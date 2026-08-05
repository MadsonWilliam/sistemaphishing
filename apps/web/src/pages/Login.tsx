import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Lado comercial (mini landing) */}
      <div className="hidden lg:flex flex-col justify-center px-14 bg-gradient-to-br from-brand-700 to-slate-900">
        <div className="text-4xl font-bold mb-4 leading-tight">
          Descubra quem cairia<br />num golpe real — antes<br />do golpista.
        </div>
        <p className="text-slate-200/80 text-lg max-w-md">
          Simule ataques de phishing, meça a vulnerabilidade por setor e treine
          sua equipe com dados reais. Phishing é o vetor inicial da maioria das
          invasões corporativas.
        </p>
        <div className="mt-8 flex gap-6 text-sm text-slate-200/70">
          <div>
            <div className="text-2xl font-bold text-white">Simular</div>
            campanhas realistas
          </div>
          <div>
            <div className="text-2xl font-bold text-white">Medir</div>
            cliques por setor
          </div>
          <div>
            <div className="text-2xl font-bold text-white">Treinar</div>
            e reduzir o risco
          </div>
        </div>
      </div>

      {/* Login */}
      <div className="flex items-center justify-center px-6 py-16 bg-slate-950">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold mb-1">Entrar</h1>
          <p className="text-slate-400 text-sm mb-6">
            Acesse o painel da plataforma.
          </p>

          <label className="block text-sm text-slate-400 mb-1">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-brand-500 outline-none mb-4"
            placeholder="voce@empresa.com"
          />

          <label className="block text-sm text-slate-400 mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-brand-500 outline-none mb-4"
            placeholder="••••••••"
          />

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 font-semibold transition disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
