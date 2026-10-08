import { PrismaClient, CampaignStatus, PostClickBehavior, TrackingEventType } from '@prisma/client';

// ─── Campanha de DEMONSTRAÇÃO (dados 100% fictícios) ──────────────────────────
// Cria uma empresa + campanha concluída com colaboradores fake e um funil
// realista, para servir de "dashboard de exemplo" em apresentações/prints.
// NÃO envia e-mail: a campanha já nasce SENT e nenhuma linha vai para a fila de
// envio (EmailOutbox). Os números da dash vêm dos timestamps do CampaignTarget;
// o contador de "acessos automáticos filtrados" vem de eventos isBot=true.
//
// Idempotente: empresa e campanha com IDs fixos (upsert); alvos+eventos são
// recriados a cada boot (apaga e recria) para refletir sempre este desenho.
//
// Para REMOVER o demo depois: apague esta chamada do seed e rode uma vez
//   DELETE FROM companies WHERE id = '<DEMO_COMPANY_ID>';  (cascata limpa o resto)

const DEMO_COMPANY_ID = 'de111111-0000-4000-8000-000000000001';
const DEMO_CAMPAIGN_ID = 'de222222-0000-4000-8000-000000000002';
const DEMO_REPORT_TOKEN = 'demo-horizonte-2026';
const EMAIL_DOMAIN = 'grupohorizonte.demo'; // .demo não é TLD real → nunca roteável

type Outcome = 'submitted' | 'clicked' | 'reported' | 'opened' | 'sent';

interface Person {
  name: string;
  email: string;
  department: string;
  outcome: Outcome;
}

// 15 colaboradores fictícios. Funil: 15 enviados · 11 abriram · 6 clicaram ·
// 2 enviaram dados · 3 reportaram (bom comportamento). Comprometimento 40%.
const PEOPLE: Person[] = [
  { name: 'Ana Paula Ribeiro', email: 'ana.ribeiro', department: 'Financeiro', outcome: 'submitted' },
  { name: 'Carlos Eduardo Nunes', email: 'carlos.nunes', department: 'Administrativo', outcome: 'submitted' },
  { name: 'Marina Alves', email: 'marina.alves', department: 'Financeiro', outcome: 'clicked' },
  { name: 'Rafael Teixeira', email: 'rafael.teixeira', department: 'RH', outcome: 'clicked' },
  { name: 'Juliana Castro', email: 'juliana.castro', department: 'TI', outcome: 'clicked' },
  { name: 'Bruno Faria', email: 'bruno.faria', department: 'Zeladoria', outcome: 'clicked' },
  { name: 'Patrícia Gomes', email: 'patricia.gomes', department: 'TI', outcome: 'reported' },
  { name: 'Roberto Siqueira', email: 'roberto.siqueira', department: 'Diretoria', outcome: 'reported' },
  { name: 'Fernanda Lima', email: 'fernanda.lima', department: 'Jurídico', outcome: 'reported' },
  { name: 'Thiago Moraes', email: 'thiago.moraes', department: 'RH', outcome: 'opened' },
  { name: 'Camila Duarte', email: 'camila.duarte', department: 'Administrativo', outcome: 'opened' },
  { name: 'Lucas Pereira', email: 'lucas.pereira', department: 'Portaria', outcome: 'sent' },
  { name: 'Gabriela Santos', email: 'gabriela.santos', department: 'Compras', outcome: 'sent' },
  { name: 'Diego Fonseca', email: 'diego.fonseca', department: 'TI', outcome: 'sent' },
  { name: 'Larissa Pinto', email: 'larissa.pinto', department: 'RH', outcome: 'sent' },
];

const MIN = 60_000;
const HOUR = 60 * MIN;

