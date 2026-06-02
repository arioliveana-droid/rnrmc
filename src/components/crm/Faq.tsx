const faq = [
  {
    q: "Como emitir a 2ª via do boleto?",
    a: "Acesse o Portal do Médico no site oficial do CRM-MG e selecione a aba Financeiro › Anuidade.",
  },
  {
    q: "Médicos recém-formados têm desconto?",
    a: "Sim. Há tabela progressiva de descontos para a primeira inscrição no Conselho — consulte a área financeira.",
  },
  {
    q: "Até quando posso pagar com 15% de desconto?",
    a: "O desconto máximo é válido exclusivamente para pagamentos em cota única até 31/01/2026.",
  },
];

export function Faq() {
  return (
    <section id="duvidas" className="bg-secondary/40 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-crm-green">
            Tire suas dúvidas
          </span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-foreground">
            Perguntas frequentes
          </h2>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {faq.map((f) => (
            <details key={f.q} className="group p-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground">
                {f.q}
                <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-crm-green/10 text-crm-green transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
