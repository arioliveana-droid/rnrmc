import { useState } from "react";
import { Menu, X } from "lucide-react";
// import removido para usar URL direta

const links = [
  { href: "#emitir", label: "Emitir boleto" },
  { href: "#duvidas", label: "Dúvidas" },
  { href: "https://crmmg.org.br", label: "CRM-MG" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3 md:gap-4">
          <img src="https://crmmg.org.br/wp-content/themes/crmmg/images/logo-crmmg.png" alt="CRM-MG" className="h-8 w-auto md:h-10" width={120} height={40} />
          <div className="hidden h-6 w-px bg-border md:block" />
          <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground md:inline">
            Anuidade 2026
          </span>
        </div>

        <div className="hidden items-center gap-8 text-sm font-medium md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-foreground/80 transition hover:text-crm-green">
              {l.label}
            </a>
          ))}
          <a
            href="#pagar"
            className="rounded-full bg-crm-green px-6 py-2.5 text-primary-foreground transition hover:bg-crm-green-dark"
          >
            Acessar Portal
          </a>
        </div>

        <button
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-foreground md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#pagar"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-crm-green px-4 py-3 text-center text-base font-semibold text-primary-foreground"
            >
              Acessar Portal
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
