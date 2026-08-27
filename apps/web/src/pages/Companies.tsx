import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Badge, Btn, Card, Field, PageHeader } from '../components/ui';

interface Company {
  id: string;
  name: string;
  status: string;
  cnpj?: string;
  allowRecurrence?: boolean;
  _count?: { users: number };
}

const statusTone: Record<string, string> = {
  ACTIVE: 'green',
  PROSPECT: 'amber',
  SUSPENDED: 'red',
};

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
}

export function Companies() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [manageCo, setManageCo] = useState<Company | null>(null);
  const [form, setForm] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    allowRecurrence: false,
  });
  const [error, setError] = useState('');

  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
  });

  const del = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/companies/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });

  const recurrence = useMutation({
    mutationFn: async (v: { id: string; allow: boolean }) =>
      (await api.patch(`/companies/${v.id}/recurrence`, { allowRecurrence: v.allow }))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/companies', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      setOpen(false);
      setForm({
        name: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
        allowRecurrence: false,
      });
      setError('');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'Erro ao criar empresa.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle="Clientes e prospects. Prospect vira ativo ao fechar a venda."
        action={<Btn onClick={() => setOpen((o) => !o)}>+ Nova empresa</Btn>}
      />

      {open && (
        <Card className="p-4 mb-6">
          <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-3">
            <Field
              label="Nome da empresa"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Field
              label="Nome do admin (contato)"
              value={form.adminName}
              onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              required
            />
            <Field
              label="E-mail do admin"
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              required
            />
            <Field
              label="Senha inicial do admin"
              type="text"
              value={form.adminPassword}
              onChange={(e) =>
                setForm({ ...form, adminPassword: e.target.value })
              }
              required
            />
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.allowRecurrence}
                onChange={(e) =>
                  setForm({ ...form, allowRecurrence: e.target.checked })
                }
              />
              Liberar <strong>recorrência</strong> de campanha para este cliente
            </label>
            <div className="md:col-span-2 flex items-center gap-3">
              <Btn type="submit" disabled={create.isPending}>
                {create.isPending ? 'Criando…' : 'Criar empresa'}
              </Btn>
              {error && <span className="text-red-400 text-sm">{error}</span>}
            </div>
          </form>
        </Card>
      )}

      <Card>
        <table className="w-full text-sm">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left font-medium px-4 py-3">Empresa</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3">Usuários</th>
              <th className="text-left font-medium px-4 py-3">Recorrência</th>
              <th className="text-right font-medium px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {companies.data?.map((c) => (
              <tr key={c.id} className="border-b border-slate-800/60">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone[c.status]}>{c.status}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {c._count?.users ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() =>
                      recurrence.mutate({ id: c.id, allow: !c.allowRecurrence })
                    }
                    disabled={recurrence.isPending}
                    className={`px-2.5 py-1 rounded-full text-xs transition ${
                      c.allowRecurrence
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-slate-700/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.allowRecurrence ? 'Liberada ✓' : 'Bloqueada'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Btn variant="ghost" onClick={() => setManageCo(c)}>
                    Usuários
                  </Btn>{' '}
                  <Btn
                    variant="danger"
                    onClick={() =>
                      confirm(
                        `Excluir "${c.name}" e todas as suas campanhas/dados?`,
                      ) && del.mutate(c.id)
                    }
                  >
                    Excluir
                  </Btn>
                </td>
              </tr>
            ))}
            {companies.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma empresa ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {manageCo && (
        <CompanyUsers company={manageCo} onClose={() => setManageCo(null)} />
      )}
    </div>
  );
}

function CompanyUsers({
  company,
  onClose,
}: {
  company: Company;
  onClose: () => void;
}) {
  const users = useQuery({
    queryKey: ['company-users', company.id],
    queryFn: async () =>
      (await api.get<CompanyUser[]>(`/companies/${company.id}/users`)).data,
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
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
        >
          ✕
        </button>
        <div className="text-lg font-semibold pr-8">Usuários · {company.name}</div>
        <div className="text-xs text-slate-500 mt-1">
          Edite o nome e/ou defina uma nova senha para o cliente. Trocar a senha
          encerra as sessões ativas dele.
        </div>

        <div className="mt-4 space-y-3">
          {users.isLoading && (
            <div className="text-sm text-slate-500">Carregando…</div>
          )}
          {users.data?.map((u) => (
            <UserEditor key={u.id} companyId={company.id} user={u} />
          ))}
          {users.data?.length === 0 && (
            <div className="text-sm text-slate-500">
              Esta empresa ainda não tem usuários (crie a empresa pelo lead ou
              pelo formulário "+ Nova empresa" para gerar o admin).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserEditor({
  companyId,
  user,
}: {
  companyId: string;
  user: CompanyUser;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState('');
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const body: { name?: string; password?: string } = {};
      if (name.trim() && name.trim() !== user.name) body.name = name.trim();
      if (password) body.password = password;
      return (
        await api.patch(`/companies/${companyId}/users/${user.id}`, body)
      ).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-users', companyId] });
      setPassword('');
      setOk(true);
      setError('');
      setTimeout(() => setOk(false), 2500);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const m = err.response?.data?.message;
      setError((Array.isArray(m) ? m[0] : m) || 'Erro ao salvar.');
    },
  });

  const dirty = (name.trim() && name.trim() !== user.name) || !!password;
  const pwTooShort = !!password && password.length < 8;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-slate-200">{user.email}</div>
        <Badge tone={user.role === 'COMPANY_ADMIN' ? 'blue' : 'slate'}>
          {user.role === 'COMPANY_ADMIN' ? 'Admin' : user.role}
        </Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mt-2">
        <label className="block">
          <span className="block text-[11px] text-slate-400 mb-1">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-2 py-2 focus:border-brand-500 outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] text-slate-400 mb-1">
            Nova senha
          </span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="deixe em branco p/ manter"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-2 py-2 focus:border-brand-500 outline-none"
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Btn
          onClick={() => save.mutate()}
          disabled={save.isPending || !dirty || pwTooShort}
        >
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Btn>
        {pwTooShort && (
          <span className="text-[11px] text-amber-400">
            Senha: mínimo 8 caracteres.
          </span>
        )}
        {ok && <span className="text-[11px] text-emerald-400">Salvo ✓</span>}
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>
    </div>
  );
}
