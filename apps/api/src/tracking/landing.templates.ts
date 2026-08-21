// Páginas renderizadas após o clique. Nenhuma delas coleta credenciais reais:
// o formulário falso existe só para medir a submissão — os valores são ignorados.
// Suportam marca do cliente (logo/cor) e um link de treino opcional.

export interface Brand {
  color?: string | null;
  color2?: string | null;
  logoUrl?: string | null;
  trainingUrl?: string | null;
}

// Sanitização defensiva: cor só entra na CSS se for um valor de cor seguro;
// logo só se for URL http(s) — evita injeção via atributo/estilo.
const safeColor = (c?: string | null): string =>
  c && /^(#[0-9a-fA-F]{3,8}|rgb\([\d\s,.%]+\)|rgba\([\d\s,.%]+\)|[a-zA-Z]{3,20})$/.test(c.trim())
    ? c.trim()
    : '#2563eb';
const safeUrl = (u?: string | null): string | null => {
  if (!u) return null;
  const t = u.trim();
  // URL http(s) normal…
  if (/^https?:\/\/[^\s"'<>]+$/i.test(t)) return t;
  // …ou imagem enviada como data URI (upload do operador).
  if (
    /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/i.test(t)
  )
    return t;
  return null;
};

const shell = (title: string, body: string, brand?: Brand) => {
  const color = safeColor(brand?.color);
  const logoUrl = safeUrl(brand?.logoUrl);
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="" style="max-height:44px;margin-bottom:18px">`
    : '';
  return `<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{background:#1e293b;max-width:560px;width:100%;border-radius:16px;padding:32px;
    box-shadow:0 20px 60px rgba(0,0,0,.4);border:1px solid #334155}
  .badge{display:inline-flex;align-items:center;gap:8px;background:#7f1d1d;color:#fecaca;
    padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;margin-bottom:16px}
  h1{font-size:22px;margin:0 0 12px}
  p{line-height:1.6;color:#cbd5e1;margin:0 0 14px}
  ul{line-height:1.7;color:#cbd5e1;padding-left:20px;margin:0 0 14px}
  .ok{background:#064e3b;color:#a7f3d0}
  label{display:block;font-size:13px;color:#94a3b8;margin:14px 0 6px}
  input{width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:15px}
  button,.btn{margin-top:20px;display:inline-block;text-decoration:none;text-align:center;width:100%;padding:13px;border:0;border-radius:10px;background:${color};color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  .muted{font-size:13px;color:#64748b;margin-top:20px}
  .logo{width:40px;height:40px;border-radius:10px;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:16px}
</style></head><body><div class="card">${logo}${body}</div></body></html>`;
};

export function blankPage(): string {
  return shell(
    'Carregando…',
    `<p style="text-align:center;color:#64748b">Carregando…</p>`,
  );
}

const tipsList = `
  <ul>
    <li>Confira o <strong>remetente real</strong> — golpistas imitam nomes conhecidos.</li>
    <li>Passe o mouse sobre os <strong>links</strong> antes de clicar e verifique o endereço.</li>
    <li>Desconfie de <strong>urgência</strong> ("expira hoje", "conta bloqueada").</li>
    <li>Nunca informe <strong>senhas</strong> ou dados por link recebido em e-mail.</li>
    <li>Desconfie de <strong>QR codes</strong> em e-mails — eles escondem o destino.</li>
    <li>Na dúvida, <strong>reporte ao TI</strong> em vez de clicar.</li>
  </ul>`;

const microTrainingBlock = `
  <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-top:8px">
    <p style="margin:0 0 8px;font-weight:600;color:#e2e8f0">🎓 Treino rápido (30s)</p>
    <p style="margin:0;font-size:14px">Antes de clicar em qualquer link (ou escanear um QR) de e-mail, faça 3 perguntas:
    <em>Eu esperava isso? O remetente confere? O link leva para onde diz levar?</em>
    Se qualquer resposta for "não", pare e reporte.</p>
  </div>`;

const trainingButton = (brand?: Brand) => {
  const url = safeUrl(brand?.trainingUrl);
  return url
    ? `<a class="btn" href="${url}" target="_blank" rel="noopener">Fazer o treinamento completo</a>`
    : '';
};

export function educationalPage(opts: {
  microTraining: boolean;
  brand?: Brand;
}): string {
  return shell(
    'Simulação de phishing',
    `<div class="badge">⚠️ Isto foi um teste de segurança</div>
     <h1>Você caiu em um phishing simulado</h1>
     <p>Calma — <strong>nenhum dano foi causado</strong> e nenhum dado seu foi coletado.
     Este foi um teste autorizado de conscientização promovido pela sua empresa.</p>
     <p>Se este fosse um ataque real, você poderia ter exposto credenciais ou a rede da empresa.
     Veja como não cair na próxima:</p>
     ${tipsList}
     ${opts.microTraining ? microTrainingBlock : ''}
     ${trainingButton(opts.brand)}
     <p class="muted">Este teste é confidencial e serve para fortalecer a segurança de todos.</p>`,
    opts.brand,
  );
}

// Página de "login/portal" convincente (tema claro, profissional). Marca é
// OPT-IN: só usa logo/cor do cliente quando informados; sem marca, fica um
// portal corporativo neutro. NUNCA grava credenciais (valores ignorados no
// trackFormSubmit) — o formulário existe só para medir a submissão.
export function fakeFormPage(opts: { token: string; brand?: Brand }): string {
  const color = safeColor(opts.brand?.color);
  // 2ª cor da identidade (opcional) — cai na primária se não informada.
  const color2 = opts.brand?.color2 ? safeColor(opts.brand.color2) : color;
  const logoUrl = safeUrl(opts.brand?.logoUrl);
  const brandMark = logoUrl
    ? `<img src="${logoUrl}" alt="" style="max-height:40px;max-width:180px">`
    : `<div class="mark">
         <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
       </div>`;
  return `<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acesso ao portal</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    background:#eef1f6;color:#1f2937;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;width:100%;max-width:400px;border-radius:14px;padding:34px 30px 28px;
    box-shadow:0 10px 30px rgba(17,24,39,.10);border:1px solid #e5e7eb;border-top:3px solid ${color2}}
  .brand{display:flex;align-items:center;justify-content:center;margin-bottom:22px}
  .mark{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,${color},${color2});display:flex;align-items:center;justify-content:center}
  h1{font-size:20px;font-weight:600;margin:0 0 6px;text-align:center}
  .sub{font-size:14px;color:#6b7280;text-align:center;margin:0 0 22px;line-height:1.5}
  label{display:block;font-size:13px;font-weight:500;color:#374151;margin:14px 0 6px}
  input{width:100%;padding:11px 12px;border-radius:9px;border:1px solid #d1d5db;font-size:15px;color:#111827;background:#fff;transition:border .15s,box-shadow .15s}
  input:focus{outline:none;border-color:${color};box-shadow:0 0 0 3px ${color}22}
  button{width:100%;margin-top:22px;padding:12px;border:0;border-radius:9px;background:${color};
    color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  button:hover{filter:brightness(.95)}
  .secure{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;font-size:12px;color:#059669}
  .secure svg{flex:none}
  .foot{margin-top:22px;text-align:center;font-size:12px;color:#9ca3af}
  .foot a{color:#9ca3af}
</style></head>
<body>
  <div class="card">
    <div class="brand">${brandMark}</div>
    <h1>Confirme seu acesso</h1>
    <p class="sub">Por segurança, confirme seus dados e defina uma nova senha para continuar.</p>
    <form method="POST" action="/t/f/${opts.token}" autocomplete="off">
      <label>E-mail corporativo</label>
      <input type="email" name="email" placeholder="voce@empresa.com" required>
      <label>Nome completo</label>
      <input type="text" name="fullname" placeholder="Seu nome" required>
      <label>Nova senha</label>
      <input type="password" name="newpass" placeholder="••••••••" required>
      <label>Confirmar nova senha</label>
      <input type="password" name="confirm" placeholder="••••••••" required>
      <button type="submit">Confirmar e continuar</button>
    </form>
    <div class="secure">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Conexão segura · seus dados são protegidos
    </div>
  </div>
  <p class="foot">© ${new Date().getFullYear()} · Portal corporativo · Política de privacidade</p>
</body></html>`;
}

export function reportedPage(opts?: { brand?: Brand }): string {
  return shell(
    'Obrigado por reportar',
    `<div class="badge ok">✅ Você agiu corretamente</div>
     <h1>Bom trabalho! Você reportou um phishing</h1>
     <p>Este e-mail fazia parte de um teste de conscientização — e você <strong>não caiu</strong>.
     Reportar mensagens suspeitas é exatamente a atitude certa.</p>
     ${tipsList}
     ${trainingButton(opts?.brand)}
     <p class="muted">Continue assim: sua atenção protege toda a empresa.</p>`,
    opts?.brand,
  );
}
