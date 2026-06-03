// Cron tick: fecha janelas Stripe vencidas (reverte nome) e reseta contagem diária.
// Chamado a cada 1 min via pg_cron.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/stripe-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { tickOrchestrator } = await import(
            "@/lib/stripe-orchestrator.server"
          );
          const r = await tickOrchestrator();
          return new Response(
            JSON.stringify({ ok: true, closed: r.closed }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          console.error("stripe-tick", e);
          return new Response(
            JSON.stringify({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        return new Response(JSON.stringify({ ok: true, alive: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
