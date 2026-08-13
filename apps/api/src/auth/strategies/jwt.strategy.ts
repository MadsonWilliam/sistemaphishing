import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { ACCESS_COOKIE } from '../auth.cookies';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  companyId: string | null;
}

// Lê o access token do cookie httpOnly (JS não acessa → mitiga roubo via XSS).
const fromCookie = (req: Request): string | null =>
  (req?.cookies?.[ACCESS_COOKIE] as string | undefined) ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Cookie primeiro; header Bearer como fallback (compatibilidade/tooling).
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Revalida o usuário no banco para respeitar desativação/exclusão em tempo real.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, companyId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  }
}
