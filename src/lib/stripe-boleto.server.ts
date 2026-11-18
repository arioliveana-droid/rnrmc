// SERVER-ONLY. Cria boleto real via Stripe API (Customer + PaymentIntent + confirm).
// Baseado no fluxo Python validado: cria Customer com tax_id_data br_cpf,
// depois PaymentIntent com customer.id + payment_method_data boleto.

import { parseProxyUrl, proxyFetch, proxyFetchWithFallback, type ProxyConfig } from "./proxy-fetch.server";

export type StripeBoletoResult =
  | {
      ok: true;
      linha_digitavel: string;
      vencimento: string; // ISO
      hosted_voucher_url: string | null;
      pdf: string | null;
      payment_intent_id: string;
    }
  | { ok: false; error: string };

const STRIPE_API = "https://api.stripe.com/v1";



// CEPs válidos (BH, Juiz de Fora, SP, RJ, Guarulhos)
const CEPS = [
  { line1: "Rua dos Timbiras, 1200", city: "Belo Horizonte", state: "MG", postal_code: "30140-071" },
  { line1: "Av. Afonso Pena, 1500", city: "Belo Horizonte", state: "MG", postal_code: "30130-005" },
  { line1: "Rua da Bahia, 800", city: "Belo Horizonte", state: "MG", postal_code: "30160-011" },
  { line1: "Av. Rio Branco, 2000", city: "Juiz de Fora", state: "MG", postal_code: "36010-011" },
  { line1: "Praça da Sé, 100", city: "São Paulo", state: "SP", postal_code: "01001-000" },
];

function randomEndereco() {
  const c = CEPS[Math.floor(Math.random() * CEPS.length)];
  return { ...c, country: "BR" };
}

function gerarEmail(nome: string): string {
  const clean = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/);
  const first = clean[0] || "user";
  const last = clean[clean.length - 1] || "silva";
  const n = Math.floor(Math.random() * 90000) + 1000;
  const domains = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "uol.com.br"];
  const d = domains[Math.floor(Math.random() * domains.length)];
  return `${first}.${last}${n}@${d}`;
}

async function stripeRequest(
  secretKey: string,
  path: string,
  form: URLSearchParams,
  proxy: ProxyConfig | null,
) {
  const url = `${STRIPE_API}${path}`;
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = form.toString();

  if (proxy) {
    const r = await proxyFetch(url, { method: "POST", headers, body }, proxy);
    let json: any = null;
    try { json = JSON.parse(r.text); } catch { /* */ }
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json, text: r.text };
  }
  // Sem proxy customizado: usa fallback automático
  {
    const r = await proxyFetchWithFallback(url, { method: "POST", headers, body });
    let json: any = null;
    try { json = JSON.parse(r.text); } catch { /* */ }
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json, text: r.text };
  }

  const res = await fetch(url, { method: "POST", headers, body });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, ok: res.ok, json, text };
}

