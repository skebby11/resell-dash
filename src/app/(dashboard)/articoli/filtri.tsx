import Link from "next/link";
import { AlertTriangle, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { STATI_ARTICOLO, type StatoArticolo } from "@/types";

const ETICHETTE: Record<StatoArticolo, string> = {
  acquistato: "Acquistati",
  "in vendita": "In vendita",
  venduto: "Venduti",
  consegnato: "Consegnati",
};

/**
 * Filtri come link e form GET, senza stato client: il filtro attivo sta
 * nell'URL, quindi la pagina è condivisibile e i risultati arrivano già filtrati
 * dal database invece di essere setacciati nel browser.
 */
export function Filtri({
  stato,
  q,
  senzaPaese,
  archivio,
}: {
  stato?: StatoArticolo;
  q?: string;
  /** Filtro attivo da /vendite-ue: isola le vendite senza paese noto. */
  senzaPaese?: boolean;
  /** Vista archivio: `?archivio=1`. */
  archivio?: boolean;
}) {
  function href(nuovoStato?: StatoArticolo) {
    const params = new URLSearchParams();
    if (nuovoStato) params.set("stato", nuovoStato);
    if (q) params.set("q", q);
    if (senzaPaese) params.set("paese", "mancante");
    if (archivio) params.set("archivio", "1");
    const qs = params.toString();
    return qs ? `/articoli?${qs}` : "/articoli";
  }

  const hrefTutti = (() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (senzaPaese) params.set("paese", "mancante");
    const qs = params.toString();
    return qs ? `/articoli?${qs}` : "/articoli";
  })();

  const hrefArchivio = (() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (senzaPaese) params.set("paese", "mancante");
    params.set("archivio", "1");
    return `/articoli?${params.toString()}`;
  })();

  const voci: { chiave: string; label: string; attivo: boolean; url: string }[] = [
    { chiave: "tutti", label: "Tutti", attivo: !stato && !senzaPaese && !archivio, url: hrefTutti },
    ...STATI_ARTICOLO.map((s) => ({
      chiave: s,
      label: ETICHETTE[s],
      attivo: !senzaPaese && stato === s,
      url: href(s),
    })),
    { chiave: "archivio", label: "Archivio", attivo: Boolean(archivio), url: hrefArchivio },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Collegamento da /vendite-ue: sostituisce i tab di stato finché non lo
          si chiude, perché "senza paese" è un filtro sulle vendite e non uno
          stato dell'articolo. */}
      {senzaPaese && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">Vendite senza paese noto: assegna un paese o lascia «Estero».</span>
          <Link href="/articoli" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
            <X className="size-3.5" />
            Rimuovi filtro
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-secondary p-1">
          {voci.map((v) => (
            <Link
              key={v.chiave}
              href={v.url}
              aria-current={v.attivo ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm transition-colors",
                v.attivo
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>

        {/* Form GET nativo: nessun JavaScript, nessun debounce, e la ricerca
            resta nell'URL come il filtro di stato. */}
        <form action="/articoli" className="relative w-full sm:w-64">
          {stato && <input type="hidden" name="stato" value={stato} />}
          {archivio && <input type="hidden" name="archivio" value="1" />}
          {senzaPaese && <input type="hidden" name="paese" value="mancante" />}
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="ricerca-articoli" className="sr-only">
            Cerca prodotto
          </label>
          <Input
            id="ricerca-articoli"
            name="q"
            type="search"
            placeholder="Cerca prodotto…"
            className="pl-8"
            defaultValue={q ?? ""}
          />
        </form>
      </div>
    </div>
  );
}
