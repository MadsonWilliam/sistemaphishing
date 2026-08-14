import { Fragment, ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Badge, Btn, Card, PageHeader } from '../components/ui';

type Stage =
  | 'NOVO'
  | 'CONTATADO'
  | 'QUALIFICADO'
  | 'PROPOSTA'
  | 'GANHO'
  | 'PERDIDO';

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  employees?: string | null;
  message?: string | null;
  notes?: string | null;
  stage: Stage;
  notified: boolean;
  createdAt: string;
}

const STAGES: { key: Stage; label: string; tone: string }[] = [
  { key: 'NOVO', label: 'Novo', tone: 'blue' },
  { key: 'CONTATADO', label: 'Contatado', tone: 'amber' },
  { key: 'QUALIFICADO', label: 'Qualificado', tone: 'amber' },
  { key: 'PROPOSTA', label: 'Proposta', tone: 'amber' },
  { key: 'GANHO', label: 'Ganho', tone: 'green' },
  { key: 'PERDIDO', label: 'Perdido', tone: 'red' },
];
const toneOf = (s: Stage) => STAGES.find((x) => x.key === s)?.tone ?? 'slate';
const labelOf = (s: Stage) => STAGES.find((x) => x.key === s)?.label ?? s;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

export function Leads() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Stage | 'ALL'>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState('');

  const leads = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get<Lead[]>('/leads')).data,
  });

  const patch = useMutation({
    mutationFn: async (v: {
      id: string;
      stage?: Stage;
      notes?: string;
    }) => (await api.patch(`/leads/${v.id}`, v)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const all = leads.data ?? [];
  const counts = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s.key] = all.filter((l) => l.stage === s.key).length;
    return acc;
  }, {});
  const rows = filter === 'ALL' ? all : all.filter((l) => l.stage === filter);

  function toggle(l: Lead) {
    if (expanded === l.id) {
      setExpanded(null);
    } else {
      setExpanded(l.id);
      setDraftNotes(l.notes ?? '');
    }
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Solicitações de demonstração da landing. Avance o estágio conforme evolui o contato."
      />

      {/* Filtros por estágio */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Chip active={filter === 'ALL'} onClick={() => setFilter('ALL')}>
          Todos <span className="opacity-60">{all.length}</span>
        </Chip>
        {STAGES.map((s) => (
          <Chip
            key={s.key}
            active={filter === s.key}
            onClick={() => setFilter(s.key)}
          >
            {s.label} <span className="opacity-60">{counts[s.key] ?? 0}</span>
          </Chip>
        ))}
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left font-medium px-4 py-3">Empresa / contato</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                Funcionários
              </th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                Recebido
              </th>
              <th className="text-left font-medium px-4 py-3">Estágio</th>
              <th className="text-right font-medium px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-b border-slate-800/60 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{l.company}</div>
                    <div className="text-slate-400">{l.name}</div>
                    <div className="text-xs text-slate-500">
                      <a className="hover:text-brand-400" href={`mailto:${l.email}`}>
                        {l.email}
                      </a>
                      {l.phone ? ` · ${l.phone}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                    {l.employees ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">
                    {fmtDate(l.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={toneOf(l.stage)}>{labelOf(l.stage)}</Badge>
                      <select
                        value={l.stage}
                        onChange={(e) =>
                          patch.mutate({ id: l.id, stage: e.target.value as Stage })
                        }
                        className="bg-slate-950 border border-slate-700 rounded-lg text-xs px-2 py-1 focus:border-brand-500 outline-none"
                      >
                        {STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Btn variant="ghost" onClick={() => toggle(l)}>
                      {expanded === l.id ? 'Fechar' : 'Detalhes'}
                    </Btn>
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr className="border-b border-slate-800/60 bg-slate-900/40">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-slate-500 mb-1">
                            Mensagem do prospect
                          </div>
                          <div className="text-sm text-slate-300 whitespace-pre-wrap min-h-[2rem]">
                            {l.message || (
                              <span className="text-slate-600">— sem mensagem —</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-3">
                            Notificação por e-mail:{' '}
                            {l.notified ? (
                              <span className="text-emerald-400">enviada</span>
                            ) : (
                              <span className="text-amber-400">não enviada</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">
                            Anotações internas
                          </div>
                          <textarea
                            value={draftNotes}
                            onChange={(e) => setDraftNotes(e.target.value)}
                            rows={4}
                            placeholder="Registro do acompanhamento (ligação, e-mail, próximo passo)…"
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-brand-500 outline-none text-sm resize-none"
                          />
                          <div className="mt-2 flex items-center gap-3">
                            <Btn
                              onClick={() =>
                                patch.mutate(
                                  { id: l.id, notes: draftNotes },
                                  { onSuccess: () => setExpanded(null) },
                                )
                              }
                              disabled={patch.isPending}
                            >
                              {patch.isPending ? 'Salvando…' : 'Salvar anotações'}
                            </Btn>
                            <a
                              href={`mailto:${l.email}?subject=NexGuard%20—%20sua%20solicitação`}
                              className="text-sm text-brand-400 hover:underline"
                            >
                              Responder por e-mail
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {leads.isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            )}
            {!leads.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {filter === 'ALL'
                    ? 'Nenhum lead ainda. Eles aparecem aqui quando alguém preenche o formulário da landing.'
                    : 'Nenhum lead neste estágio.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm transition border ${
        active
          ? 'bg-slate-800 text-white border-slate-700'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border-transparent'
      }`}
    >
      {children}
    </button>
  );
}
