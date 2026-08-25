import { Lead } from '@prisma/client';

const esc = (s?: string | null): string =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const shell = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;font-size:15px;line-height:1.6">
  <div style="background:#0f172a;color:#fff;padding:16px 22px;border-radius:10px 10px 0 0">
    <div style="font-size:17px;font-weight:700">NexGuard · Nexium Solutions</div>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:22px">
    ${inner}
    <p style="color:#94a3b8;font-size:12px;margin-top:22px">Dúvidas? Responda este e-mail ou escreva para
    <a href="mailto:contato@nexiumsolutions.com.br" style="color:#2563eb">contato@nexiumsolutions.com.br</a>.</p>
  </div>
</div>`;

// E-mail pedindo os contatos que o cliente quer testar (nome, e-mail, setor).
export function requestContactsHtml(lead: Lead): string {
  return shell(`<p>Olá ${esc(lead.name)},</p>
    <p>Estamos prontos para estruturar a simulação de phishing na <strong>${esc(lead.company)}</strong>.
    Para montar a campanha, precisamos da lista de colaboradores que você quer testar.</p>
    <p>Basta <strong>responder este e-mail</strong> com, para cada pessoa:</p>
    <table style="border-collapse:collapse;background:#f8fafc;border-radius:10px;margin:12px 0;width:100%">
      <tr><td style="padding:8px 14px;font-weight:600">Nome</td><td style="padding:8px 14px;font-weight:600">E-mail</td><td style="padding:8px 14px;font-weight:600">Setor</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b">Ana Souza</td><td style="padding:8px 14px;color:#64748b">ana@${esc(lead.email.split('@')[1] || 'suaempresa.com')}</td><td style="padding:8px 14px;color:#64748b">Financeiro</td></tr>
    </table>
    <p>Com os dados, cadastramos tudo e disparamos o teste. O <strong>setor</strong> é o que permite o
    recorte do relatório por área — quanto mais completo, melhor a análise.</p>
    <p style="font-size:13px;color:#64748b">Lembrando: nenhuma senha real é coletada e quem cai recebe,
    na hora, um treino rápido de conscientização.</p>`);
}
export function requestContactsText(lead: Lead): string {
  return `Ola ${lead.name},\n\nPara estruturar a simulacao de phishing na ${lead.company}, responda este e-mail com a lista de quem testar (Nome, E-mail, Setor).\nEx.: Ana Souza; ana@empresa.com; Financeiro\n\nNenhuma senha real e coletada.`;
}

// E-mail comercial de proposta (preços preenchidos pelo operador).
export function proposalHtml(lead: Lead): string {
  const plano = esc(lead.proposalPlan) || 'Plano NexGuard';
  const valor = esc(lead.proposalValue) || 'sob consulta';
  const cond = lead.proposalConditions
    ? `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:14px;white-space:pre-wrap">${esc(lead.proposalConditions)}</div>`
    : '';
  return shell(`<p>Olá ${esc(lead.name)},</p>
    <p>Foi um prazer rodar a simulação com a <strong>${esc(lead.company)}</strong>. Como você viu, um único
    clique já expõe a empresa — e o NexGuard transforma isso em <strong>conscientização mensurável</strong>,
    com relatório executivo e evolução a cada rodada.</p>

    <div style="border:2px solid #1a73e8;border-radius:12px;padding:18px;margin:18px 0;text-align:center">
      <div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.5px">Sua proposta</div>
      <div style="font-size:20px;font-weight:800;margin:6px 0">${plano}</div>
      <div style="font-size:26px;font-weight:800;color:#1a73e8">${valor}</div>
    </div>
    ${cond}

    <p style="font-size:14px;color:#334155">Formas de contratação:</p>
    <ul style="font-size:14px;color:#334155;line-height:1.7">
      <li><strong>Essencial</strong> — até 2 testes por mês, relatório e treino incluídos.</li>
      <li><strong>Ilimitado</strong> — testes ilimitados, incluindo outros domínios da sua operação.</li>
    </ul>

    <p style="margin-top:18px">Para seguir, é só <strong>responder este e-mail</strong> confirmando o plano —
    cuidamos de toda a ativação.</p>`);
}
export function proposalText(lead: Lead): string {
  return `Ola ${lead.name},\n\nProposta NexGuard para ${lead.company}:\nPlano: ${lead.proposalPlan ?? '-'}\nValor: ${lead.proposalValue ?? '-'}\n${lead.proposalConditions ?? ''}\n\nFormas: Essencial (ate 2 testes/mes) ou Ilimitado (testes ilimitados + outros dominios).\nResponda este e-mail para seguir.`;
}
