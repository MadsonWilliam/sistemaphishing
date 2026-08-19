import {
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { TrackingService } from './tracking.service';
import { Public } from '../common/decorators/public.decorator';

// Entradas de phishing com CAMINHO CRÍVEL (ex.: /fatura/<token>, /acesso/<token>)
// — o que a vítima vê no hover fica muito mais convincente que /t/c/<token>.
// Rotas na raiz, fora do prefixo /api e do SPA (ver exclusões em main.ts e
// app.module.ts). Cada slug é uma rota literal → nunca colide com o SPA.
// Todas registram um CLIQUE; ?a=1 marca como abertura de anexo.
@SkipThrottle()
@Public()
@Controller()
export class PhishLinkController {
  constructor(private readonly tracking: TrackingService) {}

  private async handle(
    token: string,
    attachment: boolean,
    ip: string,
    ua: string,
    res: Response,
  ) {
    const out = await this.tracking.trackClick(
      token,
      { ip, userAgent: ua },
      attachment,
    );
    if (out.redirectUrl) {
      return res.redirect(302, out.redirectUrl);
    }
    res.set('Content-Type', 'text/html; charset=utf-8').send(out.html);
  }

  @Get('acesso/:token')
  acesso(
    @Param('token') token: string,
    @Query('a') a: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    return this.handle(token, a === '1', ip, ua, res);
  }

  @Get('portal/:token')
  portal(
    @Param('token') token: string,
    @Query('a') a: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    return this.handle(token, a === '1', ip, ua, res);
  }

  @Get('fatura/:token')
  fatura(
    @Param('token') token: string,
    @Query('a') a: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    return this.handle(token, a === '1', ip, ua, res);
  }

  @Get('documento/:token')
  documento(
    @Param('token') token: string,
    @Query('a') a: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    return this.handle(token, a === '1', ip, ua, res);
  }
}
