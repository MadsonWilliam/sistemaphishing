import { Injectable } from '@nestjs/common';
import { TemplateSector, TemplateTrigger } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';

export type Severity = 'high' | 'medium' | 'low';

// Convenção de dificuldade: 1 = fácil da pessoa identificar (poucos caem) …
// 3 = difícil de identificar / mais convincente (muitos caem).
export const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'fácil de identificar',
  2: 'moderada',
  3: 'difícil de identificar',
};

export interface Recommendation {
  category: string;
  severity: Severity;
  title: string;
  detail: string;
}

// Dicas de reforço por setor (o "o que treinar" do relatório).
const SECTOR_HINT: Record<TemplateSector, string> = {
  FINANCEIRO: 'golpes de boleto/pagamento e troca de dados bancários (BEC)',
  CONTABILIDADE: 'faturas e notas fiscais falsas, cobranças urgentes',
  JURIDICO: 'falsas intimações e notificações judiciais',
  RH: 'falsos comunicados de RH e holerite',
  TI: 'falsos avisos de expiração de senha e suporte técnico',
  ADMINISTRATIVO: 'documentos e comunicados administrativos falsos',
  COMPRAS: 'falsas cobranças de fornecedores e renovações de contrato',
  LOGISTICA: 'falsas notificações de entrega/transportadora',
  DIRETORIA: 'BEC e pedidos urgentes falsos em nome de executivos',
  GERAL: 'phishing genérico (pastas compartilhadas, prêmios, convites)',
};

const TRIGGER_REC: Record<
  TemplateTrigger,
  { title: string; detail: string }
