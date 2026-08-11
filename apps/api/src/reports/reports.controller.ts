import { Controller, Get, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';

@Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
@Controller('campaigns')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Relatório executivo com boas práticas automáticas + evolução.
  // Admin do cliente vê só relatórios da própria empresa.
  @Get(':id/report')
  report(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const scope =
      user.role === Role.SUPER_ADMIN ? undefined : user.companyId ?? '__none__';
    return this.reports.buildReport(id, scope);
  }
}
