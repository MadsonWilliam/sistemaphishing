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
