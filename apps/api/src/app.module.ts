import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
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
    AuthModule,
    CompaniesModule,
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
