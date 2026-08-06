import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Ip,
  Param,
  Post,
  Headers,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { TrackingService } from './tracking.service';
import { Public } from '../common/decorators/public.decorator';

// Rotas públicas de rastreio (fora do prefixo /api — ver main.ts).
// Tokens são opacos; nenhum dado sensível é exposto.
@Public()
@Controller('t')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  // Pixel de abertura: /t/o/:token.png
  @Get('o/:token')
  async open(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    const cleaned = token.replace(/\.png$/i, '');
    const pixel = await this.tracking.trackOpen(cleaned, { ip, userAgent: ua });
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    });
    res.end(pixel);
  }

  // Clique em link: /t/c/:token
  @Get('c/:token')
  async click(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    const out = await this.tracking.trackClick(token, { ip, userAgent: ua });
    if (out.redirectUrl) {
      return res.redirect(302, out.redirectUrl);
    }
    res.set('Content-Type', 'text/html; charset=utf-8').send(out.html);
  }

  // "Abertura de anexo": /t/a/:token
  @Get('a/:token')
  async attachment(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
    @Res() res: Response,
  ) {
    const out = await this.tracking.trackClick(token, { ip, userAgent: ua }, true);
    if (out.redirectUrl) {
      return res.redirect(302, out.redirectUrl);
    }
    res.set('Content-Type', 'text/html; charset=utf-8').send(out.html);
  }

  // Submissão do formulário falso: /t/f/:token (valores ignorados)
  @Post('f/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  form(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.tracking.trackFormSubmit(token, { ip, userAgent: ua });
  }

  // Reporte de phishing: /t/r/:token
  @Get('r/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  report(
    @Param('token') token: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.tracking.trackReport(token, { ip, userAgent: ua });
  }

  // Beacon de confirmação humana (só navegador que roda JS chega aqui).
  @Post('confirm/:token')
  @HttpCode(204)
  async confirm(
    @Param('token') token: string,
    @Body() body: { type?: string },
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    const type = body?.type;
    if (type === 'click' || type === 'attachment' || type === 'report') {
      await this.tracking.confirmAccess(token, type, { ip, userAgent: ua });
    }
  }
}
