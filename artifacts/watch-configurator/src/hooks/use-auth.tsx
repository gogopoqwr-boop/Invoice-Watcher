import React, { createContext, useContext, useState, useCallback } from "react";
import { useLogin } from "@workspace/api-client-react";

type User = { id: number; username: string; role: string };

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

function parseJwt(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.id, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

function getStoredUser(): User | null {
  const token = localStorage.getItem("jwt");
  if (!token) return null;
  return parseJwt(token);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const loginMutation = useLogin();

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginMutation.mutateAsync({ username, password });
    const token = (result as any).token as string;
    localStorage.setItem("jwt", token);
    setUser(parseJwt(token));
  }, [loginMutation]);

  const logout = useCallback(() => {
    localStorage.removeItem("jwt");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading: loginMutation.isPending, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
