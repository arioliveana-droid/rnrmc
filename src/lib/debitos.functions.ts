import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cpf = onlyDigits(data.cpf);
    const crm = onlyDigits(data.crm);

    const { data: rows, error } = await supabaseAdmin
      .from("debitos")
      .select("nome, cpf, crm, codigo, status, debito_codigo, descricao, valor")
      .eq("cpf", cpf)
      .eq("crm", crm)
      .eq("debito_codigo", "A26")
      .limit(1);

    if (error) {
      console.error("lookupDebito error", error);
      return { found: false as const, error: "Erro ao consultar a base." };
    }

    const row = rows?.[0];
    if (!row) return { found: false as const, error: "Nenhum débito de anuidade 2026 encontrado para esse CRM e CPF." };
    if (row.status !== "POSITIVO") {
      return { found: false as const, error: "Anuidade 2026 já quitada ou sem débito em aberto." };
    }
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
      // Real format: NOME:CPF:CRM:STATUS:CODDEB:DESC -- but example has 6 segments
      // Example: NOME:CPF:CRM(105866):POSITIVO:A26:ANUIDADE 2026
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
        codigo: codigo,
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
