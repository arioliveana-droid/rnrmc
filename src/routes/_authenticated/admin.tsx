import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { bulkImportDebitos, listarCopiasBoleto } from "@/lib/debitos.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Copia = {
  id: string;
  nome: string;
  cpf: string;
  crm: string;
  debito_codigo: string;
  valor: number;
  linha_digitavel: string;
  copiado_em: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const importFn = useServerFn(bulkImportDebitos);
  const listarCopias = useServerFn(listarCopiasBoleto);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    errors: Array<{ line: number; raw: string; reason: string }>;
  } | null>(null);
  const [copias, setCopias] = useState<Copia[]>([]);

  const carregarCopias = async () => {
    try {
      const res = await listarCopias();
      setCopias((res.copias ?? []) as Copia[]);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    carregarCopias();
    const t = setInterval(carregarCopias, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        <div className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Cópias do código de barras
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Médicos que copiaram o código do boleto (atualiza a cada 15s).
              </p>
            </div>
            <button
              onClick={carregarCopias}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              Atualizar
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
            {copias.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma cópia registrada ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {copias.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        CRM {c.crm}/MG · CPF {c.cpf} · {c.debito_codigo}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-right">
                      <div className="font-mono">R$ {Number(c.valor).toFixed(2)}</div>
                      <div>{new Date(c.copiado_em).toLocaleString("pt-BR")}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
