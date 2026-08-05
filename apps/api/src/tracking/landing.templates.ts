// Páginas renderizadas após o clique. Nenhuma delas coleta credenciais reais:
// o formulário falso existe só para medir a submissão — os valores são ignorados.

const shell = (title: string, body: string) => `<!doctype html>
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
  button{margin-top:20px;width:100%;padding:13px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
  .muted{font-size:13px;color:#64748b;margin-top:20px}
  .logo{width:40px;height:40px;border-radius:10px;background:#2563eb;display:flex;align-items:center;justify-content:center;font-weight:700;margin-bottom:16px}
</style></head><body><div class="card">${body}</div></body></html>`;

// Página em branco (registra o clique, mas não revela nada).
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
    <li>Na dúvida, <strong>reporte ao TI</strong> em vez de clicar.</li>
  </ul>`;

const microTrainingBlock = `
  <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;margin-top:8px">
    <p style="margin:0 0 8px;font-weight:600;color:#e2e8f0">🎓 Treino rápido (30s)</p>
    <p style="margin:0;font-size:14px">Antes de clicar em qualquer link de e-mail, faça 3 perguntas:
    <em>Eu esperava isso? O remetente confere? O link leva para onde diz levar?</em>
    Se qualquer resposta for "não", pare e reporte.</p>
  </div>`;

// Página educativa ("você acabou de cair num teste").
export function educationalPage(opts: {
  microTraining: boolean;
}): string {
  return shell(
    'Simulação de phishing',
    `<div class="badge">⚠️ Isto foi um teste de segurança</div>
     <h1>Você clicou em um e-mail de phishing simulado</h1>
     <p>Calma — <strong>nenhum dano foi causado</strong> e nenhum dado seu foi coletado.
     Este foi um teste autorizado de conscientização promovido pela sua empresa.</p>
     <p>Se este fosse um ataque real, você poderia ter exposto credenciais ou a rede da empresa.
     Veja como não cair na próxima:</p>
     ${tipsList}
     ${opts.microTraining ? microTrainingBlock : ''}
     <p class="muted">Este teste é confidencial e serve para fortalecer a segurança de todos.</p>`,
  );
}

// Formulário falso — apenas para medir a submissão. Os valores NÃO são salvos.
export function fakeFormPage(opts: {
  token: string;
  actionBase: string;
}): string {
  return shell(
    'Acesso à conta',
    `<div class="logo">🔒</div>
     <h1>Entre na sua conta</h1>
     <p>Confirme suas credenciais para continuar.</p>
     <form method="POST" action="${opts.actionBase}/t/f/${opts.token}" autocomplete="off">
       <label>E-mail corporativo</label>
       <input type="email" name="email" placeholder="voce@empresa.com" required>
       <label>Senha</label>
       <input type="password" name="password" placeholder="••••••••" required>
       <button type="submit">Entrar</button>
     </form>
     <p class="muted">Ao continuar você concorda com os termos de uso.</p>`,
  );
}

// Página exibida quando o usuário REPORTA (comportamento positivo).
export function reportedPage(): string {
  return shell(
    'Obrigado por reportar',
    `<div class="badge ok">✅ Você agiu corretamente</div>
     <h1>Bom trabalho! Você reportou um phishing</h1>
     <p>Este e-mail fazia parte de um teste de conscientização — e você <strong>não caiu</strong>.
     Reportar mensagens suspeitas é exatamente a atitude certa.</p>
     ${tipsList}
     <p class="muted">Continue assim: sua atenção protege toda a empresa.</p>`,
  );
}
