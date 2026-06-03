import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Printer } from "lucide-react";
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

export type EmissaoBoleto = {
  id: string;
  linha_digitavel: string;
  vencimento: string;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCPF = (cpf: string) => {
  const d = cpf.replace(/\D/g, "").padStart(11, "0");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

// Campo Field reusable
function Field({
  label,
  value,
  className = "",
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={`border-r border-b border-neutral-300 px-2.5 py-1.5 ${className}`}>
      <div className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-0.5 text-[13px] font-medium text-neutral-900 ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

export function BoletoView({
  debito,
  emissao,
  onBack,
}: {
  debito: Debito;
  emissao: EmissaoBoleto;
  onBack: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const registrar = useServerFn(registrarCopiaBoleto);

  const linha = emissao.linha_digitavel;
  const venc = useMemo(
    () => new Date(emissao.vencimento).toLocaleDateString("pt-BR"),
    [emissao.vencimento],
  );
  const hoje = new Date().toLocaleDateString("pt-BR");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linha.replace(/[^\d]/g, ""));
    } catch {
      /* ignore */
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
    try {
      await registrar({ data: { id: emissao.id } });
    } catch {
      /* ignore */
    }
  };

  // Código de barras (visual fake derivado da linha digitável)
  const bars = useMemo(() => {
    const seed = linha.replace(/\D/g, "");
    return Array.from({ length: 95 }).map((_, i) => {
      const n = parseInt(seed[i % seed.length] ?? "0", 10);
      const wide = n % 3 === 0;
      const filled = n % 2 === 0;
      return { wide, filled };
    });
  }, [linha]);

  const nossoNumero = useMemo(() => {
    const d = linha.replace(/\D/g, "");
    return d.slice(4, 15) || "00000000000";
  }, [linha]);

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.005_158)] print:bg-white">
      {/* Header com ações (some na impressão) */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
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
          <button
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 print:px-0 print:py-0">
        {/* Aviso instituição */}
        <div className="mb-4 rounded-xl border border-crm-green/20 bg-white p-4 shadow-card print:hidden">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-crm-green text-primary-foreground font-bold text-sm">
              CRM
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                Conselho Regional de Medicina do Estado de Minas Gerais
              </div>
              <div className="text-xs text-muted-foreground">
                CNPJ 17.218.964/0001-30 · Rua dos Timbiras, 1.200 — Funcionários · Belo Horizonte/MG · CEP 30.140-064
              </div>
            </div>
          </div>
        </div>

        {/* Ficha do boleto */}
        <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-card print:rounded-none print:border-black print:shadow-none">
          {/* Faixa banco */}
          <div className="flex items-stretch border-b-2 border-neutral-900">
            <div className="flex items-center gap-2 border-r-2 border-neutral-900 px-4 py-2">
              <div className="text-2xl font-extrabold tracking-tight text-neutral-900">
                Banco do Brasil
              </div>
            </div>
            <div className="flex items-center justify-center border-r-2 border-neutral-900 px-4 py-2 text-2xl font-extrabold text-neutral-900">
              001-9
            </div>
            <div className="flex flex-1 items-center justify-end px-4 py-2 font-mono text-sm font-semibold tracking-wider text-neutral-900 md:text-base">
              {linha}
            </div>
          </div>

          {/* Recibo do pagador (linha 1) */}
          <div className="grid grid-cols-12 border-b border-neutral-300">
            <Field
              className="col-span-8"
              label="Local de pagamento"
              value="Pagável em qualquer banco, lotérica ou app bancário até o vencimento."
            />
            <Field className="col-span-4 border-r-0" label="Vencimento" value={venc} />
          </div>

          {/* Beneficiário */}
          <div className="grid grid-cols-12 border-b border-neutral-300">
            <Field
              className="col-span-8"
              label="Beneficiário"
              value="CRM-MG · Conselho Regional de Medicina do Estado de Minas Gerais"
            />
            <Field
              className="col-span-4 border-r-0"
              label="Agência / Código do beneficiário"
              value="1615-2 / 17218964-0"
              mono
            />
          </div>

          {/* Linha de dados técnicos */}
          <div className="grid grid-cols-12 border-b border-neutral-300">
            <Field className="col-span-3" label="Data do documento" value={hoje} />
            <Field className="col-span-3" label="Nº do documento" value={debito.debito_codigo} mono />
            <Field className="col-span-2" label="Espécie doc." value="DM" />
            <Field className="col-span-1" label="Aceite" value="N" />
            <Field className="col-span-3 border-r-0" label="Data processamento" value={hoje} />
          </div>

          <div className="grid grid-cols-12 border-b border-neutral-300">
            <Field className="col-span-3" label="Uso do banco" value="—" />
            <Field className="col-span-3" label="Carteira" value="17" />
            <Field className="col-span-2" label="Espécie" value="R$" />
            <Field className="col-span-1" label="Quantidade" value="1" />
            <Field className="col-span-3 border-r-0" label="Nosso número" value={nossoNumero} mono />
          </div>

          {/* Instruções + Valor */}
          <div className="grid grid-cols-12">
            <div className="col-span-8 border-r border-b border-neutral-300 px-2.5 py-2">
              <div className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">
                Instruções (texto de responsabilidade do beneficiário)
              </div>
              <ul className="mt-1.5 space-y-1 text-[12px] leading-snug text-neutral-800">
                <li>• Referente à <strong>{debito.descricao}</strong>.</li>
                <li>• Não receber após o vencimento.</li>
                <li>• Em caso de dúvida, contatar a Tesouraria do CRM-MG.</li>
                <li>• Pagamento via Pix copia-e-cola: desconto de 5% até o vencimento.</li>
              </ul>
            </div>
            <div className="col-span-4 border-b border-neutral-300">
              <Field label="(=) Valor do documento" value={fmtBRL(Number(debito.valor))} className="border-r-0" />
              <Field label="(−) Descontos / Abatimentos" value="—" className="border-r-0" />
              <Field label="(+) Juros / Multa" value="—" className="border-r-0" />
              <div className="border-b-0 border-r-0 border-neutral-300 bg-neutral-50 px-2.5 py-2">
                <div className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">
                  (=) Valor cobrado
                </div>
                <div className="mt-0.5 text-lg font-bold text-neutral-900">
                  {fmtBRL(Number(debito.valor))}
                </div>
              </div>
            </div>
          </div>

          {/* Pagador */}
          <div className="border-b border-neutral-300 px-2.5 py-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">
              Pagador
            </div>
            <div className="mt-0.5 text-[13px] font-semibold text-neutral-900">
              {debito.nome}
            </div>
            <div className="text-[12px] text-neutral-700">
              CPF {fmtCPF(debito.cpf)} · CRM {debito.crm}/MG
            </div>
          </div>

          {/* Código de barras */}
          <div className="px-4 py-5">
            <div className="flex h-[68px] items-stretch gap-[1px]">
              {bars.map((b, i) => (
                <span
                  key={i}
                  className={`${b.wide ? "w-[3px]" : "w-[1.5px]"} ${b.filled ? "bg-neutral-900" : "bg-transparent"} h-full`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bloco de ação - some na impressão */}
        <div className="mt-5 rounded-xl border border-border bg-white p-5 shadow-card print:hidden">
          <button
            onClick={handleCopy}
            className={`inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl px-6 text-base font-bold shadow-lg transition active:translate-y-0 ${
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
                Copiar linha digitável
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Cole no app do seu banco em "Pagar com código de barras" ou pague pelo Pix copia-e-cola com 5% de desconto.
          </p>
        </div>
      </main>
    </div>
  );
}
