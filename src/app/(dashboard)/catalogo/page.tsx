import Image from "next/image";
import { Gamepad2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Paginazione } from "@/components/dashboard/paginazione";
import { StatoVuoto } from "@/components/dashboard/stato-vuoto";
import {
  getProdottiPaginati,
  normalizzaPagina,
  PRODOTTI_PER_PAGINA,
} from "@/lib/data/queries";
import { formatCurrency } from "@/lib/format";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;

  // `pagina` dal risultato: una richiesta fuori intervallo viene riportata
  // all'ultima pagina valida.
  const {
    righe: prodotti,
    totale,
    pagina,
  } = await getProdottiPaginati({ q, pagina: normalizzaPagina(params.p) });

  if (totale === 0 && !q) {
    return (
      <StatoVuoto
        titolo="Catalogo vuoto"
        descrizione="Il catalogo raccoglie i modelli a cui collegare ogni articolo acquistato. Si popola da solo registrando acquisti, oppure con `npm run seed` per partire dai modelli più comuni."
        azione={{ href: "/inserimento", label: "Registra un acquisto" }}
      />
    );
  }

  function hrefPagina(p: number) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (p > 1) qs.set("p", String(p));
    const s = qs.toString();
    return s ? `/catalogo?${s}` : "/catalogo";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Margine stimato calcolato sui prezzi medi di acquisto e vendita.
        </p>
        <form action="/catalogo" className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="ricerca-catalogo" className="sr-only">
            Cerca modello
          </label>
          <Input
            id="ricerca-catalogo"
            name="q"
            type="search"
            placeholder="Cerca modello…"
            className="pl-8"
            defaultValue={q ?? ""}
          />
        </form>
      </div>

      {prodotti.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          Nessun modello corrisponde a «{q}».
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {prodotti.map((p) => {
          const haDatiPrezzo = p.prezzoMedioVendita != null && p.prezzoMedioAcquisto != null;
          const margine = haDatiPrezzo ? p.prezzoMedioVendita! - p.prezzoMedioAcquisto! : null;
          const marginePct =
            margine != null && p.prezzoMedioAcquisto ? (margine / p.prezzoMedioAcquisto) * 100 : null;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {/* Copertina da IGDB quando disponibile (lookup barcode): niente
                      fallback via onError perché questa pagina resta un Server
                      Component; l'unico "grazioso" possibile qui è mostrare
                      l'icona quando foto_url è assente, senza gestire un URL
                      salvato ma diventato irraggiungibile. */}
                  {p.fotoUrl ? (
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-secondary">
                      <Image
                        src={p.fotoUrl}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    </span>
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <Gamepad2 className="size-4" strokeWidth={2} />
                    </span>
                  )}
                  <div>
                    <h3 className="font-display text-[0.98rem] italic leading-tight text-foreground">
                      {p.nome}
                    </h3>
                    {p.piattaformaGioco && (
                      <p className="text-xs text-muted-foreground">{p.piattaformaGioco}</p>
                    )}
                  </div>
                </div>
                {p.categoria && (
                  <Badge variant="secondary" className="shrink-0">
                    {p.categoria}
                  </Badge>
                )}
              </div>

              {p.note && (
                <p className="text-xs italic text-muted-foreground">&ldquo;{p.note}&rdquo;</p>
              )}

              <div className="mt-1 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Acquisto medio</p>
                  <p className="font-mono-num font-medium text-foreground">
                    {p.prezzoMedioAcquisto != null ? formatCurrency(p.prezzoMedioAcquisto) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendita media</p>
                  <p className="font-mono-num font-medium text-foreground">
                    {p.prezzoMedioVendita != null ? formatCurrency(p.prezzoMedioVendita) : "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md bg-accent px-3 py-2">
                <span className="text-xs font-medium text-accent-foreground">Margine stimato</span>
                <span className="font-mono-num text-sm font-semibold text-accent-foreground">
                  {margine != null && marginePct != null
                    ? `${formatCurrency(margine)} (${marginePct.toFixed(0)}%)`
                    : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Paginazione
        pagina={pagina}
        perPagina={PRODOTTI_PER_PAGINA}
        totale={totale}
        hrefPagina={hrefPagina}
        etichetta="modelli"
      />
    </div>
  );
}
