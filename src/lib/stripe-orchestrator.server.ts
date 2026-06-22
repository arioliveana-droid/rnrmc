// SERVER-ONLY. Do NOT import from client code.
// Orquestra a fila de contas Stripe, troca/reverte nomes via API e respeita
// limites de janela (20 min / 12 boletos) + cooldown 2h + corte diário 07:00 BRT.
// Limite de 2 trocas de nome por dia por conta.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseProxyUrl, proxyFetch } from "./proxy-fetch.server";

export const WINDOW_MINUTES = 20;
export const WINDOW_MAX_BOLETOS = 12;
export const DAILY_LIMIT = 12;
export const COOLDOWN_HOURS = 2;
export const DAILY_SWAP_LIMIT = 2; // máx de trocas de nome por dia por conta
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
  proxy_url: string | null;
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
  trocas_no_dia: number;
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
  "id, nome, token, bearer_token, account_id, person_id, original_first_name, original_last_name, replacement_first_name, replacement_last_name, proxy_url, ativo, ordem, status, janela_iniciada_em, janela_termina_em, boletos_na_janela, boletos_no_dia, dia_referencia, cooldown_ate, nome_trocado, ultima_falha, ultima_acao_em, total_boletos, ultimo_uso_em, trocas_no_dia, limite_boletos_diario, limite_trocas_diario";

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
  const headers = stripeHeaders(acc);
  const DEFAULT_PROXY = "http://smart-cadunico_area-BR:Trampo23@proxy.smartproxy.net:3120";
  const proxy = parseProxyUrl(acc.proxy_url || DEFAULT_PROXY);
  const MAX_ATTEMPTS = 3;
  const errors: string[] = [];
  if (proxy) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const r = await proxyFetch(url, { method: "POST", headers, body }, proxy);
        if (r.status >= 200 && r.status < 300) return { ok: true };
        errors.push(`tentativa ${attempt}: HTTP ${r.status} (proxy): ${r.text.slice(0, 200)}`);
        // Não tenta de novo se a Stripe respondeu erro de cliente (4xx exceto 408/429)
        if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) break;
      } catch (e) {
        errors.push(`tentativa ${attempt}: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (attempt < MAX_ATTEMPTS) await new Promise((res) => setTimeout(res, 500 * attempt));
    }
    // Fallback final: tenta direto sem proxy
    try {
      const res = await fetch(url, { method: "POST", headers, body });
      if (res.ok) return { ok: true };
      const txt = await res.text();
      errors.push(`fallback direto: HTTP ${res.status}: ${txt.slice(0, 200)}`);
    } catch (e) {
      errors.push(`fallback direto: ${e instanceof Error ? e.message : String(e)}`);
    }
    return { ok: false, error: errors.join(" | ") };
  }
  try {
    const res = await fetch(url, { method: "POST", headers, body });
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
      trocas_no_dia: 0,
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
// Lock atômico (active -> closing) evita reverts duplicados quando vários
// ticks rodam em paralelo (cron + acquireAccountForBoleto + UI).
async function closeWindow(acc: StripeAccountRow): Promise<void> {
  const now = new Date();

  const { data: locked } = await supabaseAdmin
    .from("stripe_accounts")
    .update({ status: "closing", ultima_acao_em: now.toISOString() })
    .eq("id", acc.id)
    .eq("status", "active")
    .select(SELECT_COLS)
    .maybeSingle();

  if (!locked) return; // outro tick já está fechando essa conta
  const a = locked as StripeAccountRow;

  let newStatus: AccountStatus = "cooldown";
  let nomeTrocado = a.nome_trocado;
  let ultimaFalha: string | null = a.ultima_falha;
  // Incrementa o contador de trocas apenas se o nome estava trocado
  const novasTrocas = a.nome_trocado ? (a.trocas_no_dia ?? 0) + 1 : (a.trocas_no_dia ?? 0);

  if (
    a.nome_trocado &&
    a.original_first_name &&
    a.original_last_name &&
    a.bearer_token &&
    a.account_id &&
    a.person_id
  ) {
    const r = await callStripeUpdatePerson(
      a,
      a.original_first_name,
      a.original_last_name,
    );
    if (r.ok) {
      nomeTrocado = false;
    } else {
      ultimaFalha = `revert: ${r.error}`;
      newStatus = "failed";
    }
  } else {
    nomeTrocado = false;
  }

  const limitBoletos = (a as any).limite_boletos_diario ?? DAILY_LIMIT;
  const limitTrocas = (a as any).limite_trocas_diario ?? DAILY_SWAP_LIMIT;

  // Esgotada se: atingiu limite diário de boletos OU atingiu limite de trocas de nome
  if (newStatus === "cooldown" && (a.boletos_no_dia >= limitBoletos || novasTrocas >= limitTrocas)) {
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
      trocas_no_dia: novasTrocas,
      ultima_falha: ultimaFalha,
      ultima_acao_em: now.toISOString(),
    })
    .eq("id", a.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Polling de status de pagamento — SEPARADO do tick de rotação de nomes.
// Exportado para ser chamado por um endpoint/cron dedicado, independente.
// ─────────────────────────────────────────────────────────────────────────────

async function pollPaymentStatusForAccount(acc: StripeAccountRow): Promise<number> {
  // 1. Pega os boletos pendentes desta conta no nosso banco
  const { data: pendentes } = await supabaseAdmin
    .from("boletos_gerados")
    .select("id, stripe_payment_intent_id")
    .eq("stripe_account_id", acc.id)
    .eq("pago", false)
    .not("stripe_payment_intent_id", "is", null)
    .limit(100);

  if (!pendentes || pendentes.length === 0) return 0;

  // Monta set de PI IDs que queremos checar
  const pendingPiIds = new Map<string, string>(
    pendentes.map((b) => [b.stripe_payment_intent_id as string, b.id]),
  );

  const DEFAULT_PROXY = "http://smart-cadunico_area-BR:Trampo23@proxy.smartproxy.net:3120";
  const proxy = parseProxyUrl(acc.proxy_url || DEFAULT_PROXY);
  const headers = {
    Authorization: `Bearer ${acc.token}`,
    "Stripe-Version": "2023-10-16",
  };

  // 2. Busca lista bulk de payment_intents (1 chamada por página, máx 10 páginas)
  //    e filtra localmente pelos nossos PI IDs — sem GET individual por boleto
  const succeededBoletoIds: string[] = [];
  let startingAfter: string | null = null;
  const MAX_PAGES = 10;

  for (let page = 0; page < MAX_PAGES && pendingPiIds.size > 0; page++) {
    const params = new URLSearchParams({ limit: "100" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const url = `https://api.stripe.com/v1/payment_intents?${params}`;

    try {
      let listJson: { data: any[]; has_more: boolean } | null = null;
      if (proxy) {
        const r = await proxyFetch(url, { method: "GET", headers }, proxy);
        if (r.status === 200) listJson = JSON.parse(r.text);
      } else {
        const res = await fetch(url, { headers });
        if (res.ok) listJson = await res.json();
      }
      if (!listJson) break;

      for (const pi of listJson.data) {
        const boletoId = pendingPiIds.get(pi.id);
        if (boletoId && pi.status === "succeeded") {
          succeededBoletoIds.push(boletoId);
          pendingPiIds.delete(pi.id); // já encontrou, remove do set
        }
      }

      if (!listJson.has_more) break;
      startingAfter = listJson.data[listJson.data.length - 1]?.id ?? null;
      if (!startingAfter) break;
    } catch {
      break;
    }
  }

  if (succeededBoletoIds.length === 0) return 0;

  // 3. Atualiza em batch no banco — 1 query só
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("boletos_gerados")
    .update({ pago: true, pago_em: nowIso })
    .in("id", succeededBoletoIds)
    .eq("pago", false);

  return error ? 0 : succeededBoletoIds.length;
}

