import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { bulkImportDebitos } from "@/lib/debitos.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const importFn = useServerFn(bulkImportDebitos);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    errors: Array<{ line: number; raw: string; reason: string }>;
  } | null>(null);

  const handleImport = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await importFn({ data: { raw } });
      setResult(res);
      if (res.inserted > 0) setRaw("");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              Painel — Débitos de anuidade
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cole as linhas no formato abaixo e clique em importar.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Sair
          </button>
        </div>

        <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
{`NOME:CPF:CRM:STATUS:COD_DEBITO:DESCRICAO
ANNA CAROLLYNE SANTOS PINTO:11075980607:105866:POSITIVO:A26:ANUIDADE 2026`}
        </pre>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={14}
          spellCheck={false}
          placeholder="Cole aqui uma linha por médico…"
          className="mt-4 w-full rounded-xl border border-border bg-card p-4 font-mono text-sm text-foreground outline-none focus:border-crm-green focus:ring-2 focus:ring-crm-green/20"
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={loading || !raw.trim()}
            className="h-11 rounded-lg bg-crm-green px-6 font-semibold text-primary-foreground transition hover:bg-crm-green-dark disabled:opacity-60"
          >
            {loading ? "Importando…" : "Importar / atualizar"}
          </button>
          <span className="text-xs text-muted-foreground">
            Registros existentes (mesmo CPF + CRM + código de débito) serão atualizados.
          </span>
        </div>

        {result && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">
              {result.inserted} registro(s) importado(s).
            </p>
            {result.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-crm-red-dark">
                  {result.errors.length} erro(s):
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      <span className="font-mono">linha {e.line}</span> — {e.reason}
                      {e.raw && <span className="font-mono"> · {e.raw}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
