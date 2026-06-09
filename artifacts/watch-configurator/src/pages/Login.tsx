import React, { useState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { LiquidButton } from "@/components/ui/liquid-button";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function Login() {
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    setLocation("/admin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      setLocation("/admin");
    } catch {
      setError("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-white flex items-center justify-center p-4">
      <GlassPanel className="p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-widest mb-2 text-center">НА_УТРАХ_4</h1>
        <p className="text-muted-foreground text-sm text-center mb-8 tracking-widest">ADMIN ACCESS</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1.5">Логин</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="admin"
              required
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-1.5">Пароль</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <LiquidButton type="submit" disabled={loading} className="w-full h-12 font-bold tracking-widest text-sm mt-2">
            {loading ? "ВХОД..." : "ВОЙТИ"}
          </LiquidButton>
        </form>
      </GlassPanel>
    </div>
  );
}
