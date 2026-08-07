// Distingue interações humanas de automáticas nos endpoints de rastreio.
// Proxies de imagem (Gmail), scanners de segurança de e-mail (Safe Links,
// Proofpoint, Mimecast...) e bibliotecas HTTP disparam abertura/clique sem
// serem o funcionário — inflam as métricas. Registramos tudo, mas marcamos
// esses como bot para o funil contar só humanos.

// User-agents claramente automáticos (proxies, scanners, crawlers, libs HTTP).
const BOT_UA =
  /(bot|crawler|spider|slurp|preview|scan(ner)?|fetch|monitor|proxy|sandbox|secur|protect|defender|antivirus|\bavast\b|\bavg\b|kaspersky|\besafe\b|googleimageproxy|ggpht|yahoomailproxy|mimecast|proofpoint|barracuda|symantec|messagelabs|ironport|cisco|fortinet|forcepoint|trendmicro|sophos|cloudmark|urldefense|safelinks|curl|wget|python-requests|go-http-client|java\/|libwww|okhttp|apache-httpclient|axios|node-fetch|headlesschrome|phantomjs|puppeteer|playwright|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|bingbot|googlebot|yandex|baiduspider|duckduckbot)/i;

// Navegadores humanos legítimos sempre trazem estes sinais.
const HUMAN_HINT = /Mozilla\/5\.0.*(Gecko|AppleWebKit|Trident|Chrome|Safari|Firefox|Edg)/i;

// Janela (ms) abaixo da qual, após o envio, o acesso é quase certamente
// pré-fetch/varredura automática, não abertura humana.
const SUSPICIOUS_WINDOW_MS = 6000;

// Prefetch/cache de imagem por cliente/proxy de e-mail — usado só para ABERTURA
// (pixel), onde queremos ser mais rígidos (aberturas são inerentemente ruidosas).
const OPEN_PREFETCH_UA =
  /(microsoft|ms-office|outlook|office|windows-rss|bingpreview|imageproxy|ggpht|googleimageproxy|yahoo|proxy|prefetch|fetch|superhuman|apple mail|mimecast|proofpoint|barracuda)/i;

export function isOpenPrefetch(userAgent: string | undefined): boolean {
  const ua = (userAgent ?? '').trim();
  if (!ua) return true;
  return OPEN_PREFETCH_UA.test(ua);
}

// Scanners de SEGURANÇA "duros" (varredura de link/anexo no recebimento).
// NÃO inclui image proxies de webmail (GoogleImageProxy/Yahoo), pois esses
// representam a ABERTURA humana nesses provedores — filtrá-los zera aberturas.
const SECURITY_SCANNER_UA =
  /(safelinks|urldefense|proofpoint|mimecast|barracuda|messagelabs|ironport|forcepoint|fireeye|trendmicro|symantec|\bdefender\b|\batp\b|bitdefender|kaspersky|sophos|cisco|fortinet|cloudmark|\bavast\b|\bavg\b|virustotal|opendns)/i;

export function isSecurityScanner(userAgent: string | undefined): boolean {
  return SECURITY_SCANNER_UA.test((userAgent ?? '').trim());
}

export interface BotVerdict {
  isBot: boolean;
  reason?: string;
}

export function classifyAccess(
  userAgent: string | undefined,
  sentAt: Date | null,
): BotVerdict {
  const ua = (userAgent ?? '').trim();

  // Sem user-agent = quase sempre scanner/lib.
  if (!ua) return { isBot: true, reason: 'sem-user-agent' };

  if (BOT_UA.test(ua)) return { isBot: true, reason: 'user-agent-automatico' };

  // Acesso quase instantâneo após o envio → pré-fetch/proxy, não humano.
  if (sentAt) {
    const delta = Date.now() - sentAt.getTime();
    if (delta >= 0 && delta < SUSPICIOUS_WINDOW_MS) {
      return { isBot: true, reason: 'muito-rapido-apos-envio' };
    }
  }

  // Não parece navegador humano.
  if (!HUMAN_HINT.test(ua)) return { isBot: true, reason: 'ua-nao-navegador' };

  return { isBot: false };
}
