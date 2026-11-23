import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ContactModal } from '../components/ContactModal';

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 grid place-items-center font-bold text-white">
        N
      </div>
      <div className="font-semibold text-lg">NexGuard</div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-semibold mb-1">{title}</div>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

export function LandingPage() {
  const [contactOpen, setContactOpen] = useState(false);
  const openContact = () => setContactOpen(true);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* glow de fundo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative">
        {/* Nav */}
        <header className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <button
              onClick={openContact}
              className="hidden sm:inline text-sm text-slate-300 hover:text-white px-4 py-2"
            >
              Falar com a Nexium
            </button>
            <Link
              to="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition"
            >
              Entrar
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-12 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 mb-6">
              🛡️ Conscientização e simulação de phishing
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.1]">
              Descubra quem cairia num golpe —{' '}
              <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">
                antes do golpista.
              </span>
            </h1>
            <p className="text-lg text-slate-400 mt-6 max-w-lg">
              O NexGuard simula ataques de phishing realistas nos funcionários da
              sua empresa, mede a vulnerabilidade por setor e entrega um plano de
              ação — com números fiéis, sem cliques de robôs inflando o resultado.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button
                onClick={openContact}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 font-semibold hover:opacity-90 transition"
              >
                Solicitar demonstração
              </button>
              <Link
                to="/login"
                className="px-6 py-3 rounded-xl border border-white/15 hover:bg-white/5 font-medium transition"
              >
                Já sou cliente
              </Link>
            </div>
            <div className="flex gap-8 mt-10 text-sm">
              <div>
                <div className="text-2xl font-bold">Simular</div>
                <span className="text-slate-500">campanhas realistas</span>
              </div>
              <div>
                <div className="text-2xl font-bold">Medir</div>
                <span className="text-slate-500">por pessoa e setor</span>
              </div>
              <div>
                <div className="text-2xl font-bold">Treinar</div>
                <span className="text-slate-500">e reduzir o risco</span>
              </div>
            </div>
          </div>

          {/* mock de dashboard */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl">
            <div className="text-sm text-slate-400 mb-3">Resultados da campanha</div>
            <div className="text-2xl font-bold mb-4">
              12 de 30 pessoas (40%) cairiam num golpe real.
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ['Clicaram', '12', 'text-amber-400'],
                ['Submeteram', '5', 'text-red-400'],
                ['Comprometimento', '40%', 'text-red-400'],
              ].map(([l, v, c]) => (
                <div key={l} className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="text-[11px] text-slate-500 uppercase">{l}</div>
                  <div className={`text-xl font-bold ${c}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                ['Financeiro', 78],
                ['RH', 45],
                ['TI', 12],
              ].map(([dep, rate]) => (
                <div key={dep as string}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{dep}</span>
                    <span className="text-slate-400">{rate}%</span>
                  </div>
                  <div className="h-2 rounded bg-white/10">
                    <div
                      className="h-2 rounded bg-gradient-to-r from-amber-400 to-red-500"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Faixa de impacto */}
        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-extrabold text-brand-400">+90%</div>
              <p className="text-slate-400 text-sm mt-1">
                das invasões começam por e-mail (phishing/engenharia social)
              </p>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-brand-400">
                US$ 50 bi
              </div>
              <p className="text-slate-400 text-sm mt-1">
                em perdas por BEC entre 2013–2023 (FBI/IC3)
              </p>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-brand-400">1 clique</div>
              <p className="text-slate-400 text-sm mt-1">
                é o que basta para comprometer a rede inteira
              </p>
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-3">
            Como funciona
          </h2>
          <p className="text-slate-400 text-center mb-12">
            Da simulação ao plano de ação, em três passos.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Feature
              icon="🎣"
              title="1 · Simular"
              desc="E-mails de phishing realistas por setor (boleto, nota fiscal, intimação, MFA falso, QR code), enviados em nome de domínios convincentes e com remetentes variados."
            />
            <Feature
              icon="📊"
              title="2 · Medir"
              desc="Abertura, clique e submissão rastreados por pessoa e setor, em tempo real — com defesa anti-robô que mantém os números fiéis a pessoas reais."
            />
            <Feature
              icon="🎓"
              title="3 · Treinar"
              desc="Quem cai recebe na hora um momento educativo. O relatório executivo aponta os setores frágeis, as boas práticas e a evolução a cada campanha."
            />
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid md:grid-cols-3 gap-4">
            <Feature
              icon="🎯"
              title="Números fiéis"
              desc="Defesa anti-robô em três camadas: cliques de scanners de segurança não entram na conta — o resultado reflete pessoas de verdade."
            />
            <Feature
              icon="🏢"
              title="Recorte por setor"
              desc="Veja exatamente quem abriu, quem clicou e quais áreas precisam de mais reforço."
            />
            <Feature
              icon="📈"
              title="Evolução"
              desc="Campanhas recorrentes mostram a queda da vulnerabilidade a cada rodada."
            />
            <Feature
              icon="🧰"
              title="Biblioteca de iscas"
              desc="Modelos que golpistas realmente usam, em três níveis de dificuldade — inclusive QR code (quishing)."
            />
            <Feature
              icon="🔒"
              title="Ético e conforme"
              desc="Teste autorizado, formulário falso que nunca guarda senhas e trilha de consentimento (LGPD)."
            />
            <Feature
              icon="👥"
              title="Portal do cliente"
              desc="O gestor acompanha os próprios resultados em tempo real, sem acesso a dados de outras empresas."
            />
          </div>
        </section>

        {/* Origem — nascido no Grupo Solutions */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:p-12">
            <div className="grid lg:grid-cols-[1.25fr_1fr] gap-10 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-tight">
                  Veio de quem já protege empresas de verdade.
                </h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  O NexGuard começou como uma{' '}
                  <strong className="text-white">
                    solução interna de segurança
                  </strong>
                  , criada para proteger os clientes das empresas do{' '}
                  <strong className="text-white">Grupo Solutions</strong> — a{' '}
                  <strong className="text-white">RSTech</strong> e a{' '}
                  <strong className="text-white">SCTech</strong> — a partir de anos
                  de experiência real em TI, infraestrutura e segurança da
                  informação.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-6">
                  <a
                    href="https://gruposolutions.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition"
                  >
                    Conheça o Grupo Solutions →
                  </a>
                  <a
                    href="https://nexiumsolutions.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 transition"
                  >
                    Feito pela Nexium Solutions
                  </a>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] h-24 grid place-items-center px-6">
                  <img
                    src="/logo-rstech.png"
                    alt="RS Tech Solutions"
                    className="h-12 w-auto max-w-[230px] object-contain opacity-90"
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] h-24 grid place-items-center px-6">
                  <img
                    src="/logo-sctech.png"
                    alt="SC Tech Solutions"
                    className="h-12 w-auto max-w-[230px] object-contain opacity-90"
                  />
                </div>
                <div className="text-center text-xs text-slate-500">
                  Empresas do Grupo Solutions
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/20 to-cyan-500/10 p-12">
            <h2 className="text-3xl font-bold mb-3">
              Quanto da sua equipe cairia hoje?
            </h2>
            <p className="text-slate-300 mb-8">
              Faça um teste autorizado e descubra — com um relatório pronto para
              levar à diretoria.
            </p>
            <button
              onClick={openContact}
              className="inline-block px-8 py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 font-semibold hover:opacity-90 transition"
            >
              Solicitar demonstração
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <Logo />
            <div className="flex flex-col sm:flex-row items-center gap-x-3 gap-y-1 text-center sm:text-left">
              <span>
                NexGuard · uma solução{' '}
                <a
                  href="https://nexiumsolutions.com.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-white"
                >
                  Nexium Solutions
                </a>
                , do{' '}
                <a
                  href="https://gruposolutions.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-white"
                >
                  Grupo Solutions
                </a>{' '}
                (RSTech · SCTech) · {new Date().getFullYear()}
              </span>
              <span className="hidden sm:inline text-slate-700">·</span>
              <a
                href="/termos"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-300"
              >
                Termos e Privacidade
              </a>
            </div>
          </div>
        </footer>
      </div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </div>
  );
}
