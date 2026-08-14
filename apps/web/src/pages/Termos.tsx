import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-3 text-slate-300 leading-relaxed text-[15px]">
        {children}
      </div>
    </section>
  );
}

export function Termos() {
  const updated = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-400 grid place-items-center font-bold text-white text-sm">
              N
            </div>
            <span className="font-semibold">NexGuard</span>
          </Link>
          <Link to="/" className="text-sm text-slate-400 hover:text-white">
            ← Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">
          Termos de Uso, Consentimento do Teste e Política de Privacidade
        </h1>
        <p className="text-slate-500 text-sm mb-10">
          Última atualização: {updated} · NexGuard, uma solução Nexium Solutions
        </p>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-10 text-sm text-amber-200/90">
          Este documento explica de forma transparente como funciona a simulação
          de phishing do NexGuard e como os dados são tratados. Ele é a base do
          consentimento coletado no formulário de contato e do consentimento
          formal firmado com a empresa contratante antes de qualquer campanha.
        </div>

        <Section title="1. O que é o NexGuard">
          <p>
            O NexGuard é uma plataforma de <strong>conscientização e simulação de
            phishing</strong>. Ele envia, de forma <strong>autorizada e
            controlada</strong>, e-mails que imitam golpes reais para os
            funcionários de uma empresa contratante, com o único objetivo de medir
            a vulnerabilidade e treinar as pessoas — nunca de causar dano.
          </p>
        </Section>

        <Section title="2. Consentimento do teste (empresa contratante)">
          <p>
            A simulação só é executada mediante <strong>autorização expressa da
            empresa contratante</strong>, que declara ter legitimidade para testar
            e conscientizar seus próprios colaboradores. Essa autorização é
            registrada antes do início de qualquer campanha, com identificação do
            responsável, escopo e vigência.
          </p>
          <p>
            A empresa contratante atua como <strong>controladora</strong> dos dados
            de seus colaboradores; a Nexium Solutions atua como{' '}
            <strong>operadora</strong>, tratando os dados exclusivamente para
            executar o serviço contratado.
          </p>
        </Section>

        <Section title="3. Como a simulação funciona">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Enviamos e-mails de teste que simulam golpes comuns (cobranças,
              notas fiscais, avisos de senha, QR codes etc.).
            </li>
            <li>
              Registramos, por colaborador, apenas eventos de{' '}
              <strong>abertura, clique e submissão</strong> em página simulada, com
              defesa anti-robô para manter os números fiéis.
            </li>
            <li>
              Quem interage recebe, na hora, um <strong>momento educativo</strong>{' '}
              explicando que foi um teste e como se proteger.
            </li>
          </ul>
        </Section>

        <Section title="4. Dados tratados e finalidade (LGPD)">
          <p>
            Tratamos dados corporativos estritamente necessários à finalidade de
            conscientização: nome e e-mail corporativo do colaborador, setor e os
            eventos de interação descritos acima. A base legal é o{' '}
            <strong>legítimo interesse</strong> da empresa contratante em proteger
            sua operação, e/ou o consentimento, conforme o caso.
          </p>
          <p className="font-medium text-white">
            O NexGuard nunca coleta nem armazena senhas reais. Os formulários
            simulados existem apenas para medir a submissão — os valores digitados
            são descartados e jamais gravados.
          </p>
        </Section>

        <Section title="5. Formulário de contato comercial">
          <p>
            Ao enviar o formulário de solicitação de demonstração, você consente
            que a Nexium Solutions utilize os dados informados (nome, empresa,
            e-mail e telefone) <strong>exclusivamente para responder e conduzir
            este contato comercial</strong>. Não vendemos nem compartilhamos esses
            dados com terceiros.
          </p>
        </Section>

        <Section title="6. Retenção e segurança">
          <p>
            Os dados são mantidos apenas pelo tempo necessário à finalidade e são
            protegidos por controles técnicos (criptografia de credenciais em
            repouso, controle de acesso por papel, registro de consentimento).
            Concluído o serviço ou o contato, os dados podem ser eliminados ou
            anonimizados mediante solicitação.
          </p>
        </Section>

        <Section title="7. Seus direitos">
          <p>
            Você pode solicitar acesso, correção, portabilidade ou eliminação dos
            seus dados, bem como revogar consentimentos, a qualquer momento, pelo
            e-mail{' '}
            <a
              href="mailto:contato@nexiumsolutions.com.br"
              className="text-brand-400 hover:underline"
            >
              contato@nexiumsolutions.com.br
            </a>
            .
          </p>
        </Section>

        <Section title="8. Contato do controlador/operador">
          <p>
            Nexium Solutions — <span className="text-slate-400">CNPJ e endereço a
            constar no contrato</span>. Encarregado de dados (DPO):{' '}
            <a
              href="mailto:contato@nexiumsolutions.com.br"
              className="text-brand-400 hover:underline"
            >
              contato@nexiumsolutions.com.br
            </a>
            .
          </p>
        </Section>

        <footer className="border-t border-white/10 pt-6 mt-10 text-sm text-slate-500">
          NexGuard · uma solução{' '}
          <span className="text-slate-300">Nexium Solutions</span> ·{' '}
          {new Date().getFullYear()} ·{' '}
          <Link to="/" className="hover:text-white">
            Início
          </Link>
        </footer>
      </main>
    </div>
  );
}
