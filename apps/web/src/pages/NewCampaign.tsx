import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
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

const SETORES = [
  'Financeiro',
  'Contabilidade',
  'Jurídico',
  'RH',
  'TI',
  'Administrativo',
  'Compras',
  'Logística',
  'Diretoria',
  'Comercial',
  'Operações',
];

interface Recipient {
  email: string;
  name?: string;
  department?: string;
}

export function NewCampaign() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [error, setError] = useState('');
  const [f, setF] = useState({
    // Admin do cliente: empresa já é a dele (backend também força isso).
    companyId: isSuper ? '' : user?.companyId ?? '',
    templateId: '',
    name: '',
    postClickBehavior: 'EDUCATIONAL',
    showReportButton: true,
    microTraining: true,
    dripWindowSeconds: 0,
    linkDomain: '',
    brandLogoUrl: '',
    brandColor: '',
    trainingUrl: '',
    recurrence: 'NONE',
  });
  const [senderIds, setSenderIds] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [rec, setRec] = useState<Recipient>({
    email: '',
    name: '',
    department: '',
  });
  const [bulk, setBulk] = useState('');

  function addRecipient() {
    const email = rec.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    if (recipients.some((r) => r.email === email)) return;
    setRecipients((prev) => [
      ...prev,
      {
        email,
        name: rec.name?.trim() || undefined,
        department: rec.department?.trim() || undefined,
      },
    ]);
    setRec({ email: '', name: '', department: rec.department });
  }

  function importBulk() {
    const parsed: Recipient[] = bulk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [email, name, department] = line.split(',').map((s) => s?.trim());
        return { email: email?.toLowerCase(), name, department };
      })
      .filter((r) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email || ''));
    setRecipients((prev) => {
      const seen = new Set(prev.map((r) => r.email));
      return [...prev, ...parsed.filter((r) => !seen.has(r.email))];
    });
    setBulk('');
  }

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
    enabled: isSuper, // admin do cliente não lista empresas (403)
  });
  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: async () => (await api.get<Template[]>('/templates')).data,
  });
  // Remetentes disponíveis (sem config SMTP) — escopado pelo backend.
  const domains = useQuery({
    queryKey: ['sending-domains-available'],
    queryFn: async () =>
      (await api.get<Domain[]>('/sending-domains/available')).data,
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

  // Admin do cliente não configura SMTP: se houver remetente(s), já marca por
  // padrão (hoje só existe um). Quando o admin cadastrar vários, ele escolhe.
  const seededSenders = useRef(false);
  useEffect(() => {
    if (!isSuper && !seededSenders.current && identities.length > 0) {
      setSenderIds(identities.map((i) => i.id));
      seededSenders.current = true;
    }
  }, [isSuper, identities]);

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
        linkDomain: f.linkDomain.trim() || undefined,
        brandLogoUrl: f.brandLogoUrl.trim() || undefined,
        brandColor: f.brandColor.trim() || undefined,
        trainingUrl: f.trainingUrl.trim() || undefined,
        recurrence: f.recurrence,
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
          {isSuper ? (
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">
                Empresa-alvo
              </span>
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
          ) : (
            <p className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
              Esta campanha é da <strong className="text-slate-200">sua
              empresa</strong> e só aparece para você.
            </p>
          )}
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
            Adicione um por um com o setor — é o que permite o recorte por setor
            no relatório.
          </p>
          {/* Entrada estruturada */}
          <div className="grid grid-cols-12 gap-2">
            <input
              placeholder="email@empresa.com"
              value={rec.email}
              onChange={(e) => setRec({ ...rec, email: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
              className="col-span-5 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            />
            <input
              placeholder="nome"
              value={rec.name}
              onChange={(e) => setRec({ ...rec, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
              className="col-span-3 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            />
            <input
              list="setores"
              placeholder="setor"
              value={rec.department}
              onChange={(e) => setRec({ ...rec, department: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
              className="col-span-3 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            />
            <datalist id="setores">
              {SETORES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Btn
              type="button"
              onClick={addRecipient}
              className="col-span-1 !px-0"
            >
              +
            </Btn>
          </div>

          {/* Lista adicionada */}
          {recipients.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
              {recipients.map((r, i) => (
                <div
                  key={r.email}
                  className="flex items-center justify-between px-3 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-slate-200">{r.name || r.email}</span>
                    {r.name && (
                      <span className="text-slate-500"> · {r.email}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-blue-300">
                      {r.department || 'sem setor'}
                    </span>
                    <button
                      onClick={() =>
                        setRecipients((prev) => prev.filter((_, x) => x !== i))
                      }
                      className="text-slate-500 hover:text-red-400 text-xs"
                    >
                      remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-slate-500">
            {recipients.length} destinatário(s)
          </div>

          {/* Importação em massa (opcional) */}
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer select-none">
              Importar em massa (colar lista)
            </summary>
            <p className="mt-2">
              Um por linha: <code>email,nome,setor</code>
            </p>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={4}
              placeholder={'ana@empresa.com,Ana,Financeiro\nbruno@empresa.com,Bruno,TI'}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono"
            />
            <Btn type="button" variant="ghost" onClick={importBulk}>
              Importar
            </Btn>
          </details>
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
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">
              Domínio dos links (opcional)
            </span>
            <input
              list="linkdomains"
              placeholder="ex.: link.rsweb.net.br (vazio = domínio da plataforma)"
              value={f.linkDomain}
              onChange={(e) => setF({ ...f, linkDomain: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            />
            <datalist id="linkdomains">
              {(domains.data ?? []).map((d) => (
                <option key={d.id} value={d.domain} />
              ))}
            </datalist>
            <span className="block text-xs text-slate-500 mt-1">
              Deixa o link crível. O ideal é usar o <strong>mesmo domínio do
              remetente</strong>. O domínio precisa apontar para a plataforma
              (adicionar no EasyPanel).
            </span>
          </label>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">4 · Remetentes (rotação)</div>
          {identities.length === 0 ? (
            <p className="text-xs text-amber-400">
              {isSuper
                ? 'Nenhum remetente de domínio verificado. Cadastre/verifique um domínio em "Domínios" antes de disparar.'
                : 'Nenhum remetente disponível ainda. Peça ao administrador da plataforma para configurar um remetente.'}
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

        <Card className="p-4 space-y-3 lg:col-span-2">
          <div className="text-sm font-medium">5 · Opcionais</div>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">
                Logo do cliente (URL) — aparece na landing
              </span>
              <input
                placeholder="https://cliente.com/logo.png"
                value={f.brandLogoUrl}
                onChange={(e) => setF({ ...f, brandLogoUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">
                Cor da marca (landing)
              </span>
              <input
                type="text"
                placeholder="#1a73e8"
                value={f.brandColor}
                onChange={(e) => setF({ ...f, brandColor: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-400 mb-1">
                Recorrência automática
              </span>
              <select
                value={f.recurrence}
                onChange={(e) => setF({ ...f, recurrence: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
              >
                <option value="NONE">Não repetir</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
                <option value="QUARTERLY">Trimestral</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">
              Link de treino (mostrado a quem cai) — opcional
            </span>
            <input
              placeholder="https://treino.suaempresa.com/phishing"
              value={f.trainingUrl}
              onChange={(e) => setF({ ...f, trainingUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
            />
          </label>
          <p className="text-xs text-slate-500">
            Recorrência repete a campanha (mesmos alvos e config) e mede a
            evolução sozinha. Iscas com QR: escolha "Formulário falso" acima para
            contar como "submeteu".
          </p>
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
