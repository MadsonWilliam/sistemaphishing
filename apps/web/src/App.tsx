import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Companies } from './pages/Companies';
import { Domains } from './pages/Domains';
import { Campaigns } from './pages/Campaigns';
import { NewCampaign } from './pages/NewCampaign';
import { Allowlist } from './pages/Allowlist';
import { Leads } from './pages/Leads';
import { LandingPage } from './pages/LandingPage';
import { ReactNode } from 'react';

function Protected({
  children,
  superOnly,
}: {
  children: ReactNode;
  superOnly?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        Carregando…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  // Telas de operação: só o operador (SUPER_ADMIN). Cliente vai pro dashboard.
  if (superOnly && user.role !== 'SUPER_ADMIN')
    return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

// Raiz: landing comercial (deslogado) ou dashboard (logado).
function Home() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        Carregando…
      </div>
    );
  if (!user) return <LandingPage />;
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/campaigns" element={<Protected><Campaigns /></Protected>} />
      <Route path="/campaigns/new" element={<Protected superOnly><NewCampaign /></Protected>} />
      <Route path="/leads" element={<Protected superOnly><Leads /></Protected>} />
      <Route path="/companies" element={<Protected superOnly><Companies /></Protected>} />
      <Route path="/domains" element={<Protected superOnly><Domains /></Protected>} />
      <Route path="/allowlist" element={<Protected superOnly><Allowlist /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
