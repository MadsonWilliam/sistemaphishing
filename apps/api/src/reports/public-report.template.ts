// Página HTML autocontida do relatório público (read-only) para prospects.
// Design executivo/claro — pensado para ser compartilhado com a diretoria.

interface ReportData {
  campaign: {
    name: string;
    company: string;
    template: {
      sector: string;
      trigger: string;
      difficulty: number;
      difficultyLabel?: string;
    };
    status: string;
  };
  summary: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    submitted: number;
    reported: number;
    compromiseRate: number;
    clickRate: number;
    headline: string;
  };
  byDepartment: {
    department: string;
    total: number;
    clicked: number;
    clickRate: number;
  }[];
  byRecipient: {
    email: string;
    name: string;
    department: string;
    opened: boolean;
    clicked: boolean;
    submitted: boolean;
    reported: boolean;
  }[];
  recommendations: { severity: string; title: string; detail: string }[];
  evolution: {
    trend: string;
    previousCompromiseRate?: number;
    currentCompromiseRate: number;
    deltaPoints?: number;
  };
  benchmarkNote: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sevColor: Record<string, string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#64748b',
};

export function renderReportPage(d: ReportData): string {
  const s = d.summary;
  const kpi = (label: string, value: string | number, color = '#0f172a') =>
    `<div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
       <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em">${label}</div>
       <div style="font-size:28px;font-weight:700;color:${color};margin-top:4px">${value}</div>
     </div>`;

  const maxRate = Math.max(1, ...d.byDepartment.map((x) => x.clickRate));
  const sectorRows = d.byDepartment
    .map((x) => {
      const w = Math.round((x.clickRate / maxRate) * 100);
      const c = x.clickRate >= 50 ? '#dc2626' : x.clickRate >= 25 ? '#d97706' : '#16a34a';
      return `<div style="margin:10px 0">
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px">
          <span>${esc(x.department)}</span>
          <span style="color:${c};font-weight:600">${x.clickRate}% (${x.clicked}/${x.total})</span>
        </div>
        <div style="background:#eef2f7;border-radius:6px;height:10px">
          <div style="width:${w}%;background:${c};height:10px;border-radius:6px"></div>
        </div>
      </div>`;
    })
    .join('');

  // Recorte por colaborador (caixa) — pior desfecho de cada pessoa vira o status.
  const statusOf = (r: ReportData['byRecipient'][number]) => {
    if (r.submitted) return { label: 'Enviou dados', color: '#dc2626', bg: '#fef2f2' };
    if (r.clicked) return { label: 'Clicou no link', color: '#d97706', bg: '#fffbeb' };
    if (r.reported) return { label: 'Reportou ✓', color: '#16a34a', bg: '#f0fdf4' };
    if (r.opened) return { label: 'Abriu o e-mail', color: '#0891b2', bg: '#ecfeff' };
    return { label: 'Sem interação', color: '#64748b', bg: '#f8fafc' };
  };
  const recipientRows = d.byRecipient
    .map((r) => {
      const st = statusOf(r);
      const who = r.name
        ? `<div style="font-weight:600">${esc(r.name)}</div><div style="font-size:12px;color:#64748b">${esc(r.email)}</div>`
        : `<div style="font-weight:600">${esc(r.email)}</div>`;
      const reportTag =
        r.reported && (r.clicked || r.submitted)
          ? ` <span style="font-size:11px;color:#16a34a">· reportou</span>`
          : '';
      return `<tr style="border-top:1px solid #eef2f7">
        <td style="padding:9px 8px;vertical-align:top">${who}</td>
        <td style="padding:9px 8px;vertical-align:top;color:#475569">${esc(r.department)}</td>
        <td style="padding:9px 8px;vertical-align:top;text-align:right;white-space:nowrap">
          <span style="background:${st.bg};color:${st.color};font-weight:600;font-size:13px;padding:3px 10px;border-radius:999px">${st.label}</span>${reportTag}
        </td>
      </tr>`;
    })
    .join('');

  const recs = d.recommendations
    .map(
      (r) => `<div style="border-left:4px solid ${sevColor[r.severity] ?? '#64748b'};background:#f8fafc;border-radius:8px;padding:14px;margin:10px 0">
        <div style="font-weight:600">${esc(r.title)}</div>
        <div style="color:#475569;font-size:14px;margin-top:4px">${esc(r.detail)}</div>
      </div>`,
    )
    .join('');

  const evolution =
    d.evolution.trend === 'first'
      ? `<p style="color:#64748b">Primeira campanha da empresa — a partir da próxima, mostramos a evolução da taxa de comprometimento.</p>`
      : `<p style="font-size:15px">Comprometimento: <strong>${d.evolution.previousCompromiseRate}%</strong> → <strong>${d.evolution.currentCompromiseRate}%</strong>
         (<strong style="color:${(d.evolution.deltaPoints ?? 0) < 0 ? '#16a34a' : '#dc2626'}">${(d.evolution.deltaPoints ?? 0) > 0 ? '+' : ''}${d.evolution.deltaPoints} pts</strong>)
         ${d.evolution.trend === 'improving' ? '— melhora 🎉' : d.evolution.trend === 'worsening' ? '— piora' : '— estável'}</p>`;

  return `<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Relatório de Segurança — ${esc(d.campaign.company)}</title>
<style>
  body{margin:0;background:#eef2f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a}
  .wrap{max-width:820px;margin:0 auto;padding:32px 20px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:0 0 14px;color:#334155}
  .headline{font-size:26px;font-weight:800;line-height:1.3}
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:20px}
  .logo{width:40px;height:40px;border-radius:10px;background:#2563eb;display:grid;place-items:center;font-size:20px}
</style></head><body><div class="wrap">
  <div class="brand">
    <div class="logo" style="background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff">N</div>
    <div><div style="font-weight:700">NexGuard</div><div style="font-size:13px;color:#64748b">Relatório de simulação de phishing</div></div>
  </div>

  <div class="card">
    <h1>${esc(d.campaign.company)}</h1>
    <div style="color:#64748b;font-size:14px;margin-bottom:16px">Campanha: ${esc(d.campaign.name)} · Isca do setor ${esc(d.campaign.template.sector)} · dificuldade ${d.campaign.template.difficulty}/3${d.campaign.template.difficultyLabel ? ' (' + esc(d.campaign.template.difficultyLabel) + ')' : ''}</div>
    <div class="headline">${esc(s.headline)}</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px">
      ${kpi('Enviados', s.sent)}
      ${kpi('Clicaram', s.clicked, '#d97706')}
      ${kpi('Submeteram dados', s.submitted, '#dc2626')}
      ${kpi('Reportaram', s.reported, '#16a34a')}
      ${kpi('Comprometimento', s.compromiseRate + '%', '#dc2626')}
    </div>
  </div>

  ${
    d.byDepartment.length
      ? `<div class="card"><h2>Vulnerabilidade por setor</h2>${sectorRows}</div>`
      : ''
  }

  ${
    d.byRecipient.length
      ? `<div class="card"><h2>Resultado por colaborador</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead><tr style="text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em">
              <th style="padding:0 8px 8px">Colaborador</th>
              <th style="padding:0 8px 8px">Setor</th>
              <th style="padding:0 8px 8px;text-align:right">Status</th>
            </tr></thead>
            <tbody>${recipientRows}</tbody>
          </table>
          <div style="font-size:12px;color:#94a3b8;margin-top:12px">Recorte individual por caixa de e-mail (do desfecho mais grave ao mais seguro). Documento confidencial — uso interno de conscientização.</div>
        </div>`
      : ''
  }

  <div class="card"><h2>Boas práticas recomendadas</h2>${recs || '<p style="color:#64748b">Sem alertas críticos.</p>'}</div>

  <div class="card"><h2>Evolução</h2>${evolution}</div>

  <div class="card" style="background:#f8fafc">
    <div style="font-size:13px;color:#64748b">${esc(d.benchmarkNote)}</div>
  </div>

  <p style="text-align:center;color:#94a3b8;font-size:12px">Simulação autorizada de conscientização · documento confidencial<br>NexGuard · uma solução Nexium Solutions</p>
</div></body></html>`;
}

export function reportNotFoundPage(): string {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Relatório indisponível</title></head>
  <body style="font-family:system-ui;background:#eef2f7;display:grid;place-items:center;height:100vh;margin:0;color:#334155">
  <div style="text-align:center"><div style="font-size:40px">🔒</div><p>Relatório não encontrado ou o link foi revogado.</p></div>
  </body></html>`;
}
