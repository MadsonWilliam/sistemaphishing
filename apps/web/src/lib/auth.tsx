import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { api } from './api';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // O cookie httpOnly (se existir) vai junto; /auth/me confirma a sessão.
    // _silent: um 401 aqui (visitante deslogado) NÃO deve redirecionar para
    // /login — deixa a landing pública aparecer. Tenta refresh mesmo assim,
    // para logar de volta quem tem refresh válido e access expirado.
    api
      .get<AuthUser>('/auth/me', { _silent: true } as never)
      .then((r) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    await api.post('/auth/login', { email, password });
    const me = await api.get<AuthUser>('/auth/me');
    setUser(me.data);
  }

  function logout() {
    // Revoga o refresh no servidor e limpa os cookies; depois desloga a UI.
    api
      .post('/auth/logout')
      .catch(() => undefined)
      .finally(() => {
        setUser(null);
        location.assign('/login');
      });
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
