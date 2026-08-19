import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Btn, Card, PageHeader } from '../components/ui';

interface Campaign {
  id: string;
  name: string;
  status: string;
  company?: { name: string };
  template?: { name: string; sector: string };
  _count?: { targets: number };
}

const tone: Record<string, string> = {
  SENDING: 'blue',
  SENT: 'green',
  DRAFT: 'slate',
  SCHEDULED: 'amber',
  CANCELED: 'red',
};

function ShareButton({ id }: { id: string }) {
  const [url, setUrl] = useState('');
  const share = useMutation({
    mutationFn: async () =>
      (await api.post(`/campaigns/${id}/share`)).data as { url: string },
    onSuccess: (d) => setUrl(d.url),
  });
  if (url)
    return (
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1 w-56"
          onFocus={(e) => e.target.select()}
        />
        <Btn variant="ghost" onClick={() => navigator.clipboard.writeText(url)}>
          copiar
        </Btn>
      </div>
    );
  return (
    <Btn variant="ghost" onClick={() => share.mutate()} disabled={share.isPending}>
      Compartilhar relatório
    </Btn>
  );
}

function DeleteButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => (await api.delete(`/campaigns/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
  return (
    <Btn
      variant="danger"
      onClick={() =>
        confirm('Excluir esta campanha e todos os seus dados?') && del.mutate()
      }
    >
      Excluir
    </Btn>
  );
}

export function Campaigns() {
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const campaigns = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => (await api.get<Campaign[]>('/campaigns')).data,
  });

  return (
    <div>
      <PageHeader
        title="Campanhas"
        subtitle="Simulações disparadas e seus resultados."
        action={
          <Link to="/campaigns/new">
            <Btn>+ Nova campanha</Btn>
          </Link>
        }
      />

      <Card>
        <table className="w-full text-sm">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left font-medium px-4 py-3">Campanha</th>
              <th className="text-left font-medium px-4 py-3">Empresa</th>
              <th className="text-left font-medium px-4 py-3">Alvos</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-right font-medium px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.data?.map((c) => (
              <tr key={c.id} className="border-b border-slate-800/60">
                <td className="px-4 py-3">
                  <div>{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {c.template?.name} · {c.template?.sector}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {c.company?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {c._count?.targets ?? 0}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={tone[c.status]}>{c.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link to="/">
                      <Btn variant="ghost">Dashboard</Btn>
                    </Link>
                    {isSuper && <ShareButton id={c.id} />}
                    {isSuper && <DeleteButton id={c.id} />}
                  </div>
                </td>
              </tr>
            ))}
            {campaigns.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma campanha ainda. Crie a primeira.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
