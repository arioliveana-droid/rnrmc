import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/crm/Navbar";
import { Hero } from "@/components/crm/Hero";
import { Plans } from "@/components/crm/Plans";
import { Benefits } from "@/components/crm/Benefits";
import { HowToPay } from "@/components/crm/HowToPay";
import { Faq } from "@/components/crm/Faq";
import { Footer } from "@/components/crm/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anuidade 2026 CRM-MG · Quite com até 15% de desconto" },
      {
        name: "description",
        content:
          "Campanha de pagamento da anuidade 2026 do CRM-MG. Quite à vista com 15% de desconto ou parcele em até 5x sem juros.",
      },
      { property: "og:title", content: "Anuidade 2026 CRM-MG" },
      {
        property: "og:description",
        content:
          "Garanta sua regularidade profissional em 2026. Descontos progressivos para pagamento antecipado.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&display=swap",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Plans />
        <Benefits />
        <HowToPay />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
