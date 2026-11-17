import doctor from "@/assets/doctor-hero.jpg";

export function Hero() {
  return (
    <header className="relative overflow-hidden bg-background pt-10 pb-20 md:pt-16 md:pb-24">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-crm-green/10 blur-3xl" />
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="z-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-crm-green/10 px-3 py-1.5 text-xs font-semibold text-crm-green md:text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crm-green opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-crm-green" />
              </span>
              Campanha aberta · 2026
            </div>
            <h1 className="font-serif text-[2.25rem] font-semibold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
              Compromisso com a <span className="text-crm-green">ética médica</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:mt-6 md:text-lg">
              Garanta sua regularidade profissional no CRM-RN para 2026. Pague à vista com até 15% de
              desconto ou parcele em até 5x sem juros.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <a
                href="#pagar"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-crm-green px-6 py-3 text-base font-semibold text-primary-foreground shadow-elevated transition hover:-translate-y-0.5 hover:bg-crm-green-dark md:px-8 md:py-4"
              >
                Emitir guia de pagamento
              </a>
              <a
                href="#planos"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold text-foreground transition hover:bg-secondary md:px-8 md:py-4"
              >
                Simular parcelamento
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-widest text-muted-foreground md:text-xs">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-crm-green" /> Pix instantâneo
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-crm-green" /> Boleto
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-crm-green" /> Cartão até 5x
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-crm-green/10 blur-3xl md:-right-20 md:-top-20 md:h-64 md:w-64" />
            <img
              src={doctor}
              alt="Médica do CRM-RN"
              width={1024}
              height={1024}
              className="relative z-10 aspect-square w-full rounded-2xl object-cover shadow-elevated ring-1 ring-border md:rounded-3xl"
            />
            <div className="absolute -bottom-4 left-4 z-20 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border md:-bottom-6 md:-left-6 md:p-6">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:text-xs">
                Desconto máximo
              </div>
              <div className="mt-1 text-3xl font-bold text-crm-green md:text-4xl">15% OFF</div>
              <div className="mt-1 text-[11px] text-muted-foreground md:text-xs">
                Até 31 de janeiro
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
