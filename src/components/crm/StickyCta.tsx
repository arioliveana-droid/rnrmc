export function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] backdrop-blur-md md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Anuidade 2026 · à vista
          </div>
          <div className="truncate font-serif text-lg font-semibold text-foreground">
            R$ 837,25 <span className="text-xs font-medium text-crm-green">−15%</span>
          </div>
        </div>
        <a
          href="#pagar"
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg bg-crm-red px-5 text-sm font-semibold text-primary-foreground"
        >
          Quitar agora
        </a>
      </div>
    </div>
  );
}
