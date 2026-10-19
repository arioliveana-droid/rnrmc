const items = [
  {
    title: "Certidão de regularidade",
    body: "Emissão imediata para credenciamento em convênios, plantões e hospitais.",
  },
  {
    title: "Defesa profissional",
    body: "Suporte institucional e orientação jurídica sobre normas e processos éticos.",
  },
  {
    title: "Educação médica continuada",
    body: "Acesso gratuito a eventos, cursos e biblioteca digital do CRM-ES.",
  },
  {
    title: "Fiscalização ética",
    body: "Atuação permanente para preservar a qualidade do exercício da medicina em MG.",
  },
];

export function Benefits() {
  return (
    <section id="beneficios" className="bg-crm-navy py-24 text-primary-foreground">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-crm-green">
              Por que manter sua regularidade
            </span>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight">
              Estar em dia com o Conselho garante o pleno{" "}
              <span className="text-crm-green">exercício profissional</span>.
            </h2>
            <p className="mt-6 max-w-md text-white/70">
              A anuidade é o investimento que sustenta a fiscalização ética, a defesa da medicina mineira e
              os serviços exclusivos oferecidos aos quase 45 mil médicos registrados no estado.
            </p>

            <div className="mt-12 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="font-serif text-4xl font-semibold text-crm-green">45k+</div>
                <div className="mt-2 text-xs uppercase tracking-widest text-white/60">
                  Médicos ativos em MG
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="font-serif text-4xl font-semibold text-crm-green">24/7</div>
                <div className="mt-2 text-xs uppercase tracking-widest text-white/60">
                  Serviços online
                </div>
              </div>
            </div>
          </div>

          <ul className="space-y-6">
            {items.map((it) => (
              <li
                key={it.title}
                className="flex items-start gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.06]"
              >
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-crm-green/20 text-crm-green">
                  ✓
                </div>
                <div>
                  <h4 className="font-serif text-lg font-semibold">{it.title}</h4>
                  <p className="mt-1 text-sm text-white/70">{it.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
