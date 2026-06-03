import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  bulkImportDebitos,
  listarConsultas,
  listarBoletosGerados,
  emitirBoleto,
  getDashboardStats,
} from "@/lib/debitos.functions";
import {
  listarStripeAccounts,
  adicionarStripeAccount,
  toggleStripeAccount,
  removerStripeAccount,
} from "@/lib/stripe.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type TabId = "dashboard" | "import" | "consultas" | "stripe" | "boletos";

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
  ativo: boolean;
  boletos_na_janela: number;
  janela_iniciada_em: string | null;
  ultimo_uso_em: string | null;
  total_boletos: number;
  created_at: string;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "import", label: "Importar débitos" },
  { id: "consultas", label: "Consultas" },
  { id: "stripe", label: "Contas Stripe" },
  { id: "boletos", label: "Boletos emitidos" },
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
        {tab === "consultas" && <ConsultasSection />}
        {tab === "stripe" && <StripeSection />}
        {tab === "boletos" && <BoletosSection />}
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
function ImportSection() {
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

  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold text-foreground">
        Importar débitos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cole as linhas no formato abaixo. Registros existentes serão atualizados.
      </p>

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

      <button
        onClick={handleImport}
        disabled={loading || !raw.trim()}
        className="mt-4 h-11 rounded-lg bg-crm-green px-6 font-semibold text-primary-foreground transition hover:bg-crm-green-dark disabled:opacity-60"
      >
        {loading ? "Importando…" : "Importar / atualizar"}
      </button>

      {result && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">
            {result.inserted} registro(s) importado(s).
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {result.errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  <span className="font-mono">linha {e.line}</span> — {e.reason}
                </li>
              ))}
            </ul>
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
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await list();
    setItems((r.accounts ?? []) as StripeAccount[]);
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

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

          <div className="flex justify-end">
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
              return (
                <li key={s.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          s.ativo ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {s.nome}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {s.ativo ? "Ativa" : "Pendente"}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      API: {tokenMasked}
                      {bearerMasked && (
                        <span className="ml-2 text-xs text-crm-green-dark">
                          Bearer: {bearerMasked}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Total emitido: <strong>{s.total_boletos}</strong> · Janela atual:{" "}
                      {s.boletos_na_janela}/10 · Último uso: {fmtDate(s.ultimo_uso_em)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ----------------- BOLETOS -----------------
function BoletosSection() {
  const fn = useServerFn(listarBoletosGerados);
  const stripeFn = useServerFn(listarStripeAccounts);
  const [items, setItems] = useState<Boleto[]>([]);
  const [accounts, setAccounts] = useState<StripeAccount[]>([]);
  const [filter, setFilter] = useState<"all" | "copied" | "uncopied">("all");

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([fn(), stripeFn()]);
    setItems((b.boletos ?? []) as Boleto[]);
    setAccounts((s.accounts ?? []) as StripeAccount[]);
  }, [fn, stripeFn]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const nameOf = (id: string | null) =>
    id ? accounts.find((a) => a.id === id)?.nome ?? "—" : "sem stripe";

  const filtered = items.filter((b) => {
    if (filter === "copied") return b.copiado;
    if (filter === "uncopied") return !b.copiado;
    return true;
  });

  const totalCopiados = items.filter((b) => b.copiado).length;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            Boletos emitidos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} boleto(s) · {totalCopiados} código(s) copiado(s).
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-xs">
          {(["all", "copied", "uncopied"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                filter === f
                  ? "bg-crm-green text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {f === "all" ? "Todos" : f === "copied" ? "Copiados" : "Não copiados"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum boleto.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          b.copiado ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      <span className="truncate">{b.nome}</span>
                      {b.vezes_copiado > 1 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          ×{b.vezes_copiado}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      CRM {b.crm} · CPF {b.cpf} · {fmtBRL(Number(b.valor))} ·{" "}
                      Stripe: {nameOf(b.stripe_account_id)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <div>Emitido: {fmtDate(b.gerado_em)}</div>
                    <div>
                      {b.copiado
                        ? `Copiado: ${fmtDate(b.copiado_em)}`
                        : "Ainda não copiou"}
                    </div>
                    <div className="font-mono">{b.ip ?? "—"}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// Re-export to silence unused-import warnings if needed
void emitirBoleto;
