import { Lead } from '@prisma/client';
import PDFDocument from 'pdfkit';

const esc = (s?: string | null): string =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Domínio de e-mail do cliente (o que será testado) — parte após o @.
export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1) : email;
}

const linha = (rot: string, val?: string | null) =>
  `<tr><td style="padding:6px 14px;color:#64748b;white-space:nowrap">${rot}</td><td style="padding:6px 14px;font-weight:600;color:#0f172a">${esc(val) || '<span style="color:#b91c1c">a confirmar</span>'}</td></tr>`;

// Termo de Autorização (LGPD + autorização do teste de phishing). É uma MINUTA
// para revisão jurídica — o aceite se dá por RESPOSTA a este e-mail.
export function authorizationTermHtml(lead: Lead): string {
  const dom = emailDomain(lead.email);
  const hoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;font-size:15px;line-height:1.6">
    <div style="background:#0f172a;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
      <div style="font-size:18px;font-weight:700">NexGuard · Nexium Solutions</div>
      <div style="font-size:13px;color:#cbd5e1">Termo de Autorização de Simulação de Phishing e Política de Uso e Privacidade</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:22px">
      <p>Prezado(a) <strong>${esc(lead.name)}</strong>,</p>
      <p>Para iniciarmos a simulação de phishing de conscientização, precisamos do seu
      aceite formal deste termo. Confira os dados e a autorização abaixo:</p>

      <table style="border-collapse:collapse;background:#f8fafc;border-radius:10px;margin:14px 0;width:100%">
        ${linha('Empresa', lead.company)}
        ${linha('CNPJ', lead.cnpj)}
        ${linha('Responsável', lead.name)}
        ${linha('Telefone', lead.phone)}
        ${linha('E-mail', lead.email)}
        ${linha('Domínio a ser testado', '@' + dom)}
      </table>

      <h3 style="font-size:15px;margin:20px 0 6px">1. Objeto</h3>
      <p>A <strong>Nexium Solutions</strong>, por meio da plataforma <strong>NexGuard</strong>,
      fica autorizada a conduzir <strong>simulações de phishing controladas e educativas</strong>
      junto aos colaboradores da empresa <strong>${esc(lead.company)}</strong>, no domínio de e-mail
      <strong>@${esc(dom)}</strong>, com finalidade exclusiva de medir a vulnerabilidade e treinar as pessoas.</p>

      <h3 style="font-size:15px;margin:20px 0 6px">2. Legitimidade e papéis (LGPD)</h3>
      <p>A empresa contratante declara ter legitimidade para testar e conscientizar seus próprios
      colaboradores, atuando como <strong>controladora</strong> dos dados; a Nexium Solutions atua como
      <strong>operadora</strong>, tratando os dados apenas para executar o serviço.</p>

      <h3 style="font-size:15px;margin:20px 0 6px">3. Proteção dos dados</h3>
      <p>O NexGuard <strong>nunca coleta nem armazena senhas reais</strong> — formulários simulados
      medem apenas a submissão, descartando os valores digitados. São tratados somente os eventos de
      abertura, clique e submissão, por colaborador, pelo tempo necessário à finalidade.</p>

      <h3 style="font-size:15px;margin:20px 0 6px">4. Vigência</h3>
      <p>Esta autorização vigora a partir do aceite e pode ser revogada a qualquer momento por
      solicitação da contratante.</p>

      <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px;margin:22px 0">
        <strong style="color:#065f46">✍️ Como autorizar:</strong>
        <p style="margin:6px 0 0">Basta <strong>responder este e-mail</strong> com a frase
        <strong>"De acordo"</strong>, confirmando que leu e autoriza a simulação nos termos acima.
        Sua resposta serve como aceite eletrônico deste termo.</p>
      </div>

      <p style="color:#64748b;font-size:13px">Documento gerado em ${hoje}. Este termo é uma minuta e pode ser
      complementado pelo contrato de prestação de serviços. Dúvidas: responda este e-mail ou escreva para
      <a href="mailto:contato@nexiumsolutions.com.br" style="color:#2563eb">contato@nexiumsolutions.com.br</a>.</p>
    </div>
  </div>`;
}

// PDF do termo (personalizado com os dados do cliente) para anexar ao e-mail.
export function authorizationTermPdf(lead: Lead): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const dom = emailDomain(lead.email);
    const hoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const H1 = (t: string) =>
      doc.moveDown(0.8).fontSize(12).font('Helvetica-Bold').text(t);
    const P = (t: string) =>
      doc.moveDown(0.3).fontSize(10.5).font('Helvetica').text(t, { align: 'justify' });
    const row = (k: string, v?: string | null) =>
      doc
        .fontSize(10.5)
        .font('Helvetica-Bold')
        .text(k + ': ', { continued: true })
        .font('Helvetica')
        .text(v || '(a confirmar)');

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Termo de Autorização de Simulação de Phishing');
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#555')
      .text('NexGuard · Nexium Solutions — Política de Uso e Privacidade')
      .fillColor('#000');

    doc.moveDown(0.8);
    row('Empresa', lead.company);
    row('CNPJ', lead.cnpj);
    row('Responsável', lead.name);
    row('Telefone', lead.phone);
    row('E-mail', lead.email);
    row('Domínio a ser testado', '@' + dom);

    H1('1. Objeto');
    P(
      `A Nexium Solutions, por meio da plataforma NexGuard, fica autorizada a conduzir simulações ` +
        `de phishing controladas e educativas junto aos colaboradores da empresa ${lead.company}, ` +
        `no domínio de e-mail @${dom}, com finalidade exclusiva de medir a vulnerabilidade e treinar as pessoas.`,
    );
    H1('2. Legitimidade e papéis (LGPD)');
    P(
      'A empresa contratante declara ter legitimidade para testar e conscientizar seus próprios colaboradores, ' +
        'atuando como controladora dos dados; a Nexium Solutions atua como operadora, tratando os dados apenas ' +
        'para executar o serviço.',
    );
    H1('3. Proteção dos dados');
    P(
      'O NexGuard nunca coleta nem armazena senhas reais — formulários simulados medem apenas a submissão, ' +
        'descartando os valores digitados. São tratados somente os eventos de abertura, clique e submissão, ' +
        'por colaborador, pelo tempo necessário à finalidade.',
    );
    H1('4. Vigência');
    P(
      'Esta autorização vigora a partir do aceite e pode ser revogada a qualquer momento por solicitação da contratante.',
    );
    H1('5. Aceite');
    P(
      'O aceite deste termo se dá pela resposta do responsável ao e-mail de envio, com a manifestação "De acordo", ' +
        'servindo como aceite eletrônico.',
    );

    doc
      .moveDown(1.5)
      .fontSize(9)
      .fillColor('#666')
      .text(
        `Documento gerado em ${hoje}. Minuta sujeita a revisão jurídica e complementação por contrato. ` +
          `Contato: contato@nexiumsolutions.com.br`,
      );

    doc.end();
  });
}

export function authorizationTermText(lead: Lead): string {
  const dom = emailDomain(lead.email);
  return [
    'TERMO DE AUTORIZAÇÃO — Simulação de Phishing (NexGuard / Nexium Solutions)',
    '',
    `Empresa: ${lead.company}`,
    `CNPJ: ${lead.cnpj ?? '(a confirmar)'}`,
    `Responsável: ${lead.name}`,
    `Telefone: ${lead.phone ?? '-'}`,
    `E-mail: ${lead.email}`,
    `Domínio a ser testado: @${dom}`,
    '',
    `A Nexium Solutions (plataforma NexGuard) fica autorizada a conduzir simulações de phishing`,
    `controladas e educativas junto aos colaboradores de ${lead.company}, no domínio @${dom},`,
    `para medir a vulnerabilidade e treinar as pessoas. O NexGuard nunca coleta nem armazena senhas reais.`,
    '',
    'PARA AUTORIZAR: responda este e-mail com "De acordo".',
  ].join('\n');
}