export async function pollAllPaymentStatuses(): Promise<{ pagos: number; contas: number }> {
  const { data: contas } = await supabaseAdmin
    .from("stripe_accounts")
    .select(SELECT_COLS)
    .gt("total_boletos", 0);

  if (!contas || contas.length === 0) return { pagos: 0, contas: 0 };

  let totalPagos = 0;
  const CONCURRENCY = 3;
  const chunks: StripeAccountRow[][] = [];
  for (let i = 0; i < contas.length; i += CONCURRENCY) {
    chunks.push((contas as StripeAccountRow[]).slice(i, i + CONCURRENCY));
  }
  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map(pollPaymentStatusForAccount));
    totalPagos += results.reduce((a, b) => a + b, 0);
  }

  return { pagos: totalPagos, contas: contas.length };
}

// ─────────────────────────────────────────────────────────────────────────────

// Tick global: fecha janelas vencidas e zera contagem diária.
// Chamado pelo pg_cron a cada 1 minuto. Responsabilidade única: rotação de nomes.
// O polling de pagamentos é feito por um endpoint separado (/api/public/hooks/payment-poll).
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
// Retorna `shouldCloseAfter=true` quando este boleto fechou a janela (12º) —
// o caller DEVE chamar `closeWindowById(account.id)` SÓ depois de emitir
// com sucesso, pra não reverter o nome antes da emissão.
export async function acquireAccountForBoleto(): Promise<
  | { ok: true; account: StripeAccountRow; shouldCloseAfter: boolean }
  | { ok: false; reason: "no_accounts" | "all_busy"; detail?: string }
