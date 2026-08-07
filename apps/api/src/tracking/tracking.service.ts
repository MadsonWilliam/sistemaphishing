import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PostClickBehavior,
  TrackingEventType,
  CampaignTarget,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  blankPage,
  educationalPage,
  fakeFormPage,
  reportedPage,
} from './landing.templates';
import { classifyAccess, isSecurityScanner } from './bot-detection';

// GIF transparente de 1x1 para o pixel de abertura.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// Pixel carregado neste tempo após o envio = prefetch de entrega, não leitura.
const OPEN_DELIVERY_WINDOW_MS = 30_000;

interface ReqMeta {
  ip?: string;
  userAgent?: string;
}

interface HumanSignals {
  dwell?: number; // ms na página
  wd?: boolean; // navigator.webdriver (headless)
  focus?: boolean; // a aba esteve focada
  interacted?: boolean; // houve mouse/scroll/toque
}

type ConfirmType = 'click' | 'attachment' | 'report';
type Milestone = 'opened' | 'clicked' | 'submitted' | 'reported';

const CONFIRM_MAP: Record<
  ConfirmType,
  { type: TrackingEventType; milestone: Milestone }
> = {
  click: { type: TrackingEventType.CLICKED, milestone: 'clicked' },
  attachment: {
    type: TrackingEventType.ATTACHMENT_OPENED,
    milestone: 'clicked',
  },
  report: { type: TrackingEventType.REPORTED, milestone: 'reported' },
};

