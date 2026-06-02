import logo from "@/assets/crm-mg-logo.png.asset.json";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <img src={logo.url} alt="CRM-MG" className="h-10 w-auto" width={120} height={40} />
          <div className="hidden h-6 w-px bg-border md:block" />
          <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground md:inline">
            Anuidade 2026
          </span>
        </div>
        <div className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a href="#planos" className="text-foreground/80 transition hover:text-crm-green">Planos</a>
          <a href="#beneficios" className="text-foreground/80 transition hover:text-crm-green">Benefícios</a>
          <a href="#duvidas" className="text-foreground/80 transition hover:text-crm-green">Dúvidas</a>
          <a
            href="#pagar"
            className="rounded-full bg-crm-green px-6 py-2.5 text-primary-foreground transition hover:bg-crm-green-dark"
          >
            Acessar Portal
          </a>
        </div>
      </div>
    </nav>
  );
}
