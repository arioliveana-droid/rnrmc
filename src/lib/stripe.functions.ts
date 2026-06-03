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
      "id, nome, token, bearer_token, account_id, person_id, original_first_name, original_last_name, replacement_first_name, replacement_last_name, ativo, boletos_na_janela, janela_iniciada_em, ultimo_uso_em, total_boletos, created_at",
    )
    .order("created_at", { ascending: false });
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
        bearer_token: z.string().min(1).max(1000).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
  const { error } = await supabase.from("stripe_accounts").insert({
    nome: data.nome,
    token: data.token,
    bearer_token: data.bearer_token || null,
    ativo: false,
  });
    if (error) {
      console.error("adicionarStripeAccount", error);
      return { ok: false as const, error: error.message };
    }
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
