import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignStatus } from '@prisma/client';
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

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
  ) {}

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

  findAll() {
    return this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { name: true, sector: true } },
        company: { select: { name: true } },
        _count: { select: { targets: true } },
      },
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        template: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return campaign;
  }

  // Alvos com status por destinatário (visão operacional/QA).
  async listTargets(id: string) {
    await this.findOne(id);
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
  async listEvents(id: string) {
    await this.findOne(id);
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
  async getStats(id: string) {
    await this.findOne(id);
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

  private buildSubject(subject: string, name: string, company: string): string {
    return subject
      .replace(/{{\s*(nome|name)\s*}}/gi, name)
      .replace(/{{\s*(empresa|company)\s*}}/gi, company);
  }

  private buildHtml(
    templateHtml: string,
    p: { name: string; company: string; token: string; showReport: boolean },
  ): string {
    const baseUrl = this.config.getOrThrow<string>('APP_BASE_URL');
    const link = `${baseUrl}/t/c/${p.token}`;
    const attachment = `${baseUrl}/t/a/${p.token}`;
    let html = templateHtml
      .replace(/{{\s*(nome|name)\s*}}/gi, escapeHtml(p.name))
      .replace(/{{\s*(empresa|company)\s*}}/gi, escapeHtml(p.company))
      .replace(/{{\s*link\s*}}/gi, link)
      .replace(/{{\s*(anexo|attachment)\s*}}/gi, attachment);

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

  async send(id: string, dto: SendCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { template: true, company: { select: { name: true } } },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
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
          ),
          html: this.buildHtml(campaign.template.html, {
            name,
            company: campaign.company.name,
            token: t.token,
            showReport: campaign.showReportButton,
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

    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.SENDING, scheduledStartAt: startAt },
    });

    return { enqueued: result.enqueued, status: CampaignStatus.SENDING };
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
