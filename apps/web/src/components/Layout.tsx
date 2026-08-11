import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const nav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/campaigns', label: 'Campanhas' },
  { to: '/companies', label: 'Empresas' },
  { to: '/domains', label: 'Domínios' },
  { to: '/allowlist', label: 'Allowlist' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-brand-500 grid place-items-center">
                🛡️
              </div>
              <div className="font-semibold">PhishGuard</div>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-sm transition ${
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400 hidden sm:inline">{user?.email}</span>
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
