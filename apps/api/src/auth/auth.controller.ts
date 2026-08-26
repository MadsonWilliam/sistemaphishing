import {
  Body,
  Controller,
  HttpCode,
  Post,
  Get,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
} from './auth.cookies';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Anti brute-force: no máx. 8 tentativas de login por minuto por IP.
  // Tokens vão em cookies httpOnly — nunca no corpo/JS.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(dto.email, dto.password);
    setAuthCookies(res, tokens, this.auth.ttls);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Sessão ausente.');
    }
    const tokens = await this.auth.refresh(token);
    setAuthCookies(res, tokens, this.auth.ttls);
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) {
      await this.auth.logout(token);
    }
    clearAuthCookies(res);
  }

  // Esqueci a senha: envia um código por e-mail. Resposta sempre 200.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  // Redefine a senha com o código recebido.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(userId, dto.currentPassword, dto.newPassword);
  }
}
