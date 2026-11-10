// import removido para usar URL direta

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
          <div className="max-w-sm">
            <img src="/crm-sp-logo.png" alt="CREMESP" className="h-10 w-auto" width={120} height={40} />
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
                <li className="text-foreground/80">(11) 4349-9900</li>
                <li className="text-foreground/80">cremesp.org.br</li>
                <li><a href="#" className="text-foreground/80 hover:text-crm-green">Ouvidoria</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-16 border-t border-border pt-10 text-center">
          <p className="text-xs font-semibold tracking-wide whitespace-nowrap text-foreground">
            Conselho Regional de Medicina do Estado de São Paulo
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Rua Frei Caneca, 1282 – Consolação, São Paulo/SP
          </p>
        </div>
      </div>
    </footer>
  );
}
