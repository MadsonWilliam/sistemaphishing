import { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-500 grid place-items-center font-bold">
              🛡️
            </div>
            <div>
              <div className="font-semibold leading-tight">PhishGuard</div>
              <div className="text-xs text-slate-400 leading-tight">
                Conscientização de phishing
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400 hidden sm:inline">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
