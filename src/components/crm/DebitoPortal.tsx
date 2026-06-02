import { useState } from "react";
import {
  ArrowLeft,
  Bell,
  FileText,
  Wallet,
} from "lucide-react";
import { BoletoView } from "./BoletoView";

type Debito = {
  nome: string;
  cpf: string;
  crm: string;
  codigo: string | null;
  status: string;
  debito_codigo: string;
  descricao: string;
  valor: number;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function nomeFormatado(nome: string) {
  const min = new Set(["de", "da", "do", "das", "dos", "e"]);
  return nome
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && min.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

export function DebitoPortal({
  debito,
  onLogout,
}: {
  debito: Debito;
  onLogout: () => void;
}) {
  const [verBoleto, setVerBoleto] = useState(false);

  if (verBoleto) {
    return <BoletoView debito={debito} onBack={() => setVerBoleto(false)} />;
  }


  return (
    <div className="min-h-screen bg-[oklch(0.985_0.008_158)]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Sair
            </button>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="hidden sm:block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crm-green-dark">
                Portal do Médico
              </div>
              <div className="text-xs text-muted-foreground">
                CRM-MG · Conselho Regional de Medicina de Minas Gerais
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-2.5 py-1.5">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-crm-green text-xs font-bold text-primary-foreground">
                {initials(debito.nome)}
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-xs font-semibold leading-tight text-foreground">
                  {nomeFormatado(debito.nome)}
                </div>
                <div className="text-[10px] text-muted-foreground">CRM {debito.crm}/MG</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        {/* Hero greeting */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Anuidade 2026 · CRM-MG
              </p>
              <h1 className="mt-2 font-serif text-xl font-semibold leading-tight text-foreground md:text-3xl">
                Dr(a). {nomeFormatado(debito.nome)}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                CRM {debito.crm}/MG
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total em aberto
              </p>
              <p className="mt-1 font-serif text-2xl font-semibold text-foreground md:text-3xl">
                {fmtBRL(debito.valor)}
              </p>
            </div>
          </div>
        </section>


        {/* Main grid */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* LEFT — payment center */}
          <div className="space-y-6">
            {/* Débito card */}
            <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3 md:px-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wallet className="h-4 w-4 flex-none text-crm-green" />
                  <span className="truncate">Débito · {debito.descricao}</span>
                </div>
                <span className="flex-none rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 md:text-[11px]">
                  Em aberto
                </span>
              </div>
              <div className="p-5 md:p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Anuidade 2026
                </div>
                <div className="mt-1 font-serif text-3xl font-semibold text-foreground md:text-5xl">
                  {fmtBRL(debito.valor)}
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => setVerBoleto(true)}
                    className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-crm-green px-8 text-base font-bold text-primary-foreground shadow-lg shadow-crm-green/30 transition hover:translate-y-[-2px] hover:bg-crm-green-dark hover:shadow-xl hover:shadow-crm-green/40 active:translate-y-0 sm:w-auto"
                  >
                    <FileText className="h-6 w-6" /> Emitir boleto
                  </button>
                </div>
              </div>
            </article>


          </div>

        </section>

      </main>
    </div>
  );
}
