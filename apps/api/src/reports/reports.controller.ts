import { Controller, Get, Header, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  renderReportPage,
  reportNotFoundPage,
} from './public-report.template';

@Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
@Controller('campaigns')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private scopeOf(user: AuthUser): string | undefined {
    return user.role === Role.SUPER_ADMIN
      ? undefined
      : user.companyId ?? '__none__';
  }

  // Relatório executivo com boas práticas automáticas + evolução.
  // Admin do cliente vê só relatórios da própria empresa.
  @Get(':id/report')
  report(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reports.buildReport(id, this.scopeOf(user));
  }

  // Mesmo relatório renderizado como PÁGINA (para imprimir/salvar em PDF pelo
  // navegador). Escopado igual ao JSON. Abre em nova aba a partir do Dashboard.
  @Get(':id/report/view')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async view(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const data = await this.reports.buildReport(id, this.scopeOf(user));
    return data ? renderReportPage(data) : reportNotFoundPage();
  }
}
