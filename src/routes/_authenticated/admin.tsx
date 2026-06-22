import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  bulkImportDebitos,
  listarConsultas,
  listarBoletosGerados,
  getDashboardStats,
  listarDebitos,
  removerDebitos,
  listarSolicitacoesPendentes,
} from "@/lib/debitos.functions";
import {
  listarStripeAccounts,
  adicionarStripeAccount,
  atualizarTokenStripe,
  toggleStripeAccount,
  removerStripeAccount,
  trocarNomeAgora,
  reverterNomeAgora,
  tickOrquestrador,
  atualizarStripeAccount,
  resetarLimitesStripe,
  verificarPagamentos,
} from "@/lib/stripe.functions";
import {
  buscarTransacoesStripeHistorico,
  compararCPFsComDebitos,
  removerDebitosQuePagaram,
  type TransacaoStripe,
} from "@/lib/stripe-historico.functions";
import {
  buscarEsalvarRepasses,
  listarRepasses,
  type Repasse,
} from "@/lib/stripe-repasses.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type TabId = "dashboard" | "import" | "debitos" | "consultas" | "stripe" | "boletos" | "historico" | "pendentes" | "repasses";

type Consulta = {
  id: string;
  cpf: string;
  crm: string;
  ip: string | null;
  user_agent: string | null;
  encontrado: boolean;
  nome: string | null;
  motivo: string | null;
  criado_em: string;
};

type Boleto = {
  id: string;
  nome: string;
  cpf: string;
  crm: string;
  debito_codigo: string;
  descricao: string | null;
  valor: number;
  linha_digitavel: string;
  stripe_account_id: string | null;
  ip: string | null;
  user_agent: string | null;
  gerado_em: string;
  copiado: boolean;
  copiado_em: string | null;
  vezes_copiado: number;
};

type StripeAccount = {
  id: string;
  nome: string;
  token: string;
  bearer_token: string | null;
  account_id: string | null;
  person_id: string | null;
  original_first_name: string | null;
  original_last_name: string | null;
  replacement_first_name: string | null;
  replacement_last_name: string | null;
  proxy_url: string | null;
  ordem: number;
  status: "idle" | "active" | "cooldown" | "daily_exhausted" | "failed";
  janela_iniciada_em: string | null;
  janela_termina_em: string | null;
  boletos_na_janela: number;
  boletos_no_dia: number;
  dia_referencia: string | null;
  cooldown_ate: string | null;
  nome_trocado: boolean;
  ultima_falha: string | null;
  ultima_acao_em: string | null;
  ativo: boolean;
  ultimo_uso_em: string | null;
  total_boletos: number;
  trocas_no_dia: number;
  limite_boletos_diario: number;
  limite_trocas_diario: number;
  created_at: string;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "import", label: "Importar débitos" },
  { id: "debitos", label: "Base de débitos" },
  { id: "consultas", label: "Consultas" },
  { id: "stripe", label: "Contas Stripe" },
  { id: "boletos", label: "Boletos emitidos" },
  { id: "pendentes", label: "⏳ Não emitidos" },
  { id: "repasses", label: "💸 Repasses" },
  { id: "historico", label: "🔍 Verificador de pagamentos" },
];

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR") : "—";
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("dashboard");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crm-green-dark">
              Painel admin
            </div>
            <h1 className="font-serif text-lg font-semibold text-foreground md:text-xl">
              CRM-MG · Operações
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Sair
          </button>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 md:px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-crm-green text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        {tab === "dashboard" && <DashboardSection />}
        {tab === "import" && <ImportSection />}
        {tab === "debitos" && <DebitosSection />}
        {tab === "consultas" && <ConsultasSection />}
        {tab === "stripe" && <StripeSection />}
        {tab === "boletos" && <BoletosSection />}
        {tab === "pendentes" && <PendentesSection />}
        {tab === "repasses" && <RepassesSection />}
        {tab === "historico" && <HistoricoSection />}
      </main>
    </div>
  );
}

