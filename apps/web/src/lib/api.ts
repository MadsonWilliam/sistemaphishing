import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Sessão via cookie httpOnly (o navegador envia/recebe sozinho quando
// withCredentials=true). O JS da página NÃO tem acesso aos tokens → mesmo um
// XSS não consegue roubá-los. Mesma origem em produção; em dev o Vite faz proxy.
export const api = axios.create({ baseURL: '/api', withCredentials: true });

// Renova o access token (cookie) via /auth/refresh quando expira.
// Compartilha uma única chamada entre requests concorrentes.
let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const url = original?.url || '';
    // Não tenta renovar em cima do próprio fluxo de auth (evita loop).
    const isRefreshFlow =
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/logout');
    if (error.response?.status === 401 && !original._retry && !isRefreshFlow) {
      original._retry = true;
      const ok = await tryRefresh();
      if (ok) return api(original);
      if (location.pathname !== '/login') location.assign('/login');
    }
    return Promise.reject(error);
  },
);
