import { Controller, Get, Param } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsService } from './reports.service';
import { Roles } from '../common/decorators/roles.decorator';

@Roles(Role.SUPER_ADMIN)
@Controller('campaigns')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Relatório executivo com boas práticas automáticas + evolução.
  @Get(':id/report')
  report(@Param('id') id: string) {
    return this.reports.buildReport(id);
  }
}
