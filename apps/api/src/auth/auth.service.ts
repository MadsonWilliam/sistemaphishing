import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash, randomInt } from 'crypto';
import { DomainStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { SmtpTransportService } from '../mail/smtp-transport.service';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly domains: DomainsService,
    private readonly smtp: SmtpTransportService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // TTLs para o controller montar o maxAge dos cookies.
  get ttls(): { accessTtl: number; refreshTtl: number } {
    return {
      accessTtl: this.config.getOrThrow<number>('JWT_ACCESS_TTL'),
      refreshTtl: this.config.getOrThrow<number>('JWT_REFRESH_TTL'),
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // Comparação sempre executada para reduzir timing/enumeração de usuários.
    const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(password, hash);
    if (!user || !user.isActive || !ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return user;
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.validateUser(email, password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  }

  private async issueTokens(payload: JwtPayload): Promise<TokenPair> {
    const accessTtl = this.config.getOrThrow<number>('JWT_ACCESS_TTL');
    const refreshTtl = this.config.getOrThrow<number>('JWT_REFRESH_TTL');

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });

    // Refresh token opaco (não-JWT): gerado aleatório e guardado hasheado.
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: payload.sub,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    // Detecção de reuso: um refresh JÁ revogado sendo reapresentado indica que
    // o token vazou (o legítimo já foi rotacionado). Revoga toda a sessão do
    // usuário por precaução — invalida tanto o atacante quanto o titular.
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sessão revogada por segurança.');
    }

    if (stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    // Rotação: revoga o token usado e emite um novo par.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens({
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
      companyId: stored.user.companyId,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Senha atual incorreta.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      // Invalida todas as sessões ativas ao trocar a senha.
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // "Esqueci a senha": gera um código de 6 dígitos, guarda HASHEADO (15 min) e
  // envia por e-mail. Resposta sempre { ok } — não revela se o e-mail existe.
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user && user.isActive) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetCodeHash: this.hashToken(code),
          resetCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      await this.sendResetEmail(user.email, user.name, code).catch(() => undefined);
    }
    return { ok: true };
  }

  // Valida o código e define a nova senha (e invalida sessões ativas).
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (
      !user ||
      !user.resetCodeHash ||
      !user.resetCodeExpiresAt ||
      user.resetCodeExpiresAt < new Date() ||
      this.hashToken(code.trim()) !== user.resetCodeHash
    ) {
      throw new BadRequestException('Código inválido ou expirado.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, resetCodeHash: null, resetCodeExpiresAt: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  private async sendResetEmail(
    email: string,
    name: string,
    code: string,
  ): Promise<void> {
    const internal =
      this.config.get<string>('INTERNAL_SENDING_DOMAIN') ?? 'rsweb.net.br';
    const domain =
      (await this.prisma.sendingDomain.findFirst({
        where: { domain: internal, status: DomainStatus.VERIFIED },
      })) ??
      (await this.prisma.sendingDomain.findFirst({
        where: { status: DomainStatus.VERIFIED },
      }));
    if (!domain) return;
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
      fromName: 'NexGuard',
      toEmail: email,
      toName: name,
      subject: 'Código para redefinir sua senha — NexGuard',
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <p>Olá ${name},</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta NexGuard. Use o código abaixo:</p>
        <div style="text-align:center;margin:22px 0">
          <div style="display:inline-block;background:#0f172a;color:#fff;font-size:30px;letter-spacing:8px;font-weight:700;padding:14px 26px;border-radius:12px">${code}</div>
        </div>
        <p style="color:#475569">O código expira em <strong>15 minutos</strong>. Ao inseri-lo, você define uma nova senha.</p>
        <p style="color:#94a3b8;font-size:13px">Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.</p>
      </div>`,
      text: `Seu codigo para redefinir a senha NexGuard: ${code} (valido por 15 minutos).`,
    });
  }
}
