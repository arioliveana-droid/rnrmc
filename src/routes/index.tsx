import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/crm/Navbar";
import { BoletoForm } from "@/components/crm/BoletoForm";
import { Faq } from "@/components/crm/Faq";
import { Footer } from "@/components/crm/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Emitir boleto · Anuidade 2026 CRM-SP" },
      {
        name: "description",
        content:
          "Informe seu CRM e CPF para emitir o boleto da anuidade 2026 do CRM-SP.",
      },
      { property: "og:title", content: "Emitir boleto · Anuidade 2026 CRM-SP" },
      {
        property: "og:description",
        content:
          "Gere o boleto da sua anuidade 2026 do CRM-SP informando CRM e CPF.",
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
        <BoletoForm />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
