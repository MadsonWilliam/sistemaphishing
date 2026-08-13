import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';
import { existsSync } from 'fs';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { DomainsModule } from './domains/domains.module';
import { OutboxModule } from './outbox/outbox.module';
import { TemplatesModule } from './templates/templates.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ReportsModule } from './reports/reports.module';
import { TrackingModule } from './tracking/tracking.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Rate limiting global: 120 req/min por IP (endpoints sensíveis têm limites
    // menores; rotas públicas de rastreio são isentas).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // Serve o SPA (React) na mesma origem, exceto /api e /t (controllers).
    // Só registra se o build do front existir (em dev usamos o Vite separado).
    ...(existsSync(join(__dirname, '..', '..', 'web', 'dist'))
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', '..', 'web', 'dist'),
            exclude: ['/api', '/api/(.*)', '/t', '/t/(.*)', '/r', '/r/(.*)'],
          }),
        ]
      : []),
    PrismaModule,
    CryptoModule,
    MailModule,
    AuthModule,
    CompaniesModule,
    DomainsModule,
    OutboxModule,
    TemplatesModule,
    CampaignsModule,
    ReportsModule,
    TrackingModule,
    HealthModule,
  ],
  providers: [
    // Rate limiting primeiro (barra abuso antes mesmo da autenticação).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Autenticação exigida por padrão em toda a API (rotas @Public são exceção).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RBAC por papel, aplicado após a autenticação.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
