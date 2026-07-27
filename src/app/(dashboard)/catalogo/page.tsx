import { Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { prodottiMock } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

export default function CatalogoPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {prodottiMock.length} modelli censiti · margine stimato calcolato su prezzo medio acquisto/vendita.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {prodottiMock.map((p) => {
          const margine = p.prezzoMedioVendita - p.prezzoMedioAcquisto;
          const marginePct = (margine / p.prezzoMedioAcquisto) * 100;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Gamepad2 className="size-4" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="font-display text-[0.98rem] italic leading-tight text-foreground">
                      {p.nome}
                    </h3>
                    {p.piattaformaGioco && (
                      <p className="text-xs text-muted-foreground">{p.piattaformaGioco}</p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {p.categoria}
                </Badge>
              </div>

              {p.note && (
                <p className="text-xs italic text-muted-foreground">&ldquo;{p.note}&rdquo;</p>
              )}

              <div className="mt-1 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Acquisto medio</p>
                  <p className="font-mono-num font-medium text-foreground">
                    {formatCurrency(p.prezzoMedioAcquisto)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendita media</p>
                  <p className="font-mono-num font-medium text-foreground">
                    {formatCurrency(p.prezzoMedioVendita)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md bg-accent px-3 py-2">
                <span className="text-xs font-medium text-accent-foreground">Margine stimato</span>
                <span className="font-mono-num text-sm font-semibold text-accent-foreground">
                  {formatCurrency(margine)} ({marginePct.toFixed(0)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
