import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Mesma origem em produção; em dev o Vite faz proxy de /api.
export const api = axios.create({ baseURL: '/api' });

const ACCESS_KEY = 'phish_access_token';
const REFRESH_KEY = 'phish_refresh_token';

export const getToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefresh = () => localStorage.getItem(REFRESH_KEY);

export function setTokens(access: string | null, refresh?: string | null) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  else localStorage.removeItem(ACCESS_KEY);
  if (refresh !== undefined) {
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    else localStorage.removeItem(REFRESH_KEY);
  }
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Renova o access token via refresh token quando expira (1 tentativa por request).
// Compartilha uma única chamada de refresh entre requests concorrentes.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefresh();
  if (!refresh) return null;
  if (!refreshing) {
    refreshing = axios
      .post('/api/auth/refresh', { refreshToken: refresh })
      .then((r) => {
        setTokens(r.data.accessToken, r.data.refreshToken);
        return r.data.accessToken as string;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
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
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      if (location.pathname !== '/login') location.assign('/login');
    }
    return Promise.reject(error);
  },
);
