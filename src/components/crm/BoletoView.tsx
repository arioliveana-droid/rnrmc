import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Printer, FileText, ExternalLink, Calendar, Building2, User } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { registrarCopiaBoleto } from "@/lib/debitos.functions";
import { Barcode } from "./Barcode";

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
  hosted_voucher_url?: string | null;
  pdf_url?: string | null;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCPF = (cpf: string) => {
  const d = cpf.replace(/\D/g, "").padStart(11, "0");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

const BANCOS: Record<string, { nome: string; codigo: string }> = {
  "001": { nome: "Banco do Brasil", codigo: "001-9" },
  "033": { nome: "Santander", codigo: "033-7" },
  "104": { nome: "Caixa Econômica", codigo: "104-0" },
  "237": { nome: "Bradesco", codigo: "237-2" },
  "341": { nome: "Itaú Unibanco", codigo: "341-7" },
  "356": { nome: "Banco Real", codigo: "356-5" },
  "399": { nome: "HSBC", codigo: "399-9" },
  "422": { nome: "Banco Safra", codigo: "422-7" },
  "748": { nome: "Sicredi", codigo: "748-X" },
};
const BANCO_DEFAULT = BANCOS["341"];

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

  const dadosLinha = useMemo(() => {
    const d = linha.replace(/\D/g, "");
    const codBanco = d.slice(0, 3);
    const banco = BANCOS[codBanco] ?? BANCO_DEFAULT;
    const nossoNumero = d.slice(4, 18) || "00000000000000";
    const agencia = d.slice(20, 24) || "0000";
    const conta = d.slice(24, 30) || "000000";
    const carteira = d.slice(18, 20) || "17";
    return { codBanco, banco, nossoNumero, agencia, conta, carteira };
  }, [linha]);

  // 44-digit barcode value (boletos use Interleaved 2 of 5, 44 dígitos)
  const barcodeValue = useMemo(() => {
    return linha.replace(/\D/g, "").slice(0, 44).padEnd(44, "0");
  }, [linha]);

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

  return (
    <div className="min-h-screen bg-[oklch(0.97_0.005_158)] print:bg-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <button
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="truncate text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-crm-green-dark sm:text-[11px] sm:tracking-[0.2em]">
            Boleto · Anuidade 2026
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6 print:px-0 print:py-0">
        {/* ========= MOBILE VIEW ========= */}
        <div className="md:hidden print:hidden">
          {/* Hero card */}
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-crm-green-dark">
              <Building2 className="h-3.5 w-3.5" />
              CRM-MG
            </div>
            <div className="mt-1 text-xs leading-snug text-muted-foreground">
              Conselho Regional de Medicina do Estado de Minas Gerais
            </div>

            <div className="mt-5 flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Valor a pagar
                </div>
                <div className="mt-0.5 font-serif text-3xl font-bold text-foreground">
                  {fmtBRL(Number(debito.valor))}
                </div>
              </div>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-right">
                <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                  <Calendar className="h-3 w-3" /> Vence
                </div>
                <div className="mt-0.5 text-xs font-bold text-amber-900">{venc}</div>
              </div>
            </div>
          </div>

          {/* Linha digitável + copy */}
          <div className="mt-3 rounded-2xl border border-border bg-white p-4 shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Linha digitável
            </div>
            <div className="mt-2 break-all rounded-lg bg-neutral-50 px-3 py-2.5 font-mono text-[13px] font-semibold leading-snug text-neutral-900">
              {linha}
            </div>
            <button
              onClick={handleCopy}
              className={`mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-lg transition ${
                copiado
                  ? "bg-emerald-600 text-white shadow-emerald-600/30"
                  : "bg-crm-green text-primary-foreground shadow-crm-green/30 active:translate-y-0.5"
              }`}
            >
              {copiado ? (
                <>
                  <Check className="h-5 w-5" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" /> Copiar linha digitável
                </>
              )}
            </button>
          </div>

          {/* Código de barras */}
          <div className="mt-3 rounded-2xl border border-border bg-white p-4 shadow-card">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Código de barras
            </div>
            <div className="mt-2 overflow-x-auto rounded-lg bg-white p-2">
              <Barcode value={barcodeValue} height={70} className="mx-auto block h-[70px] w-full max-w-full" />
            </div>
          </div>

          {/* Dados pagador */}
          <div className="mt-3 rounded-2xl border border-border bg-white p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <User className="h-3 w-3" /> Pagador
            </div>
            <div className="mt-1.5 text-sm font-semibold text-foreground">{debito.nome}</div>
            <div className="text-xs text-muted-foreground">
              CPF {fmtCPF(debito.cpf)} · CRM {debito.crm}/MG
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Banco</div>
                <div className="mt-0.5 font-medium text-foreground">{dadosLinha.banco.nome}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nº documento</div>
                <div className="mt-0.5 font-mono font-medium text-foreground">{debito.debito_codigo}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Emissão</div>
                <div className="mt-0.5 font-medium text-foreground">{hoje}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Espécie</div>
                <div className="mt-0.5 font-medium text-foreground">DM · R$</div>
              </div>
            </div>
          </div>

          {/* PDF / 2ª via */}
          {(emissao.pdf_url || emissao.hosted_voucher_url) && (
            <div className="mt-3 grid gap-2">
              {emissao.pdf_url && (
                <a
                  href={emissao.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-card transition active:translate-y-0.5"
                >
                  <FileText className="h-4 w-4" />
                  Baixar PDF oficial
                </a>
              )}
              {emissao.hosted_voucher_url && (
                <a
                  href={emissao.hosted_voucher_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-card transition active:translate-y-0.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir 2ª via online
                </a>
              )}
            </div>
          )}

          <p className="mt-4 px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            Cole no app do seu banco em "Pagar com código de barras". Pagável em
            qualquer banco, lotérica ou app bancário até o vencimento.
          </p>
        </div>

        {/* ========= DESKTOP / PRINT VIEW ========= */}
        <div className="hidden md:block">
          <div className="mb-4 rounded-xl border border-crm-green/20 bg-white p-4 shadow-card print:hidden">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-crm-green text-primary-foreground font-bold text-sm">
                CRM
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  CONSELHO REGIONAL DE MEDICINA DO ESTADO DE MINAS GERAIS
                </div>
                <div className="text-xs text-muted-foreground">
                  CNPJ 17.218.964/0001-30 · Rua dos Timbiras, 1.200 — Funcionários · Belo Horizonte/MG · CEP 30.140-064
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-card print:rounded-none print:border-black print:shadow-none">
            <div className="flex items-stretch border-b-2 border-neutral-900">
              <div className="flex items-center gap-2 border-r-2 border-neutral-900 px-4 py-2">
                <div className="text-2xl font-extrabold tracking-tight text-neutral-900">
                  {dadosLinha.banco.nome}
                </div>
              </div>
              <div className="flex items-center justify-center border-r-2 border-neutral-900 px-4 py-2 text-2xl font-extrabold text-neutral-900">
                {dadosLinha.banco.codigo}
              </div>
              <div className="flex flex-1 items-center justify-end px-4 py-2 font-mono text-sm font-semibold tracking-wider text-neutral-900 md:text-base">
                {linha}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-neutral-300">
              <Field
                className="col-span-8"
                label="Local de pagamento"
                value="Pagável em qualquer banco, lotérica ou app bancário até o vencimento."
              />
              <Field className="col-span-4 border-r-0" label="Vencimento" value={venc} />
            </div>

            <div className="grid grid-cols-12 border-b border-neutral-300">
              <Field
                className="col-span-8"
                label="Beneficiário"
                value="CONSELHO REGIONAL DE MEDICINA DO ESTADO DE MINAS GERAIS"
              />
              <Field
                className="col-span-4 border-r-0"
                label="Agência / Código do beneficiário"
                value={`${dadosLinha.agencia} / ${dadosLinha.conta}`}
                mono
              />
            </div>

            <div className="grid grid-cols-12 border-b border-neutral-300">
              <Field className="col-span-3" label="Data do documento" value={hoje} />
              <Field className="col-span-3" label="Nº do documento" value={debito.debito_codigo} mono />
              <Field className="col-span-2" label="Espécie doc." value="DM" />
              <Field className="col-span-1" label="Aceite" value="N" />
              <Field className="col-span-3 border-r-0" label="Data processamento" value={hoje} />
            </div>

            <div className="grid grid-cols-12 border-b border-neutral-300">
              <Field className="col-span-3" label="Uso do banco" value="—" />
              <Field className="col-span-3" label="Carteira" value={dadosLinha.carteira} mono />
              <Field className="col-span-2" label="Espécie" value="R$" />
              <Field className="col-span-1" label="Quantidade" value="1" />
              <Field className="col-span-3 border-r-0" label="Nosso número" value={dadosLinha.nossoNumero} mono />
            </div>

            <div className="grid grid-cols-12">
              <div className="col-span-8 border-r border-b border-neutral-300 px-2.5 py-2">
                <div className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">
                  Instruções (texto de responsabilidade do beneficiário)
                </div>
                <ul className="mt-1.5 space-y-1 text-[12px] leading-snug text-neutral-800">
                  <li>• Referente à <strong>{debito.descricao}</strong>.</li>
                  <li>• Não receber após o vencimento.</li>
                  <li>• Em caso de dúvida, contatar a Tesouraria do CRM-MG.</li>
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

            {/* Código de barras real (ITF) */}
            <div className="px-4 py-4">
              <Barcode value={barcodeValue} height={70} className="block h-[70px] w-full max-w-[520px]" />
            </div>
          </div>

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

            {(emissao.pdf_url || emissao.hosted_voucher_url) && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {emissao.pdf_url && (
                  <a
                    href={emissao.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
                  >
                    <FileText className="h-4 w-4" />
                    Baixar PDF oficial
                  </a>
                )}
                {emissao.hosted_voucher_url && (
                  <a
                    href={emissao.hosted_voucher_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir 2ª via online
                  </a>
                )}
              </div>
            )}

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Cole no app do seu banco em "Pagar com código de barras" ou pague pelo Pix copia-e-cola com 5% de desconto.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
