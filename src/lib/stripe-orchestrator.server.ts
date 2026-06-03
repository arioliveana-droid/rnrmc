// SERVER-ONLY. Do NOT import from client code.
// Orquestra a fila de contas Stripe, troca/reverte nomes via API e respeita
// limites de janela (20 min / 12 boletos) + cooldown 2h + corte diário 07:00 BRT.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const WINDOW_MINUTES = 20;
export const WINDOW_MAX_BOLETOS = 12;
export const DAILY_LIMIT = 12;
export const COOLDOWN_HOURS = 2;
export const BUSINESS_DAY_START_HOUR_BRT = 7; // 07:00 America/Sao_Paulo
const BRT_OFFSET_MIN = -180; // BRT = UTC-3 (sem horário de verão)

export type AccountStatus =
  | "idle"
  | "active"
  | "cooldown"
  | "daily_exhausted"
  | "failed";

export type StripeAccountRow = {
  id: string;
  nome: string;
  token: string;
  bearer_token: string | null;
  account_id: string | null;
  person_id: string | null;
  original_first_name: string | null;
  original_last_name: string | null;
  replacement_first_name: string | null;
  replacement_last_name: string | null;
  ativo: boolean;
  ordem: number;
  status: AccountStatus;
  janela_iniciada_em: string | null;
  janela_termina_em: string | null;
  boletos_na_janela: number;
  boletos_no_dia: number;
  dia_referencia: string | null;
  cooldown_ate: string | null;
  nome_trocado: boolean;
  ultima_falha: string | null;
  ultima_acao_em: string | null;
  total_boletos: number;
  ultimo_uso_em: string | null;
};

// Retorna a "data operacional" considerando corte 07:00 BRT.
// Se agora < 07:00 BRT, a data de referência é o dia anterior.
export function businessDay(now: Date = new Date()): string {
  const localMs = now.getTime() + (now.getTimezoneOffset() - BRT_OFFSET_MIN) * 60_000;
  const localBrt = new Date(localMs);
  if (localBrt.getUTCHours() < BUSINESS_DAY_START_HOUR_BRT) {
    localBrt.setUTCDate(localBrt.getUTCDate() - 1);
  }
  return localBrt.toISOString().slice(0, 10);
}

const SELECT_COLS =
  "id, nome, token, bearer_token, account_id, person_id, original_first_name, original_last_name, replacement_first_name, replacement_last_name, ativo, ordem, status, janela_iniciada_em, janela_termina_em, boletos_na_janela, boletos_no_dia, dia_referencia, cooldown_ate, nome_trocado, ultima_falha, ultima_acao_em, total_boletos, ultimo_uso_em";

function stripeHeaders(acc: StripeAccountRow): Record<string, string> {
  const accId = acc.account_id ?? "";
  return {
    Accept: "application/json",
    "Accept-Language": "pt-BR, pt, en-US, en",
    Authorization: `Bearer ${acc.bearer_token ?? ""}`,
    "Browser-Language": "pt-BR, pt, en-US, en",
    "Content-Type": "application/x-www-form-urlencoded",
    Referer: `https://dashboard.stripe.com/${accId}/settings/business-details`,
    "Stripe-Account": accId,
    "Stripe-Livemode": "true",
    "Stripe-Version":
      "2025-06-30.basil;updated_requirement_errors_beta=v1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "x-stripe-csrf-token": "fake-deprecated-token",
    "x-stripe-manage-client-revision":
      "dd394d032c32ea38f61a29e77cf00385dd9b2114",
  };
}

async function callStripeUpdatePerson(
  acc: StripeAccountRow,
  first: string,
  last: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!acc.bearer_token || !acc.account_id || !acc.person_id) {
    return { ok: false, error: "Conta sem bearer_token/account_id/person_id" };
  }
  const url = `https://dashboard.stripe.com/v1/accounts/${acc.account_id}/persons/${acc.person_id}`;
  const body = new URLSearchParams({ first_name: first, last_name: last }).toString();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: stripeHeaders(acc),
      body,
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Faz reset do contador diário em contas cuja dia_referencia ficou pra trás.
async function resetDailyIfNeeded(): Promise<void> {
  const today = businessDay();
  await supabaseAdmin
    .from("stripe_accounts")
    .update({
      boletos_no_dia: 0,
      dia_referencia: today,
      status: "idle",
      cooldown_ate: null,
      ultima_acao_em: new Date().toISOString(),
    })
    .or(`dia_referencia.is.null,dia_referencia.lt.${today}`)
    .eq("ativo", true)
    .in("status", ["daily_exhausted", "cooldown", "idle"]);
}

// Fecha (reverte) a janela ativa: chama Stripe pra voltar ao nome original.
async function closeWindow(acc: StripeAccountRow): Promise<void> {
  const now = new Date();
  let newStatus: AccountStatus = "cooldown";
  let nomeTrocado = acc.nome_trocado;
  let ultimaFalha: string | null = acc.ultima_falha;

  if (
    acc.nome_trocado &&
    acc.original_first_name &&
    acc.original_last_name &&
    acc.bearer_token &&
    acc.account_id &&
    acc.person_id
  ) {
    const r = await callStripeUpdatePerson(
      acc,
      acc.original_first_name,
      acc.original_last_name,
    );
    if (r.ok) {
      nomeTrocado = false;
    } else {
      ultimaFalha = `revert: ${r.error}`;
      newStatus = "failed";
    }
  } else {
    // sem dados pra reverter, segue pra cooldown
    nomeTrocado = false;
  }

  if (newStatus === "cooldown" && acc.boletos_no_dia >= DAILY_LIMIT) {
    newStatus = "daily_exhausted";
  }

  const cooldownAte =
    newStatus === "cooldown"
      ? new Date(now.getTime() + COOLDOWN_HOURS * 3600_000).toISOString()
      : null;

  await supabaseAdmin
    .from("stripe_accounts")
    .update({
      status: newStatus,
      nome_trocado: nomeTrocado,
      janela_iniciada_em: null,
      janela_termina_em: null,
      boletos_na_janela: 0,
      cooldown_ate: cooldownAte,
      ultima_falha: ultimaFalha,
      ultima_acao_em: now.toISOString(),
    })
    .eq("id", acc.id);
}

