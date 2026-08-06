import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Badge, Btn, Card, Field, PageHeader } from '../components/ui';

interface Identity {
  id: string;
  localPart: string;
  displayName: string;
}
interface Domain {
  id: string;
  domain: string;
  status: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  lastTestError?: string | null;
  identities: Identity[];
}

const tone: Record<string, string> = {
  VERIFIED: 'green',
  PENDING: 'amber',
  FAILED: 'red',
};

function DomainCard({ d }: { d: Domain }) {
  const qc = useQueryClient();
  const [ident, setIdent] = useState({ localPart: '', displayName: '' });
  const [deliver, setDeliver] = useState<Record<string, unknown> | null>(null);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ['sending-domains'] });

  const verify = useMutation({
    mutationFn: async () =>
      (await api.post(`/sending-domains/${d.id}/verify`)).data,
    onSuccess: refresh,
  });
  const addIdentity = useMutation({
    mutationFn: async () =>
      (await api.post(`/sending-domains/${d.id}/identities`, ident)).data,
    onSuccess: () => {
      setIdent({ localPart: '', displayName: '' });
      refresh();
    },
  });
  const delDomain = useMutation({
    mutationFn: async () => (await api.delete(`/sending-domains/${d.id}`)).data,
    onSuccess: refresh,
  });
  const checkDeliver = useMutation({
    mutationFn: async () =>
      (await api.get(`/sending-domains/${d.id}/deliverability`)).data,
    onSuccess: (data) => setDeliver(data),
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{d.domain}</div>
          <div className="text-xs text-slate-400">
            {d.smtpHost}:{d.smtpPort} · {d.smtpSecure ? 'SSL' : 'STARTTLS'}
          </div>
        </div>
        <Badge tone={tone[d.status]}>{d.status}</Badge>
      </div>
      {d.status === 'FAILED' && d.lastTestError && (
        <div className="text-xs text-red-400 mt-1">{d.lastTestError}</div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <Btn variant="ghost" onClick={() => verify.mutate()} disabled={verify.isPending}>
          {verify.isPending ? 'Testando…' : 'Testar conexão'}
        </Btn>
        <Btn variant="ghost" onClick={() => checkDeliver.mutate()} disabled={checkDeliver.isPending}>
          Entregabilidade
        </Btn>
        <Btn variant="danger" onClick={() => confirm('Excluir domínio?') && delDomain.mutate()}>
          Excluir
        </Btn>
      </div>

      {deliver && (
        <div className="mt-3 text-xs bg-slate-950 border border-slate-800 rounded-lg p-3">
          <div>
            SPF {(deliver as any).spf?.ok ? '✅' : '❌'} · DKIM{' '}
            {(deliver as any).dkim?.ok ? '✅' : '❔'} · DMARC{' '}
            {(deliver as any).dmarc?.ok ? '✅' : '❌'} —{' '}
            <strong>{(deliver as any).status}</strong> ({(deliver as any).score})
          </div>
          {((deliver as any).recommendations as string[])?.map((r, i) => (
            <div key={i} className="text-slate-400 mt-1">
              • {r}
            </div>
          ))}
        </div>
      )}

      {/* Identidades */}
      <div className="mt-4 border-t border-slate-800 pt-3">
        <div className="text-xs text-slate-400 mb-2">Remetentes</div>
        <div className="flex flex-wrap gap-2 mb-2">
          {d.identities.map((i) => (
            <Badge key={i.id} tone="blue">
              {i.localPart}@{d.domain} · {i.displayName}
            </Badge>
          ))}
          {d.identities.length === 0 && (
            <span className="text-xs text-slate-500">Nenhum remetente.</span>
          )}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            addIdentity.mutate();
          }}
        >
          <Field
            placeholder="parte local (ex.: contas)"
            value={ident.localPart}
            onChange={(e) => setIdent({ ...ident, localPart: e.target.value })}
            className="!w-40"
            required
          />
          <Field
            placeholder="nome exibido (ex.: Financeiro)"
            value={ident.displayName}
            onChange={(e) => setIdent({ ...ident, displayName: e.target.value })}
            className="!w-52"
            required
          />
          <Btn variant="ghost" type="submit" disabled={addIdentity.isPending}>
            + remetente
          </Btn>
        </form>
      </div>
    </Card>
  );
}

export function Domains() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    domain: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUsername: '',
    smtpPassword: '',
  });
  const [error, setError] = useState('');

  const domains = useQuery({
    queryKey: ['sending-domains'],
    queryFn: async () => (await api.get<Domain[]>('/sending-domains')).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (await api.post('/sending-domains', { ...form, smtpPort: Number(form.smtpPort) })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sending-domains'] });
      setOpen(false);
      setError('');
      setForm({ domain: '', smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUsername: '', smtpPassword: '' });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(
        (Array.isArray(err.response?.data?.message)
          ? err.response?.data?.message[0]
          : err.response?.data?.message) || 'Erro ao criar domínio.',
      );
    },
  });

  return (
    <div>
      <PageHeader
        title="Domínios de envio"
        subtitle="Servidores SMTP e remetentes. As senhas ficam cifradas."
        action={<Btn onClick={() => setOpen((o) => !o)}>+ Novo domínio</Btn>}
      />

      {open && (
        <Card className="p-4 mb-6">
          <form
            className="grid md:grid-cols-3 gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Domínio" placeholder="dominiolegal.com.br" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} required />
            <Field label="Host SMTP" placeholder="smtp.provedor.com" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} required />
            <Field label="Porta" type="number" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })} required />
            <Field label="Usuário SMTP" value={form.smtpUsername} onChange={(e) => setForm({ ...form, smtpUsername: e.target.value })} required />
            <Field label="Senha SMTP" type="password" value={form.smtpPassword} onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })} required />
            <label className="flex items-center gap-2 text-sm text-slate-300 mt-6">
              <input type="checkbox" checked={form.smtpSecure} onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })} />
              SSL/TLS implícito (porta 465)
            </label>
            <div className="md:col-span-3 flex items-center gap-3">
              <Btn type="submit" disabled={create.isPending}>
                {create.isPending ? 'Salvando…' : 'Adicionar domínio'}
              </Btn>
              {error && <span className="text-red-400 text-sm">{error}</span>}
            </div>
          </form>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {domains.data?.map((d) => (
          <DomainCard key={d.id} d={d} />
        ))}
      </div>
    </div>
  );
}
