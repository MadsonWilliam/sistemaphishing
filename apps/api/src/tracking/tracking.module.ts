import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { PhishLinkController } from './phish-link.controller';

@Module({
  controllers: [TrackingController, PhishLinkController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
