import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PublicReportController } from './public-report.controller';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [CampaignsModule],
  controllers: [ReportsController, PublicReportController],
  providers: [ReportsService],
})
export class ReportsModule {}