// Tick global: fecha janelas vencidas e zera contagem diária. Chamada pelo cron.
export async function tickOrchestrator(): Promise<{ closed: number }> {
  await resetDailyIfNeeded();
  const nowIso = new Date().toISOString();
  const { data: expired } = await supabaseAdmin
    .from("stripe_accounts")
    .select(SELECT_COLS)
    .eq("status", "active")
    .or(`janela_termina_em.lte.${nowIso},boletos_na_janela.gte.${WINDOW_MAX_BOLETOS}`);

  const list = (expired ?? []) as StripeAccountRow[];
  for (const acc of list) {
    await closeWindow(acc);
  }
  return { closed: list.length };
}

// Tenta abrir uma nova conta (chama Stripe pra trocar o nome).
async function openAccount(
  acc: StripeAccountRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !acc.replacement_first_name ||
    !acc.replacement_last_name ||
    !acc.original_first_name ||
    !acc.original_last_name
  ) {
    return { ok: false, error: "Faltam nomes original/substituto" };
  }
  if (!acc.bearer_token || !acc.account_id || !acc.person_id) {
    return { ok: false, error: "Faltam credenciais (bearer/account/person)" };
  }
  return callStripeUpdatePerson(
    acc,
    acc.replacement_first_name,
    acc.replacement_last_name,
  );
}

// Adquire uma conta para emitir 1 boleto. Pode disparar tick interno.
export async function acquireAccountForBoleto(): Promise<
  | { ok: true; account: StripeAccountRow }
  | { ok: false; reason: "no_accounts" | "all_busy"; detail?: string }
> {
  await tickOrchestrator();
  const today = businessDay();
  const nowIso = new Date().toISOString();

  // 1) Já tem alguma "active" com janela aberta?
  const { data: actives } = await supabaseAdmin
    .from("stripe_accounts")
    .select(SELECT_COLS)
    .eq("ativo", true)
    .eq("status", "active")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  const open = (actives ?? []).find((a) => {
    const ar = a as StripeAccountRow;
    if (!ar.janela_termina_em) return false;
    if (new Date(ar.janela_termina_em).getTime() <= Date.now()) return false;
    if ((ar.boletos_na_janela ?? 0) >= WINDOW_MAX_BOLETOS) return false;
    if ((ar.boletos_no_dia ?? 0) >= DAILY_LIMIT) return false;
    return true;
  }) as StripeAccountRow | undefined;

  if (open) {
    await supabaseAdmin
      .from("stripe_accounts")
      .update({
        boletos_na_janela: (open.boletos_na_janela ?? 0) + 1,
        boletos_no_dia: (open.boletos_no_dia ?? 0) + 1,
        total_boletos: (open.total_boletos ?? 0) + 1,
        ultimo_uso_em: nowIso,
        ultima_acao_em: nowIso,
      })
      .eq("id", open.id);
    return {
      ok: true,
      account: {
        ...open,
        boletos_na_janela: (open.boletos_na_janela ?? 0) + 1,
        boletos_no_dia: (open.boletos_no_dia ?? 0) + 1,
      },
    };
  }

  // 2) Pega próximas candidatas: ativas, status idle ou cooldown vencido,
  //    abaixo do limite diário, com credenciais completas.
  const { data: candidates } = await supabaseAdmin
    .from("stripe_accounts")
    .select(SELECT_COLS)
    .eq("ativo", true)
    .in("status", ["idle", "cooldown"])
    .lt("boletos_no_dia", DAILY_LIMIT)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  const list = ((candidates ?? []) as StripeAccountRow[]).filter((a) => {
    if (a.cooldown_ate && new Date(a.cooldown_ate).getTime() > Date.now()) return false;
    if (!a.bearer_token || !a.account_id || !a.person_id) return false;
    if (!a.original_first_name || !a.original_last_name) return false;
    if (!a.replacement_first_name || !a.replacement_last_name) return false;
    return true;
  });

  if (list.length === 0) {
    return { ok: false, reason: "no_accounts" };
  }

  let lastErr: string | undefined;
  for (const cand of list) {
    const opened = await openAccount(cand);
    if (!opened.ok) {
      lastErr = opened.error;
      await supabaseAdmin
        .from("stripe_accounts")
        .update({
          status: "failed",
          ultima_falha: `open: ${opened.error}`,
          ultima_acao_em: nowIso,
        })
        .eq("id", cand.id);
      continue;
    }
    const inicio = new Date();
    const fim = new Date(inicio.getTime() + WINDOW_MINUTES * 60_000);
    const updated = {
      status: "active" as const,
      nome_trocado: true,
      janela_iniciada_em: inicio.toISOString(),
      janela_termina_em: fim.toISOString(),
      boletos_na_janela: 1,
      boletos_no_dia: (cand.boletos_no_dia ?? 0) + 1,
      dia_referencia: today,
      cooldown_ate: null,
      ultima_falha: null,
      total_boletos: (cand.total_boletos ?? 0) + 1,
      ultimo_uso_em: nowIso,
      ultima_acao_em: nowIso,
    };
    await supabaseAdmin.from("stripe_accounts").update(updated).eq("id", cand.id);
    return { ok: true, account: { ...cand, ...updated } };
  }

  return { ok: false, reason: "all_busy", detail: lastErr };
}
