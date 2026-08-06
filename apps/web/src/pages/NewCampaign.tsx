import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Btn, Card, Field, PageHeader } from '../components/ui';

interface Company {
  id: string;
  name: string;
}
interface Template {
  id: string;
  name: string;
  sector: string;
  difficulty: number;
}
interface Identity {
  id: string;
  localPart: string;
  displayName: string;
}
interface Domain {
  id: string;
  domain: string;
  status: string;
  identities: Identity[];
}

const DIFF_LABEL: Record<number, string> = {
  1: 'fácil de identificar',
  2: 'moderada',
  3: 'difícil de identificar',
};

export function NewCampaign() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [f, setF] = useState({
    companyId: '',
    templateId: '',
    name: '',
    recipientsText: '',
    postClickBehavior: 'EDUCATIONAL',
    showReportButton: true,
    microTraining: true,
    dripWindowSeconds: 0,
  });
  const [senderIds, setSenderIds] = useState<string[]>([]);

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  });
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: async () => (await api.get<Template[]>('/templates')).data,
  });
  const domains = useQuery({
    queryKey: ['sending-domains'],
    queryFn: async () => (await api.get<Domain[]>('/sending-domains')).data,
  });

  const identities = useMemo(
    () =>
      (domains.data ?? [])
        .filter((d) => d.status === 'VERIFIED')
        .flatMap((d) =>
          d.identities.map((i) => ({
            id: i.id,
            label: `${i.localPart}@${d.domain} · ${i.displayName}`,
          })),
        ),
    [domains.data],
  );

  const recipients = useMemo(
    () =>
      f.recipientsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [email, name, department] = line.split(',').map((s) => s?.trim());
          return { email, name: name || undefined, department: department || undefined };
        })
        .filter((r) => r.email),
    [f.recipientsText],
  );

  const submit = useMutation({
    mutationFn: async (opts: { send: boolean }) => {
      const created = await api.post('/campaigns', {
        companyId: f.companyId,
        name: f.name,
        templateId: f.templateId,
        postClickBehavior: f.postClickBehavior,
        showReportButton: f.showReportButton,
        microTraining: f.microTraining,
        dripWindowSeconds: Number(f.dripWindowSeconds),
        recipients,
      });
      if (opts.send) {
        await api.post(`/campaigns/${created.data.id}/send`, {
          senderIdentityIds: senderIds,
        });
      }
      return created.data;
    },
    onSuccess: () => navigate('/campaigns'),
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const m = err.response?.data?.message;
      setError((Array.isArray(m) ? m[0] : m) || 'Erro ao criar campanha.');
    },
  });

  const canSend = senderIds.length > 0 && recipients.length > 0 && f.companyId && f.templateId;

  return (
    <div>
      <PageHeader title="Nova campanha" subtitle="Monte e dispare uma simulação." />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">1 · Básico</div>
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Empresa-alvo</span>
            <select
              value={f.companyId}
              onChange={(e) => setF({ ...f, companyId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            >
              <option value="">Selecione…</option>
              {companies.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Isca (template)</span>
            <select
              value={f.templateId}
              onChange={(e) => setF({ ...f, templateId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            >
              <option value="">Selecione…</option>
              {templates.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.sector} · dif {t.difficulty} (
                  {DIFF_LABEL[t.difficulty] ?? '—'})
                </option>
              ))}
            </select>
            <span className="block text-xs text-slate-500 mt-1">
              Dificuldade: 1 = fácil da pessoa identificar (poucos caem) · 3 =
              difícil de identificar / mais convincente (muitos caem).
            </span>
          </label>
          <Field
            label="Nome da campanha"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">2 · Destinatários</div>
          <p className="text-xs text-slate-400">
            Um por linha: <code>email,nome,setor</code> (nome e setor opcionais).
          </p>
          <textarea
            value={f.recipientsText}
            onChange={(e) => setF({ ...f, recipientsText: e.target.value })}
            rows={7}
            placeholder={'ana@empresa.com,Ana,Financeiro\nbruno@empresa.com,Bruno,TI'}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono"
          />
          <div className="text-xs text-slate-500">{recipients.length} destinatário(s)</div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">3 · Comportamento pós-clique</div>
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Ao clicar, exibir</span>
            <select
              value={f.postClickBehavior}
              onChange={(e) => setF({ ...f, postClickBehavior: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            >
              <option value="EDUCATIONAL">Página educativa</option>
              <option value="BLANK">Tela em branco</option>
              <option value="FORM">Formulário falso (não salva senha)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.showReportButton} onChange={(e) => setF({ ...f, showReportButton: e.target.checked })} />
            Incluir botão "Reportar phishing"
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.microTraining} onChange={(e) => setF({ ...f, microTraining: e.target.checked })} />
            Micro-treino após o clique
          </label>
          <Field
            label="Gota-a-gota: espalhar envios em (segundos)"
            type="number"
            value={f.dripWindowSeconds}
            onChange={(e) => setF({ ...f, dripWindowSeconds: Number(e.target.value) })}
          />
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">4 · Remetentes (rotação)</div>
          {identities.length === 0 ? (
            <p className="text-xs text-amber-400">
              Nenhum remetente de domínio verificado. Cadastre/verifique um
              domínio em "Domínios" antes de disparar.
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-auto">
              {identities.map((i) => (
                <label key={i.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={senderIds.includes(i.id)}
                    onChange={(e) =>
                      setSenderIds((prev) =>
                        e.target.checked
                          ? [...prev, i.id]
                          : prev.filter((x) => x !== i.id),
                      )
                    }
                  />
                  {i.label}
                </label>
              ))}
            </div>
          )}
        </Card>
      </div>

      {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <Btn
          onClick={() => submit.mutate({ send: true })}
          disabled={!canSend || submit.isPending}
        >
          {submit.isPending ? 'Processando…' : 'Criar e disparar'}
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => submit.mutate({ send: false })}
          disabled={!f.companyId || !f.templateId || recipients.length === 0 || submit.isPending}
        >
          Salvar rascunho
        </Btn>
      </div>
    </div>
  );
}
