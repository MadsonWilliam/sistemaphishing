// Biblioteca de iscas da plataforma (companyId = null). Baseada em vetores que
// golpistas realmente usam, por setor / gatilho / dificuldade. Carregada no seed
// (idempotente por nome). Placeholders disponíveis: {{nome}}, {{empresa}},
// {{link}} (clique rastreado) e {{anexo}} (abertura de anexo rastreada).

export type Sector =
  | 'FINANCEIRO'
  | 'CONTABILIDADE'
  | 'JURIDICO'
  | 'RH'
  | 'TI'
  | 'ADMINISTRATIVO'
  | 'COMPRAS'
  | 'LOGISTICA'
  | 'DIRETORIA'
  | 'GERAL';

export type Trigger = 'LINK' | 'ATTACHMENT' | 'FORM';

export interface LibraryTemplate {
  name: string;
  sector: Sector;
  trigger: Trigger;
  // Convenção: 1 = FÁCIL da pessoa identificar como golpe (poucos caem) …
  // 3 = DIFÍCIL de identificar / mais convincente (muitos caem).
  difficulty: number;
  subject: string;
  html: string;
}

// Envelope visual consistente para os e-mails.
const wrap = (inner: string, cta?: { label: string; href: string }) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#202124;font-size:15px;line-height:1.55">
  ${inner}
  ${
    cta
      ? `<p style="text-align:center;margin:26px 0">
      <a href="${cta.href}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:12px 30px;border-radius:6px;display:inline-block;font-weight:bold">${cta.label}</a>
    </p>`
      : ''
  }
  <hr style="border:none;border-top:1px solid #eaeaea;margin:24px 0">
  <p style="color:#9aa0a6;font-size:12px">Esta mensagem foi enviada para {{nome}} da {{empresa}}. Se você não a reconhece, ignore-a.</p>
</div>`;

const fileCard = (name: string) => `
<table cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;margin:16px 0;width:100%">
  <tr><td style="padding:14px;font-size:14px"><span style="font-size:20px">📎</span>&nbsp;<strong>${name}</strong></td></tr>
