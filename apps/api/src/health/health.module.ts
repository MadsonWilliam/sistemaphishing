import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { NetCheckController } from './netcheck.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, NetCheckController],
})
export class HealthModule {}
