// Páginas renderizadas após o clique. Nenhuma delas coleta credenciais reais:
// o formulário falso existe só para medir a submissão — os valores são ignorados.
// Suportam marca do cliente (logo/cor) e um link de treino opcional.

export interface Brand {
  color?: string | null;
  logoUrl?: string | null;
  trainingUrl?: string | null;
}

const shell = (title: string, body: string, brand?: Brand) => {
  const color = brand?.color || '#2563eb';
  const logo = brand?.logoUrl
    ? `<img src="${brand.logoUrl}" alt="" style="max-height:44px;margin-bottom:18px">`
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

const trainingButton = (brand?: Brand) =>
  brand?.trainingUrl
    ? `<a class="btn" href="${brand.trainingUrl}" target="_blank" rel="noopener">Fazer o treinamento completo</a>`
    : '';

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

export function fakeFormPage(opts: { token: string; brand?: Brand }): string {
  return shell(
    'Confirmação de segurança',
    `<div class="logo">🔐</div>
     <h1>Confirme seu acesso</h1>
     <p>Por segurança, confirme seus dados e <strong>defina uma nova senha</strong> de acesso para continuar.</p>
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
     <p class="muted">Seus dados são protegidos. Ao continuar você concorda com a política de segurança.</p>`,
    opts.brand,
  );
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
