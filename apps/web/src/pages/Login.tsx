import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden grid place-items-center px-6">
      {/* glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-8 text-slate-300 hover:text-white"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 grid place-items-center font-bold text-white">
            N
          </div>
          <span className="font-semibold text-lg">NexGuard</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold">Entrar</h1>
          <p className="text-slate-400 text-sm mb-6">
            Acesse o painel da sua organização.
          </p>

          <form onSubmit={onSubmit}>
            <label className="block text-sm text-slate-400 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg bg-slate-950/60 border border-white/10 focus:border-brand-500 outline-none mb-4"
              placeholder="voce@empresa.com"
            />

            <label className="block text-sm text-slate-400 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-950/60 border border-white/10 focus:border-brand-500 outline-none mb-4"
              placeholder="••••••••"
            />

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <button
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 font-semibold transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          NexGuard · uma solução Nexium Solutions
        </p>
      </div>
    </div>
  );
}
