import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/admin" });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elevated"
      >
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          Painel administrativo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entre para gerenciar os débitos.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-crm-green focus:ring-2 focus:ring-crm-green/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-crm-green focus:ring-2 focus:ring-crm-green/20"
            />
          </div>

          {msg && <p className="text-sm text-crm-red-dark">{msg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-crm-green font-semibold text-primary-foreground transition hover:bg-crm-green-dark disabled:opacity-60"
          >
            {loading ? "Aguarde…" : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
