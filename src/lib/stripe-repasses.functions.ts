// SERVER-ONLY. Busca e persiste repasses (payouts) da Stripe por conta.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseProxyUrl, proxyFetch } from "./proxy-fetch.server";

const DEFAULT_PROXY = "http://smart-pcqvtsl0pvll:5lLNTXySrs13Dav7@proxy.smartproxy.net:3120";

export type Repasse = {
  id: string;
  stripe_account_id: string;
  conta_nome: string;
  payout_id: string;
  valor: number;
  arrival_date: string; // YYYY-MM-DD
  status: string;
  criado_em_stripe: string;
  atualizado_em: string;
};

async function fetchPayoutsForAccount(
  token: string,
  proxyUrl: string | null,
): Promise<{ data: any[]; error?: string }> {
  const proxy = parseProxyUrl(proxyUrl || DEFAULT_PROXY);
  const url = "https://api.stripe.com/v1/payouts?limit=100&expand[]=data.destination";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Stripe-Version": "2023-10-16",
  };

  try {
    if (proxy) {
      const r = await proxyFetch(url, { method: "GET", headers }, proxy);
      if (r.status !== 200) return { data: [], error: `HTTP ${r.status}` };
      const json = JSON.parse(r.text) as { data: any[] };
      return { data: json.data ?? [] };
    }
    const res = await fetch(url, { headers });
    if (!res.ok) return { data: [], error: `HTTP ${res.status}` };
    const json = await res.json() as { data: any[] };
    return { data: json.data ?? [] };
  } catch (e) {
    return { data: [], error: String(e) };
  }
}

/**
 * Busca payouts das contas especificadas (ou de todas se nenhuma for passada)
 * via proxy e persiste no banco.
 */
export const buscarEsalvarRepasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ accountIds: z.array(z.string()).optional() })
      .default({})
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("stripe_accounts")
      .select("id, nome, token, proxy_url")
      .order("ordem", { ascending: true });

    if (data.accountIds && data.accountIds.length > 0) {
      query = query.in("id", data.accountIds);
    }

    const { data: contas } = await query;

    if (!contas || contas.length === 0) return { atualizados: 0, erros: [] };

    const erros: { conta: string; erro: string }[] = [];
    let atualizados = 0;
    const agora = new Date().toISOString();

    // 3 contas em paralelo
    const CONCURRENCY = 3;
    for (let i = 0; i < contas.length; i += CONCURRENCY) {
      const chunk = contas.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async (conta) => {
        const { data: payouts, error } = await fetchPayoutsForAccount(conta.token, conta.proxy_url);
        if (error) { erros.push({ conta: conta.nome, erro: error }); return; }
        if (payouts.length === 0) return;

        const rows = payouts.map((p: any) => ({
          stripe_account_id: conta.id,
          payout_id: p.id as string,
          valor: (p.amount as number) / 100,
          arrival_date: new Date((p.arrival_date as number) * 1000).toISOString().slice(0, 10),
          status: p.status as string,
          criado_em_stripe: new Date((p.created as number) * 1000).toISOString(),
          atualizado_em: agora,
        }));

        const { error: upsertErr } = await supabaseAdmin
          .from("stripe_repasses")
          .upsert(rows, { onConflict: "stripe_account_id,payout_id" });

        if (upsertErr) {
          erros.push({ conta: conta.nome, erro: upsertErr.message });
        } else {
          atualizados += rows.length;
        }
      }));
    }

    return { atualizados, erros };
  });

/**
 * Lista todos os repasses salvos no banco, agrupados por conta.
 */
export const listarRepasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("stripe_repasses")
      .select("id, stripe_account_id, payout_id, valor, arrival_date, status, criado_em_stripe, atualizado_em, stripe_accounts(nome)")
      .not("status", "in", '("paid","canceled")')
      .order("arrival_date", { ascending: false })
      .limit(500);

    if (error) {
      console.error("listarRepasses", error);
      return { repasses: [] as Repasse[] };
    }

    const repasses: Repasse[] = (data ?? []).map((r: any) => ({
      id: r.id,
      stripe_account_id: r.stripe_account_id,
      conta_nome: r.stripe_accounts?.nome ?? "—",
      payout_id: r.payout_id,
      valor: Number(r.valor),
      arrival_date: r.arrival_date,
      status: r.status,
      criado_em_stripe: r.criado_em_stripe,
      atualizado_em: r.atualizado_em,
    }));

    return { repasses };
  });

/**
 * Soma o valor total de repasses com status "paid" por conta, direto do banco.
 */
export const somarRepassesPagos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("stripe_repasses")
      .select("stripe_account_id, valor")
      .eq("status", "paid");

    if (error) {
      console.error("somarRepassesPagos", error);
      return { saldo: {} as Record<string, number> };
    }

    const saldo: Record<string, number> = {};
    for (const r of data ?? []) {
      saldo[r.stripe_account_id] = (saldo[r.stripe_account_id] ?? 0) + Number(r.valor);
    }

    return { saldo };
  });
