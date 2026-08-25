import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { DomainsModule } from '../domains/domains.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [DomainsModule, CampaignsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
