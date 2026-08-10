import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FunnelChart, FunnelLegend, SectorChart } from '../components/charts';

interface Campaign {
  id: string;
  name: string;
  status: string;
  company?: { name: string };
  template?: { name: string; sector: string };
  _count?: { targets: number };
}
interface Stats {
  funnel: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    submitted: number;
    reported: number;
  };
  rates: {
    openRate: number;
    clickRate: number;
    submitRate: number;
    reportRate: number;
    compromiseRate: number;
  };
  automatedFiltered: Record<string, number>;
  byDepartment: {
    department: string;
    total: number;
    clicked: number;
    clickRate: number;
  }[];
}
interface Report {
  summary: { headline: string };
  recommendations: {
    severity: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
  }[];
  evolution: {
    trend: string;
    previousCompromiseRate?: number;
    currentCompromiseRate: number;
    deltaPoints?: number;
  };
}
interface Target {
  id: string;
  toEmail: string;
  toName?: string | null;
  department?: string | null;
  sentAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  submittedAt?: string | null;
  reportedAt?: string | null;
}

// Situação "mais avançada" da pessoa no funil, para a tabela.
function situacao(t: Target): { label: string; tone: string } {
  if (t.reportedAt) return { label: 'Reportou ✓', tone: 'text-emerald-400' };
  if (t.submittedAt) return { label: 'Submeteu dados', tone: 'text-red-400' };
  if (t.clickedAt) return { label: 'Clicou', tone: 'text-amber-400' };
  if (t.openedAt) return { label: 'Abriu', tone: 'text-blue-400' };
  if (t.sentAt) return { label: 'Enviado', tone: 'text-slate-400' };
  return { label: 'Pendente', tone: 'text-slate-500' };
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-slate-400 text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

const sevColor: Record<string, string> = {
  high: 'border-red-500/40 bg-red-500/10',
  medium: 'border-amber-500/40 bg-amber-500/10',
  low: 'border-slate-600/40 bg-slate-700/10',
};

export function Dashboard() {
  const [selected, setSelected] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);

  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get<Campaign[]>('/campaigns')).data,
  });

  const current = selected || campaigns.data?.[0]?.id || '';

  const stats = useQuery({
    queryKey: ['stats', current],
    queryFn: async () => (await api.get<Stats>(`/campaigns/${current}/stats`)).data,
    enabled: !!current,
  });
  const report = useQuery({
    queryKey: ['report', current],
    queryFn: async () => (await api.get<Report>(`/campaigns/${current}/report`)).data,
    enabled: !!current,
  });
  const targets = useQuery({
    queryKey: ['targets', current],
    queryFn: async () =>
      (await api.get<Target[]>(`/campaigns/${current}/targets`)).data,
    enabled: !!current,
  });

  const botClicks = useMemo(
    () => stats.data?.automatedFiltered?.CLICKED ?? 0,
    [stats.data],
  );

  // Pessoas filtradas pelo setor selecionado no gráfico (cross-filter).
  const people = useMemo(() => {
    const all = targets.data ?? [];
    return sectorFilter
      ? all.filter((t) => (t.department ?? '—') === sectorFilter)
      : all;
  }, [targets.data, sectorFilter]);

  if (campaigns.isLoading)
    return <div className="text-slate-400">Carregando campanhas…</div>;

  if (!campaigns.data?.length)
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
        Nenhuma campanha ainda. Crie a primeira para ver os resultados aqui.
      </div>
    );

  const f = stats.data?.funnel;
  const r = stats.data?.rates;
  const selectedSector = stats.data?.byDepartment.find(
    (d) => d.department === sectorFilter,
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho + seletor */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Resultados da campanha</h1>
          {report.data && (
            <p className="text-slate-400 text-sm mt-1">
              {report.data.summary.headline}
            </p>
          )}
        </div>
        <select
          value={current}
          onChange={(e) => {
            setSelected(e.target.value);
            setSectorFilter(null);
          }}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
        >
          {campaigns.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.company?.name ? `· ${c.company.name}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      {f && r && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Enviados" value={f.sent} />
          <Kpi label="Abriram" value={f.opened} />
          <Kpi label="Clicaram" value={f.clicked} accent="text-amber-400" />
          <Kpi label="Submeteram" value={f.submitted} accent="text-red-400" />
          <Kpi label="Reportaram" value={f.reported} accent="text-emerald-400" />
          <Kpi
            label="Comprometimento"
            value={`${r.compromiseRate}%`}
            accent="text-red-400"
          />
        </div>
      )}

      {botClicks > 0 && (
        <div className="text-xs text-slate-500">
          🤖 {botClicks} acesso(s) automático(s) (proxy/scanner) filtrados do
          funil.
        </div>
      )}

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 overflow-hidden">
          <div className="text-sm font-medium mb-2">Funil de conversão</div>
          {f && <FunnelChart data={f} />}
          <FunnelLegend />
          <p className="text-xs text-slate-500 mt-2">
            "Reportaram" é um acerto (fora do funil): quem reportou o e-mail
            como phishing em vez de cair.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">
              Cliques por setor{' '}
              <span className="text-slate-500 font-normal">
                (clique numa barra)
              </span>
            </div>
            {sectorFilter && (
              <button
                onClick={() => setSectorFilter(null)}
                className="text-xs text-brand-500 hover:underline"
              >
                limpar filtro
              </button>
            )}
          </div>
          {stats.data && (
            <SectorChart
              data={stats.data.byDepartment}
              onSelect={setSectorFilter}
            />
          )}
          {selectedSector && (
            <div className="mt-2 text-sm text-slate-300 border-t border-slate-800 pt-2">
              <strong>{selectedSector.department}</strong>:{' '}
              {selectedSector.clicked} de {selectedSector.total} clicaram (
              {selectedSector.clickRate}%)
            </div>
          )}
        </div>
      </div>

      {/* Recomendações + evolução */}
      {report.data && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm font-medium mb-3">
              Boas práticas recomendadas
            </div>
            <div className="space-y-2">
              {report.data.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${sevColor[rec.severity]}`}
                >
                  <div className="font-medium text-sm">{rec.title}</div>
                  <div className="text-slate-300 text-sm mt-1">{rec.detail}</div>
                </div>
              ))}
              {report.data.recommendations.length === 0 && (
                <div className="text-slate-400 text-sm">
                  Sem alertas — ótimo resultado.
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm font-medium mb-3">Evolução</div>
            {report.data.evolution.trend === 'first' ? (
              <p className="text-slate-400 text-sm">
                Primeira campanha desta empresa. A partir da próxima, mostramos a
                variação da taxa de comprometimento.
              </p>
            ) : (
              <div>
                <div className="text-3xl font-bold">
                  {(report.data.evolution.deltaPoints ?? 0) > 0 ? '+' : ''}
                  {report.data.evolution.deltaPoints}pts
                </div>
                <p className="text-slate-400 text-sm mt-1">
                  {report.data.evolution.trend === 'improving'
                    ? 'Melhora vs. campanha anterior 🎉'
                    : report.data.evolution.trend === 'worsening'
                      ? 'Piora vs. campanha anterior'
                      : 'Estável vs. campanha anterior'}{' '}
                  ({report.data.evolution.previousCompromiseRate}% →{' '}
                  {report.data.evolution.currentCompromiseRate}%)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detalhe por pessoa (quem abriu/clicou) — filtra pelo setor clicado */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-medium">
            Pessoas{' '}
            {sectorFilter && (
              <span className="text-slate-400 font-normal">
                · setor {sectorFilter}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {people.length} pessoa(s)
            {sectorFilter && (
              <button
                onClick={() => setSectorFilter(null)}
                className="ml-3 text-brand-500 hover:underline"
              >
                ver todos
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="text-left font-medium px-4 py-2">Pessoa</th>
                <th className="text-left font-medium px-4 py-2">Setor</th>
                <th className="text-left font-medium px-4 py-2">Abriu</th>
                <th className="text-left font-medium px-4 py-2">Clicou</th>
                <th className="text-left font-medium px-4 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {people.map((t) => {
                const s = situacao(t);
                return (
                  <tr key={t.id} className="border-b border-slate-800/60">
                    <td className="px-4 py-2">
                      <div>{t.toName || '—'}</div>
                      <div className="text-xs text-slate-500">{t.toEmail}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {t.department || '—'}
                    </td>
                    <td className="px-4 py-2">{t.openedAt ? '✅' : '—'}</td>
                    <td className="px-4 py-2">
                      {t.clickedAt ? (
                        <span className="text-amber-400">✅</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`px-4 py-2 font-medium ${s.tone}`}>
                      {s.label}
                    </td>
                  </tr>
                );
              })}
              {people.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Nenhuma pessoa neste recorte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
