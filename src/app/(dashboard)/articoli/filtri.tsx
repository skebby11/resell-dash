import Link from "next/link";
import { Search } from "lucide-react";
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
export function Filtri({ stato, q }: { stato?: StatoArticolo; q?: string }) {
  function href(nuovoStato?: StatoArticolo) {
    const params = new URLSearchParams();
    if (nuovoStato) params.set("stato", nuovoStato);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/articoli?${qs}` : "/articoli";
  }

  const voci: { chiave: string; label: string; attivo: boolean; url: string }[] = [
    { chiave: "tutti", label: "Tutti", attivo: !stato, url: href() },
    ...STATI_ARTICOLO.map((s) => ({
      chiave: s,
      label: ETICHETTE[s],
      attivo: stato === s,
      url: href(s),
    })),
  ];

  return (
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
  );
}
