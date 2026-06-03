// SERVER-ONLY. Cria boleto real via Stripe API usando a secret key da conta.

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

async function stripePost(
  secretKey: string,
  path: string,
  body: Record<string, string>,
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text };
}

export async function emitirBoletoStripe(args: {
  secretKey: string;
  nome: string;
  cpf: string; // só dígitos
  valor: number; // BRL
  descricao: string;
  diasParaVencer?: number;
}): Promise<StripeBoletoResult> {
  const dias = Math.max(1, Math.min(60, args.diasParaVencer ?? 1));
  const valorCents = Math.round(args.valor * 100);
  if (!args.secretKey) return { ok: false, error: "Conta sem secret key (token)." };
  if (valorCents < 500) return { ok: false, error: "Valor mínimo do boleto é R$ 5,00." };

  // Email placeholder único por CPF (a Stripe não valida envio)
  const email = `pagador.${args.cpf}@crmmg.local`;

  // 1) Cria customer
  const cust = await stripePost(args.secretKey, "/customers", {
    name: args.nome,
    email,
    "address[line1]": "Rua dos Timbiras, 1200",
    "address[city]": "Belo Horizonte",
    "address[state]": "MG",
    "address[postal_code]": "30140064",
    "address[country]": "BR",
  });
  if (cust.status >= 300 || !cust.json?.id) {
    return {
      ok: false,
      error: `customers: HTTP ${cust.status} ${cust.json?.error?.message ?? cust.text.slice(0, 200)}`,
    };
  }
  const customerId = cust.json.id as string;

  // 2) Cria PaymentIntent já confirmando com boleto
  const pi = await stripePost(args.secretKey, "/payment_intents", {
    amount: String(valorCents),
    currency: "brl",
    customer: customerId,
    description: args.descricao.slice(0, 200),
    "payment_method_types[]": "boleto",
    confirm: "true",
    "payment_method_data[type]": "boleto",
    "payment_method_data[boleto][tax_id]": args.cpf,
    "payment_method_options[boleto][expires_after_days]": String(dias),
  });
  if (pi.status >= 300 || !pi.json?.id) {
    return {
      ok: false,
      error: `payment_intents: HTTP ${pi.status} ${pi.json?.error?.message ?? pi.text.slice(0, 300)}`,
    };
  }

  const boleto = pi.json?.next_action?.boleto_display_details;
  const linha = boleto?.number as string | undefined;
  if (!linha) {
    return {
      ok: false,
      error: `payment_intent sem boleto_display_details (status=${pi.json?.status})`,
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
