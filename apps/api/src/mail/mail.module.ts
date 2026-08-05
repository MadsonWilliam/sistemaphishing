import { Global, Module } from '@nestjs/common';
import { SmtpTransportService } from './smtp-transport.service';

@Global()
@Module({
  providers: [SmtpTransportService],
  exports: [SmtpTransportService],
})
export class MailModule {}
