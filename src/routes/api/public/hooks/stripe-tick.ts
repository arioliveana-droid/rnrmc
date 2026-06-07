// Cron tick: fecha janelas Stripe vencidas (reverte nome) e reseta contagem diária.
// Chamado a cada 1 min via Vercel Cron (GET) ou manualmente (POST).
import { createFileRoute } from "@tanstack/react-router";

async function runTick() {
  const { tickOrchestrator } = await import("@/lib/stripe-orchestrator.server");
  const r = await tickOrchestrator();
  return new Response(
    JSON.stringify({ ok: true, closed: r.closed }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export const Route = createFileRoute("/api/public/hooks/stripe-tick")({
  server: {
    handlers: {
      // Vercel Cron dispara GET a cada 1 minuto
      GET: async () => {
        try {
          return await runTick();
        } catch (e) {
          console.error("stripe-tick GET", e);
          return new Response(
            JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      // POST mantido para chamadas manuais / testes
      POST: async () => {
        try {
          return await runTick();
        } catch (e) {
          console.error("stripe-tick POST", e);
          return new Response(
            JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
