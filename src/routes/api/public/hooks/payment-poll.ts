// Endpoint dedicado ao polling de status de pagamento dos boletos.
// SEPARADO do stripe-tick — não interfere na rotação de nomes.
//
// Como chamar: POST /api/public/hooks/payment-poll
// Autenticação: header X-Poll-Secret com o valor da env PAYMENT_POLL_SECRET
// (qualquer string aleatória que você define no Vercel/Supabase)
//
// Recomendado: pg_cron a cada 5 minutos, OU chamar manualmente pelo painel Admin.
//
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/payment-poll")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Proteção simples por secret — evita chamadas externas não autorizadas.
          // Defina PAYMENT_POLL_SECRET nas variáveis de ambiente do Vercel.
          // Se a env não estiver definida, qualquer chamada passa (dev sem configurar).
          const secret = process.env.PAYMENT_POLL_SECRET;
          if (secret) {
            const provided = request.headers.get("x-poll-secret");
            if (provided !== secret) {
              return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          const { pollAllPaymentStatuses } = await import(
            "@/lib/stripe-orchestrator.server"
          );
          const result = await pollAllPaymentStatuses();

          return new Response(
            JSON.stringify({ ok: true, ...result }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          console.error("payment-poll", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        return new Response(
          JSON.stringify({ ok: true, endpoint: "payment-poll", alive: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
