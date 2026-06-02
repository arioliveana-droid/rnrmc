import doctor from "@/assets/doctor-hero.jpg";

export function Hero() {
  return (
    <header className="relative overflow-hidden bg-background pt-16 pb-24">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-crm-green/10 blur-3xl" />
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-crm-green/10 px-4 py-1.5 text-sm font-semibold text-crm-green">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crm-green opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-crm-green" />
              </span>
              Campanha aberta · 2026
            </div>
            <h1 className="font-serif text-5xl font-semibold leading-[1.05] text-foreground lg:text-6xl">
              Compromisso com a <span className="text-crm-green">ética médica</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Garanta sua regularidade profissional no CRM-MG para o exercício de 2026.
              Aproveite descontos progressivos para pagamento à vista ou parcele em até 5 vezes sem juros.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="#pagar"
                className="rounded-lg bg-crm-red px-8 py-4 font-semibold text-primary-foreground shadow-elevated transition hover:-translate-y-0.5 hover:bg-crm-red-dark"
              >
                Emitir guia de pagamento
              </a>
              <a
                href="#planos"
                className="rounded-lg border border-border bg-card px-8 py-4 font-semibold text-foreground transition hover:bg-secondary"
              >
                Simular parcelamento
              </a>
            </div>

            <div className="mt-10 flex items-center gap-6 text-xs uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-crm-green" />
                Pix instantâneo
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-crm-green" />
                Boleto bancário
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-crm-green" />
                Cartão de crédito
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-crm-green/10 blur-3xl" />
            <img
              src={doctor}
              alt="Médica do CRM-MG"
              width={1024}
              height={1024}
              className="relative z-10 aspect-square w-full rounded-3xl object-cover shadow-elevated ring-1 ring-border"
            />
            <div className="absolute -bottom-6 -left-6 z-20 rounded-2xl bg-card p-6 shadow-card ring-1 ring-border">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Desconto máximo
              </div>
              <div className="mt-1 text-4xl font-bold text-crm-red">15% OFF</div>
              <div className="mt-1 text-xs text-muted-foreground">Pagamento até 31 de janeiro</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
