import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

    // ── Bloqueia se já existe boleto PAGO para esse débito ──
    const { data: pago } = await supabaseAdmin
      .from("boletos_gerados")
      .select("id, pago_em")
      .eq("cpf", cpf)
      .eq("crm", crm)
      .eq("debito_codigo", data.debito_codigo)
      .eq("pago", true)
      .limit(1)
      .maybeSingle();

    if (pago) {
      throw new Error("PAGO: Seu pagamento já foi recebido. Não é necessário emitir um novo boleto.");
    }

    // ── Reutiliza boleto existente se ainda não venceu e não foi pago ──
    const agora = new Date().toISOString();
    const { data: existente } = await supabaseAdmin
      .from("boletos_gerados")
      .select("id, linha_digitavel, vencimento, hosted_voucher_url, pdf_url")
      .eq("cpf", cpf)
      .eq("crm", crm)
      .eq("debito_codigo", data.debito_codigo)
      .eq("pago", false)
      .gt("vencimento", agora)
      .order("gerado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente) {
      return {
        id: existente.id,
        linha_digitavel: existente.linha_digitavel,
        vencimento: existente.vencimento,
        hosted_voucher_url: existente.hosted_voucher_url ?? null,
        pdf_url: existente.pdf_url ?? null,
      };
    }
    // ─────────────────────────────────────────────────────────────────

    const acq = await acquireAccountForBoleto();
    if (!acq.ok) {
      // Registra a tentativa frustrada para acompanhamento no admin
      await supabaseAdmin.from("solicitacoes_pendentes").insert({
        nome: data.nome,
        cpf,
        crm,
        debito_codigo: data.debito_codigo,
        descricao: data.descricao,
        valor: data.valor,
        ip,
        user_agent: ua,
      });
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
      proxyUrl: stripeAccount.proxy_url ?? null,
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

    // Marca solicitações pendentes deste CPF+débito como atendidas
    await supabaseAdmin
      .from("solicitacoes_pendentes")
      .update({ atendido: true, atendido_em: new Date().toISOString() })
      .eq("cpf", cpf)
      .eq("debito_codigo", data.debito_codigo)
      .eq("atendido", false);

    return {
      id: row.id,
      linha_digitavel: linha,
      vencimento: vencimentoIso,
      hosted_voucher_url: hostedVoucherUrl,
      pdf_url: pdfUrl,
    };
  });



export const listarSolicitacoesPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      apenasNaoAtendidos: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    let query = supabaseAdmin
      .from("solicitacoes_pendentes")
      .select("id, nome, cpf, crm, debito_codigo, descricao, valor, ip, criado_em, atendido, atendido_em")
      .order("criado_em", { ascending: false })
      .limit(500);
    if (data.apenasNaoAtendidos) {
      query = query.eq("atendido", false);
    }
    const { data: rows, error } = await query;
    if (error) {
      console.error("listarSolicitacoesPendentes", error);
      return { solicitacoes: [] };
    }
    return { solicitacoes: rows ?? [] };
  });

