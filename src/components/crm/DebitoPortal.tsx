import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Building2,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  Landmark,
  LifeBuoy,
  Lock,
  Mail,
  MapPin,
  QrCode,
  Receipt,
  Shield,
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

function FakeQrCode() {
  // 21x21 deterministic pattern that looks like a QR
  const cells = useMemo(() => {
    const arr: boolean[] = [];
    let seed = 7;
    for (let i = 0; i < 21 * 21; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      arr.push(seed / 233280 > 0.52);
    }
    // finder patterns corners
    const setFinder = (r: number, c: number) => {
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 7; j++) {
          const on =
            i === 0 ||
            i === 6 ||
            j === 0 ||
            j === 6 ||
            (i >= 2 && i <= 4 && j >= 2 && j <= 4);
          arr[(r + i) * 21 + (c + j)] = on;
        }
    };
    setFinder(0, 0);
    setFinder(0, 14);
    setFinder(14, 0);
    return arr;
  }, []);

  return (
    <svg viewBox="0 0 21 21" className="h-full w-full" aria-hidden>
      <rect width="21" height="21" fill="white" />
      {cells.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={i % 21}
            y={Math.floor(i / 21)}
            width="1"
            height="1"
            fill="currentColor"
          />
        ) : null,
      )}
    </svg>
  );
}

