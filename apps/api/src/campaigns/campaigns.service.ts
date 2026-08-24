import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignStatus, Prisma, RecurrenceRule } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService, OutboxItem } from '../outbox/outbox.service';
import { CreateCampaignDto, SendCampaignDto } from './dto/campaign.dto';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Caminho crível do link por setor (o que a vítima vê no hover). Precisa estar
// na lista branca do PhishLinkController + exclusões do main.ts/app.module.
const CLICK_SLUG: Record<string, string> = {
  FINANCEIRO: 'fatura',
  CONTABILIDADE: 'fatura',
  COMPRAS: 'fatura',
  RH: 'portal',
  TI: 'acesso',
  JURIDICO: 'documento',
  ADMINISTRATIVO: 'documento',
  DIRETORIA: 'documento',
  LOGISTICA: 'acesso',
  GERAL: 'acesso',
};
const clickSlugFor = (sector?: string | null): string =>
  (sector && CLICK_SLUG[sector]) || 'acesso';
// Abertura de "anexo": caminho de documento (marca ?a=1 = anexo no tracking).
const ATTACH_SLUG = 'documento';

// Segmentos fake de contexto por setor — deixam o link do hover mais realista
// (ex.: /fatura/2via/boleto/NF-8842?id=<token>). O token vai no ?id=.
const FAKE_CTX: Record<string, string> = {
  FINANCEIRO: '2via/boleto',
  CONTABILIDADE: '2via/nota-fiscal',
  COMPRAS: 'pedido/renovacao',
  RH: 'colaborador/atualizacao',
  TI: 'verificacao/seguranca',
  JURIDICO: 'processo/intimacao',
  ADMINISTRATIVO: 'documento/comunicado',
  DIRETORIA: 'ata/aprovacao',
  LOGISTICA: 'entrega/rastreio',
  GERAL: 'acesso/verificacao',
};
const fakeCtxFor = (sector?: string | null): string =>
  (sector && FAKE_CTX[sector]) || 'acesso/verificacao';
