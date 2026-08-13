import { CookieOptions, Response } from 'express';

// Nomes dos cookies de sessão. Prefixo próprio evita colisão.
export const ACCESS_COOKIE = 'nx_at';
export const REFRESH_COOKIE = 'nx_rt';

// Marca Secure quando o deploy é HTTPS. Deriva de APP_BASE_URL (mais confiável
// que NODE_ENV, que pode não estar setado no painel) — em produção atrás do
// TLS do EasyPanel a base é https, então o cookie só trafega cifrado.
const isHttps =
  (process.env.APP_BASE_URL || '').startsWith('https://') ||
  process.env.NODE_ENV === 'production';

// httpOnly: JS da página não lê (mitiga roubo de token via XSS).
// sameSite 'lax': o cookie NÃO acompanha POST/PUT/DELETE vindo de outro site
//   → bloqueia CSRF nas escritas, mas mantém navegação normal por link.
const base: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isHttps,
};

// Access: enviado a toda a API. Refresh: restrito às rotas /api/auth
// (login/refresh/logout) — reduz a superfície de exposição do token longo.
const REFRESH_PATH = '/api/auth';

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  ttl: { accessTtl: number; refreshTtl: number },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: '/',
    maxAge: ttl.accessTtl * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    path: REFRESH_PATH,
    maxAge: ttl.refreshTtl * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
}
