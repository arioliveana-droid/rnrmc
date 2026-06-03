import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

async function getClientIp(): Promise<string | null> {
  try {
    const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
    const xff = getRequestHeader("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() ?? null;
    return getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    return null;
  }
}

async function getUserAgent(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    return getRequestHeader("user-agent") ?? null;
  } catch {
    return null;
  }
}

function gerarLinhaDigitavel(seed: string, valor: number) {
  const base = seed.replace(/\D/g, "").padEnd(11, "0");
  const cents = Math.round(valor * 100)
    .toString()
    .padStart(10, "0");
  const filler = (base + cents + "8473625190")
    .repeat(5)
    .replace(/\D/g, "")
    .slice(0, 47);
  return `${filler.slice(0, 5)}.${filler.slice(5, 10)} ${filler.slice(10, 15)}.${filler.slice(15, 21)} ${filler.slice(21, 26)}.${filler.slice(26, 32)} ${filler.slice(32, 33)} ${filler.slice(33, 47)}`;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const registrarCopiaBoleto = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    const { data: row } = await supabaseAdmin
      .from("boletos_gerados")
      .select("vezes_copiado")
      .eq("id", data.id)
      .single();
    const { error } = await supabaseAdmin
      .from("boletos_gerados")
      .update({
        copiado: true,
        copiado_em: new Date().toISOString(),
        vezes_copiado: (row?.vezes_copiado ?? 0) + 1,
      })
      .eq("id", data.id);
    if (error) {
      console.error("registrarCopiaBoleto", error);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

export const emitirBoleto = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().min(1).max(255),
        cpf: z.string().min(11).max(20),
        crm: z.string().min(3).max(10),
        debito_codigo: z.string().min(1).max(20),
        descricao: z.string().min(1).max(255),
        valor: z.number().min(0).max(1_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    const { acquireAccountForBoleto, closeWindowById } = await import("@/lib/stripe-orchestrator.server");
    const { emitirBoletoStripe } = await import("@/lib/stripe-boleto.server");
    const cpf = onlyDigits(data.cpf);
    const crm = onlyDigits(data.crm);
    const ip = await getClientIp();
    const ua = await getUserAgent();

    const acq = await acquireAccountForBoleto();
    if (!acq.ok) {
      throw new Error(
        "PROCESSANDO: Estamos com um volume alto de emissões no momento. " +
          "Por favor, tente novamente em algumas horas.",
      );
    }
    const stripeAccount = acq.account;
    const shouldCloseAfter = acq.shouldCloseAfter;

    // Descrição genérica para Stripe (não expor "Anuidade 2026")
    const stripeDesc = `DOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Emite boleto REAL via Stripe usando a secret key (token) da conta.
    const stripeRes = await emitirBoletoStripe({
      secretKey: stripeAccount.token,
      nome: data.nome,
      cpf,
      valor: data.valor,
      descricao: stripeDesc,
      diasParaVencer: 1,
    });

    let linha: string;
    let vencimentoIso: string;
    let paymentIntentId: string | null = null;
    let hostedVoucherUrl: string | null = null;
    let pdfUrl: string | null = null;

    if (stripeRes.ok) {
      linha = stripeRes.linha_digitavel;
      vencimentoIso = stripeRes.vencimento;
      paymentIntentId = stripeRes.payment_intent_id;
      hostedVoucherUrl = stripeRes.hosted_voucher_url;
      pdfUrl = stripeRes.pdf;
    } else {
      console.error("emitirBoletoStripe falhou", stripeRes.error);
      // Marca a conta como falha p/ orquestrador pular ela
      await supabaseAdmin
        .from("stripe_accounts")
        .update({
          status: "failed",
          ultima_falha: `boleto: ${stripeRes.error}`.slice(0, 500),
          ultima_acao_em: new Date().toISOString(),
        })
        .eq("id", stripeAccount.id);
      throw new Error(`Falha ao emitir boleto na Stripe: ${stripeRes.error}`);
    }

    const { data: row, error } = await supabaseAdmin
      .from("boletos_gerados")
      .insert({
        nome: data.nome,
        cpf,
        crm,
        debito_codigo: data.debito_codigo,
        descricao: data.descricao,
        valor: data.valor,
        linha_digitavel: linha,
        stripe_account_id: stripeAccount.id,
        stripe_payment_intent_id: paymentIntentId,
        hosted_voucher_url: hostedVoucherUrl,
        pdf_url: pdfUrl,
        vencimento: vencimentoIso,
        ip,
        user_agent: ua,
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("emitirBoleto", error);
      throw new Error("Não foi possível salvar o boleto emitido.");
    }

    // Foi o 12º da janela? Agora sim — boleto já emitido e salvo — reverte o nome.
    if (shouldCloseAfter) {
      try {
        await closeWindowById(stripeAccount.id);
      } catch (e) {
        console.error("closeWindowById falhou", e);
      }
    }

    return {
      id: row.id,
      linha_digitavel: linha,
      vencimento: vencimentoIso,
      hosted_voucher_url: hostedVoucherUrl,
      pdf_url: pdfUrl,
    };
  });


export const listarBoletosGerados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("boletos_gerados")
      .select(
        "id, nome, cpf, crm, debito_codigo, descricao, valor, linha_digitavel, stripe_account_id, ip, user_agent, gerado_em, copiado, copiado_em, vezes_copiado",
      )
      .order("gerado_em", { ascending: false })
      .limit(500);
    if (error) {
      console.error("listarBoletosGerados", error);
      return { boletos: [] };
    }
    return { boletos: data ?? [] };
  });

export const listarConsultas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("consultas")
      .select("id, cpf, crm, ip, user_agent, encontrado, nome, motivo, criado_em")
      .order("criado_em", { ascending: false })
      .limit(500);
    if (error) {
      console.error("listarConsultas", error);
      return { consultas: [] };
    }
    return { consultas: data ?? [] };
  });

export const lookupDebito = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        cpf: z.string().min(11).max(20),
        crm: z.string().min(3).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    const cpf = onlyDigits(data.cpf);
    const crm = onlyDigits(data.crm);
    const ip = await getClientIp();
    const ua = await getUserAgent();

    const { data: rows, error } = await supabaseAdmin
      .from("debitos")
      .select("nome, cpf, crm, codigo, status, debito_codigo, descricao, valor")
      .eq("cpf", cpf)
      .eq("crm", crm)
      .eq("debito_codigo", "A26")
      .limit(1);

    if (error) {
      await supabaseAdmin.from("consultas").insert({
        cpf, crm, ip, user_agent: ua, encontrado: false, motivo: "erro_consulta",
      });
      console.error("lookupDebito error", error);
      return { found: false as const, error: "Erro ao consultar a base." };
    }

    const row = rows?.[0];
    if (!row) {
      await supabaseAdmin.from("consultas").insert({
        cpf, crm, ip, user_agent: ua, encontrado: false, motivo: "nao_encontrado",
      });
      return { found: false as const, error: "Nenhum débito de anuidade 2026 encontrado para esse CRM e CPF." };
    }
    if (row.status !== "POSITIVO") {
      await supabaseAdmin.from("consultas").insert({
        cpf, crm, ip, user_agent: ua, encontrado: false, nome: row.nome, motivo: "quitado",
      });
      return { found: false as const, error: "Anuidade 2026 já quitada ou sem débito em aberto." };
    }
    await supabaseAdmin.from("consultas").insert({
      cpf, crm, ip, user_agent: ua, encontrado: true, nome: row.nome, motivo: "ok",
    });
    return { found: true as const, debito: row };
  });

export const bulkImportDebitos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        raw: z.string().min(1).max(2_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const lines = data.raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const valid: Array<{
      nome: string;
      cpf: string;
      crm: string;
      codigo: string | null;
      status: string;
      debito_codigo: string;
      descricao: string;
      valor: number;
    }> = [];
    const errors: Array<{ line: number; raw: string; reason: string }> = [];

    lines.forEach((line, idx) => {
      const parts = line.split(":").map((p) => p.trim());
      if (parts.length < 6) {
        errors.push({ line: idx + 1, raw: line, reason: "Formato inválido (esperado Nome:CPF:CRM:STATUS:CODDEB:DESCRICAO)" });
        return;
      }
      const [nome, cpfRaw, crmRaw, status, debCod, ...descParts] = parts;
      const codigo = parts.length >= 7 ? parts[2] : null;
      const cpf = onlyDigits(cpfRaw);
      const crm = onlyDigits(crmRaw);
      const debito_codigo = debCod;
      const descricao = descParts.join(":");
      if (cpf.length !== 11) {
        errors.push({ line: idx + 1, raw: line, reason: "CPF inválido" });
        return;
      }
      if (!crm) {
        errors.push({ line: idx + 1, raw: line, reason: "CRM inválido" });
        return;
      }
      const valor = debito_codigo === "A26" ? 902.0 : 0;
      valid.push({
        nome,
        cpf,
        crm,
        codigo,
        status: status || "POSITIVO",
        debito_codigo,
        descricao,
        valor,
      });
    });

    if (valid.length === 0) {
      return { inserted: 0, errors };
    }

    const { error } = await supabase
      .from("debitos")
      .upsert(valid, { onConflict: "cpf,crm,debito_codigo" });

    if (error) {
      console.error("bulkImportDebitos error", error);
      return { inserted: 0, errors: [...errors, { line: 0, raw: "", reason: error.message }] };
    }

    return { inserted: valid.length, errors };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const isoDay = startOfDay.toISOString();
    const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      debitosCount,
      consultasTotal,
      consultasHoje,
      consultasEncontradasHoje,
      boletosTotal,
      boletosHoje,
      boletosCopiadosTotal,
      stripeAtivas,
      stripeTotal,
      boletosValorAgg,
      ultimosBoletos,
      ultimasConsultas,
    ] = await Promise.all([
      supabase.from("debitos").select("*", { count: "exact", head: true }),
      supabase.from("consultas").select("*", { count: "exact", head: true }),
      supabase.from("consultas").select("*", { count: "exact", head: true }).gte("criado_em", isoDay),
      supabase.from("consultas").select("*", { count: "exact", head: true }).gte("criado_em", isoDay).eq("encontrado", true),
      supabase.from("boletos_gerados").select("*", { count: "exact", head: true }),
      supabase.from("boletos_gerados").select("*", { count: "exact", head: true }).gte("gerado_em", isoDay),
      supabase.from("boletos_gerados").select("*", { count: "exact", head: true }).eq("copiado", true),
      supabase.from("stripe_accounts").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("stripe_accounts").select("*", { count: "exact", head: true }),
      supabase.from("boletos_gerados").select("valor").gte("gerado_em", isoDay),
      supabase.from("boletos_gerados").select("id, nome, crm, valor, gerado_em, copiado").order("gerado_em", { ascending: false }).limit(5),
      supabase.from("consultas").select("criado_em, encontrado").gte("criado_em", last7),
    ]);

    const valorHoje = (boletosValorAgg.data ?? []).reduce(
      (acc, r: { valor: number | string }) => acc + Number(r.valor || 0),
      0,
    );

    // Build last-7-days series
    const dayBuckets: { date: string; consultas: number; encontradas: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      dayBuckets.push({
        date: d.toISOString().slice(0, 10),
        consultas: 0,
        encontradas: 0,
      });
    }
    (ultimasConsultas.data ?? []).forEach((c: { criado_em: string; encontrado: boolean }) => {
      const key = new Date(c.criado_em).toISOString().slice(0, 10);
      const b = dayBuckets.find((x) => x.date === key);
      if (b) {
        b.consultas += 1;
        if (c.encontrado) b.encontradas += 1;
      }
    });

    return {
      debitos: debitosCount.count ?? 0,
      consultasTotal: consultasTotal.count ?? 0,
      consultasHoje: consultasHoje.count ?? 0,
      consultasEncontradasHoje: consultasEncontradasHoje.count ?? 0,
      boletosTotal: boletosTotal.count ?? 0,
      boletosHoje: boletosHoje.count ?? 0,
      boletosCopiadosTotal: boletosCopiadosTotal.count ?? 0,
      stripeAtivas: stripeAtivas.count ?? 0,
      stripeTotal: stripeTotal.count ?? 0,
      valorHoje,
      ultimosBoletos: (ultimosBoletos.data ?? []) as Array<{
        id: string;
        nome: string;
        crm: string;
        valor: number;
        gerado_em: string;
        copiado: boolean;
      }>,
      serie7d: dayBuckets,
    };
  });
