import logo from "@/assets/crm-mg-logo.png.asset.json";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
          <div className="max-w-sm">
            <img src={logo.url} alt="CRM-MG" className="h-10 w-auto" width={120} height={40} />
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Conselho Regional de Medicina de Minas Gerais. Rua dos Timbiras, 1200 — Funcionários, Belo Horizonte/MG.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-12 sm:grid-cols-3">
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Institucional
              </h5>
              <ul className="mt-4 space-y-2 text-sm">
                <li><a href="#" className="text-foreground/80 hover:text-crm-green">O Conselho</a></li>
                <li><a href="#" className="text-foreground/80 hover:text-crm-green">Legislação</a></li>
                <li><a href="#" className="text-foreground/80 hover:text-crm-green">Transparência</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Atendimento
              </h5>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="text-foreground/80">(31) 3248-7700</li>
                <li className="text-foreground/80">anuidade@crmmg.org.br</li>
                <li><a href="#" className="text-foreground/80 hover:text-crm-green">Ouvidoria</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>© 2026 CRM-MG · Todos os direitos reservados.</span>
          <span className="uppercase tracking-widest">Campanha Anuidade 2026</span>
        </div>
      </div>
    </footer>
  );
}
