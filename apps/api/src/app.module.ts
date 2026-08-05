import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { DomainsModule } from './domains/domains.module';
import { OutboxModule } from './outbox/outbox.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    CryptoModule,
    MailModule,
    AuthModule,
    CompaniesModule,
    DomainsModule,
    OutboxModule,
    HealthModule,
  ],
  providers: [
    // Autenticação exigida por padrão em toda a API (rotas @Public são exceção).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RBAC por papel, aplicado após a autenticação.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
