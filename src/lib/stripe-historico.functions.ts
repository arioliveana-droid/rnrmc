// SERVER-ONLY. Busca histórico de transações Stripe (boletos) por período,
// cruzando todas as contas cadastradas. Retorna lista flat de transações
// com CPF extraído do payment_method expandido.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseProxyUrl, proxyFetch } from "./proxy-fetch.server";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type TransacaoStripe = {
  pi_id: string;
  conta_id: string;
  conta_nome: string;
  status: string; // succeeded | requires_action | canceled | processing
  valor: number; // BRL
  descricao: string | null;
  cpf: string | null;       // tax_id do boleto (11 dígitos)
  nome_stripe: string | null; // billing_details.name
  criado_em: string;         // ISO
  vencimento: string | null; // ISO
  // dados cruzados com nosso banco (preenchidos se houver match)
  boleto_id: string | null;
  boleto_nome: string | null;
  boleto_crm: string | null;
  boleto_cpf: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: pagina todos os PaymentIntents de uma conta Stripe no período
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROXY = "http://smart-cadunico_area-BR:Trampo23@proxy.smartproxy.net:3120";

async function fetchAllPIsForAccount(
  token: string,
  tsInicio: number,
  tsFim: number,
  proxyUrl?: string | null,
): Promise<{ raw: any[]; error?: string }> {
  const results: any[] = [];
  let startingAfter: string | null = null;
  const MAX_PAGES = 100; // safety — 100 * 100 = 10.000 PI por conta

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      limit: "100",
      "created[gte]": String(tsInicio),
      "created[lte]": String(tsFim),
      "expand[]": "data.payment_method",
    });
    if (startingAfter) params.set("starting_after", startingAfter);
    const url = `https://api.stripe.com/v1/payment_intents?${params}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Stripe-Version": "2023-10-16",
    };
    const proxy = parseProxyUrl(proxyUrl || DEFAULT_PROXY);

    try {
      let resStatus: number;
      let resText: string;

      if (proxy) {
        const r = await proxyFetch(url, { method: "GET", headers }, proxy);
        resStatus = r.status;
        resText = r.text;
      } else {
        const res = await fetch(url, { headers });
        resStatus = res.status;
        resText = await res.text();
      }

      if (resStatus === 429) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (resStatus !== 200) {
        return { raw: results, error: `HTTP ${resStatus}: ${resText.slice(0, 200)}` };
      }

      const json = JSON.parse(resText) as { data: any[]; has_more: boolean };
      const boletos = json.data.filter((pi: any) =>
        Array.isArray(pi.payment_method_types)
          ? pi.payment_method_types.includes("boleto")
          : pi.payment_method?.type === "boleto"
      );
      results.push(...boletos);

      if (!json.has_more) break;
      startingAfter = json.data[json.data.length - 1]?.id ?? null;
      if (!startingAfter) break;
    } catch (e) {
      return { raw: results, error: String(e) };
    }
  }

  return { raw: results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normaliza um PaymentIntent raw da Stripe → TransacaoStripe parcial
// ─────────────────────────────────────────────────────────────────────────────

function normalizaPI(
  pi: any,
  contaId: string,
  contaNome: string,
): Omit<TransacaoStripe, "boleto_id" | "boleto_nome" | "boleto_crm" | "boleto_cpf"> {
  const pm = pi.payment_method;
  const cpf = (pm?.boleto?.tax_id ?? pm?.billing_details?.tax_id ?? null) as string | null;
  const nomePM = (pm?.billing_details?.name ?? null) as string | null;
  const vencTs = pi.next_action?.boleto_display_details?.expires_at
    ?? pi.next_action?.display_boleto_details?.expires_at ?? null;

  return {
    pi_id: pi.id as string,
    conta_id: contaId,
    conta_nome: contaNome,
    status: pi.status as string,
    valor: (pi.amount as number) / 100,
    descricao: (pi.description ?? null) as string | null,
    cpf: cpf ? cpf.replace(/\D/g, "").padStart(11, "0") : null,
    nome_stripe: nomePM,
    criado_em: new Date((pi.created as number) * 1000).toISOString(),
    vencimento: vencTs ? new Date(Number(vencTs) * 1000).toISOString() : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca TODAS as transações Stripe de boleto no período informado,
 * varrendo todas as contas ativas. Retorna lista flat + erros por conta.
 */
export const buscarTransacoesStripeHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dataInicio: z.string(), // YYYY-MM-DD
        dataFim: z.string(),    // YYYY-MM-DD
        accountIds: z.array(z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Converte datas para timestamps Unix (início do dia / fim do dia BRT = UTC-3)
    const tsInicio = Math.floor(new Date(data.dataInicio + "T00:00:00-03:00").getTime() / 1000);
    const tsFim = Math.floor(new Date(data.dataFim + "T23:59:59-03:00").getTime() / 1000);

    // Busca contas (todas ou apenas as selecionadas)
    let query = supabaseAdmin
      .from("stripe_accounts")
      .select("id, nome, token, proxy_url")
      .order("ordem", { ascending: true });

    if (data.accountIds && data.accountIds.length > 0) {
      query = query.in("id", data.accountIds);
    }

    const { data: contas } = await query;

    if (!contas || contas.length === 0) {
      return { transacoes: [], erros: [], total: 0, pagos: 0, pendentes: 0 };
    }

    const todasTransacoes: TransacaoStripe[] = [];
    const erros: { conta: string; erro: string }[] = [];

    // Processa 3 contas em paralelo para não bater rate limit
    const CONCURRENCY = 3;
    for (let i = 0; i < contas.length; i += CONCURRENCY) {
      const chunk = contas.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async (conta) => {
          const { raw, error } = await fetchAllPIsForAccount(conta.token, tsInicio, tsFim, conta.proxy_url);
          return { conta, raw, error };
        }),
      );
      for (const { conta, raw, error } of results) {
        if (error) erros.push({ conta: conta.nome, erro: error });
        for (const pi of raw) {
          todasTransacoes.push({
            ...normalizaPI(pi, conta.id, conta.nome),
            boleto_id: null,
            boleto_nome: null,
            boleto_crm: null,
            boleto_cpf: null,
          });
        }
      }
    }

    // Cruza com nossa tabela boletos_gerados pelo stripe_payment_intent_id
    if (todasTransacoes.length > 0) {
      const piIds = todasTransacoes.map((t) => t.pi_id);
      // Busca em lotes de 500 para não exceder limites do Supabase
      const BATCH = 500;
      const boletoMap = new Map<string, { id: string; nome: string; crm: string; cpf: string }>();
      for (let i = 0; i < piIds.length; i += BATCH) {
        const batchIds = piIds.slice(i, i + BATCH);
        const { data: rows } = await supabaseAdmin
          .from("boletos_gerados")
          .select("id, nome, crm, cpf, stripe_payment_intent_id")
          .in("stripe_payment_intent_id", batchIds);
        for (const row of rows ?? []) {
          if (row.stripe_payment_intent_id) {
            boletoMap.set(row.stripe_payment_intent_id, {
              id: row.id,
              nome: row.nome,
              crm: row.crm,
              cpf: row.cpf,
            });
          }
        }
      }
      for (const t of todasTransacoes) {
        const match = boletoMap.get(t.pi_id);
        if (match) {
          t.boleto_id = match.id;
          t.boleto_nome = match.nome;
          t.boleto_crm = match.crm;
          t.boleto_cpf = match.cpf;
          // Se não temos CPF do Stripe, usa o do nosso banco
          if (!t.cpf && match.cpf) t.cpf = match.cpf;
          if (!t.nome_stripe && match.nome) t.nome_stripe = match.nome;
        }
      }

      // Marca como pagos os boletos cujo PI já tem status "succeeded"
      // Aproveita os dados já buscados — sem nenhum GET extra por boleto
      const pagosIds = todasTransacoes
        .filter((t) => t.status === "succeeded" && t.boleto_id)
        .map((t) => t.boleto_id as string);

      if (pagosIds.length > 0) {
        const nowIso = new Date().toISOString();
        const BATCH_UPD = 100;
        for (let i = 0; i < pagosIds.length; i += BATCH_UPD) {
          await supabaseAdmin
            .from("boletos_gerados")
            .update({ pago: true, pago_em: nowIso })
            .in("id", pagosIds.slice(i, i + BATCH_UPD))
            .eq("pago", false);
        }
      }
    }

    // Ordena por data decrescente
    todasTransacoes.sort((a, b) => b.criado_em.localeCompare(a.criado_em));

    return {
      transacoes: todasTransacoes,
      erros,
      total: todasTransacoes.length,
      pagos: todasTransacoes.filter((t) => t.status === "succeeded").length,
      pendentes: todasTransacoes.filter((t) => t.status === "requires_action").length,
    };
  });

/**
 * Recebe lista de CPFs e verifica quais ainda têm débitos ativos no banco.
 * Retorna os débitos correspondentes para o usuário poder excluí-los.
 */
export const compararCPFsComDebitos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ cpfs: z.array(z.string()).min(1).max(5000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Normaliza CPFs (só dígitos, 11 chars)
    const cpfsNorm = [...new Set(data.cpfs.map((c) => c.replace(/\D/g, "").padStart(11, "0")))];

    const BATCH = 200;
    const todos: any[] = [];
    for (let i = 0; i < cpfsNorm.length; i += BATCH) {
      const batch = cpfsNorm.slice(i, i + BATCH);
      const { data: rows } = await supabaseAdmin
        .from("debitos")
        .select("id, nome, cpf, crm, status, debito_codigo, descricao, valor")
        .in("cpf", batch);
      todos.push(...(rows ?? []));
    }
    return { debitos: todos, total: todos.length };
  });

/**
 * Remove débitos por lista de IDs (usados após confirmação de que a pessoa pagou).
 */
export const removerDebitosQuePagaram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const BATCH = 200;
    let removidos = 0;
    for (let i = 0; i < data.ids.length; i += BATCH) {
      const batch = data.ids.slice(i, i + BATCH);
      const { error, count } = await supabaseAdmin
        .from("debitos")
        .delete({ count: "exact" })
        .in("id", batch);
      if (!error) removidos += count ?? 0;
    }
    return { ok: true, removidos };
  });
