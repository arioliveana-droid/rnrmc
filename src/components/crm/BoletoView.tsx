import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Calendar, Building2, Barcode } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { registrarCopiaBoleto } from "@/lib/debitos.functions";

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

function gerarLinhaDigitavel(seed: string, valor: number) {
  // Pseudo "linha digitável" determinística (47 dígitos) baseada em CPF/CRM
  const base = seed.replace(/\D/g, "").padEnd(11, "0");
  const cents = Math.round(valor * 100)
    .toString()
    .padStart(10, "0");
  const filler = (base + cents + "8473625190")
    .repeat(5)
    .replace(/\D/g, "")
    .slice(0, 47);
  return `${filler.slice(0, 5)}.${filler.slice(5, 10)} ${filler.slice(10, 15)}.${filler.slice(15, 21)} ${filler.slice(21, 26)}.${filler.slice(26, 32)} ${filler.slice(32, 33)} ${filler.slice(33, 47)}`;
}

function vencimento() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("pt-BR");
}

export function BoletoView({
  debito,
  onBack,
}: {
  debito: Debito;
  onBack: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const registrar = useServerFn(registrarCopiaBoleto);

  const linha = useMemo(
    () => gerarLinhaDigitavel(debito.cpf + debito.crm, debito.valor),
    [debito],
  );
  const venc = useMemo(() => vencimento(), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linha.replace(/[^\d]/g, ""));
    } catch {
      /* ignore */
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
    try {
      await registrar({
        data: {
          nome: debito.nome,
          cpf: debito.cpf,
          crm: debito.crm,
          debito_codigo: debito.debito_codigo,
          valor: Number(debito.valor),
          linha_digitavel: linha,
        },
      });
    } catch {
      /* ignore */
    }
  };

  // Barcode visual (faixas pseudoaleatórias mas estáveis)
  const bars = useMemo(() => {
    const seed = linha.replace(/\D/g, "");
    return Array.from({ length: 70 }).map((_, i) => {
      const n = parseInt(seed[i % seed.length] ?? "0", 10);
      return n % 2 === 0 ? "w-[2px]" : "w-[4px]";
    });
  }, [linha]);

  return (
    <div className="min-h-screen bg-[oklch(0.985_0.008_158)]">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <button
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-crm-green-dark">
            Boleto · Anuidade 2026
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {/* Cabeçalho do boleto */}
          <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-crm-green text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Beneficiário
                </div>
                <div className="text-sm font-semibold text-foreground">
                  CRM-MG
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Banco
              </div>
              <div className="text-sm font-bold text-foreground">001-9</div>
            </div>
          </div>

          {/* Corpo */}
          <div className="p-5 md:p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Pagador
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {debito.nome}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  CRM {debito.crm}/MG
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Vencimento
                </div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Calendar className="h-4 w-4 text-crm-green" />
                  {venc}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-secondary/50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Descrição
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {debito.descricao}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Valor
                  </div>
                  <div className="font-serif text-3xl font-semibold text-foreground">
                    {fmtBRL(Number(debito.valor))}
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Em aberto
                </span>
              </div>
            </div>

            {/* Código de barras visual */}
            <div className="mt-6">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Barcode className="h-3.5 w-3.5" />
                Código de barras
              </div>
              <div className="mt-2 flex h-20 items-center gap-[2px] overflow-hidden rounded-lg border border-border bg-white px-3">
                {bars.map((w, i) => (
                  <span
                    key={i}
                    className={`${w} h-full bg-foreground`}
                  />
                ))}
              </div>
              <div className="mt-3 break-all rounded-lg border border-dashed border-border bg-background px-3 py-2 text-center font-mono text-xs text-foreground md:text-sm">
                {linha}
              </div>
            </div>

            {/* Botão copiar */}
            <button
              onClick={handleCopy}
              className={`mt-5 inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl px-6 text-base font-bold shadow-lg transition active:translate-y-0 ${
                copiado
                  ? "bg-emerald-600 text-white shadow-emerald-600/30"
                  : "bg-crm-green text-primary-foreground shadow-crm-green/30 hover:translate-y-[-2px] hover:bg-crm-green-dark"
              }`}
            >
              {copiado ? (
                <>
                  <Check className="h-6 w-6" />
                  Código copiado!
                </>
              ) : (
                <>
                  <Copy className="h-6 w-6" />
                  Copiar código de barras
                </>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Cole no app do seu banco em “Pagar com código de barras”.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
