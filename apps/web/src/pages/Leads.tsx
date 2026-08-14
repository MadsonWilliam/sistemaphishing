import { ReactNode, useState } from 'react';
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
  const [view, setView] = useState<'lista' | 'kanban'>('kanban');
  const [filter, setFilter] = useState<Stage | 'ALL'>('ALL');
  const [detail, setDetail] = useState<Lead | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);

  const leads = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get<Lead[]>('/leads')).data,
  });

  const patch = useMutation({
    mutationFn: async (v: { id: string; stage?: Stage; notes?: string }) =>
      (await api.patch<Lead>(`/leads/${v.id}`, v)).data,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      // Mantém o modal aberto em sincronia com o dado salvo.
      setDetail((d) => (d && d.id === updated.id ? updated : d));
    },
  });

  const all = leads.data ?? [];
  const counts = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s.key] = all.filter((l) => l.stage === s.key).length;
    return acc;
  }, {});

  function move(id: string, stage: Stage) {
    const lead = all.find((l) => l.id === id);
    if (lead && lead.stage !== stage) patch.mutate({ id, stage });
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Solicitações de demonstração da landing. Arraste os cards para avançar o estágio."
        action={
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
            {(['kanban', 'lista'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize transition ${
                  view === v
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        }
      />

      {view === 'kanban' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {STAGES.map((s) => {
            const items = all.filter((l) => l.stage === s.key);
            return (
              <div
                key={s.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(s.key);
                }}
                onDragLeave={() => setDragOver((d) => (d === s.key ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) move(id, s.key);
                }}
                className={`rounded-xl border p-2 min-h-[8rem] transition ${
                  dragOver === s.key
                    ? 'border-brand-500 bg-brand-500/5'
                    : 'border-slate-800 bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between px-1 py-1.5 mb-1">
                  <span className="text-sm font-medium">{s.label}</span>
                  <Badge tone={s.tone}>{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((l) => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('text/plain', l.id)
                      }
                      onClick={() => setDetail(l)}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 cursor-grab active:cursor-grabbing hover:border-slate-700"
                    >
                      <div className="text-sm font-medium leading-tight">
                        {l.company}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {l.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                        <span>{l.employees ?? '—'}</span>
                        <span>{fmtDate(l.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-[11px] text-slate-600 px-1 py-3 text-center">
                      —
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
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
                  <th className="text-left font-medium px-4 py-3">
                    Empresa / contato
                  </th>
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
                {(filter === 'ALL'
                  ? all
                  : all.filter((l) => l.stage === filter)
                ).map((l) => (
                  <tr key={l.id} className="border-b border-slate-800/60">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.company}</div>
                      <div className="text-slate-400">{l.name}</div>
                      <div className="text-xs text-slate-500">
                        {l.email}
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
                      <Badge tone={toneOf(l.stage)}>{labelOf(l.stage)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Btn variant="ghost" onClick={() => setDetail(l)}>
                        Detalhes
                      </Btn>
                    </td>
                  </tr>
                ))}
                {leads.isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Carregando…
                    </td>
                  </tr>
                )}
                {!leads.isLoading && all.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      Nenhum lead ainda. Eles aparecem aqui quando alguém preenche
                      o formulário da landing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {detail && (
        <LeadDetail
          lead={detail}
          onClose={() => setDetail(null)}
          onStage={(stage) => move(detail.id, stage)}
          onSaveNotes={(notes) => patch.mutate({ id: detail.id, notes })}
          saving={patch.isPending}
        />
      )}
    </div>
  );
}

function LeadDetail({
  lead,
  onClose,
  onStage,
  onSaveNotes,
  saving,
}: {
  lead: Lead;
  onClose: () => void;
  onStage: (s: Stage) => void;
  onSaveNotes: (notes: string) => void;
  saving: boolean;
}) {
  const [notes, setNotes] = useState(lead.notes ?? '');

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-6 relative rounded-xl border border-slate-800 bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            ✕
          </button>
          <div className="text-lg font-semibold">{lead.company}</div>
          <div className="text-slate-400 text-sm">{lead.name}</div>
          <div className="text-sm text-slate-500 mt-1">
            <a className="hover:text-brand-400" href={`mailto:${lead.email}`}>
              {lead.email}
            </a>
            {lead.phone ? ` · ${lead.phone}` : ''}
            {lead.employees ? ` · ${lead.employees} func.` : ''}
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-1">Estágio</div>
            <select
              value={lead.stage}
              onChange={(e) => onStage(e.target.value as Stage)}
              className="bg-slate-950 border border-slate-700 rounded-lg text-sm px-3 py-2 focus:border-brand-500 outline-none"
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-1">Mensagem do prospect</div>
            <div className="text-sm text-slate-300 whitespace-pre-wrap">
              {lead.message || <span className="text-slate-600">— sem mensagem —</span>}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Notificação por e-mail:{' '}
              {lead.notified ? (
                <span className="text-emerald-400">enviada</span>
              ) : (
                <span className="text-amber-400">não enviada</span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-1">Anotações internas</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Registro do acompanhamento (ligação, e-mail, próximo passo)…"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-brand-500 outline-none text-sm resize-none"
            />
            <div className="mt-2 flex items-center gap-3">
              <Btn onClick={() => onSaveNotes(notes)} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar anotações'}
              </Btn>
              <a
                href={`mailto:${lead.email}?subject=NexGuard%20—%20sua%20solicitação`}
                className="text-sm text-brand-400 hover:underline"
              >
                Responder por e-mail
              </a>
            </div>
          </div>
        </div>
      </div>
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
