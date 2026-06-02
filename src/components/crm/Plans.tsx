const plans = [
  {
    title: "Cota Única — Janeiro",
    description: "Pagamento integral com o maior benefício da campanha.",
    highlight: "15%",
    highlightLabel: "de desconto",
    due: "Vence em 31/01/2026",
    value: "R$ 837,25",
    accent: "green" as const,
    cta: "Pagar à vista",
  },
  {
    title: "Cota Única — Fevereiro",
    description: "Quitação integral com desconto intermediário.",
    highlight: "10%",
    highlightLabel: "de desconto",
    due: "Vence em 28/02/2026",
    value: "R$ 886,50",
    accent: "navy" as const,
    cta: "Pagar em fevereiro",
  },
  {
    title: "Parcelamento",
    description: "Divida o valor integral em parcelas mensais sem juros.",
    highlight: "5x",
    highlightLabel: "sem juros",
    due: "Primeira parcela em 31/01/2026",
    value: "5x R$ 197,00",
    accent: "red" as const,
    cta: "Parcelar pagamento",
  },
];

export function Plans() {
  return (
    <section id="planos" className="bg-secondary/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-crm-green">
            Anuidade 2026
          </span>
          <h2 className="mt-3 font-serif text-4xl font-semibold text-foreground">
            Escolha a melhor opção para você
          </h2>
          <p className="mt-4 text-muted-foreground">
            Prazos e condições vigentes para a anuidade de 2026 · Valor de referência R$ 985,00
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.title}
              className="group relative flex flex-col rounded-3xl bg-card p-8 shadow-card ring-1 ring-border transition hover:-translate-y-1 hover:shadow-elevated"
            >
              <div
                className={
                  p.accent === "green"
                    ? "mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-crm-green/10 font-bold text-crm-green"
                    : p.accent === "red"
                      ? "mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-crm-red/10 font-bold text-crm-red"
                      : "mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-crm-navy/10 font-bold text-crm-navy"
                }
              >
                R$
              </div>
              <h3 className="font-serif text-xl font-semibold text-foreground">{p.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>

              <div className="mt-8 flex items-baseline gap-2">
                <span
                  className={
                    p.accent === "red"
                      ? "text-5xl font-bold text-crm-red"
                      : p.accent === "navy"
                        ? "text-5xl font-bold text-crm-navy"
                        : "text-5xl font-bold text-crm-green"
                  }
                >
                  {p.highlight}
                </span>
                <span className="text-sm text-muted-foreground">{p.highlightLabel}</span>
              </div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-crm-red">
                {p.due}
              </div>

              <div className="mt-6 rounded-xl border border-dashed border-border bg-secondary/60 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold text-foreground">{p.value}</span>
              </div>

              <button className="mt-8 w-full rounded-xl bg-secondary py-3 font-semibold text-foreground transition group-hover:bg-crm-green group-hover:text-primary-foreground">
                {p.cta}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
