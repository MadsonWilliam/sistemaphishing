import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
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
    brandLogoUrl: '',
    brandColor: '',
    brandColor2: '',
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
  const [logoErr, setLogoErr] = useState('');

  function onLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 260_000) {
      setLogoErr('Imagem muito grande (máx ~250KB). Reduza e tente de novo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setF((prev) => ({ ...prev, brandLogoUrl: String(reader.result) }));
      setLogoErr('');
    };
    reader.readAsDataURL(file);
  }

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
        brandLogoUrl: f.brandLogoUrl.trim() || undefined,
        brandColor: f.brandColor.trim() || undefined,
        brandColor2: f.brandColor2.trim() || undefined,
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
          <p className="text-xs text-slate-500">
            🔗 O domínio do link agora é o <strong>mesmo do remetente</strong>{' '}
            escolhido (ex.: remetente <code>contabilmaisbrasil.com.br</code> →
            link <code>contabilmaisbrasil.com.br/fatura/…</code>). Nada a
            configurar aqui.
          </p>
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

        <Card className="p-4 space-y-4 lg:col-span-2">
          <div className="text-sm font-medium">5 · Opcionais — marca do cliente</div>
          <p className="text-xs text-slate-500">
            Use só se o cliente <strong>quiser</strong> a landing com a cara
            dele. Sem nada aqui, a página falsa fica um portal neutro.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Logo (upload) */}
            <div>
              <span className="block text-xs text-slate-400 mb-1">
                Logo do cliente (aparece na landing)
              </span>
              <div className="flex items-center gap-3">
                {f.brandLogoUrl ? (
                  <img
                    src={f.brandLogoUrl}
                    alt=""
                    className="h-10 max-w-[120px] object-contain bg-white rounded px-1"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-slate-800 grid place-items-center text-slate-500 text-[10px]">
                    logo
                  </div>
                )}
                <label className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs cursor-pointer">
                  Enviar imagem
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={onLogoFile}
                  />
                </label>
                {f.brandLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setF({ ...f, brandLogoUrl: '' })}
                    className="text-xs text-slate-500 hover:text-red-400"
                  >
                    remover
                  </button>
                )}
              </div>
              {logoErr && (
                <span className="block text-xs text-amber-400 mt-1">{logoErr}</span>
              )}
              <span className="block text-[11px] text-slate-500 mt-1">
                PNG/JPG/SVG até ~250KB. A imagem fica embutida — não precisa de
                link público.
              </span>
            </div>

            {/* Recorrência */}
            <div>
              <span className="block text-xs text-slate-400 mb-1">
                Recorrência automática
              </span>
              <select
                value={f.recurrence}
                onChange={(e) => setF({ ...f, recurrence: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
              >
                <option value="NONE">Não repetir (campanha única)</option>
                <option value="WEEKLY">Repetir toda semana</option>
                <option value="MONTHLY">Repetir todo mês</option>
                <option value="QUARTERLY">Repetir a cada trimestre</option>
              </select>
              <span className="block text-[11px] text-slate-500 mt-1">
                Re-dispara a <strong>mesma</strong> campanha (mesmos alvos e
                configuração) no intervalo, medindo a evolução sozinha.
              </span>
            </div>
          </div>

          {/* Cores (até 2) */}
          <div className="grid md:grid-cols-2 gap-4">
            <ColorField
              label="Cor principal da marca"
              value={f.brandColor}
              onChange={(v) => setF({ ...f, brandColor: v })}
            />
            <ColorField
              label="Cor secundária (opcional)"
              value={f.brandColor2}
              onChange={(v) => setF({ ...f, brandColor2: v })}
            />
          </div>

          <p className="text-[11px] text-slate-500">
            Iscas com QR: escolha "Formulário falso" no passo 3 para contar como
            "submeteu".
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

const COLOR_PRESETS = [
  '#2563eb', '#1a73e8', '#0ea5e9', '#0891b2',
  '#059669', '#16a34a', '#65a30d', '#ca8a04',
  '#ea580c', '#dc2626', '#e11d48', '#db2777',
  '#7c3aed', '#4f46e5', '#0f172a', '#475569',
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#2563eb'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded bg-slate-950 border border-slate-700 cursor-pointer p-0.5"
        />
        <input
          type="text"
          placeholder="#1a73e8"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-slate-500 hover:text-red-400"
          >
            limpar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className={`h-6 w-6 rounded-full border transition ${
              value.toLowerCase() === c ? 'border-white ring-2 ring-white/40' : 'border-white/20'
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
