import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { DomainsModule } from '../domains/domains.module';

@Module({
  imports: [DomainsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