> = {
  LINK: {
    title: 'Reforçar verificação de links e ativar MFA',
    detail:
      'O comprometimento veio de cliques em link. Treine a conferência de URL (passar o mouse antes de clicar, checar o domínio real) e ative MFA — a maior parte do roubo de credencial teria sido bloqueada.',
  },
  ATTACHMENT: {
    title: 'Reforçar política de anexos e sandbox no gateway',
    detail:
      'O comprometimento veio da abertura de anexo. Reforce a regra de não abrir anexos inesperados e ative sandbox/detonação de anexos no gateway de e-mail.',
  },
  FORM: {
    title: 'Ativar MFA e treinar reconhecimento de login falso',
    detail:
      'Os alvos foram levados a uma página de login falsa. Ative MFA e treine a identificação de páginas de captura de credencial (URL, cadeado, contexto).',
  },
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
  ) {}

  private async compromiseRateOf(campaignId: string): Promise<number> {
    const [total, clicked] = await Promise.all([
      this.prisma.campaignTarget.count({ where: { campaignId } }),
      this.prisma.campaignTarget.count({
        where: { campaignId, clickedAt: { not: null } },
      }),
    ]);
    return total ? +((clicked / total) * 100).toFixed(1) : 0;
  }

  // Resolve o relatório pelo token público (link read-only p/ prospects).
  async buildReportByToken(token: string) {
    const c = await this.prisma.campaign.findUnique({
      where: { reportToken: token },
      select: { id: true },
    });
    if (!c) return null;
    return this.buildReport(c.id);
  }

  async buildReport(campaignId: string, scopeCompanyId?: string) {
    const campaign = await this.campaigns.findOne(campaignId, scopeCompanyId);
    const stats = await this.campaigns.getStats(campaignId, scopeCompanyId);
    const { funnel, rates, byDepartment } = stats;
    const recs: Recommendation[] = [];

    // 1) Setor mais vulnerável (acima da média geral de cliques).
    const worst = byDepartment.find((d) => d.total > 0) ?? null;
    if (worst && worst.clickRate > rates.clickRate) {
      const gap = +(worst.clickRate - rates.clickRate).toFixed(1);
      recs.push({
        category: 'setor',
        severity: gap >= 20 ? 'high' : 'medium',
        title: `Setor ${worst.department} é o mais suscetível`,
        detail: `${worst.department} teve ${worst.clickRate}% de cliques (média geral ${rates.clickRate}%, ${gap} pontos acima). Priorize treinamento focado em ${SECTOR_HINT[campaign.template.sector]}.`,
      });
    }

    // 2) Recomendação pelo gatilho principal da isca.
    const trig = TRIGGER_REC[campaign.template.trigger];
    if (funnel.clicked > 0) {
      recs.push({
        category: 'gatilho',
        severity: 'high',
        title: trig.title,
        detail: trig.detail,
      });
    }

    // 3) Submissão de credencial em formulário falso (risco direto).
    if (funnel.submitted > 0) {
      recs.push({
        category: 'credencial',
        severity: 'high',
        title: 'Credenciais submetidas em página falsa',
        detail: `${funnel.submitted} pessoa(s) (${rates.submitRate}%) enviaram dados num formulário falso — risco direto de account takeover. MFA é a mitigação prioritária.`,
      });
    }

    // 4) Comportamento de reporte (sinal positivo).
    if (!campaign.showReportButton) {
      recs.push({
        category: 'reporte',
        severity: 'low',
        title: 'Habilitar e medir o "Reportar phishing"',
        detail:
          'Esta campanha não ofereceu botão de reporte, então não medimos quem agiria certo. Habilite o reporte nas próximas e reconheça quem reporta — reforça a cultura de segurança.',
      });
    } else if (rates.reportRate < 10) {
      recs.push({
        category: 'reporte',
        severity: 'medium',
        title: 'Baixa taxa de reporte',
        detail: `Apenas ${rates.reportRate}% reportaram o e-mail suspeito. Implante o botão "Reportar phishing" no cliente de e-mail e reconheça publicamente quem reporta.`,
      });
    }

    // 5) Maturidade em função da dificuldade da isca.
    if (rates.clickRate >= 30) {
      const lvl = campaign.template.difficulty;
      recs.push({
        category: 'maturidade',
        severity: rates.clickRate >= 50 ? 'high' : 'medium',
        title:
          lvl <= 1
            ? 'Maturidade baixa: caíram numa isca simples'
            : 'Alta taxa de comprometimento',
        detail:
          lvl <= 1
            ? `${rates.clickRate}% caíram num e-mail pouco sofisticado (dificuldade ${lvl}/3). Comece pelo treinamento básico de reconhecimento de phishing.`
            : `${rates.clickRate}% caíram numa isca de dificuldade ${lvl}/3. Combine treinamento contínuo com controles técnicos (MFA, filtro, sandbox).`,
      });
    }

    // Evolução: compara com a campanha anterior (enviada) da mesma empresa.
    const prev = await this.prisma.campaign.findFirst({
      where: {
        companyId: campaign.company.id,
        id: { not: campaignId },
        status: { in: ['SENDING', 'SENT'] },
        createdAt: { lt: campaign.createdAt },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });
    let evolution:
      | {
          trend: 'improving' | 'worsening' | 'flat' | 'first';
          previousCampaign?: string;
          previousCompromiseRate?: number;
          currentCompromiseRate: number;
          deltaPoints?: number;
        }
      | undefined;
    if (prev) {
      const prevRate = await this.compromiseRateOf(prev.id);
      const delta = +(rates.compromiseRate - prevRate).toFixed(1);
      evolution = {
        trend: delta < 0 ? 'improving' : delta > 0 ? 'worsening' : 'flat',
        previousCampaign: prev.name,
        previousCompromiseRate: prevRate,
        currentCompromiseRate: rates.compromiseRate,
        deltaPoints: delta,
      };
    } else {
      evolution = { trend: 'first', currentCompromiseRate: rates.compromiseRate };
    }

    // Ordena recomendações por severidade.
    const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    recs.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        company: campaign.company.name,
        template: {
          name: campaign.template.name,
          sector: campaign.template.sector,
          trigger: campaign.template.trigger,
          difficulty: campaign.template.difficulty,
          difficultyLabel:
            DIFFICULTY_LABEL[campaign.template.difficulty] ?? '—',
        },
        status: campaign.status,
      },
      summary: {
        ...funnel,
        ...rates,
        headline: `${funnel.clicked} de ${funnel.total} pessoas (${rates.compromiseRate}%) cairiam num golpe real.`,
      },
      byDepartment,
      recommendations: recs,
      evolution,
      benchmarkNote:
        'Phishing está entre os principais vetores iniciais de invasão corporativa (Verizon DBIR). Taxas de clique acima de ~15–20% indicam necessidade de reforço; a meta é reduzir a cada campanha.',
    };
  }
}
