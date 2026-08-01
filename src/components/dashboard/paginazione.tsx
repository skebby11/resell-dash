import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

/**
 * Navigazione fra pagine basata su link e non su stato client: la pagina
 * corrente vive nell'URL, quindi è condivisibile, sopravvive al refresh e
 * funziona col tasto «indietro».
 */
export function Paginazione({
  pagina,
  perPagina,
  totale,
  hrefPagina,
  etichetta,
}: {
  pagina: number;
  perPagina: number;
  totale: number;
  /** Costruisce l'URL di una pagina preservando i filtri attivi. */
  hrefPagina: (pagina: number) => string;
  etichetta: string;
}) {
  const ultima = Math.max(1, Math.ceil(totale / perPagina));
  const da = totale === 0 ? 0 : (pagina - 1) * perPagina + 1;
  const a = Math.min(pagina * perPagina, totale);

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
      aria-label={`Paginazione ${etichetta}`}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {totale === 0 ? (
          <>Nessun risultato</>
        ) : (
          <>
            <span className="font-mono-num">
              {formatNumber(da)}–{formatNumber(a)}
            </span>{" "}
            di <span className="font-mono-num">{formatNumber(totale)}</span> {etichetta}
          </>
        )}
      </p>

      {ultima > 1 && (
        <div className="flex items-center gap-2">
          {pagina > 1 ? (
            <Button
              render={<Link href={hrefPagina(pagina - 1)} rel="prev" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="size-4" />
              Precedente
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="size-4" />
              Precedente
            </Button>
          )}

          <span className="px-1 text-xs text-muted-foreground">
            <span className="font-mono-num">{pagina}</span> /{" "}
            <span className="font-mono-num">{ultima}</span>
          </span>

          {pagina < ultima ? (
            <Button
              render={<Link href={hrefPagina(pagina + 1)} rel="next" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Successiva
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Successiva
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}