// Referência fake (nº de documento) por alvo, p/ o link parecer único e real.
const fakeRef = (): string =>
  `${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;

// Domínio (parte após o @) do e-mail do destinatário.
const emailDomainOf = (email: string): string => {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1) : email;
};

@Injectable()
export class CampaignsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignsService.name);
  private recTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Verifica campanhas recorrentes a cada 5 minutos.
    this.recTimer = setInterval(
      () =>
        this.runRecurring().catch((e) =>
          this.logger.error('Falha no ciclo de recorrência', e),
        ),
      5 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.recTimer) clearInterval(this.recTimer);
  }

  private token(): string {
    return randomBytes(24).toString('hex');
  }

  async create(dto: CreateCampaignDto) {
    const [company, template] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: dto.companyId } }),
      this.prisma.template.findUnique({ where: { id: dto.templateId } }),
    ]);
    if (!company) throw new BadRequestException('Empresa inexistente.');
    if (!template) throw new BadRequestException('Template inexistente.');

    return this.prisma.campaign.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        templateId: dto.templateId,
        postClickBehavior: dto.postClickBehavior ?? undefined,
        showReportButton: dto.showReportButton ?? undefined,
        microTraining: dto.microTraining ?? undefined,
        landingRedirectUrl: dto.landingRedirectUrl ?? null,
        // O domínio do link agora é derivado do remetente no envio (ver send()).
        brandLogoUrl: dto.brandLogoUrl?.trim() || null,
        brandColor: dto.brandColor?.trim() || null,
        brandColor2: dto.brandColor2?.trim() || null,
        recurrence: dto.recurrence ?? undefined,
        dripWindowSeconds: dto.dripWindowSeconds ?? undefined,
        dripJitterSeconds: dto.dripJitterSeconds ?? undefined,
        scheduledStartAt: dto.scheduledStartAt
          ? new Date(dto.scheduledStartAt)
          : null,
        targets: {
          create: dto.recipients.map((r) => ({
            token: this.token(),
            toEmail: r.email.toLowerCase().trim(),
            toName: r.name ?? null,
            department: r.department ?? null,
          })),
        },
      },
      include: { _count: { select: { targets: true } } },
    });
  }

  // scopeCompanyId: quando presente (admin do cliente), limita à empresa dele.
  findAll(scopeCompanyId?: string) {
    return this.prisma.campaign.findMany({
      where: scopeCompanyId ? { companyId: scopeCompanyId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { name: true, sector: true } },
        company: { select: { name: true } },
        _count: { select: { targets: true } },
      },
    });
  }

  async findOne(id: string, scopeCompanyId?: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        template: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!campaign || (scopeCompanyId && campaign.companyId !== scopeCompanyId)) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    return campaign;
  }

  // Alvos com status por destinatário (visão operacional/QA).
  async listTargets(id: string, scopeCompanyId?: string) {
    await this.findOne(id, scopeCompanyId);
    return this.prisma.campaignTarget.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        toEmail: true,
        toName: true,
        department: true,
        token: true,
        senderIdentityId: true,
        sentAt: true,
        openedAt: true,
        clickedAt: true,
        submittedAt: true,
        reportedAt: true,
      },
    });
  }

  // Auditoria de eventos brutos (ver UA/bot de cada acesso) — transparência.
  async listEvents(id: string, scopeCompanyId?: string) {
    await this.findOne(id, scopeCompanyId);
    return this.prisma.trackingEvent.findMany({
      where: { target: { campaignId: id } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        type: true,
        isBot: true,
        botReason: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        target: { select: { toEmail: true } },
      },
    });
  }

  // Funil de conversão + recorte por setor (base da dashboard/relatório).
  async getStats(id: string, scopeCompanyId?: string) {
    await this.findOne(id, scopeCompanyId);
    const base = { campaignId: id };
    const [total, sent, opened, clicked, submitted, reported] =
      await Promise.all([
        this.prisma.campaignTarget.count({ where: base }),
        this.prisma.campaignTarget.count({
          where: { ...base, sentAt: { not: null } },
        }),
        this.prisma.campaignTarget.count({
          where: { ...base, openedAt: { not: null } },
        }),
        this.prisma.campaignTarget.count({
          where: { ...base, clickedAt: { not: null } },
        }),
        this.prisma.campaignTarget.count({
          where: { ...base, submittedAt: { not: null } },
        }),
        this.prisma.campaignTarget.count({
          where: { ...base, reportedAt: { not: null } },
        }),
      ]);

    const deptTotals = await this.prisma.campaignTarget.groupBy({
      by: ['department'],
      where: base,
      _count: { _all: true },
    });
    const deptClicked = await this.prisma.campaignTarget.groupBy({
      by: ['department'],
      where: { ...base, clickedAt: { not: null } },
      _count: { _all: true },
    });
    const clickedMap = new Map(
      deptClicked.map((d) => [d.department ?? '—', d._count._all]),
    );
    const byDepartment = deptTotals.map((d) => {
      const label = d.department ?? '—';
      const totalDept = d._count._all;
      const clickedDept = clickedMap.get(label) ?? 0;
      return {
        department: label,
        total: totalDept,
        clicked: clickedDept,
        clickRate: totalDept ? +((clickedDept / totalDept) * 100).toFixed(1) : 0,
      };
    });

    // Transparência: acessos automáticos (proxy/scanner) filtrados do funil.
    const botEvents = await this.prisma.trackingEvent.groupBy({
      by: ['type'],
      where: { isBot: true, target: { campaignId: id } },
      _count: { _all: true },
    });
    const automatedFiltered = botEvents.reduce<Record<string, number>>(
      (acc, e) => {
        acc[e.type] = e._count._all;
        return acc;
      },
      {},
    );

    const rate = (n: number) => (total ? +((n / total) * 100).toFixed(1) : 0);
    return {
      funnel: { total, sent, opened, clicked, submitted, reported },
      automatedFiltered,
      rates: {
        openRate: rate(opened),
        clickRate: rate(clicked),
        submitRate: rate(submitted),
        reportRate: rate(reported),
        compromiseRate: rate(clicked), // % que "caiu" (clicou/abriu anexo)
      },
      byDepartment: byDepartment.sort((a, b) => b.clickRate - a.clickRate),
    };
  }

  private buildSubject(
    subject: string,
    name: string,
    company: string,
    email: string,
  ): string {
    return subject
      .replace(/{{\s*(nome|name)\s*}}/gi, name)
      .replace(/{{\s*(empresa|company)\s*}}/gi, company)
      .replace(/{{\s*(email|e-mail)\s*}}/gi, email)
      .replace(/{{\s*(dominio|domínio|domain)\s*}}/gi, emailDomainOf(email));
  }

  // Normaliza o domínio de link informado (aceita "host" ou "https://host").
  // Sem domínio próprio, usa a BASE DE RASTREIO (nunca o portal) — cai no
  // APP_BASE_URL só se TRACKING_BASE_URL não estiver configurada.
  private linkBase(linkDomain?: string | null): string {
    if (!linkDomain) {
      return (
        this.config.get<string>('TRACKING_BASE_URL') ??
        this.config.getOrThrow<string>('APP_BASE_URL')
      );
    }
    const host = linkDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return `https://${host}`;
  }

  private buildHtml(
    templateHtml: string,
    p: {
      name: string;
      company: string;
      email: string;
      token: string;
      showReport: boolean;
      baseUrl: string;
      sector?: string | null;
    },
  ): string {
    const baseUrl = p.baseUrl;
    // Caminhos fake ricos por setor (ex.: /fatura/2via/boleto/2024-8842?id=<token>)
    // — muito mais convincentes no hover. O token vai no ?id=; o clique é
    // rastreado igual (ver PhishLinkController, que lê o ?id).
    const slug = clickSlugFor(p.sector);
    const ctx = fakeCtxFor(p.sector);
    const ref = fakeRef();
    const link = `${baseUrl}/${slug}/${ctx}/${ref}?id=${p.token}`;
    const attachment = `${baseUrl}/${ATTACH_SLUG}/anexo/${ref}?id=${p.token}&a=1`;
    const qrImg = `<img src="${baseUrl}/t/q/${p.token}.png" width="200" height="200" alt="Escaneie para acessar" style="display:block;margin:8px 0">`;
    let html = templateHtml
      .replace(/{{\s*(nome|name)\s*}}/gi, escapeHtml(p.name))
      .replace(/{{\s*(empresa|company)\s*}}/gi, escapeHtml(p.company))
      .replace(/{{\s*(email|e-mail)\s*}}/gi, escapeHtml(p.email))
      .replace(/{{\s*(dominio|domínio|domain)\s*}}/gi, escapeHtml(emailDomainOf(p.email)))
      .replace(/{{\s*link\s*}}/gi, link)
      .replace(/{{\s*(anexo|attachment)\s*}}/gi, attachment)
      .replace(/{{\s*qr\s*}}/gi, qrImg);

    // Link-canário (honeypot): invisível ao humano, mas scanners que varrem
    // todos os links o buscam — delatando a varredura automática.
    html += `<a href="${baseUrl}/t/x/${p.token}" style="display:none;font-size:1px;color:transparent" aria-hidden="true">.</a>`;

    // Pixel de abertura.
    html += `<img src="${baseUrl}/t/o/${p.token}.png" width="1" height="1" alt="" style="display:none">`;

    // Rodapé opcional de "reportar" (só quando habilitado na campanha).
    if (p.showReport) {
      html += `<p style="font-size:12px;color:#9aa0a6;margin-top:20px">Não reconhece este e-mail? <a href="${baseUrl}/t/r/${p.token}">Reportar como phishing</a>.</p>`;
    }
    return html;
  }

  // scopeCompanyId: quando presente (admin do cliente), só dispara campanha da
  // própria empresa — outra empresa responde 404.
  async send(id: string, dto: SendCampaignDto, scopeCompanyId?: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { template: true, company: { select: { name: true } } },
    });
    if (!campaign || (scopeCompanyId && campaign.companyId !== scopeCompanyId)) {
      throw new NotFoundException('Campanha não encontrada.');
    }
    if (
      campaign.status !== CampaignStatus.DRAFT &&
      campaign.status !== CampaignStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `Campanha não pode ser enviada no status ${campaign.status}.`,
      );
    }

    const identities = await this.prisma.senderIdentity.findMany({
      where: { id: { in: dto.senderIdentityIds }, isActive: true },
      include: { domain: true },
    });
    if (identities.length === 0) {
      throw new BadRequestException(
        'Nenhuma identidade de remetente válida informada.',
      );
    }

    const targets = await this.prisma.campaignTarget.findMany({
      where: { campaignId: id },
    });
    if (targets.length === 0) {
      throw new BadRequestException('Campanha sem destinatários.');
    }

    const items: OutboxItem[] = [];
    await Promise.all(
      targets.map((t, idx) => {
        const identity = identities[idx % identities.length];
        // Domínio do link = domínio do PRÓPRIO remetente deste alvo (casam →
        // máximo de convincência). Ex.: noreply@contabilmaisbrasil.com.br →
        // link contabilmaisbrasil.com.br/fatura/<token>.
        const base = this.linkBase(identity.domain.domain);
        const name = t.toName ?? 'colaborador';
        items.push({
          senderIdentityId: identity.id,
          companyId: campaign.companyId,
          toEmail: t.toEmail,
          toName: t.toName,
          subject: this.buildSubject(
            campaign.template.subject,
            name,
            campaign.company.name,
            t.toEmail,
          ),
          html: this.buildHtml(campaign.template.html, {
            name,
            company: campaign.company.name,
            email: t.toEmail,
            token: t.token,
            showReport: campaign.showReportButton,
            baseUrl: base,
            sector: campaign.template.sector,
          }),
          campaignId: campaign.id,
          campaignTargetId: t.id,
        });
        // Registra qual remetente foi atribuído a este alvo (rotação).
        return this.prisma.campaignTarget.update({
          where: { id: t.id },
          data: { senderIdentityId: identity.id },
        });
      }),
    );

    const startAt = campaign.scheduledStartAt ?? new Date();
    const result = await this.outbox.enqueueDrip(items, {
      startAt,
      windowSeconds: campaign.dripWindowSeconds,
      jitterSeconds: campaign.dripJitterSeconds,
    });

    const recurring =
      campaign.recurrence && campaign.recurrence !== RecurrenceRule.NONE;
    await this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.SENDING,
        scheduledStartAt: startAt,
        ...(recurring
          ? {
              nextRunAt: this.addInterval(new Date(), campaign.recurrence),
              senderIds: dto.senderIdentityIds,
            }
          : {}),
      },
    });

    return { enqueued: result.enqueued, status: CampaignStatus.SENDING };
  }

  private addInterval(from: Date, rule: RecurrenceRule): Date {
    const d = new Date(from);
    if (rule === RecurrenceRule.WEEKLY) d.setDate(d.getDate() + 7);
    else if (rule === RecurrenceRule.MONTHLY) d.setMonth(d.getMonth() + 1);
    else if (rule === RecurrenceRule.QUARTERLY) d.setMonth(d.getMonth() + 3);
    return d;
  }

  // Executa campanhas recorrentes vencidas: clona (novos alvos/tokens) e dispara.
  async runRecurring(): Promise<void> {
    const due = await this.prisma.campaign.findMany({
      where: {
        recurrence: { not: RecurrenceRule.NONE },
        nextRunAt: { lte: new Date() },
        status: { in: [CampaignStatus.SENDING, CampaignStatus.SENT] },
      },
      include: { targets: true },
    });
    for (const parent of due) {
      try {
        await this.cloneAndSend(parent);
        await this.prisma.campaign.update({
          where: { id: parent.id },
          data: { nextRunAt: this.addInterval(new Date(), parent.recurrence) },
        });
      } catch (e) {
        this.logger?.error?.('Falha em campanha recorrente', e as Error);
      }
    }
  }

  private async cloneAndSend(
    parent: Prisma.CampaignGetPayload<{ include: { targets: true } }>,
  ) {
    if (!parent.senderIds?.length || !parent.targets.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const child = await this.prisma.campaign.create({
      data: {
        companyId: parent.companyId,
        name: `${parent.name} · ${stamp}`,
        templateId: parent.templateId,
        postClickBehavior: parent.postClickBehavior,
        showReportButton: parent.showReportButton,
        microTraining: parent.microTraining,
        landingRedirectUrl: parent.landingRedirectUrl,
        linkDomain: parent.linkDomain,
        brandLogoUrl: parent.brandLogoUrl,
        brandColor: parent.brandColor,
        trainingUrl: parent.trainingUrl,
        dripWindowSeconds: parent.dripWindowSeconds,
        dripJitterSeconds: parent.dripJitterSeconds,
        recurringParentId: parent.id,
        targets: {
          create: parent.targets.map((t) => ({
            token: this.token(),
            toEmail: t.toEmail,
            toName: t.toName,
            department: t.department,
          })),
        },
      },
    });
    await this.send(child.id, { senderIdentityIds: parent.senderIds });
  }

  // Gera (ou reaproveita) o token do relatório público read-only.
  async share(id: string) {
    await this.findOne(id);
    const existing = await this.prisma.campaign.findUnique({
      where: { id },
      select: { reportToken: true },
    });
    let token = existing?.reportToken ?? null;
    if (!token) {
      token = randomBytes(18).toString('hex');
      await this.prisma.campaign.update({
        where: { id },
        data: { reportToken: token },
      });
    }
    const base = this.config.getOrThrow<string>('APP_BASE_URL');
    return { token, url: `${base}/r/${token}` };
  }

  async unshare(id: string) {
    await this.findOne(id);
    await this.prisma.campaign.update({
      where: { id },
      data: { reportToken: null },
    });
    return { revoked: true };
  }

  async cancel(id: string) {
    await this.findOne(id);
    // Cancela os e-mails ainda pendentes desta campanha.
    await this.prisma.emailOutbox.updateMany({
      where: { campaignId: id, status: 'PENDING' },
      data: { status: 'CANCELED' },
    });
    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELED },
    });
    return { canceled: true };
  }

  // Remove a campanha e tudo dela (alvos→eventos por cascade; fila associada).
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.emailOutbox.deleteMany({ where: { campaignId: id } }),
      this.prisma.campaign.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }
}
