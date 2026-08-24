import {
  Controller,
  Get,
  Headers,
  Ip,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { TrackingService } from './tracking.service';
import { Public } from '../common/decorators/public.decorator';

// Entradas de phishing com CAMINHO FAKE RICO (ex.: /fatura/2via/boleto/2024-8842
// ?id=<token>) — o que a vítima vê no hover fica muito realista. O token vai no
// ?id= e o caminho após o slug é livre (curinga). Rotas na raiz, fora do /api e
// do SPA (exclusões em main.ts e app.module.ts). ?a=1 = abertura de anexo.
@SkipThrottle()
@Public()
@Controller()
export class PhishLinkController {
  constructor(private readonly tracking: TrackingService) {}

  private async handle(
    id: string | undefined,
    attachment: boolean,
    ip: string,
    ua: string,
    res: Response,
  ) {
    const out = await this.tracking.trackClick(
      id ?? '',
      { ip, userAgent: ua },
      attachment,
    );
    if (out.redirectUrl) {
      return res.redirect(302, out.redirectUrl);
    }
    res.set('Content-Type', 'text/html; charset=utf-8').send(out.html);
  }

  @Get('acesso/*')
  acesso(
    @Query('id') id: string,
    @Query('a') a: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    return this.handle(id, a === '1', ip, ua, res);
  }

  @Get('portal/*')
  portal(
    @Query('id') id: string,
    @Query('a') a: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    return this.handle(id, a === '1', ip, ua, res);
  }

  @Get('fatura/*')
  fatura(
    @Query('id') id: string,
    @Query('a') a: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    return this.handle(id, a === '1', ip, ua, res);
  }

  @Get('documento/*')
  documento(
    @Query('id') id: string,
    @Query('a') a: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    return this.handle(id, a === '1', ip, ua, res);
  }
}
