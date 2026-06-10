import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
  deliveryAddress?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; deliveryAddress?: string }) => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
  refetch: async () => {},
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("ng-token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Request failed");
  }
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("ng-token"));
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const t = localStorage.getItem("ng-token");
    if (!t) { setUser(null); setLoading(false); return; }
    try {
      const data = await apiFetch("/auth/me");
      setUser(data as AuthUser);
    } catch {
      localStorage.removeItem("ng-token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }) as AuthUser & { token: string };
    localStorage.setItem("ng-token", data.token);
    setToken(data.token);
    setUser({ id: data.id, email: data.email, name: data.name, isAdmin: data.isAdmin, deliveryAddress: data.deliveryAddress });
  };

  const register = async (email: string, password: string, name?: string) => {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }) as AuthUser & { token: string };
    localStorage.setItem("ng-token", data.token);
    setToken(data.token);
    setUser({ id: data.id, email: data.email, name: data.name, isAdmin: data.isAdmin, deliveryAddress: data.deliveryAddress });
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("ng-token");
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (data: { name?: string; deliveryAddress?: string }) => {
    const updated = await apiFetch("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }) as AuthUser;
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
