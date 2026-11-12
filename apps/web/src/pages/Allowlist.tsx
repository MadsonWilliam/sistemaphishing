import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card, PageHeader } from '../components/ui';

interface Domain {
  id: string;
  domain: string;
  status?: string;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-xs grid place-items-center mt-0.5">
        {n}
      </span>
      <span className="text-sm text-slate-300">{children}</span>
    </li>
  );
}

function Guide({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="font-medium mb-3">{title}</div>
      <ol className="space-y-2">{children}</ol>
    </Card>
  );
}

export function Allowlist() {
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [copied, setCopied] = useState(false);
  // Remetentes disponíveis ao escopo: o cliente vê os domínios de envio das
  // iscas (os dois); o super admin vê todos. Endpoint liberado p/ company_admin.
  const domains = useQuery({
    queryKey: ['allowlist-domains'],
    queryFn: async () =>
      (await api.get<Domain[]>('/sending-domains/available')).data,
  });
  const [sel, setSel] = useState('');
  const domain = useMemo(
    () => domains.data?.find((d) => d.id === sel) ?? domains.data?.[0],
    [domains.data, sel],
  );
  const dom = domain?.domain ?? 'seu-dominio.com.br';

  // Todos os domínios de envio (lista a enviar ao TI — cobre os dois de uma vez).
  const domainList =
    domains.data && domains.data.length ? domains.data.map((d) => d.domain) : [dom];
  const multi = domainList.length > 1;
  const bullets = domainList.map((d) => `  • Domínio de envio: ${d}`).join('\n');

  const brief = `Prezado time de TI,

Vamos conduzir um teste AUTORIZADO de conscientização de phishing com os
colaboradores. Para que os resultados sejam fiéis, é essencial que os e-mails
de simulação NÃO sejam bloqueados, colocados em quarentena, nem tenham os links
reescritos/pré-escaneados pelo gateway de segurança.

Por favor, adicione ${multi ? 'os seguintes remetentes' : 'o seguinte remetente'} à lista de permissão (allowlist),
desativando filtro de spam/phishing, sandbox/detonação e reescrita de links
(ex.: Safe Links, URL Defense) SOMENTE para ${multi ? 'estes remetentes' : 'este remetente'}:

${bullets}

Isso vale apenas para a janela do teste e apenas para ${multi ? 'estes domínios' : 'este domínio'}.
Obrigado!`;

  return (
    <div>
      <PageHeader
        title="Allowlisting (lista de permissão)"
        subtitle="Para dados 100% fiéis: o gateway do cliente não deve escanear/reescrever os e-mails de simulação."
      />

      <Card className="p-4 mb-6 border-amber-500/30 bg-amber-500/5">
        <p className="text-sm text-slate-300">
          {isSuper ? (
            <>
              Sem allowlisting, nossas 3 camadas anti-scanner já protegem os
              dados (ótimo para prospects/trials). Mas para{' '}
              <strong>clientes ativos</strong>, pedir ao TI do cliente para
              liberar nosso domínio de envio elimina de vez qualquer
              interferência de scanner — <strong>é o padrão da indústria</strong>{' '}
              (KnowBe4, Cofense) e vira um diferencial de implantação
              profissional.
            </>
          ) : (
            <>
              Para que o teste reflita <strong>pessoas reais</strong>, peça ao seu
              time de TI para liberar{' '}
              {multi ? 'os domínios de envio abaixo' : 'o domínio de envio abaixo'}{' '}
              na lista de permissão (allowlist) — assim nenhum filtro de spam ou
              scanner de links interfere nos resultados. É o{' '}
              <strong>padrão da indústria</strong> (KnowBe4, Cofense). Abaixo há
              uma mensagem pronta para copiar e os passos por provedor.
            </>
          )}
        </p>
      </Card>

      {domains.data && domains.data.length > 1 && (
        <label className="block mb-4">
          <span className="block text-xs text-slate-400 mb-1">
            Domínio de envio
          </span>
          <select
            value={domain?.id ?? ''}
            onChange={(e) => setSel(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm"
          >
            {domains.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.domain}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Texto pronto para enviar ao TI do cliente */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">
            {isSuper
              ? 'Mensagem pronta para o TI do cliente'
              : 'Mensagem pronta para o seu time de TI'}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(brief);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white"
          >
            {copied ? 'Copiado ✓' : 'Copiar'}
          </button>
        </div>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto">
          {brief}
        </pre>
      </Card>

      {/* Guias por provedor */}
      {multi && (
        <p className="text-xs text-slate-400 mb-3">
          Os passos abaixo mostram o domínio <code>{dom}</code>. Repita o mesmo
          para o outro domínio usando o seletor acima — ou simplesmente envie a
          mensagem pronta, que já cobre os dois.
        </p>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <Guide title="Microsoft 365 / Defender">
          <Step n={1}>
            <strong>Regra de transporte</strong> (Exchange admin center): pular a
            filtragem de spam para mensagens do remetente <code>@{dom}</code> (set
            SCL -1).
          </Step>
          <Step n={2}>
            <strong>Safe Links</strong> e <strong>Safe Attachments</strong>
            (Defender): excluir o domínio <code>{dom}</code> — <em>não</em>{' '}
            reescrever/detonar URLs desse remetente.
          </Step>
          <Step n={3}>
            <strong>Tenant Allow/Block List</strong>: adicionar <code>{dom}</code>{' '}
            como permitido.
          </Step>
        </Guide>

        <Guide title="Google Workspace / Gmail">
          <Step n={1}>
            Admin console → <strong>Apps → Google Workspace → Gmail → Spam,
            phishing e malware</strong>: adicionar <code>{dom}</code> à lista de
            remetentes permitidos.
          </Step>
          <Step n={2}>
            Em <strong>Segurança avançada / conformidade de conteúdo</strong>:
            criar isenção para o remetente <code>@{dom}</code> (não aplicar
            varredura agressiva de links).
          </Step>
          <Step n={3}>
            Opcional: adicionar a faixa de IP do servidor de envio à allowlist de
            entrada.
          </Step>
        </Guide>

        <Guide title="Outros gateways (Mimecast, Proofpoint, Barracuda, Sophos…)">
          <Step n={1}>
            Criar uma <strong>política de exceção / bypass</strong> para o
            remetente <code>@{dom}</code>.
          </Step>
          <Step n={2}>
            Desativar <strong>URL rewriting / sandbox / detonação</strong> (o
            equivalente ao Safe Links) apenas para esse remetente.
          </Step>
          <Step n={3}>
            Garantir que as mensagens <strong>não vão para quarentena</strong>.
          </Step>
        </Guide>

        <Guide title="Provedor próprio / webmail (cPanel, Zimbra, Zoho…)">
          <Step n={1}>
            Adicionar <code>{dom}</code> à <strong>whitelist</strong> do filtro de
            spam (SpamAssassin: <code>whitelist_from *@{dom}</code>).
          </Step>
          <Step n={2}>
            Se houver antivírus/scanner de links, criar exceção para o remetente.
          </Step>
          <Step n={3}>
            Regra genérica: <strong>não filtrar, não reescrever links, não
            quarentenar</strong> mensagens de <code>{dom}</code> durante o teste.
          </Step>
        </Guide>

        <Guide title="KingHost">
          <Step n={1}>
            Painel KingHost (<code>painel.kinghost.com.br</code>) →{' '}
            <strong>E-mails</strong> → selecione a conta →{' '}
            <strong>Antispam</strong>: adicione <code>{dom}</code> à{' '}
            <strong>Lista branca</strong> (remetentes liberados).
          </Step>
          <Step n={2}>
            No <strong>Antispam avançado</strong> (quando disponível): em{' '}
            <strong>Remetentes confiáveis</strong>, libere{' '}
            <code>@{dom}</code> — sem filtragem, sem quarentena.
          </Step>
          <Step n={3}>
            No <strong>webmail</strong> da KingHost, marque as mensagens de{' '}
            <code>@{dom}</code> como <strong>"Não é spam"</strong> e crie um
            filtro para não movê-las para o Lixo Eletrônico.
          </Step>
        </Guide>
      </div>

      <p className="text-xs text-slate-500 mt-6">
        Dica: manter <strong>SPF/DKIM/DMARC válidos</strong>
        {isSuper ? ' (veja em "Domínios")' : ''} melhora a entrega e a confiança
        do allowlist.
      </p>
    </div>
  );
}