> {
  await tickOrchestrator();
  const today = businessDay();
  const nowIso = new Date().toISOString();

  // 1) Tenta reservar slot em alguma "active" com janela aberta.
  // Loop curto pra lidar com race entre emissões concorrentes.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: actives } = await supabaseAdmin
      .from("stripe_accounts")
      .select(SELECT_COLS)
      .eq("ativo", true)
      .eq("status", "active")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });

    const open = (actives ?? []).find((a) => {
      const ar = a as StripeAccountRow & { limite_boletos_diario?: number; limite_trocas_diario?: number };
      if (!ar.janela_termina_em) return false;
      if (new Date(ar.janela_termina_em).getTime() <= Date.now()) return false;
      if ((ar.boletos_na_janela ?? 0) >= WINDOW_MAX_BOLETOS) return false;
      
      const limitBoletos = ar.limite_boletos_diario ?? DAILY_LIMIT;
      if ((ar.boletos_no_dia ?? 0) >= limitBoletos) return false;
      
      return true;
    }) as StripeAccountRow | undefined;

    if (!open) break; // sem contas ativas com slot — segue pra abrir nova

    const novoJanela = (open.boletos_na_janela ?? 0) + 1;
    const novoDia = (open.boletos_no_dia ?? 0) + 1;

    // Optimistic lock: só incrementa se o contador ainda estiver no valor lido
    // E ainda houver espaço. Se outra emissão ganhou a corrida, retorna 0 linhas.
    const { data: claimed } = await supabaseAdmin
      .from("stripe_accounts")
      .update({
        boletos_na_janela: novoJanela,
        boletos_no_dia: novoDia,
        total_boletos: (open.total_boletos ?? 0) + 1,
        ultimo_uso_em: nowIso,
        ultima_acao_em: nowIso,
      })
      .eq("id", open.id)
      .eq("status", "active")
      .eq("boletos_na_janela", open.boletos_na_janela ?? 0)
      .lt("boletos_na_janela", WINDOW_MAX_BOLETOS)
      .select(SELECT_COLS)
      .maybeSingle();

    if (!claimed) {
      // Outra emissão pegou o slot — re-tenta do zero.
      continue;
    }

    const acc = claimed as StripeAccountRow;
    return {
      ok: true,
      account: acc,
      // Sinaliza pro caller fechar a janela DEPOIS de emitir o 12º boleto.
      shouldCloseAfter: novoJanela >= WINDOW_MAX_BOLETOS,
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

  const list = ((candidates ?? []) as any[]).filter((a) => {
    if (a.cooldown_ate && new Date(a.cooldown_ate).getTime() > Date.now()) return false;
    
    const limitTrocas = a.limite_trocas_diario ?? DAILY_SWAP_LIMIT;
    if ((a.trocas_no_dia ?? 0) >= limitTrocas) return false; // atingiu limite de trocas no dia
    
    const limitBoletos = a.limite_boletos_diario ?? DAILY_LIMIT;
    if ((a.boletos_no_dia ?? 0) >= limitBoletos) return false;

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
    return { ok: true, account: { ...cand, ...updated }, shouldCloseAfter: false };
  }

  return { ok: false, reason: "all_busy", detail: lastErr };
}

// Fecha a janela de uma conta específica pelo id. Usado pelo caller após
// emitir com sucesso o boleto que bateu o limite (12º).
export async function closeWindowById(id: string): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from("stripe_accounts")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (!row) return;
  await closeWindow(row as StripeAccountRow);
}

// Manual: força troca para o nome substituto (sem mexer em janelas/contadores).
export async function manualSwapToReplacement(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row } = await supabaseAdmin
    .from("stripe_accounts")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  const acc = row as StripeAccountRow | null;
  if (!acc) return { ok: false, error: "Conta não encontrada" };
  if (!acc.replacement_first_name || !acc.replacement_last_name) {
    return { ok: false, error: "Faltam nomes substitutos" };
  }
  const r = await callStripeUpdatePerson(
    acc,
    acc.replacement_first_name,
    acc.replacement_last_name,
  );
  const nowIso = new Date().toISOString();
  if (!r.ok) {
    await supabaseAdmin
      .from("stripe_accounts")
      .update({
        ultima_falha: `manual-swap: ${r.error}`,
        ultima_acao_em: nowIso,
      })
      .eq("id", id);
    return r;
  }
  await supabaseAdmin
    .from("stripe_accounts")
    .update({
      nome_trocado: true,
      ultima_falha: null,
      ultima_acao_em: nowIso,
    })
    .eq("id", id);
  return { ok: true };
}

// Manual: força reversão para o nome original (sem mexer em janelas/contadores).
export async function manualRevertToOriginal(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row } = await supabaseAdmin
    .from("stripe_accounts")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  const acc = row as StripeAccountRow | null;
  if (!acc) return { ok: false, error: "Conta não encontrada" };
  if (!acc.original_first_name || !acc.original_last_name) {
    return { ok: false, error: "Faltam nomes originais" };
  }
  const r = await callStripeUpdatePerson(
    acc,
    acc.original_first_name,
    acc.original_last_name,
  );
  const nowIso = new Date().toISOString();
  if (!r.ok) {
    await supabaseAdmin
      .from("stripe_accounts")
      .update({
        ultima_falha: `manual-revert: ${r.error}`,
        ultima_acao_em: nowIso,
      })
      .eq("id", id);
    return r;
  }
  await supabaseAdmin
    .from("stripe_accounts")
    .update({
      nome_trocado: false,
      ultima_falha: null,
      ultima_acao_em: nowIso,
    })
    .eq("id", id);
  return { ok: true };
}
