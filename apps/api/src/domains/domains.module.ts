import { Module } from '@nestjs/common';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { DeliverabilityService } from './deliverability.service';

@Module({
  controllers: [DomainsController],
  providers: [DomainsService, DeliverabilityService],
  exports: [DomainsService],
})
export class DomainsModule {}