// Tipos de ação considerados na varredura (o que um scanner abre em lote).
const SWEEP_ACTIONS: TrackingEventType[] = [
  TrackingEventType.CLICKED,
  TrackingEventType.ATTACHMENT_OPENED,
  TrackingEventType.REPORTED,
];

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  readonly pixel = PIXEL;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async findTarget(token: string) {
    return this.prisma.campaignTarget.findUnique({
      where: { token },
      include: { campaign: true },
    });
  }

  // Hierarquia do funil: um evento humano marca ele e todos os anteriores
  // (clique implica abertura; submissão implica clique+abertura; reporte
  // implica abertura). Só grava o que ainda não estava marcado.
  private funnelData(
    target: CampaignTarget,
    milestone: Milestone,
  ): Record<string, Date> {
    const now = new Date();
    const data: Record<string, Date> = {};
    const need = (f: keyof CampaignTarget) => {
      if (!target[f]) data[f as string] = now;
    };
    if (milestone === 'opened') need('openedAt');
    if (milestone === 'clicked') {
      need('openedAt');
      need('clickedAt');
    }
    if (milestone === 'submitted') {
      need('openedAt');
      need('clickedAt');
      need('submittedAt');
    }
    if (milestone === 'reported') {
      need('openedAt');
      need('reportedAt');
    }
    return data;
  }

  private async applyFunnel(target: CampaignTarget, milestone: Milestone) {
    const data = this.funnelData(target, milestone);
    if (Object.keys(data).length) {
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data,
      });
    }
  }

  // Beacon de confirmação HUMANA. Dispara na 1ª interação, OU por
  // permanência com a aba focada, OU ao sair da página — mas nunca de forma
  // instantânea (sandbox renderiza e sai em <1s). Envia sinais p/ o servidor.
  private withBeacon(html: string, token: string, type: ConfirmType): string {
    const script =
      `<script>(function(){var f=false,t0=Date.now(),it=false,fo=document.hasFocus();` +
      `function go(r){if(f)return;var d=Date.now()-t0;if(d<800)return;f=true;` +
      `var p=JSON.stringify({type:'${type}',dwell:d,wd:!!navigator.webdriver,vis:document.visibilityState,focus:fo||document.hasFocus(),interacted:it,reason:r});` +
      `try{if(navigator.sendBeacon){navigator.sendBeacon('/t/confirm/${token}',new Blob([p],{type:'application/json'}));}` +
      `else{fetch('/t/confirm/${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:p,keepalive:true});}}catch(e){}}` +
      `function on(){it=true;fo=true;go('interacao');}` +
      `['mousemove','pointerdown','pointermove','scroll','wheel','keydown','touchstart','click'].forEach(function(e){window.addEventListener(e,on,{passive:true});});` +
      `window.addEventListener('focus',function(){fo=true;});` +
      `setTimeout(function(){if(document.visibilityState==='visible'&&document.hasFocus()){fo=true;go('permanencia');}},3000);` +
      `['pagehide','beforeunload'].forEach(function(e){window.addEventListener(e,function(){go('saida');});});` +
      `document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')go('saida');});` +
      `})();</script>`;
    return html.includes('</body>')
      ? html.replace('</body>', script + '</body>')
      : html + script;
  }

  private async recordRaw(
    target: CampaignTarget,
    type: TrackingEventType,
    meta: ReqMeta,
    reason = 'acesso-bruto',
  ) {
    await this.prisma.trackingEvent.create({
      data: {
        targetId: target.id,
        type,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 300),
        isBot: true,
        botReason: reason,
      },
    });
  }

  async trackOpen(token: string, meta: ReqMeta): Promise<Buffer> {
    const target = await this.findTarget(token);
    if (target) {
      // Abertura só conta se: não for scanner de segurança, tiver UA, e não
      // for prefetch de entrega (logo após o envio). Proxy de imagem de webmail
      // (Gmail) É contado — é a abertura humana nesses provedores.
      const noUa = !meta.userAgent;
      const scanner = isSecurityScanner(meta.userAgent);
      const prefetch =
        !!target.sentAt &&
        Date.now() - target.sentAt.getTime() < OPEN_DELIVERY_WINDOW_MS;
      const isBot = noUa || scanner || prefetch;
      await this.prisma.trackingEvent.create({
        data: {
          targetId: target.id,
          type: TrackingEventType.OPENED,
          ip: meta.ip?.slice(0, 64),
          userAgent: meta.userAgent?.slice(0, 300),
          isBot,
          botReason: isBot
            ? scanner
              ? 'scanner-seguranca'
              : prefetch
                ? 'prefetch-entrega'
                : 'sem-ua'
            : null,
        },
      });
      if (!isBot) await this.applyFunnel(target, 'opened');
    }
    return this.pixel;
  }

  // Clique/anexo: registra o GET (bruto, não conta) e serve a landing com o
  // beacon. O clique só entra no funil quando o beacon confirmar humano.
  async trackClick(
    token: string,
    meta: ReqMeta,
    asAttachment = false,
  ): Promise<{ redirectUrl?: string; html: string }> {
    const target = await this.findTarget(token);
    if (!target) return { html: blankPage() };

    await this.recordRaw(
      target,
      asAttachment
        ? TrackingEventType.ATTACHMENT_OPENED
        : TrackingEventType.CLICKED,
      meta,
    );

    const c = target.campaign;
    const confirmType: ConfirmType = asAttachment ? 'attachment' : 'click';

    // Redirect não tem landing nossa → sem beacon; contamos no GET com filtro UA.
    if (c.landingRedirectUrl) {
      const v = classifyAccess(meta.userAgent, null);
      if (!v.isBot) await this.applyFunnel(target, 'clicked');
      return { redirectUrl: c.landingRedirectUrl, html: '' };
    }

    let page: string;
    switch (c.postClickBehavior) {
      case PostClickBehavior.BLANK:
        page = blankPage();
        break;
      case PostClickBehavior.FORM:
        page = fakeFormPage({
          token,
          actionBase: this.config.getOrThrow<string>('APP_BASE_URL'),
        });
        break;
      case PostClickBehavior.EDUCATIONAL:
      default:
        page = educationalPage({ microTraining: c.microTraining });
        break;
    }
    return { html: this.withBeacon(page, token, confirmType) };
  }

  // Toque no link-canário (honeypot): marca o alvo como varrido por scanner.
  async trackCanary(token: string, meta: ReqMeta): Promise<void> {
    await this.prisma.campaignTarget.updateMany({
      where: { token },
      data: { lastCanaryAt: new Date() },
    });
  }

  // Anula um alvo delatado como varredura: reverte flags de compromisso/reporte
  // e marca os eventos recentes de ação como bot.
  private async revertSweep(targetId: string, reason: string): Promise<void> {
    await this.prisma.campaignTarget.update({
      where: { id: targetId },
      data: { clickedAt: null, submittedAt: null, reportedAt: null },
    });
    await this.prisma.trackingEvent.updateMany({
      where: {
        targetId,
        isBot: false,
        type: { in: SWEEP_ACTIONS },
        createdAt: { gte: new Date(Date.now() - 8000) },
      },
      data: { isBot: true, botReason: reason },
    });
  }

  async trackReport(token: string, meta: ReqMeta): Promise<string> {
    const target = await this.findTarget(token);
    if (!target) return blankPage();
    await this.recordRaw(target, TrackingEventType.REPORTED, meta);
    return this.withBeacon(reportedPage(), token, 'report');
  }

  // Submissão do formulário falso: POST de formulário = humano. Valores IGNORADOS.
  async trackFormSubmit(token: string, meta: ReqMeta): Promise<string> {
    const target = await this.findTarget(token);
    if (!target) return blankPage();
    await this.prisma.trackingEvent.create({
      data: {
        targetId: target.id,
        type: TrackingEventType.FORM_SUBMITTED,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 300),
        isBot: false,
        botReason: 'form-submit-humano',
      },
    });
    await this.applyFunnel(target, 'submitted');
    return educationalPage({ microTraining: target.campaign.microTraining });
  }

  // Beacon de confirmação humana. Aceita se: UA de navegador, não headless
  // (webdriver), permanência mínima, e houve interação OU a aba esteve focada.
  async confirmAccess(
    token: string,
    type: ConfirmType,
    meta: ReqMeta,
    signals: HumanSignals = {},
  ) {
    const target = await this.findTarget(token);
    if (!target || !CONFIRM_MAP[type]) return;

    const uaVerdict = classifyAccess(meta.userAgent, null);
    const sinceSend = target.sentAt
      ? Date.now() - target.sentAt.getTime()
      : null;

    let isBot = uaVerdict.isBot;
    let reason: string | undefined = uaVerdict.reason;
    // Headless.
    if (!isBot && signals.wd === true) {
      isBot = true;
      reason = 'webdriver-headless';
    }
    // Renderização instantânea (sandbox).
    if (!isBot && typeof signals.dwell === 'number' && signals.dwell < 800) {
      isBot = true;
      reason = 'permanencia-curta';
    }
    // EXIGE interação real de mouse/scroll/toque — sandbox finge foco, mas não
    // gera interação. (Foco sozinho não basta.)
    if (!isBot && signals.interacted !== true) {
      isBot = true;
      reason = 'sem-interacao-real';
    }
    // Cedo demais após o envio = detonação de scanner na entrega, não humano.
    if (!isBot && sinceSend !== null && sinceSend < 45_000) {
      isBot = true;
      reason = 'cedo-demais-scanner';
    }

    const { type: eventType, milestone } = CONFIRM_MAP[type];

    // Duas camadas anti-scanner comportamentais:
    // (1) Canário: o alvo tocou o link OCULTO há pouco → é scanner varrendo.
    // (2) Varredura multi-link: já registrou ação em OUTRO link há segundos
    //     (humano faz UMA ação; scanner abre vários quase juntos).
    if (!isBot) {
      const canaryRecent =
        !!target.lastCanaryAt &&
        Date.now() - target.lastCanaryAt.getTime() < 15_000;
      const burst = canaryRecent
        ? null
        : await this.prisma.trackingEvent.findFirst({
            where: {
              targetId: target.id,
              isBot: false,
              type: { in: SWEEP_ACTIONS, not: eventType },
              createdAt: { gte: new Date(Date.now() - 8000) },
            },
          });
      if (canaryRecent || burst) {
        isBot = true;
        reason = canaryRecent ? 'link-oculto-scanner' : 'varredura-multi-link';
        await this.revertSweep(target.id, reason);
      }
    }

    // Log dos sinais para diagnóstico (visível na auditoria de eventos).
    const dbg = ` [d=${signals.dwell} f=${signals.focus} i=${signals.interacted} wd=${signals.wd} t=${sinceSend}]`;
    await this.prisma.trackingEvent.create({
      data: {
        targetId: target.id,
        type: eventType,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 300),
        isBot,
        botReason: (isBot ? reason ?? 'automatico' : 'confirmado-humano') + dbg,
      },
    });
    if (!isBot) await this.applyFunnel(target, milestone);
  }
}
