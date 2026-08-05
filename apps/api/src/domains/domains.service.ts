import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DomainStatus, SendingDomain } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { SmtpTransportService } from '../mail/smtp-transport.service';
import { SmtpConfig } from '../mail/mail.types';
import {
  CreateSendingDomainDto,
  CreateSenderIdentityDto,
  SendTestEmailDto,
} from './dto/domain.dto';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly smtp: SmtpTransportService,
  ) {}

  // Monta a config SMTP (com senha decifrada) — uso interno apenas.
  smtpConfigOf(domain: SendingDomain): SmtpConfig {
    return {
      host: domain.smtpHost,
      port: domain.smtpPort,
      secure: domain.smtpSecure,
      username: domain.smtpUsername,
      password: this.crypto.decrypt(domain.smtpPasswordEnc),
    };
  }

  async create(dto: CreateSendingDomainDto) {
    const created = await this.prisma.sendingDomain.create({
      data: {
        domain: dto.domain.toLowerCase().trim(),
        smtpHost: dto.smtpHost.trim(),
        smtpPort: dto.smtpPort,
        smtpSecure: dto.smtpSecure,
        smtpUsername: dto.smtpUsername.trim(),
        smtpPasswordEnc: this.crypto.encrypt(dto.smtpPassword),
        companyId: dto.companyId ?? null,
      },
    });
    return this.toPublic(created);
  }

  async findAll(companyId?: string | null) {
    const where =
      companyId === undefined ? {} : { companyId: companyId ?? null };
    const domains = await this.prisma.sendingDomain.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        identities: { orderBy: { localPart: 'asc' } },
        _count: { select: { identities: true } },
      },
    });
    return domains.map((d) => this.toPublic(d));
  }

  async findOneOrThrow(id: string) {
    const domain = await this.prisma.sendingDomain.findUnique({
      where: { id },
    });
    if (!domain) {
      throw new NotFoundException('Domínio de envio não encontrado.');
    }
    return domain;
  }

  // Testa a conexão SMTP e atualiza o status do domínio.
  async verify(id: string) {
    const domain = await this.findOneOrThrow(id);
    try {
      await this.smtp.verify(this.smtpConfigOf(domain));
      const updated = await this.prisma.sendingDomain.update({
        where: { id },
        data: {
          status: DomainStatus.VERIFIED,
          lastTestedAt: new Date(),
          lastTestError: null,
        },
      });
      return this.toPublic(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha desconhecida';
      const updated = await this.prisma.sendingDomain.update({
        where: { id },
        data: {
          status: DomainStatus.FAILED,
          lastTestedAt: new Date(),
          lastTestError: message.slice(0, 500),
        },
      });
      return this.toPublic(updated);
    }
  }

  async addIdentity(domainId: string, dto: CreateSenderIdentityDto) {
    await this.findOneOrThrow(domainId);
    return this.prisma.senderIdentity.create({
      data: {
        domainId,
        localPart: dto.localPart.toLowerCase().trim(),
        displayName: dto.displayName.trim(),
      },
    });
  }

  async listIdentities(domainId: string) {
    await this.findOneOrThrow(domainId);
    return this.prisma.senderIdentity.findMany({
      where: { domainId },
      orderBy: { localPart: 'asc' },
    });
  }

  // Envia um e-mail de teste imediato (sem passar pelo outbox) para validar o SMTP.
  async sendTest(domainId: string, dto: SendTestEmailDto) {
    const domain = await this.findOneOrThrow(domainId);
    const identity = await this.prisma.senderIdentity.findFirst({
      where: { id: dto.senderIdentityId, domainId },
    });
    if (!identity) {
      throw new BadRequestException(
        'Identidade de remetente não pertence a este domínio.',
      );
    }
    const fromEmail = `${identity.localPart}@${domain.domain}`;
    try {
      const result = await this.smtp.send(this.smtpConfigOf(domain), {
        fromEmail,
        fromName: identity.displayName,
        toEmail: dto.toEmail,
        subject: 'Teste de configuração — plataforma de simulação',
        html: `<p>Este é um e-mail de teste enviado de <strong>${fromEmail}</strong>.</p><p>Se você recebeu, o transporte SMTP deste domínio está funcionando.</p>`,
        text: `Teste de configuração SMTP a partir de ${fromEmail}.`,
      });
      return { ok: true, messageId: result.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha desconhecida';
      throw new BadRequestException(`Falha no envio de teste: ${message}`);
    }
  }

  // Nunca expõe a senha (nem cifrada) na resposta da API.
  private toPublic<T extends SendingDomain>(d: T) {
    const { smtpPasswordEnc, ...rest } = d as SendingDomain &
      Record<string, unknown>;
    return rest;
  }
}
