import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Badge, Btn, Card, Field, PageHeader } from '../components/ui';

interface Company {
  id: string;
  name: string;
  status: string;
  cnpj?: string;
  _count?: { users: number };
}

const statusTone: Record<string, string> = {
  ACTIVE: 'green',
  PROSPECT: 'amber',
  SUSPENDED: 'red',
};

export function Companies() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
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

  const create = useMutation({
    mutationFn: async () => (await api.post('/companies', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      setOpen(false);
      setForm({ name: '', adminName: '', adminEmail: '', adminPassword: '' });
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
                <td className="px-4 py-3 text-right">
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
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma empresa ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
