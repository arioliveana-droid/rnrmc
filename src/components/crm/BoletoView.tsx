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
  "745": { nome: "Citibank", codigo: "745-5" },
  "748": { nome: "Sicredi", codigo: "748-X" },
};

function formatLinhaDigitavel(linha: string) {
  const d = linha.replace(/\D/g, "");
  if (d.length !== 47) return linha;
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33, 47)}`;
}

function linhaToBarcode(linha: string) {
  const digits = linha.replace(/\D/g, "");
  if (digits.length !== 47) return digits.padEnd(44, "0").slice(0, 44);
  const campo1 = digits.slice(0, 9);
  const campo2 = digits.slice(10, 20);
  const campo3 = digits.slice(21, 31);
  const dv = digits.slice(32, 33);
  const fatorEValor = digits.slice(33, 47);
  return `${campo1.slice(0,4)}${dv}${fatorEValor}${campo1.slice(4,9)}${campo2}${campo3}`;
}

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
    <div className={`border-r border-b border-neutral-300 px-2.5 py-1.5 print:border-black ${className}`}>
      <div className="text-[9px] font-medium uppercase tracking-wide text-neutral-500 print:text-neutral-800">
        {label}
      </div>
      <div className={`mt-0.5 text-[13px] font-medium text-neutral-900 print:text-black ${mono ? "font-mono" : ""}`}>
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
    const banco = BANCOS[codBanco] ?? { nome: "Banco", codigo: `${codBanco}-X` };
    const nossoNumero = d.slice(4, 18) || "00000000000000";
    const agencia = d.slice(20, 24) || "0000";
    const conta = d.slice(24, 30) || "000000";
    const carteira = d.slice(18, 20) || "17";
    return { codBanco, banco, nossoNumero, agencia, conta, carteira };
  }, [linha]);

  const linhaFormatada = useMemo(() => formatLinhaDigitavel(linha), [linha]);
  const barcodeValue = useMemo(() => linhaToBarcode(linha), [linha]);

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
      <style>{`
        @media print {
          @page { margin: 0; size: auto; }
          body { 
            margin: 0;
            padding: 0;
            background: white !important; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          /* Hide EVERYTHING by default */
          body * {
            visibility: hidden;
          }
          /* Show ONLY the print container and its children */
          .boleto-print-container, .boleto-print-container * {
            visibility: visible;
          }
          /* Position it at the top left of the page */
          .boleto-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 1.5cm;
          }
        }
      `}</style>
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
        <div className="md:hidden print:hidden -mx-3 -my-4 pb-32">
          {/* Premium hero with brand gradient */}
          <div className="relative overflow-hidden bg-gradient-to-br from-crm-green-dark via-crm-green to-crm-green-dark px-5 pt-6 pb-7 text-white">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/5 blur-3xl" />

            <div className="relative flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 backdrop-blur text-[11px] font-extrabold ring-1 ring-white/30">
                CRM
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                  CRM-ES · Anuidade 2026
                </div>
                <div className="truncate text-[11px] text-white/70">
                  Conselho Regional de Medicina/ES
                </div>
              </div>
            </div>

            <div className="relative mt-6">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Valor a pagar
              </div>
              <div className="mt-1 font-serif text-[40px] font-bold leading-none tracking-tight">
                {fmtBRL(Number(debito.valor))}
              </div>
            </div>

            <div className="relative mt-5 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur ring-1 ring-white/20">
              <Calendar className="h-4 w-4 text-white/90" />
              <div className="flex-1 text-[11px] text-white/80">Vencimento</div>
              <div className="text-sm font-bold text-white">{venc}</div>
            </div>
          </div>

          {/* Card flutuante - linha digitável + copy */}
          <div className="-mt-4 px-3">
            <div className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Linha digitável
                </div>
                <div className="text-[10px] font-semibold text-crm-green-dark">
                  Boleto bancário
                </div>

              </div>

              <div 
                onClick={handleCopy}
                className="mt-2 break-all rounded-xl bg-neutral-50 px-3 py-3 font-mono text-[13px] font-semibold leading-relaxed tracking-tight text-neutral-900 ring-1 ring-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors active:scale-[0.99] active:bg-neutral-200"
                title="Clique para copiar"
              >
                {linhaFormatada}
              </div>

              <button
                onClick={handleCopy}
                className={`mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold shadow-lg transition-all active:scale-[0.98] ${
                  copiado
                    ? "bg-emerald-600 text-white shadow-emerald-600/30"
                    : "bg-crm-green text-primary-foreground shadow-crm-green/40"
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
            <div className="mt-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Código de barras
                </div>
                <div className="text-[10px] text-neutral-400">ITF · 44 dígitos</div>
              </div>
              <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-neutral-200">
                <Barcode
                  value={barcodeValue}
                  height={80}
                  className="block w-full max-w-full"
                />
              </div>
              <p className="mt-2 text-center text-[10.5px] leading-snug text-muted-foreground">
                Aponte a câmera do app do seu banco para o código acima
              </p>
            </div>

            {/* PDF customizado */}
            <div className="mt-3">
              <button
                onClick={() => window.print()}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 text-sm font-semibold text-white shadow-md transition active:scale-[0.98]"
              >
                <FileText className="h-4 w-4" />
                Salvar boleto em PDF
              </button>
            </div>

            {/* Dados detalhados */}
            <div className="mt-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                <User className="h-3 w-3" /> Pagador
              </div>
              <div className="mt-1.5 text-[15px] font-semibold text-foreground">
                {debito.nome}
              </div>
              <div className="text-xs text-muted-foreground">
                CPF {fmtCPF(debito.cpf)} · CRM debito.crm/ES
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-neutral-200 pt-3">
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-neutral-500">Nº documento</div>
                  <div className="mt-0.5 font-mono text-[13px] font-medium text-foreground">{debito.debito_codigo}</div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-neutral-500">Emissão</div>
                  <div className="mt-0.5 text-[13px] font-medium text-foreground">{hoje}</div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-neutral-500">Beneficiário</div>
                  <div className="mt-0.5 text-[12px] font-medium leading-snug text-foreground">CRM-ES</div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-neutral-500">CNPJ</div>
                  <div className="mt-0.5 font-mono text-[12px] font-medium text-foreground">17.218.964/0001-30</div>
                </div>

              </div>
            </div>

            <p className="mt-4 px-2 pb-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              Pagável em qualquer banco, lotérica ou app bancário até o vencimento.
            </p>
          </div>
        </div>


        {/* ========= DESKTOP / PRINT VIEW ========= */}
        <div className="hidden md:block print:block boleto-print-container">
          
          <div className="mb-4 flex items-center justify-between rounded-xl border border-crm-green/20 bg-white p-4 shadow-card print:hidden">
            <div className="flex items-center gap-4">
              <img src="/CRM-ES-logo.png" alt="CRM-ES" style={{ height: "48px", width: "140px", objectFit: "contain", display: "block" }} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground">
                  CONSELHO REGIONAL DE MEDICINA DO ESTADO DE Espírito Santo
                </div>
                <div className="text-xs text-muted-foreground">
                  CNPJ 27.472.242/0001-02 · Av. Marechal Mascarenhas de Moraes, 2399 — Bento Ferreira · Vitória/ES
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-[800px] bg-white print:max-w-none">
            {/* Recibo do Pagador */}
            <div className="mb-6 border border-black p-0 print:border-none">
              <table className="w-full border-collapse border-black text-[10px] leading-tight text-black">
                <tbody>
                  <tr>
                    <td colSpan={2} className="border-b border-black p-2">
                      <div className="flex items-center justify-between">
                        <img src="/CRM-ES-logo.png" alt="CRM-ES" style={{ height: "40px", width: "120px", objectFit: "contain", display: "block" }} />
                        <div className="text-sm font-bold tracking-widest">{linhaFormatada}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-r border-black p-1 align-top w-2/3">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Beneficiário</div>
                      <div className="font-semibold mt-0.5">CONSELHO REGIONAL DE MEDICINA DO ESTADO DE Espírito Santo</div>
                    </td>
                    <td className="border-b border-black p-1 align-top w-1/3">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Agência / Código do Beneficiário</div>
                      <div className="font-semibold mt-0.5">{dadosLinha.agencia} / {dadosLinha.conta}</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-r border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Pagador</div>
                      <div className="font-semibold mt-0.5">{debito.nome}</div>
                      <div className="mt-0.5">CPF: {fmtCPF(debito.cpf)} - CRM: {debito.crm}/ES</div>
                    </td>
                    <td className="border-b border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Vencimento</div>
                      <div className="font-semibold mt-0.5">{venc}</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-r border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Nº do Documento</div>
                      <div className="font-semibold mt-0.5">{debito.debito_codigo}</div>
                    </td>
                    <td className="border-b border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Valor do Documento</div>
                      <div className="font-bold mt-0.5">{fmtBRL(Number(debito.valor))}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border-b border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Instruções</div>
                      <div className="mt-1">
                        - Referente à <strong>{debito.descricao}</strong>.<br/>
                        - Pagável em qualquer banco, lotérica ou app bancário até o vencimento.<br/>
                        - Não receber após o vencimento.
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="w-full text-right text-[10px] p-1 font-semibold border-t border-dashed border-black">
                Recibo do Pagador
              </div>
            </div>

            {/* Boleto principal */}
            <div className="border border-black p-0 print:border-none">
              <table className="w-full border-collapse border-black text-[10px] leading-tight text-black table-fixed">
                <tbody>
                  <tr>
                    <td colSpan={7} className="border-b-2 border-black p-2">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 border-r-2 border-black pr-2">
                          <img src="/CRM-ES-logo.png" alt="CRM-ES" style={{ height: "30px", width: "90px", objectFit: "contain", display: "block" }} />
                        </div>
                        <div className="flex-shrink-0 border-r-2 border-black px-2 text-lg font-bold">
                          {dadosLinha.banco.codigo}
                        </div>
                        <div className="flex-1 whitespace-nowrap text-right text-[11px] sm:text-[12px] md:text-[13px] tracking-tight font-bold">
                          {linhaFormatada}
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="border-b border-r border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Local de pagamento</div>
                      <div className="font-semibold mt-0.5">Pagável em qualquer banco, lotérica ou app bancário até o vencimento.</div>
                    </td>
                    <td colSpan={2} className="border-b border-black p-1 align-top w-[180px] bg-neutral-100 print:bg-transparent">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Vencimento</div>
                      <div className="font-semibold mt-0.5 text-right">{venc}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="border-b border-r border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Beneficiário</div>
                      <div className="font-semibold mt-0.5">CONSELHO REGIONAL DE MEDICINA DO ESTADO DE Espírito Santo</div>
                    </td>
                    <td colSpan={2} className="border-b border-black p-1 align-top w-[180px]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Agência / Código do Beneficiário</div>
                      <div className="font-semibold mt-0.5 text-right">{dadosLinha.agencia} / {dadosLinha.conta}</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-r border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Data do documento</div>
                      <div className="font-semibold mt-0.5">{hoje}</div>
                    </td>
                    <td colSpan={2} className="border-b border-r border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Nº do documento</div>
                      <div className="font-semibold mt-0.5">{debito.debito_codigo}</div>
                    </td>
                    <td className="border-b border-r border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Espécie doc.</div>
                      <div className="font-semibold mt-0.5">DM</div>
                    </td>
                    <td className="border-b border-r border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Aceite</div>
                      <div className="font-semibold mt-0.5">N</div>
                    </td>
                    <td colSpan={2} className="border-b border-black p-1 align-top w-[180px]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Data processamento</div>
                      <div className="font-semibold mt-0.5 text-right">{hoje}</div>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-b border-r border-black p-1 align-top w-[15%]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Uso do banco</div>
                      <div className="font-semibold mt-0.5">—</div>
                    </td>
                    <td className="border-b border-r border-black p-1 align-top w-[12%]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Carteira</div>
                      <div className="font-semibold mt-0.5">{dadosLinha.carteira}</div>
                    </td>
                    <td className="border-b border-r border-black p-1 align-top w-[10%]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Espécie</div>
                      <div className="font-semibold mt-0.5">R$</div>
                    </td>
                    <td className="border-b border-r border-black p-1 align-top w-[12%]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Quantidade</div>
                      <div className="font-semibold mt-0.5">1</div>
                    </td>
                    <td className="border-b border-r border-black p-1 align-top w-[18%]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Valor (x)</div>
                      <div className="font-semibold mt-0.5">—</div>
                    </td>
                    <td colSpan={2} className="border-b border-black p-1 align-top w-[180px]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Nosso número</div>
                      <div className="font-semibold mt-0.5 text-right">{dadosLinha.nossoNumero}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} rowSpan={4} className="border-b border-r border-black p-1 align-top h-[100px]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Instruções (texto de responsabilidade do beneficiário)</div>
                      <div className="mt-1 text-xs">
                        - Referente à <strong>{debito.descricao}</strong>.<br/>
                        - Não receber após o vencimento.<br/>
                        - Em caso de dúvida, contatar a Tesouraria do CRM-ES.
                      </div>
                    </td>
                    <td colSpan={2} className="border-b border-black p-1 align-top w-[180px]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">(=) Valor do documento</div>
                      <div className="font-bold mt-0.5 text-right">{fmtBRL(Number(debito.valor))}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border-b border-black p-1 align-top w-[180px]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">(-) Descontos / Abatimentos</div>
                      <div className="font-semibold mt-0.5 text-right">—</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border-b border-black p-1 align-top w-[180px]">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">(+) Juros / Multa</div>
                      <div className="font-semibold mt-0.5 text-right">—</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border-b border-black p-1 align-top w-[180px] bg-neutral-100 print:bg-transparent">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">(=) Valor cobrado</div>
                      <div className="font-bold mt-0.5 text-right text-base">{fmtBRL(Number(debito.valor))}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={7} className="border-black p-1 align-top">
                      <div className="text-[8px] font-bold text-neutral-600 print:text-black">Pagador</div>
                      <div className="font-semibold mt-0.5">{debito.nome}</div>
                      <div className="mt-0.5">CPF: {fmtCPF(debito.cpf)} - CRM: {debito.crm}/ES</div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-4 pb-4 flex justify-end pr-8 print:justify-start print:pr-0">
                <Barcode value={barcodeValue} height={70} className="block" />
              </div>
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

            <div className="mt-3">
              <button
                onClick={() => window.print()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                <FileText className="h-4 w-4" />
                Salvar como PDF
              </button>
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Cole no app do seu banco em "Pagar com código de barras".
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
