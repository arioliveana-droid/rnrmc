import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarStripeAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("stripe_accounts")
      .select(
        "id, nome, token, bearer_token, account_id, person_id, original_first_name, original_last_name, replacement_first_name, replacement_last_name, proxy_url, ordem, status, janela_iniciada_em, janela_termina_em, boletos_na_janela, boletos_no_dia, dia_referencia, cooldown_ate, nome_trocado, ultima_falha, ultima_acao_em, ativo, ultimo_uso_em, total_boletos, created_at",
      )
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("listarStripeAccounts", error);
      return { accounts: [] };
    }
    return { accounts: data ?? [] };
  });

export const adicionarStripeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        token: z.string().min(8).max(500),
        bearer_token: z.string().max(1000).optional().or(z.literal("")),
        account_id: z.string().max(200).optional().or(z.literal("")),
        person_id: z.string().max(200).optional().or(z.literal("")),
        original_first_name: z.string().max(120).optional().or(z.literal("")),
        original_last_name: z.string().max(120).optional().or(z.literal("")),
        replacement_first_name: z.string().max(120).optional().or(z.literal("")),
        replacement_last_name: z.string().max(120).optional().or(z.literal("")),
        proxy_url: z.string().max(500).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("stripe_accounts").insert({
      nome: data.nome,
      token: data.token,
      bearer_token: data.bearer_token || null,
      account_id: data.account_id || null,
      person_id: data.person_id || null,
      original_first_name: data.original_first_name || null,
      original_last_name: data.original_last_name || null,
      replacement_first_name: data.replacement_first_name || null,
      replacement_last_name: data.replacement_last_name || null,
      proxy_url: data.proxy_url || null,
      ativo: false,
    });
    if (error) {
      console.error("adicionarStripeAccount", error);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

export const atualizarTokenStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().min(1).max(120).optional(),
        token: z.string().min(8).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: {
      token: string;
      status: string;
      ultima_falha: string | null;
      nome?: string;
    } = {
      token: data.token,
      status: "active",
      ultima_falha: null,
    };
    if (data.nome) patch.nome = data.nome;
    const { error } = await supabase
      .from("stripe_accounts")
      .update(patch)
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const toggleStripeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("stripe_accounts")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) {
      console.error("toggleStripeAccount", error);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

export const removerStripeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("stripe_accounts")
      .delete()
      .eq("id", data.id);
    if (error) {
      console.error("removerStripeAccount", error);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

// Manual: troca nome para o substituto AGORA (chama Stripe).
export const trocarNomeAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { manualSwapToReplacement } = await import(
      "./stripe-orchestrator.server"
    );
    return manualSwapToReplacement(data.id);
  });

// Manual: reverte nome para o original AGORA (chama Stripe).
export const reverterNomeAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { manualRevertToOriginal } = await import(
      "./stripe-orchestrator.server"
    );
    return manualRevertToOriginal(data.id);
  });
