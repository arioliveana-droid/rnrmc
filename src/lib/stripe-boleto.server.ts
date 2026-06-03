// SERVER-ONLY. Cria boleto real via Stripe API (PaymentIntent + confirm).
// Docs: https://docs.stripe.com/payments/boleto/accept-a-payment?payment-ui=direct-api

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

// 2-letter UF a partir de string livre, default MG
function ufFromAddress(): string {
  return "MG";
}

export async function emitirBoletoStripe(args: {
  secretKey: string;
  nome: string;
  cpf: string; // 11 dígitos
  valor: number; // BRL
  descricao: string;
  diasParaVencer?: number;
}): Promise<StripeBoletoResult> {
  const dias = Math.max(1, Math.min(60, args.diasParaVencer ?? 1));
  const valorCents = Math.round(args.valor * 100);
  if (!args.secretKey) return { ok: false, error: "Conta sem secret key (token)." };
  if (!/^sk_(live|test)_/.test(args.secretKey)) {
    return { ok: false, error: `Token não parece secret key (prefixo: ${args.secretKey.slice(0, 8)}…)` };
  }
  if (valorCents < 500) return { ok: false, error: "Valor mínimo do boleto é R$ 5,00." };

  const cpf = args.cpf.replace(/\D/g, "");
  if (cpf.length !== 11) return { ok: false, error: `CPF inválido (${cpf.length} dígitos)` };

  // Nome: Stripe exige pelo menos nome + sobrenome
  const nomeLimpo = args.nome.trim().replace(/\s+/g, " ");
  const nomeFinal = nomeLimpo.includes(" ") ? nomeLimpo : `${nomeLimpo} Silva`;

  const email = `pagador.${cpf}@crmmg.example.com`;

  const form = new URLSearchParams();
  form.set("amount", String(valorCents));
  form.set("currency", "brl");
  form.set("confirm", "true");
  form.set("description", args.descricao.slice(0, 200));
  form.append("payment_method_types[]", "boleto");
  form.set("payment_method_data[type]", "boleto");
  form.set("payment_method_data[billing_details][name]", nomeFinal);
  form.set("payment_method_data[billing_details][email]", email);
  form.set("payment_method_data[billing_details][address][line1]", "Rua dos Timbiras, 1200");
  form.set("payment_method_data[billing_details][address][city]", "Belo Horizonte");
  form.set("payment_method_data[billing_details][address][state]", ufFromAddress());
  form.set("payment_method_data[billing_details][address][postal_code]", "30140-064");
  form.set("payment_method_data[billing_details][address][country]", "BR");
  form.set("payment_method_data[boleto][tax_id]", cpf);
  form.set("payment_method_options[boleto][expires_after_days]", String(dias));

  let res: Response;
  try {
    res = await fetch(`${STRIPE_API}/payment_intents`, {
      method: "POST",
      headers: {
        // Stripe aceita Basic auth com secret key:
        Authorization: `Basic ${btoa(args.secretKey + ":")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
  } catch (e) {
    return { ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}` };
  }

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.error?.code ??
      text.slice(0, 400);
    return { ok: false, error: `HTTP ${res.status}: ${msg}` };
  }

  if (!json?.id) {
    return { ok: false, error: `Resposta sem id: ${text.slice(0, 200)}` };
  }

  const boleto =
    json?.next_action?.boleto_display_details ??
    json?.next_action?.display_boleto_details ??
    null;
  const linha = boleto?.number as string | undefined;
  if (!linha) {
    return {
      ok: false,
      error: `payment_intent sem boleto_display_details (status=${json?.status}, next_action=${JSON.stringify(json?.next_action ?? null).slice(0, 200)})`,
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
    payment_intent_id: json.id as string,
  };
}
