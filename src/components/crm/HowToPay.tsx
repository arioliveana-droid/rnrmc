const steps = [
  {
    n: "01",
    title: "Acesse o Portal do Médico",
    body: "Entre em CREMERNp.org.br com seu CRM e senha de segurança.",
  },
  {
    n: "02",
    title: "Gere Pix ou boleto",
    body: "Escolha entre Pix instantâneo, boleto bancário ou cartão em até 5x.",
  },
  {
    n: "03",
    title: "Pronto, está em dia",
    body: "Seu status de regularidade é atualizado em até 24h após o pagamento.",
  },
];

export function HowToPay() {
  return (
    <section id="pagar" className="bg-background py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-crm-green">
            Procedimento
          </span>
          <h2 className="mt-3 font-serif text-4xl font-semibold text-foreground">
            Como realizar o pagamento da sua anuidade
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-3xl border border-border bg-card p-8 shadow-card transition hover:border-crm-green"
            >
              <div className="font-serif text-5xl font-semibold text-crm-green/30">{s.n}</div>
              <h4 className="mt-6 font-serif text-xl font-semibold text-foreground">{s.title}</h4>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl bg-crm-green-soft p-10 md:flex-row">
          <div>
            <h3 className="font-serif text-2xl font-semibold text-crm-green-dark">
              Pronto para garantir sua regularidade?
            </h3>
            <p className="mt-2 text-sm text-crm-green-dark/80">
              Quite agora e aproveite o desconto máximo de 15%.
            </p>
          </div>
          <a
            href="https://CREMERNp.org.br"
            className="rounded-lg bg-crm-green px-8 py-4 font-semibold text-primary-foreground shadow-elevated transition hover:-translate-y-0.5 hover:bg-crm-green-dark"
          >
            Quitar anuidade 2026
          </a>
        </div>
      </div>
    </section>
  );
}
