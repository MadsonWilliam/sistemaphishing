import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus, DomainStatus, Lead } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { SmtpTransportService } from '../mail/smtp-transport.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
import {
  authorizationTermHtml,
  authorizationTermPdf,
  authorizationTermText,
} from './leads.term';
import {
  proposalHtml,
  proposalText,
  requestContactsHtml,
  requestContactsText,
} from './leads.emails';
import { SendMailInput } from '../mail/mail.types';

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
    private readonly campaigns: CampaignsService,
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
        cnpj: dto.cnpj?.trim() || null,
        employees: dto.employees?.trim() || null,
        message: dto.message?.trim() || null,
        // Registra o momento do aceite dos termos (prova de consentimento LGPD).
        consentAt: new Date(),
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

  // Mini-CRM: o operador avança o estágio e/ou registra anotações.
  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const exists = await this.prisma.lead.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Lead não encontrado.');
    }
    return this.prisma.lead.update({
      where: { id },
      data: {
        stage: dto.stage ?? undefined,
        // Permite limpar as anotações enviando string vazia.
        notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
        proposalPlan:
          dto.proposalPlan === undefined ? undefined : dto.proposalPlan.trim() || null,
        proposalValue:
          dto.proposalValue === undefined ? undefined : dto.proposalValue.trim() || null,
        proposalConditions:
          dto.proposalConditions === undefined
            ? undefined
            : dto.proposalConditions.trim() || null,
        meetingAt:
          dto.meetingAt === undefined
            ? undefined
            : dto.meetingAt
              ? new Date(dto.meetingAt)
              : null,
      },
    });
  }

  // Arquiva / desarquiva o lead (arquivados ficam ocultos por padrão no Kanban).
  async setArchived(id: string, archived: boolean): Promise<Lead> {
    const exists = await this.prisma.lead.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Lead não encontrado.');
    return this.prisma.lead.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
  }

  // Exclui o lead permanentemente.
  async remove(id: string): Promise<{ deleted: true }> {
    const exists = await this.prisma.lead.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Lead não encontrado.');
    await this.prisma.lead.delete({ where: { id } });
    return { deleted: true };
  }

  // Envia o TERMO DE AUTORIZAÇÃO ao cliente (aceite por resposta ao e-mail).
  // Registra termSentAt. O operador move o estágio manualmente quando o cliente
  // responder "De acordo".
  async sendTerm(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException('Lead não encontrado.');
    }
    const domain = await this.pickSendingDomain();
    if (!domain) {
      throw new BadRequestException(
        'Nenhum domínio de envio verificado para enviar o termo.',
      );
    }
    const cfg = this.domains.smtpConfigOf(domain);
    const identity = await this.prisma.senderIdentity.findFirst({
      where: { domainId: domain.id },
      orderBy: { localPart: 'asc' },
    });
    const fromEmail = identity
      ? `${identity.localPart}@${domain.domain}`
      : `no-reply@${domain.domain}`;
    try {
      const pdf = await authorizationTermPdf(lead);
      await this.smtp.send(cfg, {
        fromEmail,
        fromName: 'Nexium Solutions',
        toEmail: lead.email,
        toName: lead.name,
        subject: `Autorização de simulação de phishing — ${lead.company}`,
        html: authorizationTermHtml(lead),
        text: authorizationTermText(lead),
        // A resposta do cliente (aceite) vai para o contato comercial.
        headers: { 'Reply-To': 'contato@nexiumsolutions.com.br' },
        attachments: [
          {
            filename: 'Termo-de-Autorizacao-NexGuard.pdf',
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'falha no envio';
      throw new BadRequestException(`Não foi possível enviar o termo: ${message}`);
    }
    return this.prisma.lead.update({
      where: { id },
      data: { termSentAt: new Date() },
    });
  }

  // Cria a Empresa (tenant) a partir do lead — sem login/portal por ora. Isso
  // habilita rodar campanhas para esse cliente. Idempotente por lead.
  async createCompany(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead não encontrado.');
    if (lead.createdCompanyId) {
      const ex = await this.prisma.company.findUnique({
        where: { id: lead.createdCompanyId },
        select: { id: true },
      });
      if (ex) {
        throw new BadRequestException('Empresa já criada para este lead.');
      }
    }
    const company = await this.prisma.company.create({
      data: {
        name: lead.company,
        cnpj: lead.cnpj ?? undefined,
        status: CompanyStatus.PROSPECT,
      },
      select: { id: true },
    });
    return this.prisma.lead.update({
      where: { id },
      data: { createdCompanyId: company.id },
    });
  }

  // Envia o relatório da última campanha do cliente por e-mail (fidelização).
  async sendReport(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead não encontrado.');
    if (!lead.createdCompanyId) {
      throw new BadRequestException(
        'Crie a empresa do cliente antes (botão "Criar empresa").',
      );
    }
    const campaign = await this.prisma.campaign.findFirst({
      where: { companyId: lead.createdCompanyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });
    if (!campaign) {
      throw new BadRequestException(
        'Nenhuma campanha para este cliente ainda — rode uma campanha antes.',
      );
    }
    const { url } = await this.campaigns.share(campaign.id);

    const domain = await this.pickSendingDomain();
    if (!domain) {
      throw new BadRequestException('Nenhum domínio de envio verificado.');
    }
    const cfg = this.domains.smtpConfigOf(domain);
    const identity = await this.prisma.senderIdentity.findFirst({
      where: { domainId: domain.id },
      orderBy: { localPart: 'asc' },
    });
    const fromEmail = identity
      ? `${identity.localPart}@${domain.domain}`
      : `no-reply@${domain.domain}`;
    const nome = esc(lead.name);
    await this.smtp.send(cfg, {
      fromEmail,
      fromName: 'Nexium Solutions',
      toEmail: lead.email,
      toName: lead.name,
      subject: `Relatório da simulação de phishing — ${lead.company}`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;font-size:15px;line-height:1.6">
        <p>Olá ${nome},</p>
        <p>Concluímos a simulação de phishing de conscientização na <strong>${esc(lead.company)}</strong>.
        O relatório executivo — com taxa de comprometimento, recorte por setor e boas práticas
        recomendadas — está disponível no link abaixo:</p>
        <p style="text-align:center;margin:26px 0">
          <a href="${url}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:12px 30px;border-radius:6px;display:inline-block;font-weight:bold">Ver relatório da campanha</a>
        </p>
        <p style="font-size:13px;color:#64748b">Este relatório é confidencial. Podemos agendar uma
        conversa para revisar os resultados e o plano de evolução. Basta responder este e-mail.</p>
      </div>`,
      text: `Relatório da simulação de phishing — ${lead.company}\n\nAcesse: ${url}`,
      headers: { 'Reply-To': 'contato@nexiumsolutions.com.br' },
    });
    return this.prisma.lead.update({
      where: { id },
      data: { reportSentAt: new Date() },
    });
  }

  // Envio de e-mail ao lead a partir de um domínio verificado (Reply-To comercial).
  private async mailToLead(
    lead: Lead,
    msg: Pick<SendMailInput, 'subject' | 'html' | 'text' | 'attachments'>,
  ): Promise<void> {
    const domain = await this.pickSendingDomain();
    if (!domain) {
      throw new BadRequestException('Nenhum domínio de envio verificado.');
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
      fromName: 'Nexium Solutions',
      toEmail: lead.email,
      toName: lead.name,
      headers: { 'Reply-To': 'contato@nexiumsolutions.com.br' },
      ...msg,
    });
  }

  // ETAPA "Estrutura de Campanha": pede ao cliente a lista de quem testar.
  async requestContacts(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead não encontrado.');
    await this.mailToLead(lead, {
      subject: `Vamos configurar seu teste — ${lead.company}`,
      html: requestContactsHtml(lead),
      text: requestContactsText(lead),
    });
    return this.prisma.lead.update({
      where: { id },
      data: { contactsRequestedAt: new Date() },
    });
  }

  // ETAPA "Campanha Teste" (automação): cria a empresa (se preciso) e dispara
  // uma campanha demo (isca financeira, remetente contábil) para o e-mail do
  // PRÓPRIO cliente — ele experimenta o teste na pele. Caminho principal segue
  // manual (lista real de colaboradores).
  async demoCampaign(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead não encontrado.');

    let companyId = lead.createdCompanyId ?? null;
    if (companyId) {
      const ex = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });
      if (!ex) companyId = null;
    }
    if (!companyId) {
      const company = await this.prisma.company.create({
        data: {
          name: lead.company,
          cnpj: lead.cnpj ?? undefined,
          status: CompanyStatus.PROSPECT,
        },
        select: { id: true },
      });
      companyId = company.id;
      await this.prisma.lead.update({
        where: { id },
        data: { createdCompanyId: companyId },
      });
    }

    const template = await this.prisma.template.findFirst({
      where: { sector: 'FINANCEIRO', companyId: null },
      select: { id: true },
    });
    if (!template) {
      throw new BadRequestException('Nenhuma isca financeira disponível.');
    }
    // Remetente: prefere um domínio verificado "contábil"; senão, qualquer verificado.
    const domains = await this.prisma.sendingDomain.findMany({
      where: { status: DomainStatus.VERIFIED },
      include: { identities: { where: { isActive: true }, take: 1 } },
    });
    const withId = domains.filter((d) => d.identities.length > 0);
    const chosen =
      withId.find((d) => /contabil/i.test(d.domain)) ?? withId[0];
    if (!chosen) {
      throw new BadRequestException(
        'Nenhum remetente verificado com identidade para disparar.',
      );
    }
    const identityId = chosen.identities[0].id;

    const campaign = await this.campaigns.create({
      companyId,
      name: `Demo automática — ${lead.company}`,
      templateId: template.id,
      postClickBehavior: 'FORM',
      showReportButton: true,
      microTraining: true,
      recipients: [
        {
          email: lead.email,
          name: lead.name,
          department: 'Financeiro',
        },
      ],
    } as never);
    await this.campaigns.send(campaign.id, { senderIdentityIds: [identityId] });

    return this.prisma.lead.findUniqueOrThrow({ where: { id } });
  }

  // ETAPA "Proposta": envia o e-mail comercial com plano/valor/condições.
  async sendProposal(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead não encontrado.');
    if (!lead.proposalPlan || !lead.proposalValue) {
      throw new BadRequestException(
        'Preencha o plano e o valor da proposta antes de enviar.',
      );
    }
    await this.mailToLead(lead, {
      subject: `Proposta NexGuard — ${lead.company}`,
      html: proposalHtml(lead),
      text: proposalText(lead),
    });
    return this.prisma.lead.update({
      where: { id },
      data: { proposalSentAt: new Date() },
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
  // E-mails INTERNOS (notificação de lead, termo, proposta, relatório) saem pelo
  // domínio institucional (rsweb) — nunca pelos domínios-isca, reservados a
  // campanhas de clientes. Fallback: qualquer verificado, se o rsweb não existir.
  private async pickSendingDomain() {
    const preferred =
      this.config.get<string>('INTERNAL_SENDING_DOMAIN') ?? 'rsweb.net.br';
    const institutional = await this.prisma.sendingDomain.findFirst({
      where: { domain: preferred, status: DomainStatus.VERIFIED },
    });
    if (institutional) return institutional;
    return this.prisma.sendingDomain.findFirst({
      where: { status: DomainStatus.VERIFIED },
      orderBy: { createdAt: 'asc' },
    });
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
