import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Companies } from './pages/Companies';
import { Domains } from './pages/Domains';
import { Campaigns } from './pages/Campaigns';
import { NewCampaign } from './pages/NewCampaign';
import { ReactNode } from 'react';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        Carregando…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/campaigns" element={<Protected><Campaigns /></Protected>} />
      <Route path="/campaigns/new" element={<Protected><NewCampaign /></Protected>} />
      <Route path="/companies" element={<Protected><Companies /></Protected>} />
      <Route path="/domains" element={<Protected><Domains /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
