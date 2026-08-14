import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainStatus, Lead } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { SmtpTransportService } from '../mail/smtp-transport.service';
import { CreateLeadDto } from './dto/lead.dto';

// Escapa entrada do lead antes de interpolar no HTML do e-mail (anti-injeção).
const esc = (s?: string | null): string =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domains: DomainsService,
    private readonly smtp: SmtpTransportService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateLeadDto): Promise<{ ok: true }> {
    // Honeypot: bots preenchem o campo oculto. Responde ok e descarta em silêncio.
    if (dto.website && dto.website.trim()) {
      this.logger.warn('Lead descartado (honeypot preenchido).');
      return { ok: true };
    }

    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name.trim(),
        company: dto.company.trim(),
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone?.trim() || null,
        employees: dto.employees?.trim() || null,
        message: dto.message?.trim() || null,
      },
    });

    // Notifica fora do caminho crítico: se o e-mail falhar, o lead já está salvo.
    const notified = await this.notify(lead);
    if (notified) {
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { notified: true },
      });
    }
    return { ok: true };
  }

  // Lista para o operador (super admin) — nenhum lead se perde no e-mail.
  list(): Promise<Lead[]> {
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  private async notify(lead: Lead): Promise<boolean> {
    let emailed = false;
    try {
      emailed = await this.sendEmail(lead);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.error(`Falha ao notificar lead ${lead.id} por e-mail: ${message}`);
    }
    // Teams em STANDBY: só dispara se a webhook estiver configurada.
    await this.notifyTeams(lead).catch((err) =>
      this.logger.warn(`Webhook Teams falhou: ${err?.message ?? err}`),
    );
    return emailed;
  }

  private async sendEmail(lead: Lead): Promise<boolean> {
    const to = this.config.getOrThrow<string>('LEADS_TO');
    const domain = await this.pickSendingDomain();
    if (!domain) {
      this.logger.warn(
        'Nenhum domínio de envio configurado — lead salvo, mas sem e-mail.',
      );
      return false;
    }
    const cfg = this.domains.smtpConfigOf(domain);
    const identity = await this.prisma.senderIdentity.findFirst({
      where: { domainId: domain.id },
      orderBy: { localPart: 'asc' },
    });
    const fromEmail = identity
      ? `${identity.localPart}@${domain.domain}`
      : `no-reply@${domain.domain}`;

    await this.smtp.send(cfg, {
      fromEmail,
      fromName: 'NexGuard · Leads',
      toEmail: to,
      subject: `Nova solicitação de demonstração — ${lead.company}`,
      html: this.emailHtml(lead),
      text: this.emailText(lead),
      // Responder o e-mail vai direto para o prospect.
      headers: { 'Reply-To': `${lead.name} <${lead.email}>` },
    });
    return true;
  }

  // Prefere um domínio VERIFIED; se não houver, usa qualquer um cadastrado.
  private async pickSendingDomain() {
    const verified = await this.prisma.sendingDomain.findFirst({
      where: { status: DomainStatus.VERIFIED },
      orderBy: { createdAt: 'desc' },
    });
    return (
      verified ??
      (await this.prisma.sendingDomain.findFirst({
        orderBy: { createdAt: 'desc' },
      }))
    );
  }

  private emailHtml(lead: Lead): string {
    const row = (label: string, value?: string | null) =>
      value
        ? `<tr><td style="padding:6px 12px;color:#64748b">${label}</td><td style="padding:6px 12px;font-weight:600">${esc(value)}</td></tr>`
        : '';
    return `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#0f172a">
      <h2 style="margin:0 0 4px">Nova solicitação de demonstração</h2>
      <p style="margin:0 0 16px;color:#64748b">Recebida pelo site do NexGuard.</p>
      <table style="border-collapse:collapse;background:#f8fafc;border-radius:10px">
        ${row('Nome', lead.name)}
        ${row('Empresa', lead.company)}
        ${row('E-mail', lead.email)}
        ${row('Telefone', lead.phone)}
        ${row('Funcionários', lead.employees)}
        ${lead.message ? `<tr><td style="padding:6px 12px;color:#64748b;vertical-align:top">Mensagem</td><td style="padding:6px 12px;white-space:pre-wrap">${esc(lead.message)}</td></tr>` : ''}
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">Responda este e-mail para falar direto com o contato.</p>
    </div>`;
  }

  private emailText(lead: Lead): string {
    return [
      'Nova solicitação de demonstração (NexGuard)',
      `Nome: ${lead.name}`,
      `Empresa: ${lead.company}`,
      `E-mail: ${lead.email}`,
      lead.phone ? `Telefone: ${lead.phone}` : '',
      lead.employees ? `Funcionários: ${lead.employees}` : '',
      lead.message ? `Mensagem: ${lead.message}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  // Card do Teams (STANDBY): implementado, mas só envia se a webhook existir.
  private async notifyTeams(lead: Lead): Promise<void> {
    const url = this.config.get<string>('LEADS_TEAMS_WEBHOOK_URL');
    if (!url) return; // sem canal ainda — permanece em standby

    const facts = [
      { name: 'Empresa', value: lead.company },
      { name: 'Nome', value: lead.name },
      { name: 'E-mail', value: lead.email },
      lead.phone ? { name: 'Telefone', value: lead.phone } : null,
      lead.employees ? { name: 'Funcionários', value: lead.employees } : null,
    ].filter(Boolean);

    const card = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: '6366F1',
      summary: `Novo lead: ${lead.company}`,
      title: '🛡️ Nova solicitação de demonstração (NexGuard)',
      sections: [
        {
          facts,
          text: lead.message ? esc(lead.message) : '',
        },
      ],
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
  }
}