export const listarBoletosGerados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(10).max(200).default(50),
        search: z.string().max(200).default(""),
        filtro: z.enum(["todos", "pagos", "nao_pagos", "copiados"]).default("todos"),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { page, pageSize, search, filtro, dataInicio, dataFim } = data;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("boletos_gerados")
      .select(
        "id, nome, cpf, crm, debito_codigo, descricao, valor, linha_digitavel, stripe_account_id, ip, user_agent, gerado_em, copiado, copiado_em, vezes_copiado, stripe_payment_intent_id, hosted_voucher_url, pdf_url, vencimento",
        { count: "exact" },
      )
      .order("gerado_em", { ascending: false })
      .range(from, to);

    if (search.trim()) {
      const q = search.trim();
      const isNumeric = /^\d+$/.test(q);
      if (isNumeric) {
        query = query.or(`crm.eq.${q},cpf.eq.${q}`);
      } else {
        query = query.ilike("nome", `%${q}%`);
      }
    }

    if (filtro === "copiados") query = query.eq("copiado", true);

    if (dataInicio) query = query.gte("gerado_em", dataInicio);
    if (dataFim) query = query.lte("gerado_em", dataFim);

    const { data: rows, error, count } = await query;
    if (error) {
      console.error("listarBoletosGerados", error);
      return { boletos: [], total: 0 };
    }
    return { boletos: rows ?? [], total: count ?? 0 };
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
        lineOffset: z.number().int().min(0).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const lineOffset = data.lineOffset ?? 0;
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
    let skippedDebts = 0;

    lines.forEach((line, localIdx) => {
      const idx = localIdx + lineOffset;
      // Novo formato: NOME:CPF:CRM:STATUS:COD1:DESC1 | COD2:DESC2 | ...
      // Antigo formato: NOME:CPF:CRM:STATUS:COD:DESC (sem pipe)
      // Estratégia: separar a parte "header" (NOME:CPF:CRM:STATUS) dos segmentos de débito
      // Um segmento de débito é sempre CODDEBITO:DESCRICAO

      // Primeiro, verifica se há pipe para o novo formato multi-débito
      const hasPipe = line.includes(" | ");

      let headerStr: string;
      let debtSegments: string[];

      if (hasPipe) {
        // Exemplo: "NOME:CPF:CRM:STATUS:A26:ANUIDADE 2026 | M24:MULTA ELEITORAL 2024"
        // Split pelo primeiro segmento que é NOME:CPF:CRM:STATUS:COD:DESC e os demais por " | "
        const allSegments = line.split(" | ").map((s) => s.trim());
        // O primeiro segmento contém: NOME:CPF:CRM:STATUS:COD:DESC
        const firstParts = allSegments[0].split(":").map((p) => p.trim());
        if (firstParts.length < 6) {
          errors.push({ line: idx + 1, raw: line, reason: "Formato inválido no primeiro segmento (esperado Nome:CPF:CRM:STATUS:CODDEB:DESCRICAO)" });
          return;
        }
        // header = NOME:CPF:CRM:STATUS
        headerStr = firstParts.slice(0, 4).join(":");
        // primeiro débito vem no próprio primeiro segmento
        const firstDebtCod = firstParts[4];
        const firstDebtDesc = firstParts.slice(5).join(":");
        debtSegments = [`${firstDebtCod}:${firstDebtDesc}`];
        // demais débitos vêm dos outros segmentos
        for (let i = 1; i < allSegments.length; i++) {
          debtSegments.push(allSegments[i]);
        }
      } else {
        // Formato simples: NOME:CPF:CRM:STATUS:COD:DESC
        const parts = line.split(":").map((p) => p.trim());
        if (parts.length < 6) {
          errors.push({ line: idx + 1, raw: line, reason: "Formato inválido (esperado Nome:CPF:CRM:STATUS:CODDEB:DESCRICAO)" });
          return;
        }
        headerStr = parts.slice(0, 4).join(":");
        const debtCod = parts[4];
        const debtDesc = parts.slice(5).join(":");
        debtSegments = [`${debtCod}:${debtDesc}`];
      }

      // Parse do header
      const headerParts = headerStr.split(":").map((p) => p.trim());
      const [nome, cpfRaw, crmRaw, status] = headerParts;
      const cpf = onlyDigits(cpfRaw);
      const crm = onlyDigits(crmRaw);

      if (cpf.length !== 11) {
        errors.push({ line: idx + 1, raw: line, reason: "CPF inválido" });
        return;
      }
      if (!crm) {
        errors.push({ line: idx + 1, raw: line, reason: "CRM inválido" });
        return;
      }

      // Itera sobre os segmentos de débito — importa apenas A26 (anuidade)
      for (const seg of debtSegments) {
        const segParts = seg.split(":").map((p) => p.trim());
        if (segParts.length < 2) continue;
        const debito_codigo = segParts[0];
        const descricao = segParts.slice(1).join(":");

        // Ignora qualquer débito que não seja A26
        if (debito_codigo !== "A26") {
          skippedDebts++;
          continue;
        }

        valid.push({
          nome,
          cpf,
          crm,
          codigo: crm || null,
          status: status || "POSITIVO",
          debito_codigo,
          descricao,
          valor: 902.0,
        });
      }
      // Médicos sem débito A26 são silenciosamente ignorados (só têm multas, etc.)
    });

    if (valid.length === 0) {
      return { inserted: 0, skippedDebts, errors };
    }

    const { error } = await supabase
      .from("debitos")
      .upsert(valid, { onConflict: "cpf,crm,debito_codigo" });

    if (error) {
      console.error("bulkImportDebitos error", error);
      return { inserted: 0, skippedDebts, errors: [...errors, { line: 0, raw: "", reason: error.message }] };
    }

    return { inserted: valid.length, skippedDebts, errors };
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
      boletosPagosTotal,
      boletosPagosHoje,
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
      supabase.from("boletos_gerados").select("*", { count: "exact", head: true }).eq("pago", true),
      supabase.from("boletos_gerados").select("*", { count: "exact", head: true }).eq("pago", true).gte("pago_em", isoDay),
      supabase.from("stripe_accounts").select("*", { count: "exact", head: true }).eq("ativo", true),
      supabase.from("stripe_accounts").select("*", { count: "exact", head: true }),
      supabase.from("boletos_gerados").select("valor").gte("gerado_em", isoDay),
      supabase.from("boletos_gerados").select("id, nome, crm, valor, gerado_em, copiado, pago").order("gerado_em", { ascending: false }).limit(5),
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
      boletosPagosTotal: boletosPagosTotal.count ?? 0,
      boletosPagosHoje: boletosPagosHoje.count ?? 0,
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
        pago: boolean;
      }>,
      serie7d: dayBuckets,
    };
  });

export const listarDebitos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(10).max(200).default(50),
        search: z.string().max(200).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { page, pageSize, search } = data;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("debitos")
      .select("id, nome, cpf, crm, status, debito_codigo, descricao, valor", { count: "exact" })
      .order("nome", { ascending: true })
      .range(from, to);

    if (search.trim()) {
      // busca por nome (ilike) ou crm exato ou cpf exato
      const q = search.trim();
      const isNumeric = /^\d+$/.test(q);
      if (isNumeric) {
        // pode ser CRM ou CPF — usa or()
        query = query.or(`crm.eq.${q},cpf.eq.${q}`);
      } else {
        query = query.ilike("nome", `%${q}%`);
      }
    }

    const { data: rows, error, count } = await query;

    if (error) {
      console.error("listarDebitos", error);
      return { debitos: [], total: 0 };
    }
    return { debitos: rows ?? [], total: count ?? 0 };
  });

export const removerDebitos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("debitos")
      .delete()
      .in("id", data.ids);
    if (error) {
      console.error("removerDebitos", error);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