// ----------------- DASHBOARD -----------------
type Stats = Awaited<ReturnType<typeof getDashboardStats>>;

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "green" | "amber" | "blue" | "neutral";
}) {
  const accentClass =
    accent === "green"
      ? "from-crm-green/10 to-transparent border-crm-green/30"
      : accent === "amber"
        ? "from-amber-200/30 to-transparent border-amber-300/60"
        : accent === "blue"
          ? "from-sky-200/30 to-transparent border-sky-300/60"
          : "from-secondary/60 to-transparent border-border";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${accentClass} p-5`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-serif text-3xl font-semibold text-foreground">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function DashboardSection() {
  const fn = useServerFn(getDashboardStats);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fn();
      setStats(r);
    } finally {
      setLoading(false);
    }
  }, [fn]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !stats) {
    return (
      <p className="text-sm text-muted-foreground">Carregando estatísticas…</p>
    );
  }
  if (!stats) return null;

  const maxSerie = Math.max(1, ...stats.serie7d.map((d) => d.consultas));

  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral em tempo real · atualiza a cada 30s.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Débitos importados"
          value={stats.debitos.toLocaleString("pt-BR")}
          hint="Base total cadastrada"
          accent="neutral"
        />
        <StatCard
          label="Consultas hoje"
          value={stats.consultasHoje.toLocaleString("pt-BR")}
          hint={`${stats.consultasEncontradasHoje} encontraram débito`}
          accent="blue"
        />
        <StatCard
          label="Boletos gerados hoje"
          value={stats.boletosHoje.toLocaleString("pt-BR")}
          hint={`${fmtBRL(stats.valorHoje)} em valor`}
          accent="green"
        />
        <StatCard
          label="Boletos pagos hoje"
          value={stats.boletosPagosHoje.toLocaleString("pt-BR")}
          hint={`${stats.boletosPagosTotal.toLocaleString("pt-BR")} pagos no total`}
          accent="green"
        />
        <StatCard
          label="Stripe ativas"
          value={`${stats.stripeAtivas}/${stats.stripeTotal}`}
          hint="Contas em rotação"
          accent="amber"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Consultas (total)"
          value={stats.consultasTotal.toLocaleString("pt-BR")}
        />
        <StatCard
          label="Boletos (total)"
          value={stats.boletosTotal.toLocaleString("pt-BR")}
        />
        <StatCard
          label="Boletos copiados"
          value={stats.boletosCopiadosTotal.toLocaleString("pt-BR")}
          hint={
            stats.boletosTotal > 0
              ? `${Math.round((stats.boletosCopiadosTotal / stats.boletosTotal) * 100)}% de conversão`
              : undefined
          }
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Consultas nos últimos 7 dias
            </div>
            <div className="text-xs text-muted-foreground">
              Total vs. consultas com débito encontrado
            </div>
          </div>
        </div>
        <div className="mt-6 flex h-44 items-end gap-3">
          {stats.serie7d.map((d) => {
            const h = (d.consultas / maxSerie) * 100;
            const hEnc = (d.encontradas / maxSerie) * 100;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-full w-full items-end justify-center">
                  <div
                    className="w-full rounded-t-md bg-crm-green/20"
                    style={{ height: `${h}%` }}
                  />
                  <div
                    className="absolute bottom-0 w-full rounded-t-md bg-crm-green"
                    style={{ height: `${hEnc}%` }}
                  />
                </div>
                <div className="text-[10px] font-medium text-muted-foreground">
                  {new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", {
                    weekday: "short",
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {d.consultas}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-crm-green/20" /> Total
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-crm-green" /> Com débito
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-semibold text-foreground">
            Últimos boletos emitidos
          </div>
        </div>
        {stats.ultimosBoletos.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum boleto emitido ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.ultimosBoletos.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {b.nome}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    CRM {b.crm} · {fmtDate(b.gerado_em)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {fmtBRL(Number(b.valor))}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      b.copiado
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {b.copiado ? "Copiado" : "Pendente"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ----------------- IMPORT -----------------
const CHUNK_SIZE = 200; // linhas por lote
const CONCURRENCY = 4;  // requisições simultâneas

type ImportProgress = {
  totalLines: number;
  processedLines: number;
  inserted: number;
  skipped: number;
  errorCount: number;
  errors: Array<{ line: number; raw: string; reason: string }>;
  done: boolean;
};

function ImportSection() {
  const importFn = useServerFn(bulkImportDebitos);
  const [raw, setRaw] = useState("");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);

  const handleImport = async () => {
    const allLines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (allLines.length === 0) return;

    abortRef.current = false;
    setLoading(true);
    setProgress({
      totalLines: allLines.length,
      processedLines: 0,
      inserted: 0,
      skipped: 0,
      errorCount: 0,
      errors: [],
      done: false,
    });

    // Divide em chunks
    const chunks: Array<{ lines: string[]; offset: number }> = [];
    for (let i = 0; i < allLines.length; i += CHUNK_SIZE) {
      chunks.push({ lines: allLines.slice(i, i + CHUNK_SIZE), offset: i });
    }

    // Processa com concurrency controlada
    let chunkIndex = 0;
    const accProgress: ImportProgress = {
      totalLines: allLines.length,
      processedLines: 0,
      inserted: 0,
      skipped: 0,
      errorCount: 0,
      errors: [],
      done: false,
    };

    const processChunk = async (chunk: { lines: string[]; offset: number }) => {
      if (abortRef.current) return;
      try {
        const res = await importFn({
          data: { raw: chunk.lines.join("\n"), lineOffset: chunk.offset },
        });
        accProgress.processedLines += chunk.lines.length;
        accProgress.inserted += res.inserted;
        accProgress.skipped += res.skippedDebts ?? 0;
        accProgress.errorCount += res.errors.length;
        accProgress.errors = [...accProgress.errors, ...res.errors].slice(0, 100);
      } catch (e) {
        accProgress.processedLines += chunk.lines.length;
        accProgress.errorCount += chunk.lines.length;
        accProgress.errors.push({
          line: chunk.offset + 1,
          raw: "",
          reason: e instanceof Error ? e.message : "Erro desconhecido no lote",
        });
      }
      setProgress({ ...accProgress });
    };

    // Pool de workers com concurrency = CONCURRENCY
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        if (abortRef.current) break;
        const idx = chunkIndex++;
        if (idx >= chunks.length) break;
        await processChunk(chunks[idx]);
      }
    });

    await Promise.all(workers);

    accProgress.done = true;
    setProgress({ ...accProgress });
    setLoading(false);
    if (accProgress.inserted > 0) setRaw("");
  };

  const handleCancel = () => {
    abortRef.current = true;
    setLoading(false);
  };

  const pct = progress
    ? Math.round((progress.processedLines / Math.max(progress.totalLines, 1)) * 100)
    : 0;

  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold text-foreground">
        Importar débitos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cole as linhas abaixo. Suporta múltiplos débitos por linha — apenas anuidades (A26) são importadas.
      </p>

      <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap break-all">
{`NOME:CPF:CRM:STATUS:A26:ANUIDADE 2026
NOME:CPF:CRM:STATUS:A26:ANUIDADE 2026 | M24:MULTA ELEITORAL 2024`}
      </pre>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={14}
        spellCheck={false}
        disabled={loading}
        placeholder="Cole aqui uma linha por médico…"
        className="mt-4 w-full rounded-xl border border-border bg-card p-4 font-mono text-sm text-foreground outline-none focus:border-crm-green focus:ring-2 focus:ring-crm-green/20 disabled:opacity-60"
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleImport}
          disabled={loading || !raw.trim()}
          className="h-11 rounded-lg bg-crm-green px-6 font-semibold text-primary-foreground transition hover:bg-crm-green-dark disabled:opacity-60"
        >
          {loading ? "Importando…" : "Importar / atualizar"}
        </button>
        {loading && (
          <button
            onClick={handleCancel}
            className="h-11 rounded-lg border border-destructive px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Cancelar
          </button>
        )}
        {progress && !loading && (
          <span className="text-xs text-muted-foreground">
            Concluído em {CONCURRENCY} threads simultâneas
          </span>
        )}
      </div>

      {/* Barra de progresso */}
      {progress && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 space-y-4">
          {/* Barra */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>
                {progress.processedLines.toLocaleString("pt-BR")} / {progress.totalLines.toLocaleString("pt-BR")} linhas
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-crm-green transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            {loading && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Processando em até {CONCURRENCY} lotes de {CHUNK_SIZE} linhas simultâneos…
              </p>
            )}
          </div>

          {/* Contadores */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-crm-green">
                {progress.inserted.toLocaleString("pt-BR")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Importados</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">
                {progress.skipped.toLocaleString("pt-BR")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Outros débitos ignorados</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">
                {progress.processedLines.toLocaleString("pt-BR")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Linhas processadas</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className={`text-2xl font-bold ${progress.errorCount > 0 ? "text-destructive" : "text-foreground"}`}>
                {progress.errorCount.toLocaleString("pt-BR")}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Erros</p>
            </div>
          </div>

          {/* Status final */}
          {progress.done && (
            <p className={`text-sm font-semibold ${progress.inserted > 0 ? "text-crm-green" : "text-muted-foreground"}`}>
              {progress.inserted > 0
                ? `✓ ${progress.inserted.toLocaleString("pt-BR")} débito(s) de anuidade importado(s) com sucesso.`
                : "Nenhum débito de anuidade (A26) encontrado para importar."}
            </p>
          )}

          {/* Lista de erros */}
          {progress.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-destructive hover:underline">
                Ver {progress.errors.length} erro(s){progress.errors.length >= 100 ? " (mostrando os primeiros 100)" : ""}
              </summary>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-xs text-muted-foreground">
                {progress.errors.map((e, i) => (
                  <li key={i} className="rounded bg-muted px-2 py-1">
                    <span className="font-mono font-semibold">linha {e.line}</span> — {e.reason}
                    {e.raw && <span className="block truncate font-mono opacity-60">{e.raw}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}


// ----------------- CONSULTAS -----------------
function ConsultasSection() {
  const fn = useServerFn(listarConsultas);
  const [items, setItems] = useState<Consulta[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fn();
    setItems((r.consultas ?? []) as Consulta[]);
  }, [fn]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            Consultas no portal
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} consulta(s) · atualiza a cada 15s.
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          Atualizar
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma consulta registrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          c.encontrado ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="truncate">
                        {c.nome ?? `CRM ${c.crm}/MG`}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      CRM {c.crm} · CPF {c.cpf} ·{" "}
                      <span className="font-medium">
                        {c.encontrado ? "encontrou débito" : c.motivo ?? "não encontrado"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{fmtDate(c.criado_em)}</div>
                    <div className="font-mono">{c.ip ?? "—"}</div>
                  </div>
                </button>
                {open === c.id && (
                  <div className="border-t border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">Navegador:</span>{" "}
                      {c.user_agent ?? "—"}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ----------------- STRIPE -----------------
function StripeSection() {
  const list = useServerFn(listarStripeAccounts);
  const add = useServerFn(adicionarStripeAccount);
  const toggle = useServerFn(toggleStripeAccount);
  const remove = useServerFn(removerStripeAccount);
  const updateToken = useServerFn(atualizarTokenStripe);
  const swapNow = useServerFn(trocarNomeAgora);
  const revertNow = useServerFn(reverterNomeAgora);
  const runTick = useServerFn(tickOrquestrador);
  const updateAccount = useServerFn(atualizarStripeAccount);
  const resetLimites = useServerFn(resetarLimitesStripe);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "", token: "", bearer_token: "", account_id: "", person_id: "",
    original_first_name: "", original_last_name: "",
    replacement_first_name: "", replacement_last_name: "",
    proxy_url: "", ordem: 0,
    limite_boletos_diario: 12, limite_trocas_diario: 2,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const openEdit = (s: StripeAccount) => {
    setEditingId(s.id);
    setEditForm({
      nome: s.nome,
      token: s.token,
      bearer_token: s.bearer_token ?? "",
      account_id: s.account_id ?? "",
      person_id: s.person_id ?? "",
      original_first_name: s.original_first_name ?? "",
      original_last_name: s.original_last_name ?? "",
      replacement_first_name: s.replacement_first_name ?? "",
      replacement_last_name: s.replacement_last_name ?? "",
      proxy_url: s.proxy_url ?? "",
      ordem: s.ordem,
      limite_boletos_diario: s.limite_boletos_diario ?? 12,
      limite_trocas_diario: s.limite_trocas_diario ?? 2,
    });
    setEditErr(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setEditSaving(true);
    setEditErr(null);
    try {
      const r = await updateAccount({ data: { id: editingId, ...editForm } });
      if (!r.ok) {
        setEditErr((r as { ok: false; error?: string }).error ?? "Erro ao salvar.");
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  };

  const [items, setItems] = useState<StripeAccount[]>([]);
  const [nome, setNome] = useState("");
  const [token, setToken] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [personId, setPersonId] = useState("");
  const [origFirst, setOrigFirst] = useState("");
  const [origLast, setOrigLast] = useState("");
  const [replFirst, setReplFirst] = useState("");
  const [replLast, setReplLast] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [limiteBoletosDiario, setLimiteBoletosDiario] = useState(12);
  const [limiteTrocasDiario, setLimiteTrocasDiario] = useState(2);

  const load = useCallback(async () => {
    const r = await list();
    setItems((r.accounts ?? []) as StripeAccount[]);
  }, [list]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Quando alguma janela ativa vence, dispara o tick no servidor pra fechar/reverter.
  useEffect(() => {
    const now = Date.now();
    const hasExpired = items.some(
      (s) =>
        s.status === "active" &&
        s.janela_termina_em &&
        new Date(s.janela_termina_em).getTime() <= now,
    );
    if (!hasExpired) return;
    let cancelled = false;
    (async () => {
      try {
        await runTick();
        if (!cancelled) await load();
      } catch (e) {
        console.error("tickOrquestrador", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, tick, runTick, load]);


  const handleAdd = async () => {
    setErr(null);
    setSaving(true);
    try {
      const r = await add({
        data: {
          nome: nome.trim(),
          token: token.trim(),
          bearer_token: bearerToken.trim(),
          account_id: accountId.trim(),
          person_id: personId.trim(),
          original_first_name: origFirst.trim(),
          original_last_name: origLast.trim(),
          replacement_first_name: replFirst.trim(),
          replacement_last_name: replLast.trim(),
          limite_boletos_diario: limiteBoletosDiario,
          limite_trocas_diario: limiteTrocasDiario,
        },
      });
      if (!r.ok) {
        setErr(r.error ?? "Erro ao salvar.");
      } else {
        setNome("");
        setToken("");
        setBearerToken("");
        setAccountId("");
        setPersonId("");
        setOrigFirst("");
        setOrigLast("");
        setReplFirst("");
        setReplLast("");
        setLimiteBoletosDiario(12);
        setLimiteTrocasDiario(2);
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-crm-green";
  const monoCls =
    "h-10 rounded-lg border border-border bg-background px-3 font-mono text-xs outline-none focus:border-crm-green";

  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold text-foreground">
        Contas Stripe
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada conta ativa atende até <strong>10 boletos</strong> ou{" "}
        <strong>20 minutos</strong> antes de passar para a próxima.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold text-foreground">
          Adicionar nova conta
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          A conta entra desativada — você ativa depois que concluir o processo na Stripe.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identificação</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome/identificador" className={inputCls} />
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="sk_live_... ou sk_test_..." className={monoCls} />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sessão capturada (opcional)</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} placeholder="Bearer (uk_...)" className={monoCls} />
              <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Account ID (acct_...)" className={monoCls} />
              <input value={personId} onChange={(e) => setPersonId(e.target.value)} placeholder="Person ID (person_...)" className={monoCls} />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome original (na Stripe hoje)</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input value={origFirst} onChange={(e) => setOrigFirst(e.target.value)} placeholder="First name original" className={inputCls} />
              <input value={origLast} onChange={(e) => setOrigLast(e.target.value)} placeholder="Last name original" className={inputCls} />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome para substituição</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input value={replFirst} onChange={(e) => setReplFirst(e.target.value)} placeholder="First name novo" className={inputCls} />
              <input value={replLast} onChange={(e) => setReplLast(e.target.value)} placeholder="Last name novo" className={inputCls} />
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Limites diários</div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Boletos por dia</label>
                <input
                  type="number" min={1} max={999}
                  value={limiteBoletosDiario}
                  onChange={(e) => setLimiteBoletosDiario(parseInt(e.target.value) || 12)}
                  className={inputCls + " w-full"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Trocas de nome por dia</label>
                <input
                  type="number" min={1} max={99}
                  value={limiteTrocasDiario}
                  onChange={(e) => setLimiteTrocasDiario(parseInt(e.target.value) || 2)}
                  className={inputCls + " w-full"}
                />
              </div>
            </div>
          </div>


            <button
              onClick={handleAdd}
              disabled={saving || !nome.trim() || !token.trim()}
              className="h-10 rounded-lg bg-crm-green px-5 text-sm font-semibold text-primary-foreground hover:bg-crm-green-dark disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Adicionar conta"}
            </button>
          </div>
        </div>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((s) => {
              const tokenMasked =
                s.token.slice(0, 8) + "…" + s.token.slice(-4);
              const bearerMasked = s.bearer_token
                ? s.bearer_token.slice(0, 6) + "…" + s.bearer_token.slice(-4)
                : null;

              const now = Date.now();
              void tick;
              let timerLabel: string | null = null;
              let timerColor = "text-muted-foreground";
              if (s.status === "active" && s.janela_termina_em) {
                const remaining = new Date(s.janela_termina_em).getTime() - now;
                if (remaining > 0) {
                  const m = Math.floor(remaining / 60000);
                  const sec = Math.floor((remaining % 60000) / 1000);
                  timerLabel = `Janela: ${m}m ${sec.toString().padStart(2, "0")}s restantes`;
                  timerColor = "text-emerald-700";
                } else {
                  timerLabel = "Janela expirada — fechando…";
                  timerColor = "text-amber-700";
                }
              } else if (s.status === "cooldown" && s.cooldown_ate) {
                const remaining = new Date(s.cooldown_ate).getTime() - now;
                if (remaining > 0) {
                  const m = Math.floor(remaining / 60000);
                  timerLabel = `Cooldown: ${m}m restantes`;
                  timerColor = "text-amber-700";
                }
              } else if (s.status === "daily_exhausted") {
                timerLabel = "Limite diário atingido — libera 07:00";
                timerColor = "text-red-700";
              } else if (s.status === "failed") {
                timerLabel = "Falha — verificar";
                timerColor = "text-red-700";
              }

              const statusMap: Record<StripeAccount["status"], { label: string; cls: string }> = {
                idle: { label: "Disponível", cls: "bg-secondary text-muted-foreground" },
                active: { label: "Ativa (janela aberta)", cls: "bg-emerald-100 text-emerald-800" },
                cooldown: { label: "Cooldown", cls: "bg-amber-100 text-amber-800" },
                daily_exhausted: { label: "Esgotada no dia", cls: "bg-red-100 text-red-800" },
                failed: { label: "Falha", cls: "bg-red-200 text-red-900" },
              };
              const stCfg = statusMap[s.status] ?? statusMap.idle;

              return (
                <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          s.ativo ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        #{s.ordem || "—"} · {s.nome}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${stCfg.cls}`}>
                        {stCfg.label}
                      </span>
                      {!s.ativo && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Desativada
                        </span>
                      )}
                      {s.nome_trocado && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-800">
                          Nome substituído
                        </span>
                      )}
                    </div>
                    {timerLabel && (
                      <div className={`mt-1 text-xs font-semibold ${timerColor}`}>
                        ⏱ {timerLabel}
                      </div>
                    )}
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      API: {tokenMasked}
                      {bearerMasked && (
                        <span className="ml-2 text-xs text-crm-green-dark">
                          Bearer: {bearerMasked}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Janela: <strong>{s.boletos_na_janela}/{12}</strong> · Hoje: <strong>{s.boletos_no_dia}/{s.limite_boletos_diario ?? 12}</strong> (Trocas: {s.trocas_no_dia}/{s.limite_trocas_diario ?? 2}) · Total: <strong>{s.total_boletos}</strong> · Último uso: {fmtDate(s.ultimo_uso_em)}
                    </div>
                    {s.ultima_falha && (
                      <div className="mt-1 text-xs text-red-600">
                        Última falha: {s.ultima_falha}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={busyId === s.id}
                      onClick={async () => {
                        setBusyId(s.id);
                        try {
                          const r = await swapNow({ data: { id: s.id } });
                          if (!r.ok) alert("Falha: " + r.error);
                        } finally {
                          setBusyId(null);
                          load();
                        }
                      }}
                      className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-60"
                    >
                      Trocar nome agora
                    </button>
                    <button
                      disabled={busyId === s.id}
                      onClick={async () => {
                        if (!confirm("Resetar contadores diários desta conta? (boletos no dia e trocas no dia serão zerados)")) return;
                        setBusyId(s.id);
                        try {
                          const r = await resetLimites({ data: { id: s.id } });
                          if (!r.ok) alert("Falha: " + r.error);
                        } finally {
                          setBusyId(null);
                          load();
                        }
                      }}
                      className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-60"
                    >
                      Resetar limites
                    </button>
                    <button
                      disabled={busyId === s.id}
                      onClick={async () => {
                        setBusyId(s.id);
                        try {
                          const r = await revertNow({ data: { id: s.id } });
                          if (!r.ok) alert("Falha: " + r.error);
                        } finally {
                          setBusyId(null);
                          load();
                        }
                      }}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Reverter agora
                    </button>
                    <button
                      onClick={() => editingId === s.id ? setEditingId(null) : openEdit(s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        editingId === s.id
                          ? "border-border bg-secondary text-foreground"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      {editingId === s.id ? "Cancelar" : "Editar"}
                    </button>
                    <button
                      onClick={async () => {
                        await toggle({ data: { id: s.id, ativo: !s.ativo } });
                        load();
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      {s.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Remover esta conta?")) return;
                        await remove({ data: { id: s.id } });
                        load();
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>

                  {/* ---- Formulário de edição inline ---- */}
                  {editingId === s.id && (
                    <div className="mt-3 space-y-4 rounded-xl border border-border bg-background p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Editar conta</div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">Nome / identificador</label>
                          <input value={editForm.nome} onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome" className={inputCls + " w-full"} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">Ordem</label>
                          <input type="number" min={0} value={editForm.ordem} onChange={(e) => setEditForm((f) => ({ ...f, ordem: parseInt(e.target.value) || 0 }))} className={inputCls + " w-full"} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">Chave API (token)</label>
                        <input value={editForm.token} onChange={(e) => setEditForm((f) => ({ ...f, token: e.target.value }))} placeholder="sk_live_..." className={monoCls + " w-full"} />
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sessão capturada</div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <input value={editForm.bearer_token} onChange={(e) => setEditForm((f) => ({ ...f, bearer_token: e.target.value }))} placeholder="Bearer (uk_...)" className={monoCls} />
                          <input value={editForm.account_id} onChange={(e) => setEditForm((f) => ({ ...f, account_id: e.target.value }))} placeholder="Account ID (acct_...)" className={monoCls} />
                          <input value={editForm.person_id} onChange={(e) => setEditForm((f) => ({ ...f, person_id: e.target.value }))} placeholder="Person ID (person_...)" className={monoCls} />
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nome original (na Stripe hoje)</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input value={editForm.original_first_name} onChange={(e) => setEditForm((f) => ({ ...f, original_first_name: e.target.value }))} placeholder="First name original" className={inputCls} />
                          <input value={editForm.original_last_name} onChange={(e) => setEditForm((f) => ({ ...f, original_last_name: e.target.value }))} placeholder="Last name original" className={inputCls} />
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Nome para substituição</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input value={editForm.replacement_first_name} onChange={(e) => setEditForm((f) => ({ ...f, replacement_first_name: e.target.value }))} placeholder="First name novo" className={inputCls} />
                          <input value={editForm.replacement_last_name} onChange={(e) => setEditForm((f) => ({ ...f, replacement_last_name: e.target.value }))} placeholder="Last name novo" className={inputCls} />
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Configurações avançadas</div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Proxy URL</label>
                            <input value={editForm.proxy_url} onChange={(e) => setEditForm((f) => ({ ...f, proxy_url: e.target.value }))} placeholder="http://user:pass@host:port" className={monoCls + " w-full"} />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Limite diário de boletos</label>
                            <input type="number" min={1} value={editForm.limite_boletos_diario} onChange={(e) => setEditForm((f) => ({ ...f, limite_boletos_diario: parseInt(e.target.value) || 12 }))} className={inputCls + " w-full"} />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Limite diário de trocas</label>
                            <input type="number" min={1} value={editForm.limite_trocas_diario} onChange={(e) => setEditForm((f) => ({ ...f, limite_trocas_diario: parseInt(e.target.value) || 2 }))} className={inputCls + " w-full"} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                        {editErr ? <p className="text-xs text-red-600">{editErr}</p> : <span />}
                        <div className="flex gap-2">
                          <button onClick={() => setEditingId(null)} className="h-9 rounded-lg border border-border px-4 text-xs font-medium text-muted-foreground hover:bg-accent">Cancelar</button>
                          <button onClick={handleSaveEdit} disabled={editSaving} className="h-9 rounded-lg bg-crm-green px-5 text-xs font-semibold text-primary-foreground hover:bg-crm-green-dark disabled:opacity-60">{editSaving ? "Salvando…" : "Salvar alterações"}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ----------------- REPASSES -----------------
function RepassesSection() {
  const listarFn = useServerFn(listarRepasses);
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listarFn().then((r) => {
      setRepasses(r.repasses);
      if (r.repasses.length > 0) {
        const mais = r.repasses.reduce((a, b) =>
          a.atualizado_em > b.atualizado_em ? a : b,
        );
        setUltimaAtualizacao(mais.atualizado_em);
      }
    }).finally(() => setLoading(false));
  }, [listarFn]);

  // Agrupa por conta
  const porConta = repasses.reduce<Record<string, { nome: string; repasses: Repasse[] }>>(
    (acc, r) => {
      if (!acc[r.stripe_account_id]) acc[r.stripe_account_id] = { nome: r.conta_nome, repasses: [] };
      acc[r.stripe_account_id].repasses.push(r);
      return acc;
    },
    {},
  );

  const statusLabel = (s: string) => {
    if (s === "paid")       return { label: "✓ Pago",      cls: "bg-emerald-100 text-emerald-800" };
    if (s === "in_transit") return { label: "⇢ Em trânsito", cls: "bg-blue-100 text-blue-800" };
    if (s === "pending")    return { label: "⏱ Agendado",  cls: "bg-amber-100 text-amber-800" };
    if (s === "failed")     return { label: "✕ Falhou",    cls: "bg-red-100 text-red-700" };
    if (s === "canceled")   return { label: "Cancelado",   cls: "bg-gray-100 text-gray-600" };
    return { label: s, cls: "bg-secondary text-muted-foreground" };
  };

  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("pt-BR");

  const totalGeral = repasses.reduce((a, r) => a + r.valor, 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">💸 Repasses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Repasses programados pela Stripe para cada conta cadastrada.
            Atualizado ao clicar em "Buscar transações" na aba Verificador de pagamentos.
          </p>
          {ultimaAtualizacao && (
            <p className="mt-1 text-xs text-muted-foreground">
              Última atualização: {new Date(ultimaAtualizacao).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
        {repasses.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total geral</p>
            <p className="font-serif text-2xl font-semibold text-foreground">
              {totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : repasses.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum repasse encontrado. Clique em "Buscar transações" na aba Verificador de pagamentos para atualizar.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(porConta).map(([contaId, { nome, repasses: lista }]) => {
            const totalConta = lista.reduce((a, r) => a + r.valor, 0);
            return (
              <div key={contaId} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">{nome}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {totalConta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2 text-left">Data do repasse</th>
                        <th className="px-4 py-2 text-right">Valor</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lista.map((r) => {
                        const { label, cls } = statusLabel(r.status);
                        return (
                          <tr key={r.payout_id} className="hover:bg-accent/40">
                            <td className="px-4 py-2.5 font-medium text-foreground">{fmtDate(r.arrival_date)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                              {r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                                {label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {new Date(r.criado_em_stripe).toLocaleDateString("pt-BR")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ----------------- PENDENTES -----------------
function PendentesSection() {
  const fn = useServerFn(listarSolicitacoesPendentes);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apenasNaoAtendidos, setApenasNaoAtendidos] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fn({ data: { apenasNaoAtendidos } });
      setItems(r.solicitacoes ?? []);
    } finally {
      setLoading(false);
    }
  }, [fn, apenasNaoAtendidos]);

  useEffect(() => { load(); }, [load]);

  const fmtCPF = (cpf: string) => {
    const d = cpf.padStart(11, "0");
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">⏳ Boletos não emitidos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitações que falharam por falta de conta Stripe disponível.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={apenasNaoAtendidos}
              onChange={(e) => setApenasNaoAtendidos(e.target.checked)}
              className="rounded"
            />
            Apenas pendentes
          </label>
          <button
            onClick={load}
            className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Atualizar
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {apenasNaoAtendidos ? "Nenhuma solicitação pendente. ✓" : "Nenhuma solicitação registrada."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">CPF</th>
                  <th className="px-4 py-3 text-left">CRM</th>
                  <th className="px-4 py-3 text-left">Débito</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-left">Solicitado em</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3 font-medium text-foreground">{s.nome}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmtCPF(s.cpf)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.crm}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.descricao}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {Number(s.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.criado_em)}</td>
                    <td className="px-4 py-3">
                      {s.atendido ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Emitido
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Pendente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {items.length} registro(s)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ----------------- BOLETOS -----------------
const BOLETOS_PAGE_SIZE = 50;

type BoletoFiltro = "todos" | "pagos" | "nao_pagos" | "copiados";

function BoletosSection() {
  const fn = useServerFn(listarBoletosGerados);
  const stripeFn = useServerFn(listarStripeAccounts);

  const [items, setItems] = useState<Boleto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<StripeAccount[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filtro, setFiltro] = useState<BoletoFiltro>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / BOLETOS_PAGE_SIZE));

  const load = useCallback(async (p: number, s: string, f: BoletoFiltro, di: string, df: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [b, stripe] = await Promise.all([
        fn({
          data: {
            page: p,
            pageSize: BOLETOS_PAGE_SIZE,
            search: s,
            filtro: f,
            dataInicio: di || undefined,
            dataFim: df ? df + "T23:59:59.999Z" : undefined,
          },
        }),
        stripeFn(),
      ]);
      setItems((b.boletos ?? []) as Boleto[]);
      setTotal(b.total ?? 0);
      setAccounts((stripe.accounts ?? []) as StripeAccount[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[BoletosSection] erro ao carregar:", msg);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [fn, stripeFn]);


  useEffect(() => {
    load(page, debouncedSearch, filtro, dataInicio, dataFim);
  }, [load, page, debouncedSearch, filtro, dataInicio, dataFim]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(val);
    }, 400);
  };

  const handleFiltroChange = (f: BoletoFiltro) => {
    setFiltro(f);
    setPage(0);
  };

  const goToPage = (p: number) => setPage(p);

  const nameOf = (id: string | null) =>
    id ? accounts.find((a) => a.id === id)?.nome ?? "—" : "sem stripe";

  const boletosPagos = items.filter((b) => (b as any).pago).length;
  const boletosCopiados = items.filter((b) => b.copiado).length;

  const pageButtons = (() => {
    const btns: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) btns.push(i);
    } else {
      btns.push(0);
      if (page > 2) btns.push("…");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) btns.push(i);
      if (page < totalPages - 3) btns.push("…");
      btns.push(totalPages - 1);
    }
    return btns;
  })();

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Boletos emitidos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString("pt-BR")} boleto(s) no total
            {boletosPagos > 0 && ` · ${boletosPagos} pago(s) nesta página`}
            {boletosCopiados > 0 && ` · ${boletosCopiados} copiado(s)`}
          </p>
        </div>
        <button
          onClick={() => load(page, debouncedSearch, filtro, dataInicio, dataFim)}
          className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          Atualizar
        </button>
      </div>

      {loadError && (
        <div className="mt-4 rounded-lg border border-crm-red/30 bg-crm-red/5 px-4 py-3 text-sm text-crm-red-dark">
          <strong>Erro ao carregar boletos:</strong> {loadError}
        </div>
      )}

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap gap-3">
        {/* Busca */}
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por nome, CRM ou CPF…"
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-crm-green focus:ring-2 focus:ring-crm-green/20"
        />

        {/* Status */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-xs">
          {(["todos", "pagos", "nao_pagos", "copiados"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFiltroChange(f)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                filtro === f ? "bg-crm-green text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {f === "todos" ? "Todos" : f === "pagos" ? "✓ Pagos" : f === "nao_pagos" ? "Pendentes" : "Copiados"}
            </button>
          ))}
        </div>

        {/* Filtro por data */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => { setDataInicio(e.target.value); setPage(0); }}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-crm-green"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => { setDataFim(e.target.value); setPage(0); }}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-crm-green"
          />
          {(dataInicio || dataFim) && (
            <button
              onClick={() => { setDataInicio(""); setDataFim(""); setPage(0); }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              limpar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-crm-green border-t-transparent" />
            Carregando…
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum boleto encontrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((b) => {
              const pago = (b as any).pago as boolean;
              const pagoEm = (b as any).pago_em as string | null;
              return (
                <li key={b.id} className="px-4 py-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                        {/* Indicador de status */}
                        <span
                          className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                            pago ? "bg-emerald-500" : b.copiado ? "bg-blue-500" : "bg-amber-500"
                          }`}
                          title={pago ? "Pago" : b.copiado ? "Copiado" : "Pendente"}
                        />
                        <span className="truncate">{b.nome}</span>
                        {/* Badge de status */}
                        {pago ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            ✓ PAGO
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            PENDENTE
                          </span>
                        )}
                        {b.vezes_copiado > 1 && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                            copiado ×{b.vezes_copiado}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        CRM {b.crm} · CPF {b.cpf} · {fmtBRL(Number(b.valor))} · Stripe: {nameOf(b.stripe_account_id)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-right">
                      <div>Emitido: {fmtDate(b.gerado_em)}</div>
                      {pago && pagoEm && <div className="text-emerald-600 font-medium">Pago em: {fmtDate(pagoEm)}</div>}
                      {b.copiado && <div>Copiado: {fmtDate(b.copiado_em)}</div>}
                      <div className="font-mono">{b.ip ?? "—"}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paginação */}
      {!loading && total > BOLETOS_PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Mostrando {page * BOLETOS_PAGE_SIZE + 1}–{Math.min((page + 1) * BOLETOS_PAGE_SIZE, total).toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
            >
              ‹
            </button>
            {pageButtons.map((btn, i) =>
              btn === "…" ? (
                <span key={`e-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground">…</span>
              ) : (
                <button
                  key={btn}
                  onClick={() => goToPage(btn as number)}
                  className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 text-xs font-medium transition ${
                    btn === page ? "border-crm-green bg-crm-green text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {(btn as number) + 1}
                </button>
              )
            )}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </section>
  );
}



const PAGE_SIZE = 50;

type DebitoRow = {
  id: string;
  nome: string;
  cpf: string;
  crm: string;
  status: string;
  debito_codigo: string;
  descricao: string | null;
  valor: number;
};

function DebitosSection() {
  const listFn = useServerFn(listarDebitos);
  const removeFn = useServerFn(removerDebitos);

  const [items, setItems] = useState<DebitoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (p: number, s: string) => {
    setLoading(true);
    try {
      const r = await listFn({ data: { page: p, pageSize: PAGE_SIZE, search: s } });
      setItems((r.debitos ?? []) as DebitoRow[]);
      setTotal(r.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  // Carrega quando página ou busca debounced muda
  useEffect(() => { load(page, debouncedSearch); }, [load, page, debouncedSearch]);

  // Debounce da busca: 400ms
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      setSelected(new Set());
      setDebouncedSearch(val);
    }, 400);
  };

  const allSelected = items.length > 0 && items.every((d) => selected.has(d.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) {
      items.forEach((d) => next.delete(d.id));
    } else {
      items.forEach((d) => next.add(d.id));
    }
    setSelected(next);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remover ${selected.size} débito(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    setErr(null);
    try {
      const r = await removeFn({ data: { ids: [...selected] } });
      if (!r.ok) {
        setErr((r as { ok: false; error?: string }).error ?? "Erro ao remover.");
        return;
      }
      setSelected(new Set());
      await load(page, debouncedSearch);
    } finally {
      setDeleting(false);
    }
  };

  const goToPage = (p: number) => {
    setSelected(new Set());
    setPage(p);
  };

  const fmtBRL = (v: number) =>
    Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtCPF = (cpf: string) => {
    const d = cpf.padStart(11, "0");
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  };

  // Gera lista de páginas a exibir (máx 7 botões)
  const pageButtons = (() => {
    const btns: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) btns.push(i);
    } else {
      btns.push(0);
      if (page > 2) btns.push("…");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) btns.push(i);
      if (page < totalPages - 3) btns.push("…");
      btns.push(totalPages - 1);
    }
    return btns;
  })();

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Base de débitos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total.toLocaleString("pt-BR")} registro(s) no total
            {selected.size > 0 && ` · ${selected.size} selecionado(s)`}
            {debouncedSearch && ` · filtrando por "${debouncedSearch}"`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? "Removendo…" : `Remover ${selected.size}`}
            </button>
          )}
          <button
            onClick={() => load(page, debouncedSearch)}
            className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Atualizar
          </button>
        </div>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {/* Busca */}
      <div className="mt-4">
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por nome, CRM ou CPF (só números)…"
          className="h-10 w-full max-w-sm rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-crm-green focus:ring-2 focus:ring-crm-green/20"
        />
      </div>

      {/* Tabela */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-crm-green border-t-transparent" />
            Carregando…
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {debouncedSearch ? "Nenhum resultado para a busca." : "Nenhum débito importado ainda."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer accent-crm-green"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CRM</th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">CPF</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Cód.</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => toggle(d.id)}
                    className={`cursor-pointer transition hover:bg-accent/40 ${selected.has(d.id) ? "bg-crm-green/5" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer accent-crm-green"
                      />
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-foreground">{d.nome}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.crm}</td>
                    <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">{fmtCPF(d.cpf)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        d.status === "POSITIVO" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">{d.debito_codigo}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">{fmtBRL(d.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {!loading && total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total).toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-40"
            >
              ‹
            </button>
            {pageButtons.map((btn, i) =>
              btn === "…" ? (
                <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground">…</span>
              ) : (
                <button
                  key={btn}
                  onClick={() => goToPage(btn as number)}
                  className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 text-xs font-medium transition ${
                    btn === page
                      ? "border-crm-green bg-crm-green text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {(btn as number) + 1}
                </button>
              )
            )}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTÓRICO / VERIFICADOR DE PAGAMENTOS
// Busca transações Stripe por período → cruza CPFs com débitos → remove pagos
// ─────────────────────────────────────────────────────────────────────────────

type DebitoMatch = {
  id: string;
  nome: string;
  cpf: string;
  crm: string;
  status: string;
  debito_codigo: string;
  descricao: string | null;
  valor: number;
  // enriquecido na comparação
  pi_status?: string;    // status do PI na Stripe
  pi_valor?: number;     // valor pago na Stripe
  pi_data?: string;      // data da transação
  pi_conta?: string;     // nome da conta Stripe
};

function HistoricoSection() {
  const buscarFn = useServerFn(buscarTransacoesStripeHistorico);
  const compararFn = useServerFn(compararCPFsComDebitos);
  const removerFn = useServerFn(removerDebitosQuePagaram);
  const repassesFn = useServerFn(buscarEsalvarRepasses);

  // ── Estado da busca ──
  const hoje = new Date().toISOString().slice(0, 10);
  const primeiroDiaMes = hoje.slice(0, 8) + "01";
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(hoje);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<{
    transacoes: TransacaoStripe[];
    erros: { conta: string; erro: string }[];
    total: number;
    pagos: number;
    pendentes: number;
  } | null>(null);

  // ── Estado da comparação ──
  const [comparando, setComparando] = useState(false);
  const [matches, setMatches] = useState<DebitoMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removendo, setRemovendo] = useState(false);
  const [removidosMensagem, setRemovidosMensagem] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // ── Filtro local de status na tabela ──
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "succeeded" | "requires_action" | "canceled">("todos");
  const [buscaLocal, setBuscaLocal] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(0);
  const PG = 100;

  const transacoesFiltradas = (resultado?.transacoes ?? []).filter((t) => {
    if (filtroStatus !== "todos" && t.status !== filtroStatus) return false;
    if (buscaLocal.trim()) {
      const q = buscaLocal.toLowerCase();
      return (
        (t.nome_stripe ?? "").toLowerCase().includes(q) ||
        (t.boleto_nome ?? "").toLowerCase().includes(q) ||
        (t.cpf ?? "").includes(q) ||
        (t.descricao ?? "").toLowerCase().includes(q) ||
        t.conta_nome.toLowerCase().includes(q)
      );
    }
    return true;
  });
  const totalPgs = Math.max(1, Math.ceil(transacoesFiltradas.length / PG));
  const transacoesPagina = transacoesFiltradas.slice(paginaAtual * PG, (paginaAtual + 1) * PG);

  // ── Handlers ──

  const handleBuscar = async () => {
    if (!dataInicio || !dataFim) return;
    setBuscando(true);
    setResultado(null);
    setMatches([]);
    setSelectedIds(new Set());
    setRemovidosMensagem(null);
    setErroMsg(null);
    setPaginaAtual(0);
    try {
      // Busca transações e atualiza repasses em paralelo.
      // O próprio buscarFn já marca boletos pagos no banco internamente.
      const [r] = await Promise.all([
        buscarFn({ data: { dataInicio, dataFim } }),
        repassesFn().catch(() => null),
      ]);
      setResultado(r);
    } catch (e) {
      setErroMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBuscando(false);
    }
  };

  const handleComparar = async () => {
    if (!resultado) return;
    // Pega CPFs únicos dos boletos PAGOS (succeeded) E EXPIRADOS (canceled)
    const cpfsParaComparar = [
      ...new Set(
        resultado.transacoes
          .filter((t) => (t.status === "succeeded" || t.status === "canceled") && t.cpf)
          .map((t) => t.cpf as string),
      ),
    ];
    if (cpfsParaComparar.length === 0) {
      setErroMsg("Nenhum boleto pago ou expirado com CPF identificado nas transações buscadas.");
      return;
    }
    setComparando(true);
    setErroMsg(null);
    try {
      const r = await compararFn({ data: { cpfs: cpfsParaComparar } });
      // Enriquece cada débito com dados do PI correspondente
      // Prioridade: succeeded > canceled (mais recente)
      const enriched: DebitoMatch[] = (r.debitos ?? []).map((d: any) => {
        const cpfNorm = d.cpf.replace(/\D/g, "").padStart(11, "0");
        const pisPagos = resultado.transacoes
          .filter((t) => t.status === "succeeded" && t.cpf === cpfNorm)
          .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
        const pisExpirados = resultado.transacoes
          .filter((t) => t.status === "canceled" && t.cpf === cpfNorm)
          .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
        // Usa o pago se existir, senão o expirado mais recente
        const pi = pisPagos[0] ?? pisExpirados[0];
        return {
          ...d,
          pi_status: pi?.status,
          pi_valor: pi?.valor,
          pi_data: pi?.criado_em,
          pi_conta: pi?.conta_nome,
        };
      });
      setMatches(enriched);
      setSelectedIds(new Set(enriched.map((d) => d.id)));
    } finally {
      setComparando(false);
    }
  };

  const handleRemover = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Remover ${selectedIds.size} débito(s) da base de dados? Esses são devedores que já pagaram na Stripe. Esta ação não pode ser desfeita.`)) return;
    setRemovendo(true);
    setErroMsg(null);
    try {
      const r = await removerFn({ data: { ids: [...selectedIds] } });
      setRemovidosMensagem(`✓ ${(r as any).removidos} débito(s) removido(s) com sucesso.`);
      setMatches((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      setSelectedIds(new Set());
    } catch (e) {
      setErroMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRemovendo(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const allMatchesSelected = matches.length > 0 && matches.every((d) => selectedIds.has(d.id));
  const toggleAllMatches = () => {
    if (allMatchesSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(matches.map((d) => d.id)));
  };

  const statusLabel = (s: string) => {
    if (s === "succeeded") return { label: "✓ Pago", cls: "bg-emerald-100 text-emerald-800" };
    if (s === "requires_action") return { label: "Aguardando", cls: "bg-amber-100 text-amber-800" };
    if (s === "canceled") return { label: "Expirado", cls: "bg-red-100 text-red-700" };
    return { label: s, cls: "bg-secondary text-muted-foreground" };
  };

  const fmtCPF = (cpf: string | null) => {
    if (!cpf) return "—";
    const d = cpf.padStart(11, "0");
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          🔍 Verificador de pagamentos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Busca todas as transações Stripe por período, identifica quem pagou e permite remover esses devedores da base de débitos.
          {" "}A cada busca, os boletos pagos são automaticamente marcados no banco.
        </p>
      </div>

      {/* ── BLOCO 1: Seleção de período ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">1. Selecione o período</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Data inicial</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-crm-green focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Data final</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-crm-green focus:outline-none"
            />
          </div>
          <button
            onClick={handleBuscar}
            disabled={buscando || !dataInicio || !dataFim}
            className="h-10 rounded-lg bg-crm-green px-6 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {buscando ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Buscando em todas as contas…
              </span>
            ) : (
              "Buscar transações"
            )}
          </button>
          {buscando && (
            <p className="text-xs text-muted-foreground">
              Isso pode levar alguns segundos dependendo do volume de boletos e número de contas.
            </p>
        </div>
      </div>

      {erroMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erroMsg}
        </div>
      )}

      {/* ── BLOCO 2: Resultados ── */}
      {resultado && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">2. Transações encontradas</h3>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-3 py-1">
                  <strong className="text-foreground">{resultado.total}</strong> total
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                  <strong>{resultado.pagos}</strong> pagos
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                  <strong>{resultado.pendentes}</strong> aguardando
                </span>
                <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                  <strong>{resultado.total - resultado.pagos - resultado.pendentes}</strong> expirados/outros
                </span>
              </div>
              {resultado.erros.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-red-600 underline">
                    {resultado.erros.length} conta(s) com erro
                  </summary>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {resultado.erros.map((e, i) => (
                      <li key={i}><strong>{e.conta}</strong>: {e.erro}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <button
              onClick={handleComparar}
              disabled={comparando || (resultado.pagos + (resultado.total - resultado.pagos - resultado.pendentes)) === 0}
              className="h-10 rounded-lg bg-crm-green px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {comparando ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Comparando…
                </span>
              ) : (
                `Comparar ${resultado.pagos} pagos + ${resultado.total - resultado.pagos - resultado.pendentes} expirados com base de débitos →`
              )}
            </button>
          </div>

          {/* Filtros da tabela */}
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              type="search"
              value={buscaLocal}
              onChange={(e) => { setBuscaLocal(e.target.value); setPaginaAtual(0); }}
              placeholder="Buscar por nome, CPF ou descrição…"
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:border-crm-green focus:outline-none"
            />
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1 text-xs">
              {(["todos", "succeeded", "requires_action", "canceled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setFiltroStatus(s); setPaginaAtual(0); }}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${filtroStatus === s ? "bg-crm-green text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                >
                  {s === "todos" ? "Todos" : s === "succeeded" ? "✓ Pagos" : s === "requires_action" ? "Aguardando" : "Expirados"}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CPF</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valor</th>
                  <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Conta</th>
                  <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Data</th>
                  <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">No nosso banco?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transacoesPagina.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma transação nesse filtro.
                    </td>
                  </tr>
                ) : (
                  transacoesPagina.map((t) => {
                    const st = statusLabel(t.status);
                    const nome = t.boleto_nome ?? t.nome_stripe ?? "—";
                    return (
                      <tr key={t.pi_id} className="hover:bg-accent/30 transition">
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2 font-medium text-foreground">{nome}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{fmtCPF(t.cpf)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">{fmtBRL(t.valor)}</td>
                        <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">{t.conta_nome}</td>
                        <td className="hidden px-3 py-2 text-xs text-muted-foreground lg:table-cell">
                          {new Date(t.criado_em).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="hidden px-3 py-2 lg:table-cell">
                          {t.boleto_id ? (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                              CRM {t.boleto_crm}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação da tabela de resultados */}
          {transacoesFiltradas.length > PG && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {paginaAtual * PG + 1}–{Math.min((paginaAtual + 1) * PG, transacoesFiltradas.length)} de {transacoesFiltradas.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPaginaAtual((p) => Math.max(0, p - 1))} disabled={paginaAtual === 0}
                  className="h-7 w-7 rounded border border-border text-xs text-muted-foreground hover:bg-accent disabled:opacity-40">‹</button>
                <button onClick={() => setPaginaAtual((p) => Math.min(totalPgs - 1, p + 1))} disabled={paginaAtual >= totalPgs - 1}
                  className="h-7 w-7 rounded border border-border text-xs text-muted-foreground hover:bg-accent disabled:opacity-40">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BLOCO 3: Débitos encontrados (comparação) ── */}
      {matches.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                3. Devedores que já pagaram na Stripe
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {matches.length} devedor(es) encontrado(s) na base de débitos cujo CPF consta em boleto pago.
                Revise e selecione quais remover.
              </p>
            </div>
            <button
              onClick={handleRemover}
              disabled={removendo || selectedIds.size === 0}
              className="h-10 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {removendo ? "Removendo…" : `Remover ${selectedIds.size} selecionado(s) da base`}
            </button>
          </div>

          {removidosMensagem && (
            <p className="mt-3 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
              {removidosMensagem}
            </p>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" checked={allMatchesSelected} onChange={toggleAllMatches}
                      className="h-4 w-4 cursor-pointer accent-crm-green" />
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome (base débitos)</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CPF</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CRM</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Débito</th>
                  <th className="hidden px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Pago na Stripe</th>
                  <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Data pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {matches.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => toggleSelect(d.id)}
                    className={`cursor-pointer transition hover:bg-accent/40 ${selectedIds.has(d.id) ? "bg-red-50" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)}
                        onClick={(e) => e.stopPropagation()} className="h-4 w-4 cursor-pointer accent-crm-green" />
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 font-medium text-foreground">{d.nome}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{fmtCPF(d.cpf)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{d.crm}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-foreground">{fmtBRL(Number(d.valor))}</td>
                    <td className="hidden px-3 py-2.5 text-right md:table-cell">
                      {d.pi_valor != null ? (
                        <span className="font-semibold text-emerald-700">{fmtBRL(d.pi_valor)}</span>
                      ) : "—"}
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                      {d.pi_data ? new Date(d.pi_data).toLocaleString("pt-BR") : "—"}
                      {d.pi_conta && <span className="ml-1 text-[10px] opacity-60">({d.pi_conta})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estado vazio antes de buscar */}
      {!resultado && !buscando && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Selecione um período acima e clique em <strong>Buscar transações</strong> para começar.
        </div>
      )}
    </section>
  );
}
