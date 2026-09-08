import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function decodeToken(token: string): User | null {
  try {
    const payload = token.split('.')[1];
    const raw = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    const data = JSON.parse(json);
    // Token đã hết hạn (JWT exp) → coi như chưa đăng nhập
    if (data.exp && Date.now() / 1000 >= data.exp) return null;
    return {
      id: data.uid,
      username: data.username,
      fullName: data.fullName,
      role: data.role,
      storeId: data.storeId,
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      approve: true
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialToken = getToken();
  const [user, setUser] = useState<User | null>(initialToken ? decodeToken(initialToken) : null);
  const [token] = useState<string | null>(initialToken);
  const [loading, setLoading] = useState(false);

  async function login(username: string, password: string) {
    setLoading(true);
    try {
      const data = await api.login(username, password);
      setToken(data.token ?? null);
      setUser(data);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng trong AuthProvider');
  return ctx;
}