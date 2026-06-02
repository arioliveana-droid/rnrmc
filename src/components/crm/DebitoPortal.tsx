import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Check,
  Download,
  FileText,
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

export function DebitoPortal({
  debito,
  onLogout,
}: {
  debito: Debito;
  onLogout: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [metodo, setMetodo] = useState<"pix" | "boleto" | null>(null);

  const valorPix = debito.valor * 0.95;

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
                  1 débito em aberto
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Dados verificados
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 md:gap-3">
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
                  Vencimento
                </div>
                <div className="mt-1.5 font-serif text-base font-semibold text-foreground md:mt-2 md:text-xl">
                  31/03
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
                  Vencimento em 31/03/2026.
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
                    <span className="text-[11px] text-muted-foreground">
                      Compensação imediata
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
                    <span className="text-[11px] text-muted-foreground">
                      Pagável em qualquer banco
                    </span>
                  </button>
                </div>

                {/* Conteúdo do método escolhido */}
                {metodo === "pix" && (
                  <div className="mt-6 rounded-2xl border border-border bg-background p-4 md:p-5">
                    <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
                      <div className="mx-auto w-40 rounded-2xl border border-border bg-white p-3 text-crm-navy shadow-card md:mx-0 md:w-44">
                        <FakeQrCode />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-serif text-xl font-semibold text-foreground md:text-2xl">
                          Pague {fmtBRL(valorPix)} via Pix
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                          Desconto de 5% aplicado. Após o pagamento a baixa ocorre em até 2 horas úteis.
                        </p>
                        <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Pix copia e cola
                          </div>
                          <div className="mt-1 line-clamp-2 break-all font-mono text-[11px] text-foreground/80 md:text-xs">
                            {pixCode}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={copyPix}
                            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-crm-green px-4 text-sm font-semibold text-primary-foreground transition hover:bg-crm-green-dark sm:flex-none"
                          >
                            {copied ? (
                              <><Check className="h-4 w-4" /> Código copiado</>
                            ) : (
                              <><Copy className="h-4 w-4" /> Copiar Pix</>
                            )}
                          </button>
                          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-secondary">
                            <Download className="h-4 w-4" /> Baixar QR
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {metodo === "boleto" && (
                  <div className="mt-6 rounded-2xl border border-border bg-background p-4 md:p-5">
                    <h3 className="font-serif text-xl font-semibold text-foreground md:text-2xl">
                      Boleto bancário registrado
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                      Aceito em qualquer banco, lotérica ou internet banking. Compensação em até 3 dias úteis.
                    </p>
                    <div className="mt-3 rounded-xl border border-dashed border-border bg-secondary/30 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Linha digitável
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-foreground/85 md:text-sm">
                        23793.38128 60082.{debito.crm.padStart(6, "0")}1 12345.678901 1 9876{Math.floor(debito.valor * 100)}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Valor</div>
                        <div className="font-semibold text-foreground">{fmtBRL(debito.valor)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Vencimento</div>
                        <div className="font-semibold text-foreground">31/03/2026</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-crm-green px-4 text-sm font-semibold text-primary-foreground hover:bg-crm-green-dark sm:flex-none">
                        <Download className="h-4 w-4" /> Baixar boleto (PDF)
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
