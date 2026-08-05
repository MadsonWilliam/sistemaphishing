import axios from 'axios';

// Mesma origem em produção; em dev o Vite faz proxy de /api.
export const api = axios.create({ baseURL: '/api' });

const TOKEN_KEY = 'phish_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401) {
      setToken(null);
      if (location.pathname !== '/login') location.assign('/login');
    }
    return Promise.reject(error);
  },
);