export function DebitoPortal({
  debito,
  onLogout,
}: {
  debito: Debito;
  onLogout: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"pix" | "boleto" | "cartao">("pix");

  const parcela = debito.valor / 12;

  const pixCode =
    "00020126580014BR.GOV.BCB.PIX0136anuidade-" +
    debito.crm +
    "-2026@crmmg.org.br5204000053039865802BR5915CRM MINAS GERAIS6009BELO HORIZ62070503***6304A1B2";

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

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
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-crm-green-dark">
                <ShieldCheck className="h-3.5 w-3.5" />
                Acesso autenticado · Anuidade 2026
              </div>
              <h1 className="mt-5 font-serif text-3xl font-semibold leading-tight text-foreground md:text-4xl">
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

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-crm-green-soft px-3 py-1 text-xs font-semibold text-crm-green-dark ring-1 ring-inset ring-crm-green/30">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Inscrição ativa
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                  <Receipt className="h-3.5 w-3.5" />
                  1 débito em aberto
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Dados verificados
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Total em aberto
                </div>
                <div className="mt-2 font-serif text-xl font-semibold text-foreground">
                  {fmtBRL(debito.valor)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Vencimento
                </div>
                <div className="mt-2 font-serif text-xl font-semibold text-foreground">
                  31/03
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Inscrição
                </div>
                <div className="mt-2 font-serif text-xl font-semibold text-foreground">
                  {debito.crm}<span className="text-sm text-muted-foreground">/MG</span>
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
              <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wallet className="h-4 w-4 text-crm-green" />
                  Débito · {debito.descricao}
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Em aberto
                </span>
              </div>
              <div className="grid gap-6 p-5 md:grid-cols-[1.1fr_1fr] md:p-6">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Valor original
                  </div>
                  <div className="mt-1 font-serif text-4xl font-semibold text-foreground md:text-5xl">
                    {fmtBRL(debito.valor)}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Valor único da anuidade 2026. Vencimento em 31/03/2026.
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Código do débito</dt>
                      <dd className="font-medium text-foreground">{debito.debito_codigo}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Exercício</dt>
                      <dd className="font-medium text-foreground">2026</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Status</dt>
                      <dd className="font-medium text-crm-green-dark">{debito.status}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Vencimento</dt>
                      <dd className="font-medium text-foreground">31/03/2026</dd>
                    </div>
                  </dl>
                </div>

                {/* Parcelas resumo */}
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Opções de quitação
                  </div>
                  <ul className="mt-3 space-y-2.5 text-sm">
                    <li className="flex items-center justify-between gap-3 rounded-lg bg-crm-green-soft px-3 py-2">
                      <span className="flex items-center gap-2 font-medium text-crm-green-dark">
                        <Check className="h-4 w-4" /> À vista (Pix/Boleto)
                      </span>
                      <span className="font-semibold text-crm-green-dark">
                        {fmtBRL(debito.valor)}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-secondary/60">
                      <span className="text-foreground">3x sem juros</span>
                      <span className="font-medium text-foreground">
                        3× {fmtBRL(debito.valor / 3)}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-secondary/60">
                      <span className="text-foreground">6x sem juros</span>
                      <span className="font-medium text-foreground">
                        6× {fmtBRL(debito.valor / 6)}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-secondary/60">
                      <span className="text-foreground">12x no cartão</span>
                      <span className="font-medium text-foreground">
                        12× {fmtBRL(parcela)}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </article>

            {/* Pagamento tabs */}
            <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap border-b border-border bg-secondary/30">
                {(
                  [
                    { id: "pix", label: "Pix", icon: QrCode },
                    { id: "boleto", label: "Boleto bancário", icon: FileText },
                    { id: "cartao", label: "Cartão de crédito", icon: CreditCard },
                  ] as const
                ).map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold transition ${
                        active
                          ? "text-crm-green-dark"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <t.icon className="h-4 w-4" />
                      {t.label}
                      {active && (
                        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-crm-green" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-5 md:p-6">
                {tab === "pix" && (
                  <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
                    <div className="mx-auto w-48 rounded-2xl border border-border bg-white p-3 text-crm-navy shadow-card md:mx-0">
                      <FakeQrCode />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-crm-green-soft px-3 py-1 text-xs font-semibold text-crm-green-dark">
                        <Sparkles className="h-3.5 w-3.5" /> Pix com desconto de 5%
                      </div>
                      <h3 className="mt-2 font-serif text-2xl font-semibold text-foreground">
                        Pague {fmtBRL(valorAVista)} via Pix
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Compensação imediata. Após o pagamento, a baixa ocorre em
                        até 2 horas úteis.
                      </p>

                      <div className="mt-4 rounded-xl border border-border bg-background p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Pix copia e cola
                        </div>
                        <div className="mt-1 line-clamp-2 break-all font-mono text-xs text-foreground/80">
                          {pixCode}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={copyPix}
                          className="inline-flex h-11 items-center gap-2 rounded-lg bg-crm-green px-4 text-sm font-semibold text-primary-foreground transition hover:bg-crm-green-dark"
                        >
                          {copied ? (
                            <>
                              <Check className="h-4 w-4" /> Código copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" /> Copiar código Pix
                            </>
                          )}
                        </button>
                        <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-secondary">
                          <Download className="h-4 w-4" /> Baixar QR code
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "boleto" && (
                  <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <h3 className="font-serif text-2xl font-semibold text-foreground">
                        Boleto bancário registrado
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Aceito em qualquer banco, lotérica ou internet banking.
                        Compensação em até 3 dias úteis.
                      </p>
                      <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/30 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Linha digitável
                        </div>
                        <div className="mt-1 font-mono text-sm text-foreground/85">
                          23793.38128 60082.{debito.crm.padStart(6, "0")}1 12345.678901 1 9876{Math.floor(debito.valor * 100)}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Valor</div>
                          <div className="font-semibold text-foreground">
                            {fmtBRL(debito.valor)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Vencimento</div>
                          <div className="font-semibold text-foreground">31/03/2026</div>
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-crm-green px-4 text-sm font-semibold text-primary-foreground hover:bg-crm-green-dark">
                          <Download className="h-4 w-4" /> Baixar boleto (PDF)
                        </button>
                        <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-secondary">
                          <Mail className="h-4 w-4" /> Enviar por e-mail
                        </button>
                      </div>
                    </div>
                    <div className="hidden h-44 w-32 rounded-xl border border-border bg-gradient-to-b from-white to-secondary md:block">
                      <div className="flex h-full flex-col items-center justify-end gap-1 p-3">
                        {Array.from({ length: 22 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-1 w-full bg-crm-navy"
                            style={{ opacity: (i % 3) * 0.3 + 0.2 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {tab === "cartao" && (
                  <div>
                    <h3 className="font-serif text-2xl font-semibold text-foreground">
                      Parcele em até 12× sem juros
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Visa, Mastercard, Elo e Hipercard. Cobrança recorrente
                      mensal pela operadora.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {[1, 3, 6, 12].map((n) => (
                        <button
                          key={n}
                          className={`rounded-xl border p-4 text-left transition hover:border-crm-green hover:bg-crm-green-soft ${
                            n === 12 ? "border-crm-green bg-crm-green-soft" : "border-border bg-background"
                          }`}
                        >
                          <div className="text-xs text-muted-foreground">{n}×</div>
                          <div className="font-serif text-xl font-semibold text-foreground">
                            {fmtBRL(debito.valor / n)}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Total {fmtBRL(debito.valor)}
                          </div>
                        </button>
                      ))}
                    </div>
                    <button className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-crm-green px-5 text-sm font-semibold text-primary-foreground hover:bg-crm-green-dark">
                      <CreditCard className="h-4 w-4" /> Pagar com cartão
                    </button>
                  </div>
                )}
              </div>
            </article>

            {/* Histórico */}
            <article className="rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  Histórico de anuidades
                </h3>
                <button className="text-xs font-semibold text-crm-green-dark hover:underline">
                  Ver tudo
                </button>
              </div>
              <ul className="mt-4 divide-y divide-border text-sm">
                {[
                  { ano: 2026, valor: debito.valor, status: "Em aberto", tone: "amber" },
                  { ano: 2025, valor: 837.25, status: "Pago em 18/02/2025", tone: "green" },
                  { ano: 2024, valor: 802.18, status: "Pago em 22/01/2024", tone: "green" },
                  { ano: 2023, valor: 781.0, status: "Pago em 05/02/2023", tone: "green" },
                ].map((row) => (
                  <li
                    key={row.ano}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-xs font-bold text-foreground">
                        {row.ano}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          Anuidade {row.ano}
                        </div>
                        <div className="text-xs text-muted-foreground">{row.status}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-foreground">{fmtBRL(row.valor)}</div>
                      {row.tone === "green" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-crm-green-soft px-2 py-0.5 text-[11px] font-semibold text-crm-green-dark">
                          <Check className="h-3 w-3" /> Quitado
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Em aberto
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          {/* RIGHT — sidebar */}
          <aside className="space-y-6">
            {/* Profile card */}
            <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="relative h-20 bg-gradient-to-r from-crm-green to-crm-green-dark">
                <div className="absolute -bottom-8 left-5 grid h-16 w-16 place-items-center rounded-2xl border-4 border-card bg-crm-navy text-lg font-bold text-white">
                  {initials(debito.nome)}
                </div>
              </div>
              <div className="px-5 pb-5 pt-10">
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  {debito.nome}
                </h3>
                <p className="text-xs text-muted-foreground">
                  CPF {maskCpfDisplay(debito.cpf)}
                </p>

                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Stethoscope className="mt-0.5 h-4 w-4 flex-none text-crm-green" />
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Inscrição
                      </dt>
                      <dd className="font-medium text-foreground">
                        CRM {debito.crm}/MG · Principal
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <GraduationCap className="mt-0.5 h-4 w-4 flex-none text-crm-green" />
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Especialidade registrada
                      </dt>
                      <dd className="font-medium text-foreground">Clínica Médica</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Building2 className="mt-0.5 h-4 w-4 flex-none text-crm-green" />
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Local de atuação
                      </dt>
                      <dd className="font-medium text-foreground">Belo Horizonte · MG</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Calendar className="mt-0.5 h-4 w-4 flex-none text-crm-green" />
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Última atualização
                      </dt>
                      <dd className="font-medium text-foreground">02/06/2026</dd>
                    </div>
                  </div>
                </dl>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-secondary">
                    <Download className="h-3.5 w-3.5" /> Carteira
                  </button>
                  <button className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-secondary">
                    <FileText className="h-3.5 w-3.5" /> Certidão
                  </button>
                </div>
              </div>
            </article>

            {/* Atalhos */}
            <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h3 className="font-serif text-lg font-semibold text-foreground">
                Serviços do médico
              </h3>
              <ul className="mt-4 space-y-1.5 text-sm">
                {[
                  { icon: Receipt, label: "Comprovantes de pagamento" },
                  { icon: Landmark, label: "Negociação de débitos antigos" },
                  { icon: MapPin, label: "Alterar endereço cadastral" },
                  { icon: Shield, label: "2ª via da carteira digital" },
                  { icon: LifeBuoy, label: "Atendimento ao médico" },
                ].map((it) => (
                  <li key={it.label}>
                    <button className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-foreground transition hover:bg-secondary">
                      <span className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-crm-green-soft text-crm-green-dark">
                          <it.icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-medium">{it.label}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-crm-green-dark" />
                    </button>
                  </li>
                ))}
              </ul>
            </article>

            {/* Segurança */}
            <article className="rounded-2xl border border-crm-green/25 bg-crm-green-soft p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-crm-green-dark">
                <Lock className="h-4 w-4" />
                Conexão protegida
              </div>
              <p className="mt-2 text-xs leading-relaxed text-crm-green-dark/80">
                Sessão criptografada (TLS 1.3). Seus dados são tratados conforme
                a LGPD e usados apenas para localizar débitos vinculados ao seu
                CRM. Você pode encerrar a sessão a qualquer momento.
              </p>
              <button
                onClick={onLogout}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-crm-green-dark hover:underline"
              >
                Encerrar sessão <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </article>
          </aside>
        </section>

        {/* Footer institucional */}
        <footer className="mt-10 border-t border-border">
          <div className="grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crm-green-dark">
                Institucional
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>Sobre o CRM-MG</li>
                <li>Conselheiros e diretoria</li>
                <li>Normas e ética médica</li>
                <li>Transparência</li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crm-green-dark">
                Atendimento
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>Fale com o CRM-MG</li>
                <li>Ouvidoria</li>
                <li>Canal de denúncias</li>
                <li>Perguntas frequentes</li>
              </ul>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crm-green-dark">
                Endereço
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Conselho Regional de Medicina de Minas Gerais
                <br />
                Rua dos Timbiras, 1200 — Funcionários
                <br />
                Belo Horizonte / MG
              </p>
            </div>
          </div>
          <div className="border-t border-border py-4 text-center text-[11px] text-muted-foreground">
            CRM-MG · Conselho Regional de Medicina de Minas Gerais · Portal seguro
          </div>
        </footer>
      </main>
    </div>
  );
}
