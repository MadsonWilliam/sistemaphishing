import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

type Mode = 'login' | 'forgot' | 'reset';

const inputCls =
  'w-full px-3 py-2.5 rounded-lg bg-slate-950/60 border border-white/10 focus:border-brand-500 outline-none mb-4';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const msg = (e: unknown, fallback: string) =>
    ((e as { response?: { data?: { message?: string | string[] } } })?.response
      ?.data?.message &&
      (Array.isArray(
        (e as { response?: { data?: { message?: string[] } } }).response!.data!
          .message,
      )
        ? (e as { response: { data: { message: string[] } } }).response.data
            .message[0]
        : (e as { response: { data: { message: string } } }).response.data
            .message)) ||
    fallback;

  async function onLogin(e: FormEvent) {
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

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setInfo(
        `Se houver uma conta para ${email}, enviamos um código de 6 dígitos por e-mail (válido por 15 min).`,
      );
      setMode('reset');
    } catch (e) {
      setError(msg(e, 'Não foi possível enviar o código.'));
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (newPass !== confirm) {
      setError('As senhas não conferem.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', {
        email,
        code: code.trim(),
        newPassword: newPass,
      });
      setMode('login');
      setPassword('');
      setCode('');
      setNewPass('');
      setConfirm('');
      setInfo('Senha redefinida! Faça login com a nova senha.');
    } catch (e) {
      setError(msg(e, 'Código inválido ou expirado.'));
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === 'login'
      ? 'Entrar'
      : mode === 'forgot'
        ? 'Recuperar senha'
        : 'Definir nova senha';
  const sub =
    mode === 'login'
      ? 'Acesse o painel da sua organização.'
      : mode === 'forgot'
        ? 'Informe seu e-mail para receber um código.'
        : 'Digite o código recebido e crie uma nova senha.';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden grid place-items-center px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-400 grid place-items-center font-bold text-white">
              N
            </div>
            <span className="font-semibold text-lg">NexGuard</span>
          </Link>
          <Link
            to="/"
            className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
          >
            ← Voltar ao site
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-slate-400 text-sm mb-6">{sub}</p>

          {info && (
            <p className="text-emerald-400 text-sm mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              {info}
            </p>
          )}

          {mode === 'login' && (
            <form onSubmit={onLogin}>
              <label className="block text-sm text-slate-400 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className={inputCls}
                placeholder="voce@empresa.com"
              />
              <label className="block text-sm text-slate-400 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputCls}
                placeholder="••••••••"
              />
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 font-semibold transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? 'Entrando…' : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError('');
                  setInfo('');
                }}
                className="w-full text-center text-sm text-slate-400 hover:text-white mt-4"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={onForgot}>
              <label className="block text-sm text-slate-400 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className={inputCls}
                placeholder="voce@empresa.com"
              />
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 font-semibold transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? 'Enviando…' : 'Enviar código'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="w-full text-center text-sm text-slate-400 hover:text-white mt-4"
              >
                ← Voltar ao login
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={onReset}>
              <label className="block text-sm text-slate-400 mb-1">
                Código recebido
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                className={inputCls + ' tracking-[6px] text-center text-lg'}
                placeholder="000000"
              />
              <label className="block text-sm text-slate-400 mb-1">
                Nova senha
              </label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
                minLength={8}
                className={inputCls}
                placeholder="mínimo 8 caracteres"
              />
              <label className="block text-sm text-slate-400 mb-1">
                Confirmar nova senha
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className={inputCls}
                placeholder="repita a senha"
              />
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button
                disabled={busy}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 font-semibold transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? 'Redefinindo…' : 'Redefinir senha'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="w-full text-center text-sm text-slate-400 hover:text-white mt-4"
              >
                ← Voltar ao login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          NexGuard · uma solução Nexium Solutions
        </p>
      </div>
    </div>
  );
}
