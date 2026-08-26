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

// Micro-treino INTERATIVO: cards navegáveis com exemplos de como identificar
// phishing. Marca opt-in (logo + cor de destaque). Self-contained (HTML/CSS/JS).
export function microTrainingPage(opts: { brand?: Brand }): string {
  const color = safeColor(opts.brand?.color);
  const logoUrl = safeUrl(opts.brand?.logoUrl);
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="" style="max-height:34px;max-width:150px">`
    : `<div class="mk">🛡️</div>`;

  // Cada card: título, texto e um "mock" ilustrativo com o sinal de alerta.
  const cards = [
    {
      t: '⚠️ Isto foi um teste de segurança',
      d: 'Você clicou em um phishing <strong>simulado</strong> — nenhum dano e nenhum dado coletado. Em 1 minuto, aprenda a identificar o próximo. Toque em <strong>Próximo</strong>.',
      m: '',
    },
    {
      t: '1. Confira o remetente',
      d: 'Golpistas imitam domínios reais com pequenas trocas. Olhe com atenção o endereço, não só o nome.',
      m: `<div class="mock"><span class="lbl">De:</span> Financeiro &lt;cobranca@<span class="bad">contabiil-maisbrasil.com</span>&gt;<div class="tip">Domínio parecido, mas com letra a mais.</div></div>`,
    },
    {
      t: '2. Passe o mouse no link',
      d: 'Antes de clicar, veja para onde o link realmente aponta. Se o domínio não for o oficial, desconfie.',
      m: `<div class="mock"><a class="fakebtn" style="background:${color}">Emitir 2ª via</a><div class="url">🔗 <span class="bad">2via-boleto-online.com</span>/fatura/…</div><div class="tip">O texto diz uma coisa; o link leva para outra.</div></div>`,
    },
    {
      t: '3. Urgência e ameaça',
      d: 'Pressão para agir "agora" é a tática mais comum. Pare e pense antes de reagir.',
      m: `<div class="mock"><span class="bad">⏰ Sua conta será bloqueada HOJE!</span> Regularize em 2 horas para evitar juros.<div class="tip">Urgência artificial para você não pensar.</div></div>`,
    },
    {
      t: '4. Pediu senha ou dados?',
      d: 'Nenhuma empresa séria pede senha por link de e-mail. Nunca informe credenciais a partir de um e-mail.',
      m: `<div class="mock"><span class="lbl">Nova senha</span> <span class="field">••••••••</span><div class="tip">Formulário pedindo senha = sinal de alerta.</div></div>`,
    },
    {
      t: '5. Na dúvida, reporte',
      d: 'Não clique, não responda. Encaminhe ao seu TI/segurança. Reportar protege toda a empresa.',
      m: `<div class="mock ok">✅ Reportar ao TI é sempre a atitude certa.</div>`,
    },
    {
      t: '🎉 Treino concluído!',
      d: 'Você está mais preparado. Lembre das 3 perguntas antes de clicar: <em>Eu esperava isso? O remetente confere? O link leva para onde diz?</em> Se algo não bater, pare.',
      m: '',
    },
  ];

  const slides = cards
    .map(
      (c, i) => `<section class="slide${i === 0 ? ' on' : ''}" data-i="${i}">
        <h2>${c.t}</h2><p>${c.d}</p>${c.m}</section>`,
    )
    .join('');
  const dots = cards
    .map((_, i) => `<span class="dot${i === 0 ? ' on' : ''}"></span>`)
    .join('');

  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Micro-treino de segurança</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;
    background:#eef1f6;color:#1f2937;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;width:100%;max-width:440px;border-radius:16px;box-shadow:0 12px 40px rgba(17,24,39,.12);overflow:hidden}
  .top{background:${color};color:#fff;padding:14px 20px;display:flex;align-items:center;gap:10px}
  .mk{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center}
  .top b{font-size:14px;font-weight:600}
  .body{padding:22px;min-height:230px}
  h2{font-size:18px;margin:0 0 10px} p{color:#475569;line-height:1.6;margin:0 0 14px;font-size:15px}
  .slide{display:none} .slide.on{display:block;animation:f .25s ease}
  @keyframes f{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .mock{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;font-size:14px;color:#334155}
  .mock.ok{border-color:#a7f3d0;background:#ecfdf5;color:#065f46;font-weight:600}
  .lbl{color:#94a3b8} .bad{color:#b91c1c;font-weight:700;background:#fef2f2;padding:0 3px;border-radius:3px}
  .tip{margin-top:8px;font-size:12px;color:#64748b} .field{letter-spacing:2px}
  .fakebtn{display:inline-block;color:#fff;padding:8px 16px;border-radius:8px;font-weight:600;font-size:13px}
  .url{margin-top:8px;font-size:13px;color:#334155}
  .foot{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-top:1px solid #eef2f7}
  .dots{display:flex;gap:6px} .dot{width:7px;height:7px;border-radius:50%;background:#cbd5e1} .dot.on{background:${color}}
  button{border:0;border-radius:9px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer}
  #next{background:${color};color:#fff} #prev{background:#eef2f7;color:#475569}
  #prev[disabled]{opacity:.4;cursor:default}
</style></head><body>
  <div class="card">
    <div class="top">${logo}<b>Micro-treino de segurança</b></div>
    <div class="body">${slides}</div>
    <div class="foot">
      <button id="prev" disabled>Anterior</button>
      <div class="dots">${dots}</div>
      <button id="next">Próximo</button>
    </div>
  </div>
  <script>
    (function(){
      var i=0, s=document.querySelectorAll('.slide'), d=document.querySelectorAll('.dot');
      var prev=document.getElementById('prev'), next=document.getElementById('next');
      function show(){ s.forEach(function(x,n){x.classList.toggle('on',n===i)});
        d.forEach(function(x,n){x.classList.toggle('on',n===i)});
        prev.disabled=i===0; next.textContent=i===s.length-1?'Concluir':'Próximo'; }
      next.onclick=function(){ if(i<s.length-1){i++;show();} else {next.disabled=true;next.textContent='✔ Concluído';} };
      prev.onclick=function(){ if(i>0){i--;show();} };
    })();
  </script>
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
