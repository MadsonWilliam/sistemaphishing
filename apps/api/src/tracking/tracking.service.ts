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
import { classifyAccess } from './bot-detection';

// GIF transparente de 1x1 para o pixel de abertura.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

interface ReqMeta {
  ip?: string;
  userAgent?: string;
}

type ConfirmType = 'click' | 'attachment' | 'report';

const CONFIRM_MAP: Record<
  ConfirmType,
  { field: keyof CampaignTarget; type: TrackingEventType }
> = {
  click: { field: 'clickedAt', type: TrackingEventType.CLICKED },
  attachment: { field: 'clickedAt', type: TrackingEventType.ATTACHMENT_OPENED },
  report: { field: 'reportedAt', type: TrackingEventType.REPORTED },
};

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

  // Injeta o beacon de confirmação: só um navegador real que executa JS conta
  // como interação humana. Scanners de e-mail fazem GET mas não rodam isto.
  private withBeacon(html: string, token: string, type: ConfirmType): string {
    const script = `<script>try{var b=JSON.stringify({type:'${type}'});if(navigator.sendBeacon){navigator.sendBeacon('/t/confirm/${token}',new Blob([b],{type:'application/json'}));}else{fetch('/t/confirm/${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:b,keepalive:true});}}catch(e){}</script>`;
    return html.includes('</body>')
      ? html.replace('</body>', script + '</body>')
      : html + script;
  }

  // Registra o acesso bruto (auditoria) — NÃO marca o funil. A marcação humana
  // vem do beacon (confirmAccess).
  private async recordRaw(
    target: CampaignTarget,
    type: TrackingEventType,
    meta: ReqMeta,
  ) {
    const verdict = classifyAccess(meta.userAgent, target.sentAt);
    await this.prisma.trackingEvent.create({
      data: {
        targetId: target.id,
        type,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 300),
        isBot: verdict.isBot,
        botReason: verdict.reason ?? 'acesso-bruto',
      },
    });
  }

  async trackOpen(token: string, meta: ReqMeta): Promise<Buffer> {
    const target = await this.findTarget(token);
    if (target) {
      // Abertura via pixel é inerentemente ruidosa (proxies) — registra, mas
      // marca openedAt só se não parecer bot.
      const verdict = classifyAccess(meta.userAgent, target.sentAt);
      await this.prisma.trackingEvent.create({
        data: {
          targetId: target.id,
          type: TrackingEventType.OPENED,
          ip: meta.ip?.slice(0, 64),
          userAgent: meta.userAgent?.slice(0, 300),
          isBot: verdict.isBot,
          botReason: verdict.reason ?? null,
        },
      });
      if (!verdict.isBot && !target.openedAt) {
        await this.prisma.campaignTarget.update({
          where: { id: target.id },
          data: { openedAt: new Date() },
        });
      }
    }
    return this.pixel;
  }

  // Clique/anexo: registra o GET (bruto) e serve a landing com beacon.
  // O clique só conta no funil quando o beacon confirmar (navegador real).
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

    // Campanha com redirect não tem landing nossa → não há como rodar o beacon.
    // Nesse caso, contamos o clique no GET (com filtro de bot por UA).
    if (c.landingRedirectUrl) {
      await this.setFlagIfHuman(target, confirmType, meta);
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

  // Reporte: registra o GET (bruto) e serve a página com beacon. Só conta
  // reporte quando o beacon confirmar — evita scanner inflar o reporte.
  async trackReport(token: string, meta: ReqMeta): Promise<string> {
    const target = await this.findTarget(token);
    if (!target) return blankPage();
    await this.recordRaw(target, TrackingEventType.REPORTED, meta);
    return this.withBeacon(reportedPage(), token, 'report');
  }

  // Submissão do formulário falso: é um POST de formulário — humano.
  // Os valores enviados são IGNORADOS de propósito.
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
    const data: Record<string, Date> = {};
    if (!target.submittedAt) data.submittedAt = new Date();
    if (!target.clickedAt) data.clickedAt = new Date();
    if (Object.keys(data).length) {
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data,
      });
    }
    return educationalPage({ microTraining: target.campaign.microTraining });
  }

  private async setFlagIfHuman(
    target: CampaignTarget,
    type: ConfirmType,
    meta: ReqMeta,
  ) {
    // Na confirmação, o sinal humano é rodar JS; consideramos só o UA (sem a
    // regra de "rápido demais", que poderia barrar um humano ágil).
    const verdict = classifyAccess(meta.userAgent, null);
    const { field } = CONFIRM_MAP[type];
    if (!verdict.isBot && !target[field]) {
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data: { [field]: new Date() },
      });
    }
  }

  // Beacon de confirmação humana (chamado por JS da landing).
  async confirmAccess(token: string, type: ConfirmType, meta: ReqMeta) {
    const target = await this.findTarget(token);
    if (!target || !CONFIRM_MAP[type]) return;
    const verdict = classifyAccess(meta.userAgent, null);
    const { field, type: eventType } = CONFIRM_MAP[type];
    await this.prisma.trackingEvent.create({
      data: {
        targetId: target.id,
        type: eventType,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 300),
        isBot: verdict.isBot,
        botReason: verdict.isBot ? verdict.reason : 'confirmado-humano',
      },
    });
    if (!verdict.isBot && !target[field]) {
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data: { [field]: new Date() },
      });
    }
  }
}
