import { Controller, Get, Header, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Public } from '../common/decorators/public.decorator';
import {
  renderReportPage,
  reportNotFoundPage,
} from './public-report.template';

// Relatório público read-only (fora do prefixo /api — ver main.ts). Sem login:
// serve para enviar a pré-análise ao prospect. Token pode ser revogado.
@Public()
@Controller('r')
export class PublicReportController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async page(@Param('token') token: string) {
    const data = await this.reports.buildReportByToken(token);
    return data ? renderReportPage(data) : reportNotFoundPage();
  }
}