export async function seedDemo(prisma: PrismaClient) {
  // Template-isca: a de reforma tributária (tema condomínio); se não houver,
  // cai em qualquer isca da biblioteca.
  const template =
    (await prisma.template.findFirst({
      where: { companyId: null, name: { contains: 'Reforma Tributária' } },
      select: { id: true },
    })) ??
    (await prisma.template.findFirst({
      where: { companyId: null },
      select: { id: true },
    }));

  if (!template) {
    console.log('[seed] demo: nenhuma isca na biblioteca ainda — pulando demo.');
    return;
  }

  const start = new Date(Date.now() - 8 * 24 * HOUR); // campanha ~8 dias atrás

  // 1) Empresa demo (idempotente por ID fixo).
  await prisma.company.upsert({
    where: { id: DEMO_COMPANY_ID },
    update: { name: 'Administradora Horizonte (DEMO)', status: 'ACTIVE' },
    create: {
      id: DEMO_COMPANY_ID,
      name: 'Administradora Horizonte (DEMO)',
      legalName: 'Horizonte Administração de Condomínios LTDA (DEMO)',
      status: 'ACTIVE',
    },
  });

  // 2) Campanha demo concluída (SENT) — sem nada na fila de envio.
  // createdAt ANTIGO de propósito: a lista ordena por createdAt desc, então o
  // demo fica SEMPRE por último (nunca vira a campanha padrão da dash nem se
  // mistura no topo com as campanhas reais). Nenhuma tela exibe essa data.
  const PINNED_OLD = new Date('2000-01-01T00:00:00Z');
  await prisma.campaign.upsert({
    where: { id: DEMO_CAMPAIGN_ID },
    update: {
      status: CampaignStatus.SENT,
      name: 'Demonstração — Reforma Tributária (condomínios)',
      createdAt: PINNED_OLD,
    },
    create: {
      id: DEMO_CAMPAIGN_ID,
      companyId: DEMO_COMPANY_ID,
      templateId: template.id,
      name: 'Demonstração — Reforma Tributária (condomínios)',
      status: CampaignStatus.SENT,
      postClickBehavior: PostClickBehavior.EDUCATIONAL,
      showReportButton: true,
      scheduledStartAt: start,
      reportToken: DEMO_REPORT_TOKEN,
      createdAt: PINNED_OLD,
    },
  });

  // 3) Recria alvos + eventos do zero (idempotência limpa).
  await prisma.campaignTarget.deleteMany({ where: { campaignId: DEMO_CAMPAIGN_ID } });

  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
  const scannerUa = 'Mozilla/5.0 (compatible; SecurityProxy/2.1; +scanner)';

  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i];
    const sentAt = new Date(start.getTime() + i * 3 * MIN); // ~3min entre cada
    const openedAt = new Date(sentAt.getTime() + (20 + i) * MIN);
    const clickedAt = new Date(openedAt.getTime() + 4 * MIN);
    const submittedAt = new Date(clickedAt.getTime() + 2 * MIN);
    const reportedAt = new Date(openedAt.getTime() + 6 * MIN);

    const did = {
      opened: ['opened', 'clicked', 'submitted', 'reported'].includes(p.outcome),
      clicked: ['clicked', 'submitted'].includes(p.outcome),
      submitted: p.outcome === 'submitted',
      reported: p.outcome === 'reported',
    };

    const events: {
      type: TrackingEventType;
      isBot: boolean;
      botReason?: string;
      ua: string;
      at: Date;
    }[] = [{ type: TrackingEventType.SENT, isBot: false, ua, at: sentAt }];
    if (did.opened) events.push({ type: TrackingEventType.OPENED, isBot: false, ua, at: openedAt });
    if (did.clicked) events.push({ type: TrackingEventType.CLICKED, isBot: false, ua, at: clickedAt });
    if (did.submitted) events.push({ type: TrackingEventType.FORM_SUBMITTED, isBot: false, ua, at: submittedAt });
    if (did.reported) events.push({ type: TrackingEventType.REPORTED, isBot: false, ua, at: reportedAt });

    // Alguns acessos de scanner (isBot) nos que NÃO abriram — mostra a defesa
    // anti-robô mantendo o funil fiel a pessoas reais.
    if (p.outcome === 'sent' && i % 2 === 0) {
      events.push({
        type: TrackingEventType.OPENED,
        isBot: true,
        botReason: 'varredura automática (scanner de segurança)',
        ua: scannerUa,
        at: new Date(sentAt.getTime() + 30_000),
      });
    }

    await prisma.campaignTarget.create({
      data: {
        campaignId: DEMO_CAMPAIGN_ID,
        token: `demo-tok-${String(i + 1).padStart(2, '0')}`,
        toEmail: `${p.email}@${EMAIL_DOMAIN}`,
        toName: p.name,
        department: p.department,
        sentAt,
        openedAt: did.opened ? openedAt : null,
        clickedAt: did.clicked ? clickedAt : null,
        submittedAt: did.submitted ? submittedAt : null,
        reportedAt: did.reported ? reportedAt : null,
        events: {
          create: events.map((e) => ({
            type: e.type,
            isBot: e.isBot,
            botReason: e.botReason ?? null,
            ip: '189.84.10.' + (20 + i),
            userAgent: e.ua,
            createdAt: e.at,
          })),
        },
      },
    });
  }

  console.log(
    `[seed] demo: empresa+campanha "Administradora Horizonte (DEMO)" com ${PEOPLE.length} colaboradores fictícios. Relatório público: /r/${DEMO_REPORT_TOKEN}`,
  );
}