</table>`;

export const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  {
    name: 'Boleto em atraso — 2ª via',
    sector: 'FINANCEIRO',
    trigger: 'LINK',
    difficulty: 2,
    subject: '{{nome}}, identificamos uma fatura em aberto',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Consta em nosso sistema uma fatura da <strong>{{empresa}}</strong> vencida há 3 dias. Para evitar juros e negativação, emita a 2ª via e regularize hoje.</p>`,
      { label: 'Emitir 2ª via do boleto', href: '{{link}}' },
    ),
  },
  {
    name: 'Nota fiscal eletrônica (NF-e)',
    sector: 'CONTABILIDADE',
    trigger: 'ATTACHMENT',
    difficulty: 2,
    subject: 'NF-e nº 04482 — {{empresa}}',
    html: wrap(
      `<p>Prezado(a) {{nome}},</p>
       <p>Segue em anexo a nota fiscal eletrônica referente à sua última operação. O XML e o DANFE estão no arquivo abaixo.</p>
       ${fileCard('NFe_04482.pdf')}
       <p><a href="{{anexo}}">Baixar DANFE (PDF)</a></p>`,
    ),
  },
  {
    name: 'Fornecedor: atualização de dados bancários (BEC)',
    sector: 'COMPRAS',
    trigger: 'LINK',
    difficulty: 3,
    subject: 'Atualização de conta para pagamento — urgente',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Informamos que nossa conta bancária foi alterada. Por favor, atualize os dados no cadastro de fornecedores antes do próximo pagamento para evitar atrasos.</p>
       <p>Confirme a nova conta pelo link seguro abaixo.</p>`,
      { label: 'Confirmar novos dados bancários', href: '{{link}}' },
    ),
  },
  {
    name: 'Intimação / notificação judicial',
    sector: 'JURIDICO',
    trigger: 'ATTACHMENT',
    difficulty: 2,
    subject: 'Intimação — Processo nº 0009123-45.2026',
    html: wrap(
      `<p>Prezado(a) {{nome}},</p>
       <p>Você foi intimado(a) em processo que tramita contra a <strong>{{empresa}}</strong>. O prazo para manifestação é de 5 dias úteis. Acesse a íntegra no documento anexo.</p>
       ${fileCard('Intimacao_0009123.pdf')}
       <p><a href="{{anexo}}">Abrir intimação</a></p>`,
    ),
  },
  {
    name: 'Documento compartilhado (pasta)',
    sector: 'GERAL',
    trigger: 'LINK',
    difficulty: 2,
    subject: 'Um documento foi compartilhado com você',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Um documento foi compartilhado com você pela equipe de {{empresa}}. O acesso expira em 24 horas.</p>
       ${fileCard('Relatorio_Confidencial.pdf')}`,
      { label: 'Abrir documento', href: '{{link}}' },
    ),
  },
  {
    name: 'RH: atualização cadastral obrigatória',
    sector: 'RH',
    trigger: 'FORM',
    difficulty: 2,
    subject: '{{nome}}, atualize seus dados até sexta-feira',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>O RH da {{empresa}} está atualizando o cadastro dos colaboradores. Confirme seus dados no portal para não ter o holerite bloqueado neste mês.</p>`,
      { label: 'Acessar portal do colaborador', href: '{{link}}' },
    ),
  },
  {
    name: 'TI: sua senha expira em 24 horas',
    sector: 'TI',
    trigger: 'FORM',
    difficulty: 2,
    subject: 'Ação necessária: sua senha expira em 24h',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Por política de segurança da {{empresa}}, sua senha de rede expira em 24 horas. Renove agora para manter o acesso ao e-mail e aos sistemas.</p>`,
      { label: 'Renovar minha senha', href: '{{link}}' },
    ),
  },
  {
    name: 'Reembolso / benefício disponível',
    sector: 'GERAL',
    trigger: 'FORM',
    difficulty: 1,
    subject: 'Você tem um reembolso pendente de R$ 428,90',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Identificamos um valor de <strong>R$ 428,90</strong> a ser reembolsado a você. Confirme seus dados para receber o crédito ainda nesta semana.</p>`,
      { label: 'Receber meu reembolso', href: '{{link}}' },
    ),
  },
  {
    name: 'Entrega retida — atualize o endereço',
    sector: 'LOGISTICA',
    trigger: 'LINK',
    difficulty: 1,
    subject: 'Sua encomenda está retida na transportadora',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Uma encomenda destinada à {{empresa}} está retida por endereço incompleto. Atualize os dados de entrega em até 48h para evitar a devolução.</p>`,
      { label: 'Atualizar endereço de entrega', href: '{{link}}' },
    ),
  },
  {
    name: 'Convite de reunião / ata para aprovação',
    sector: 'DIRETORIA',
    trigger: 'LINK',
    difficulty: 3,
    subject: 'Ata da reunião de diretoria — aprovar até hoje',
    html: wrap(
      `<p>Prezado(a) {{nome}},</p>
       <p>Segue a ata da última reunião de diretoria da {{empresa}} para sua revisão e aprovação. Precisamos do seu aceite ainda hoje para prosseguir.</p>`,
      { label: 'Revisar e aprovar ata', href: '{{link}}' },
    ),
  },
  {
    name: 'Cobrança de assinatura de software',
    sector: 'COMPRAS',
    trigger: 'LINK',
    difficulty: 2,
    subject: 'Falha na renovação da sua assinatura corporativa',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Não conseguimos renovar a assinatura corporativa da {{empresa}}. Atualize a forma de pagamento em 24h para não perder o acesso da equipe.</p>`,
      { label: 'Atualizar pagamento', href: '{{link}}' },
    ),
  },
  // ── Iscas com QR code (quishing) — o {{qr}} vira o QR do link de clique.
  // Recomendado usar com comportamento pós-clique "Formulário" (vira "submeteu").
  {
    name: 'QR — Benefício disponível (quishing)',
    sector: 'GERAL',
    trigger: 'FORM',
    difficulty: 1,
    subject: 'Escaneie e resgate seu benefício',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Você tem um benefício disponível. Escaneie o QR code abaixo com a câmera do celular para resgatar agora.</p>
       <div style="text-align:center">{{qr}}</div>`,
    ),
  },
  {
    name: 'QR — Documento seguro (quishing)',
    sector: 'GERAL',
    trigger: 'FORM',
    difficulty: 2,
    subject: '{{nome}}, documento seguro disponível',
    html: wrap(
      `<p>Prezado(a) {{nome}},</p>
       <p>Um documento seguro da {{empresa}} está disponível. Por segurança, o acesso é feito via QR — escaneie com o celular corporativo para abrir.</p>
       <div style="text-align:center">{{qr}}</div>`,
    ),
  },
  {
    name: 'QR — Reautenticação MFA (quishing)',
    sector: 'TI',
    trigger: 'FORM',
    difficulty: 3,
    subject: 'Ação necessária: reative sua autenticação (MFA)',
    html: wrap(
      `<p>Olá {{nome}},</p>
       <p>Detectamos uma inconsistência na sua autenticação multifator. Para manter o acesso aos sistemas da {{empresa}}, reative o MFA escaneando o QR abaixo no seu app autenticador.</p>
       <div style="text-align:center">{{qr}}</div>
       <p style="font-size:12px;color:#9aa0a6">O não cumprimento em 24h poderá suspender seu acesso.</p>`,
    ),
  },
];
