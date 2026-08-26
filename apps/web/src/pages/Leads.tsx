import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Badge, Btn, Card, PageHeader } from '../components/ui';

type Stage =
  | 'NOVO'
  | 'CONTATADO'
  | 'QUALIFICADO'
  | 'ESTRUTURA_CAMPANHA'
  | 'TESTE'
  | 'PROPOSTA'
  | 'GANHO'
  | 'PERDIDO';

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  cnpj?: string | null;
  employees?: string | null;
  message?: string | null;
  notes?: string | null;
  stage: Stage;
  notified: boolean;
  termSentAt?: string | null;
  createdCompanyId?: string | null;
  reportSentAt?: string | null;
  contactsRequestedAt?: string | null;
  proposalPlan?: string | null;
  proposalValue?: string | null;
  proposalConditions?: string | null;
  proposalSentAt?: string | null;
  meetingAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
}

// Máscara de moeda BRL: "800000" -> "R$ 8.000,00".
const maskBRL = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const cents = (parseInt(digits, 10) / 100).toFixed(2);
  const [int, dec] = cents.split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
};

const STAGES: { key: Stage; label: string; tone: string }[] = [
  { key: 'NOVO', label: 'Novo', tone: 'blue' },
  { key: 'QUALIFICADO', label: 'Qualificado', tone: 'amber' },
  { key: 'ESTRUTURA_CAMPANHA', label: 'Estrutura de Campanha', tone: 'amber' },
  { key: 'TESTE', label: 'Campanha Teste', tone: 'blue' },
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

// Sequência do pipeline e o próximo estágio (para o botão "Avançar").
const STAGE_ORDER: Stage[] = [
  'NOVO',
  'QUALIFICADO',
  'ESTRUTURA_CAMPANHA',
  'TESTE',
  'PROPOSTA',
  'GANHO',
];
const nextStageOf = (s: Stage): Stage | null => {
  const i = STAGE_ORDER.indexOf(s);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
};

// Roteiro (o que fazer em cada etapa) — guia o operador pelo Kanban.
const PLAYBOOK: Record<Stage, { titulo: string; passo: string }> = {
  NOVO: {
    titulo: 'Revisar e qualificar',
    passo:
      'Confira os dados do formulário, valide o CNPJ/interesse e envie o termo de autorização.',
  },
  CONTATADO: {
    titulo: 'Qualificar',
    passo: 'Valide o interesse e envie o termo de autorização.',
  },
  QUALIFICADO: {
    titulo: 'Enviar termo de autorização',
    passo:
      'Envie o termo (abaixo). Quando o cliente responder "De acordo" por e-mail, avance para Estrutura de Campanha.',
  },
  ESTRUTURA_CAMPANHA: {
    titulo: 'Solicitar contatos ao cliente',
    passo:
      'Envie o e-mail pedindo nome, e-mail e setor de quem ele quer testar. Ao receber a lista, cadastre e avance para Campanha Teste.',
  },
  TESTE: {
    titulo: 'Rodar teste + enviar relatório',
    passo:
      'Crie a empresa e a campanha (ou use a demo automática). Depois, use o relatório para fidelizar e evoluir para Proposta.',
  },
  PROPOSTA: {
    titulo: 'Proposta comercial',
    passo:
      'Preencha plano, valor e condições abaixo e envie a proposta. Ao fechar, marque como Ganho.',
  },
  GANHO: {
    titulo: 'Cliente ativo 🎉',
    passo: 'Onboarding concluído — cliente fechado.',
  },
  PERDIDO: {
    titulo: 'Encerrado',
    passo: 'Lead marcado como perdido.',
  },
};

export function Leads() {
  const qc = useQueryClient();
  const [view, setView] = useState<'lista' | 'kanban'>('kanban');
  const [filter, setFilter] = useState<Stage | 'ALL'>('ALL');
  const [detail, setDetail] = useState<Lead | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const leads = useQuery({
    queryKey: ['leads'],
    queryFn: async () => (await api.get<Lead[]>('/leads')).data,
  });

  const patch = useMutation({
    mutationFn: async (v: {
      id: string;
      stage?: Stage;
      notes?: string;
      proposalPlan?: string;
      proposalValue?: string;
      proposalConditions?: string;
      meetingAt?: string;
    }) => {
      // O id vai só na URL — enviar no corpo quebra o ValidationPipe
      // (forbidNonWhitelisted) e retorna 400.
      const { id, ...body } = v;
      return (await api.patch<Lead>(`/leads/${id}`, body)).data;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      // Mantém o modal aberto em sincronia com o dado salvo.
      setDetail((d) => (d && d.id === updated.id ? updated : d));
    },
  });

  const sendTerm = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Lead>(`/leads/${id}/send-term`)).data,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setDetail((d) => (d && d.id === updated.id ? updated : d));
    },
  });

  const clientAction = useMutation({
    mutationFn: async (v: {
      id: string;
      kind:
        | 'create-company'
        | 'send-report'
        | 'request-contacts'
        | 'demo-campaign'
        | 'send-proposal'
        | 'archive'
        | 'unarchive';
    }) => (await api.post<Lead>(`/leads/${v.id}/${v.kind}`)).data,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setDetail((d) => (d && d.id === updated.id ? updated : d));
    },
  });
  const clientActionError = (
    clientAction.error as { response?: { data?: { message?: string } } }
  )?.response?.data?.message;

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/leads/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setDetail(null);
    },
  });

  // "Enviar proposta" é absoluto: salva os campos e depois envia.
  async function saveAndSendProposal(
    id: string,
    v: { proposalPlan?: string; proposalValue?: string; proposalConditions?: string },
  ) {
    await patch.mutateAsync({ id, ...v });
    await clientAction.mutateAsync({ id, kind: 'send-proposal' });
  }

  const raw = leads.data ?? [];
  const archivedCount = raw.filter((l) => l.archivedAt).length;
  // Arquivados só entram quando "mostrar arquivados" está ativo.
  const all = showArchived ? raw : raw.filter((l) => !l.archivedAt);
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
          <div className="flex items-center gap-2">
            {archivedCount > 0 && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  showArchived
                    ? 'bg-slate-800 text-white border-slate-700'
                    : 'text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                {showArchived ? 'Ocultar' : 'Mostrar'} arquivados ({archivedCount})
              </button>
            )}
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
          onSendTerm={() => sendTerm.mutate(detail.id)}
          termSending={sendTerm.isPending}
          termError={
            sendTerm.isError
              ? ((sendTerm.error as { response?: { data?: { message?: string } } })
                  ?.response?.data?.message ?? 'Falha ao enviar o termo.')
              : null
          }
          onCreateCompany={() =>
            clientAction.mutate({ id: detail.id, kind: 'create-company' })
          }
          onSendReport={() =>
            clientAction.mutate({ id: detail.id, kind: 'send-report' })
          }
          onRequestContacts={() =>
            clientAction.mutate({ id: detail.id, kind: 'request-contacts' })
          }
          onDemoCampaign={() =>
            clientAction.mutate({ id: detail.id, kind: 'demo-campaign' })
          }
          onSendProposal={(v) => saveAndSendProposal(detail.id, v)}
          onSaveProposal={(v) => patch.mutate({ id: detail.id, ...v })}
          onSaveMeeting={(iso) => patch.mutate({ id: detail.id, meetingAt: iso })}
          onArchive={() =>
            clientAction.mutate({
              id: detail.id,
              kind: detail.archivedAt ? 'unarchive' : 'archive',
            })
          }
          onDelete={() => del.mutate(detail.id)}
          deleting={del.isPending}
          clientPending={clientAction.isPending}
          clientError={clientAction.isError ? clientActionError ?? 'Falha.' : null}
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
  onSendTerm,
  termSending,
  termError,
  onCreateCompany,
  onSendReport,
  onRequestContacts,
  onDemoCampaign,
  onSendProposal,
  onSaveProposal,
  onSaveMeeting,
  onArchive,
  onDelete,
  deleting,
  clientPending,
  clientError,
}: {
  lead: Lead;
  onClose: () => void;
  onStage: (s: Stage) => void;
  onSaveNotes: (notes: string) => void;
  saving: boolean;
  onSendTerm: () => void;
  termSending: boolean;
  termError: string | null;
  onCreateCompany: () => void;
  onSendReport: () => void;
  onRequestContacts: () => void;
  onDemoCampaign: () => void;
  onSendProposal: (v: {
    proposalPlan?: string;
    proposalValue?: string;
    proposalConditions?: string;
  }) => void;
  onSaveProposal: (v: {
    proposalPlan?: string;
    proposalValue?: string;
    proposalConditions?: string;
  }) => void;
  onSaveMeeting: (iso: string) => void;
  onArchive: () => void;
  onDelete: () => void;
  deleting: boolean;
  clientPending: boolean;
  clientError: string | null;
}) {
  const toLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [plan, setPlan] = useState(lead.proposalPlan ?? '');
  const [value, setValue] = useState(lead.proposalValue ?? '');
  const [conditions, setConditions] = useState(lead.proposalConditions ?? '');
  const [meeting, setMeeting] = useState(toLocalInput(lead.meetingAt));
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-6 relative rounded-xl border border-slate-800 bg-slate-900 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            ✕
          </button>
          <div className="text-lg font-semibold pr-8">{lead.company}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-slate-400 text-sm">{lead.name}</span>
            <Badge tone={toneOf(lead.stage)}>{labelOf(lead.stage)}</Badge>
          </div>

          {/* Próximo passo (roteiro por etapa) */}
          <div className="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/[0.06] p-3">
            <div className="text-xs text-brand-300 font-semibold mb-0.5">
              Próximo passo · {PLAYBOOK[lead.stage].titulo}
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              {PLAYBOOK[lead.stage].passo}
            </div>
          </div>

          {/* Todos os dados do formulário */}
          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-1.5">
              Dados do formulário
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm rounded-lg border border-slate-800 bg-slate-950 p-3">
              {(
                [
                  ['Empresa', lead.company],
                  ['CNPJ', lead.cnpj],
                  ['Responsável', lead.name],
                  ['Telefone', lead.phone],
                  ['E-mail', lead.email],
                  ['Funcionários', lead.employees],
                  ['Recebido', fmtDate(lead.createdAt)],
                ] as [string, string | null | undefined][]
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <div className="text-[11px] text-slate-500">{k}</div>
                  <div className="text-slate-200 truncate" title={v || undefined}>
                    {v || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estágio + avançar */}
          <div className="mt-4 flex items-end gap-2">
            <div>
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
            {nextStageOf(lead.stage) && (
              <Btn
                variant="ghost"
                onClick={() => onStage(nextStageOf(lead.stage) as Stage)}
              >
                Avançar → {labelOf(nextStageOf(lead.stage) as Stage)}
              </Btn>
            )}
          </div>

          {/* Reunião / call agendada (opcional) */}
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs text-slate-300 font-medium mb-2">
              📅 Reunião / call agendada
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={meeting}
                onChange={(e) => setMeeting(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg text-sm px-2 py-1.5 focus:border-brand-500 outline-none [color-scheme:dark]"
              />
              <Btn
                variant="ghost"
                onClick={() => onSaveMeeting(meeting)}
                disabled={saving}
              >
                Salvar
              </Btn>
              {lead.meetingAt && (
                <>
                  <span className="text-[11px] text-emerald-400">
                    Agendada: {fmtDateTime(lead.meetingAt)}
                  </span>
                  <button
                    onClick={() => {
                      setMeeting('');
                      onSaveMeeting('');
                    }}
                    className="text-[11px] text-slate-500 hover:text-red-400"
                  >
                    limpar
                  </button>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              Opcional — registre a data/hora da call ou reunião com o cliente.
            </div>
          </div>

          {/* Termo de autorização — aceite por resposta ao e-mail */}
          <div
            className={`mt-4 rounded-lg border p-3 ${
              !lead.termSentAt &&
              (lead.stage === 'QUALIFICADO' || lead.stage === 'CONTATADO')
                ? 'border-brand-500/50 bg-brand-500/[0.06]'
                : 'border-slate-800 bg-slate-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-300 font-medium">
                📄 Termo de autorização do teste
              </div>
              <Btn onClick={onSendTerm} disabled={termSending}>
                {termSending
                  ? 'Enviando…'
                  : lead.termSentAt
                    ? 'Reenviar termo'
                    : 'Enviar termo'}
              </Btn>
            </div>
            <div className="text-xs mt-2">
              {lead.termSentAt ? (
                <span className="text-emerald-400">
                  Enviado em {fmtDateTime(lead.termSentAt)}
                </span>
              ) : (
                <span className="text-slate-500">Ainda não enviado.</span>
              )}
            </div>
            {termError && (
              <div className="text-xs text-red-400 mt-1">{termError}</div>
            )}
            <div className="text-[11px] text-slate-600 mt-2 leading-relaxed">
              Envia o termo (com empresa, CNPJ, responsável e domínio) para{' '}
              <strong>{lead.email}</strong>. O cliente autoriza{' '}
              <strong>respondendo "De acordo"</strong> por e-mail — aí você move
              o card para <strong>Campanha Teste</strong>.
            </div>
          </div>

          {/* Estrutura de Campanha — pedir contatos ao cliente */}
          <div
            className={`mt-4 rounded-lg border p-3 ${
              lead.stage === 'ESTRUTURA_CAMPANHA' && !lead.contactsRequestedAt
                ? 'border-brand-500/50 bg-brand-500/[0.06]'
                : 'border-slate-800 bg-slate-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-300 font-medium">
                📋 Contatos do teste
              </div>
              <Btn
                onClick={onRequestContacts}
                disabled={clientPending}
                variant={lead.contactsRequestedAt ? 'ghost' : 'primary'}
              >
                {clientPending
                  ? 'Enviando…'
                  : lead.contactsRequestedAt
                    ? 'Reenviar solicitação'
                    : 'Solicitar contatos ao cliente'}
              </Btn>
            </div>
            <div className="text-[11px] text-slate-600 mt-2 leading-relaxed">
              Envia um e-mail pedindo <strong>nome, e-mail e setor</strong> de quem
              o cliente quer testar (para você cadastrar e disparar a campanha).
              {lead.contactsRequestedAt && (
                <span className="text-emerald-400">
                  {' '}
                  Solicitado em {fmtDateTime(lead.contactsRequestedAt)}.
                </span>
              )}
            </div>
          </div>

          {/* Cliente / testes — criar empresa + demo + relatório */}
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs text-slate-300 font-medium mb-2">
              🏢 Cliente e testes
            </div>
            {!lead.createdCompanyId ? (
              <div>
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={onCreateCompany} disabled={clientPending}>
                    {clientPending ? 'Criando…' : 'Criar empresa do cliente'}
                  </Btn>
                  <Btn
                    variant="ghost"
                    onClick={onDemoCampaign}
                    disabled={clientPending}
                  >
                    Disparar demo automática
                  </Btn>
                </div>
                <div className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  "Criar empresa" cria <strong>{lead.company}</strong> (com CNPJ)
                  para você rodar campanhas. "Demo automática" cria a empresa{' '}
                  <strong>e dispara uma isca financeira para o próprio cliente</strong>{' '}
                  ({lead.email}) experimentar o teste.
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs text-emerald-400 mb-2">
                  Empresa criada ✓ — pronta para campanhas.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to="/campaigns/new">
                    <Btn variant="ghost">Criar campanha</Btn>
                  </Link>
                  <Btn
                    variant="ghost"
                    onClick={onDemoCampaign}
                    disabled={clientPending}
                  >
                    Demo automática
                  </Btn>
                  <Btn onClick={onSendReport} disabled={clientPending}>
                    {clientPending
                      ? 'Enviando…'
                      : lead.reportSentAt
                        ? 'Reenviar relatório'
                        : 'Enviar relatório ao cliente'}
                  </Btn>
                </div>
                <div className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  "Enviar relatório" gera o link do relatório da{' '}
                  <strong>última campanha</strong> deste cliente e envia para{' '}
                  <strong>{lead.email}</strong>.
                  {lead.reportSentAt && (
                    <span className="text-emerald-400">
                      {' '}
                      Enviado em {fmtDateTime(lead.reportSentAt)}.
                    </span>
                  )}
                </div>
              </div>
            )}
            {clientError && (
              <div className="text-xs text-red-400 mt-2">{clientError}</div>
            )}
          </div>

          {/* Proposta comercial — só na etapa Proposta */}
          {lead.stage === 'PROPOSTA' && (
            <div className="mt-4 rounded-lg border border-brand-500/40 bg-brand-500/[0.06] p-3">
              <div className="text-xs text-brand-300 font-semibold mb-2">
                💼 Proposta comercial
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] text-slate-400 mb-1">
                    Plano
                  </span>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-2 py-2 focus:border-brand-500 outline-none"
                  >
                    <option value="">Selecione…</option>
                    <option value="Essencial — até 2 testes/mês">
                      Essencial — até 2 testes/mês
                    </option>
                    <option value="Ilimitado — testes ilimitados + outros domínios">
                      Ilimitado — ilimitado + outros domínios
                    </option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] text-slate-400 mb-1">
                    Valor
                  </span>
                  <input
                    value={value}
                    onChange={(e) => setValue(maskBRL(e.target.value))}
                    inputMode="numeric"
                    placeholder="R$ 8.000,00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-2 py-2 focus:border-brand-500 outline-none"
                  />
                </label>
              </div>
              <label className="block mt-2">
                <span className="block text-[11px] text-slate-400 mb-1">
                  Condições (opcional)
                </span>
                <textarea
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  rows={2}
                  placeholder="Ex.: fidelidade 6 meses, setup incluído, suporte por e-mail…"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-2 py-2 focus:border-brand-500 outline-none resize-none"
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Btn
                  variant="ghost"
                  onClick={() =>
                    onSaveProposal({
                      proposalPlan: plan,
                      proposalValue: value,
                      proposalConditions: conditions,
                    })
                  }
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </Btn>
                <Btn
                  onClick={() =>
                    onSendProposal({
                      proposalPlan: plan,
                      proposalValue: value,
                      proposalConditions: conditions,
                    })
                  }
                  disabled={clientPending || saving || !plan || !value}
                >
                  {clientPending
                    ? 'Enviando…'
                    : lead.proposalSentAt
                      ? 'Reenviar proposta'
                      : 'Enviar proposta'}
                </Btn>
                {lead.proposalSentAt && (
                  <span className="text-[11px] text-emerald-400">
                    Enviada em {fmtDateTime(lead.proposalSentAt)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                "Enviar" já salva e dispara o e-mail comercial para{' '}
                <strong>{lead.email}</strong>.
              </div>
            </div>
          )}

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

          {/* Rodapé — arquivar / excluir */}
          <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-3">
            <Btn variant="ghost" onClick={onArchive} disabled={clientPending}>
              {lead.archivedAt ? 'Desarquivar' : 'Arquivar'}
            </Btn>
            <Btn
              variant="danger"
              onClick={() => {
                if (
                  confirm('Excluir este lead permanentemente? Não dá para desfazer.')
                )
                  onDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Excluindo…' : 'Excluir lead'}
            </Btn>
            {lead.archivedAt && (
              <span className="text-[11px] text-slate-500">
                Arquivado em {fmtDateTime(lead.archivedAt)}
              </span>
            )}
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