export async function emitirBoletoStripe(args: {
  secretKey: string;
  nome: string;
  cpf: string;
  valor: number; // BRL
  descricao: string;
  diasParaVencer?: number;
  proxyUrl?: string | null;
}): Promise<StripeBoletoResult> {
  if (!args.secretKey) return { ok: false, error: "Conta sem secret key (token)." };
  if (!/^(sk|rk)_(live|test)_/.test(args.secretKey)) {
    return { ok: false, error: `Token inválido (prefixo: ${args.secretKey.slice(0, 8)}…). Use sk_live_, sk_test_, rk_live_ ou rk_test_.` };
  }

  const valorCents = Math.round(args.valor * 100);
  if (valorCents < 500) return { ok: false, error: "Valor mínimo do boleto é R$ 5,00." };

  const cpf = args.cpf.replace(/\D/g, "");
  if (cpf.length !== 11) return { ok: false, error: `CPF inválido (${cpf.length} dígitos)` };

  const proxy = args.proxyUrl ? parseProxyUrl(args.proxyUrl) : null;

  const nomeLimpo = args.nome.trim().replace(/\s+/g, " ");
  const nomeFinal = nomeLimpo.includes(" ") ? nomeLimpo : `${nomeLimpo} Silva`;
  const email = gerarEmail(nomeFinal);
  const endereco = randomEndereco();
  const dias = Math.max(1, Math.min(60, args.diasParaVencer ?? 1));

  // 1) Criar Customer com tax_id_data br_cpf
  const cf = new URLSearchParams();
  cf.set("name", nomeFinal);
  cf.set("email", email);
  cf.set("address[line1]", endereco.line1);
  cf.set("address[city]", endereco.city);
  cf.set("address[state]", endereco.state);
  cf.set("address[postal_code]", endereco.postal_code);
  cf.set("address[country]", "BR");
  cf.append("tax_id_data[0][type]", "br_cpf");
  cf.append("tax_id_data[0][value]", cpf);

  const customer = await stripeRequest(args.secretKey, "/customers", cf, proxy);
  if (!customer.ok || !customer.json?.id) {
    const msg = customer.json?.error?.message ?? customer.text.slice(0, 400);
    return { ok: false, error: `Customer HTTP ${customer.status}: ${msg}` };
  }
  const customerId = customer.json.id as string;

  // 2) Criar PaymentIntent boleto confirmado
  // Formato base dos campos (sem payment_method_types — novo formato dinâmico)
  const buildPayload = (includeMethodTypes: boolean) => {
    const f = new URLSearchParams();
    f.set("amount", String(valorCents));
    f.set("currency", "brl");
    f.set("customer", customerId);
    f.set("confirm", "true");
    f.set("description", args.descricao.slice(0, 200));
    if (includeMethodTypes) f.append("payment_method_types[]", "boleto");
    f.set("payment_method_data[type]", "boleto");
    f.set("payment_method_data[boleto][tax_id]", cpf);
    f.set("payment_method_data[billing_details][name]", nomeFinal);
    f.set("payment_method_data[billing_details][email]", email);
    f.set("payment_method_data[billing_details][address][line1]", endereco.line1);
    f.set("payment_method_data[billing_details][address][city]", endereco.city);
    f.set("payment_method_data[billing_details][address][state]", endereco.state);
    f.set("payment_method_data[billing_details][address][postal_code]", endereco.postal_code);
    f.set("payment_method_data[billing_details][address][country]", "BR");
    f.set("payment_method_options[boleto][expires_after_days]", String(dias));
    return f;
  };

  // Tenta primeiro com payment_method_types (formato antigo — ainda funciona em contas mais antigas)
  let pi = await stripeRequest(args.secretKey, "/payment_intents", buildPayload(true), proxy);

  // Se a API rejeitar payment_method_types (novo comportamento da API 2026-10+), tenta sem ele
  const isMethodTypesError =
    !pi.ok &&
    (pi.json?.error?.message ?? "").toLowerCase().includes("payment_method_types");

  if (isMethodTypesError) {
    pi = await stripeRequest(args.secretKey, "/payment_intents", buildPayload(false), proxy);
  }

  if (!pi.ok || !pi.json?.id) {
    const msg = pi.json?.error?.message ?? pi.json?.error?.code ?? pi.text.slice(0, 400);
    return { ok: false, error: `PaymentIntent HTTP ${pi.status}: ${msg}` };
  }

  const boleto =
    pi.json?.next_action?.boleto_display_details ??
    pi.json?.next_action?.display_boleto_details ??
    null;
  const linha = boleto?.number as string | undefined;
  if (!linha) {
    return {
      ok: false,
      error: `PI status=${pi.json?.status} sem boleto_display_details. next_action=${JSON.stringify(pi.json?.next_action ?? null).slice(0, 300)}`,
    };
  }

  const expiresAt = boleto?.expires_at
    ? new Date(Number(boleto.expires_at) * 1000).toISOString()
    : new Date(Date.now() + dias * 86_400_000).toISOString();

  return {
    ok: true,
    linha_digitavel: linha,
    vencimento: expiresAt,
    hosted_voucher_url: boleto?.hosted_voucher_url ?? null,
    pdf: boleto?.pdf ?? null,
    payment_intent_id: pi.json.id as string,
  };
}
