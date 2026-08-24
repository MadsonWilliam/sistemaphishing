import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Status = 'idle' | 'sending' | 'ok' | 'error';

const FUNC_FAIXAS = ['1–50', '51–200', '201–500', '500+'];

export function ContactModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  // Fecha no Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api.post('/leads', {
        name: f.get('name'),
        company: f.get('company'),
        email: f.get('email'),
        phone: f.get('phone') || undefined,
        cnpj: f.get('cnpj') || undefined,
        employees: f.get('employees') || undefined,
        message: f.get('message') || undefined,
        consent: f.get('consent') === 'on',
        website: f.get('website') || undefined, // honeypot
      });
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Não foi possível enviar agora. Tente novamente.',
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
        >
          ✕
        </button>

        {status === 'ok' ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-xl font-bold mb-2">Solicitação enviada!</h3>
            <p className="text-slate-400">
              Recebemos seu contato e a equipe da Nexium retornará em breve para
              agendar sua demonstração.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 font-medium"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold">Solicitar demonstração</h3>
            <p className="text-sm text-slate-400 mt-1 mb-5">
              Preencha e a equipe da Nexium entra em contato. Sem compromisso.
            </p>
            <form onSubmit={submit} className="space-y-3">
              {/* honeypot invisível anti-bot */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field name="name" label="Nome*" placeholder="Seu nome" required />
                <Field
                  name="company"
                  label="Empresa*"
                  placeholder="Nome da empresa"
                  required
                />
              </div>
              <Field
                name="email"
                type="email"
                label="E-mail corporativo*"
                placeholder="voce@empresa.com"
                required
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field name="phone" label="Telefone" placeholder="(00) 00000-0000" />
                <Field name="cnpj" label="CNPJ" placeholder="00.000.000/0001-00" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    Nº de funcionários
                  </label>
                  <select
                    name="employees"
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-white/10 text-sm focus:border-brand-500 outline-none"
                    defaultValue=""
                  >
                    <option value="">Selecione…</option>
                    {FUNC_FAIXAS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden sm:block" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Mensagem
                </label>
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Conte rapidamente seu contexto (opcional)"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-white/10 text-sm focus:border-brand-500 outline-none resize-none"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  className="mt-0.5 accent-brand-500 w-4 h-4 shrink-0"
                />
                <span>
                  Li e concordo com os{' '}
                  <a
                    href="/termos"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-brand-400 hover:underline"
                  >
                    Termos e a Política de Privacidade
                  </a>
                  , e autorizo o contato da Nexium sobre esta solicitação.
                </span>
              </label>

              {status === 'error' && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 font-semibold hover:opacity-90 transition disabled:opacity-60"
              >
                {status === 'sending' ? 'Enviando…' : 'Enviar solicitação'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = 'text',
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-white/10 text-sm focus:border-brand-500 outline-none"
      />
    </div>
  );
}
