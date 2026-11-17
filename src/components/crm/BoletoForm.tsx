import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { lookupDebito } from "@/lib/debitos.functions";
import { DebitoPortal } from "./DebitoPortal";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCrm(v: string) {
  return v.replace(/\D/g, "").slice(0, 7);
}

function isValidCpf(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
}

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

export function BoletoForm() {
  const [crm, setCrm] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debito, setDebito] = useState<Debito | null>(null);
  const [jaFoiPago, setJaFoiPago] = useState(false);
  const lookup = useServerFn(lookupDebito);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDebito(null);
    setJaFoiPago(false);

    if (crm.length < 4) {
      setError("Informe um número de CRM válido.");
      return;
    }
    if (!isValidCpf(cpf)) {
      setError("CPF inválido. Verifique os dígitos.");
      return;
    }

    setLoading(true);
    try {
      const res = await lookup({ data: { cpf, crm } });
      if (!res.found) {
        setError(res.error ?? "Registro não encontrado.");
      } else if (res.jaFoiPago) {
        setJaFoiPago(true);
      } else {
        setDebito(res.debito as Debito);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  void formatCurrency;

  if (jaFoiPago || debito) {
    return <DebitoPortal debito={debito!} onLogout={() => { setDebito(null); setJaFoiPago(false); setCrm(""); setCpf(""); }} jaFoiPago={jaFoiPago} />;
  }

  return (
    <section id="emitir" className="bg-background py-12 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[1.05fr_1fr] md:gap-14 md:px-6">
        <div className="order-2 md:order-1">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-crm-green">
            Anuidade 2026
          </span>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-foreground md:text-5xl">
            Emita o boleto da sua anuidade
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            Informe seu CRM e CPF para gerar o boleto da anuidade 2026 do CRM-RN.
          </p>

        </div>

        <form
          onSubmit={handleSubmit}
          className="order-1 rounded-3xl border border-border bg-card p-6 shadow-elevated md:order-2 md:p-8"
        >
          <h2 className="font-serif text-xl font-semibold text-foreground md:text-2xl">
            Consultar débitos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe seu CRM e CPF para localizar sua anuidade.
          </p>


          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="crm" className="block text-sm font-medium text-foreground">
                Número do CRM
              </label>
              <input
                id="crm"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ex.: 123456"
                value={crm}
                onChange={(e) => setCrm(maskCrm(e.target.value))}
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none transition focus:border-crm-green focus:ring-2 focus:ring-crm-green/20"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Apenas dígitos, sem UF.
              </p>
            </div>

            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-foreground">
                CPF do médico(a)
              </label>
              <input
                id="cpf"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base text-foreground outline-none transition focus:border-crm-green focus:ring-2 focus:ring-crm-green/20"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-crm-red/30 bg-crm-green/5 px-3 py-2 text-sm text-crm-green-dark"
              >
                {error}
              </div>
            )}


            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-crm-green text-base font-semibold text-primary-foreground shadow-elevated transition hover:bg-crm-green-dark disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Consultando…
                </>
              ) : (
              "Consultar débitos"
              )}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Conexão segura · dados protegidos pela LGPD
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
