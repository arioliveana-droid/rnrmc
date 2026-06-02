import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Check,
  Download,
  FileText,
  Mail,
  QrCode,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Wallet,
} from "lucide-react";

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

function maskCpfDisplay(cpf: string) {
  const d = cpf.replace(/\D/g, "").padStart(11, "0");
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function DebitoPortal({
  debito,
  onLogout,
}: {
  debito: Debito;
  onLogout: () => void;
}) {
  const [metodo, setMetodo] = useState<"pix" | "boleto" | null>(null);

  const valorPix = debito.valor * 0.95;

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
                  {debito.nome.split(" ")[0]} {debito.nome.split(" ").slice(-1)[0]}
                </div>
                <div className="text-[10px] text-muted-foreground">CRM {debito.crm}/MG</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        {/* Hero greeting institucional */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-8">
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end md:gap-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-crm-green-dark md:text-[11px] md:tracking-[0.2em]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Acesso autenticado · Anuidade 2026
              </div>
              <h1 className="mt-4 font-serif text-2xl font-semibold leading-tight text-foreground md:mt-5 md:text-4xl">
                Olá, Dr<span className="text-muted-foreground">(a).</span>{" "}
                <span className="text-crm-green-dark">
                  {debito.nome.split(" ")[0].toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                </span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Seu registro foi localizado na base oficial do CRM-MG. Neste
                portal você acompanha sua situação financeira, emite documentos
                e quita a anuidade do exercício corrente.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-crm-green-soft px-2.5 py-1 text-[11px] font-semibold text-crm-green-dark ring-1 ring-inset ring-crm-green/30">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Inscrição ativa
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                  <Receipt className="h-3.5 w-3.5" />
                  Débito em aberto
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Dados verificados
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <div className="rounded-xl border border-border bg-background p-3 md:p-4">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground md:text-[10px] md:tracking-widest">
                  Total
                </div>
                <div className="mt-1.5 font-serif text-base font-semibold text-foreground md:mt-2 md:text-xl">
                  {fmtBRL(debito.valor)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 md:p-4">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground md:text-[10px] md:tracking-widest">
                  Inscrição
                </div>
                <div className="mt-1.5 font-serif text-base font-semibold text-foreground md:mt-2 md:text-xl">
                  {debito.crm}<span className="text-xs text-muted-foreground md:text-sm">/MG</span>
                </div>
              </div>
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
                  Valor da anuidade 2026
                </div>
                <div className="mt-1 font-serif text-3xl font-semibold text-foreground md:text-5xl">
                  {fmtBRL(debito.valor)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Consulte as opções de pagamento abaixo.
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Código do débito</dt>
                    <dd className="font-medium text-foreground">{debito.debito_codigo}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd className="font-medium text-crm-green-dark">{debito.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Inscrição</dt>
                    <dd className="font-medium text-foreground">CRM {debito.crm}/MG</dd>
                  </div>
                </dl>

                {/* Dois botões: Pix (-5%) e Boleto */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setMetodo("pix")}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition ${
                      metodo === "pix"
                        ? "border-crm-green bg-crm-green-soft"
                        : "border-border bg-background hover:border-crm-green hover:bg-crm-green-soft/60"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-crm-green-dark">
                      <QrCode className="h-4 w-4" /> Pagar com Pix
                      <span className="rounded-full bg-crm-green px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        -5%
                      </span>
                    </span>
                    <span className="font-serif text-xl font-semibold text-foreground">
                      {fmtBRL(valorPix)}
                    </span>
                  </button>

                  <button
                    onClick={() => setMetodo("boleto")}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition ${
                      metodo === "boleto"
                        ? "border-crm-green bg-crm-green-soft"
                        : "border-border bg-background hover:border-crm-green hover:bg-crm-green-soft/60"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileText className="h-4 w-4 text-crm-green" /> Emitir boleto
                    </span>
                    <span className="font-serif text-xl font-semibold text-foreground">
                      {fmtBRL(debito.valor)}
                    </span>
                  </button>
                </div>

                {/* Conteúdo do método escolhido */}
                {metodo === "pix" && (
                  <div className="mt-6 rounded-2xl border border-border bg-background p-4 md:p-5">
                    <h3 className="font-serif text-xl font-semibold text-foreground md:text-2xl">
                      Pagamento via Pix
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                      Valor com desconto de 5%: {fmtBRL(valorPix)}.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-crm-green px-4 text-sm font-semibold text-primary-foreground transition hover:bg-crm-green-dark sm:flex-none">
                        <QrCode className="h-4 w-4" /> Gerar código Pix
                      </button>
                    </div>
                  </div>
                )}

                {metodo === "boleto" && (
                  <div className="mt-6 rounded-2xl border border-border bg-background p-4 md:p-5">
                    <h3 className="font-serif text-xl font-semibold text-foreground md:text-2xl">
                      Boleto bancário
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                      Valor: {fmtBRL(debito.valor)}.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-crm-green px-4 text-sm font-semibold text-primary-foreground hover:bg-crm-green-dark sm:flex-none">
                        <Download className="h-4 w-4" /> Gerar boleto
                      </button>
                      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-secondary">
                        <Mail className="h-4 w-4" /> Enviar por e-mail
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>


          </div>

        </section>

      </main>
    </div>
  );
}
