import { Paginazione } from "@/components/dashboard/paginazione";
import { StatoVuoto } from "@/components/dashboard/stato-vuoto";
import {
  ARTICOLI_PER_PAGINA,
  getArticoliPaginati,
  normalizzaPagina,
  normalizzaStato,
} from "@/lib/data/queries";
import { ArticoliTable } from "./articoli-table";
import { Filtri } from "./filtri";

export default async function ArticoliPage({
  searchParams,
}: {
  // In Next.js 16 searchParams è asincrono.
  searchParams: Promise<{ stato?: string; q?: string; p?: string; paese?: string }>;
}) {
  const params = await searchParams;
  const stato = normalizzaStato(params.stato);
  const q = params.q?.trim() || undefined;
  // `?paese=mancante`: collegamento da /vendite-ue per isolare le vendite
  // senza paese noto e correggerle. Sovrascrive il filtro di stato (le
  // vendite senza paese sono per forza venduto/consegnato).
  const senzaPaese = params.paese === "mancante";

  // `pagina` dal risultato e non dal parametro: una richiesta fuori intervallo
  // viene riportata all'ultima pagina valida, e l'indicatore deve dire dove
  // siamo davvero.
  const { righe, totale, pagina } = await getArticoliPaginati({
    stato,
    q,
    senzaPaese,
    pagina: normalizzaPagina(params.p),
  });

  // Nessun filtro attivo e zero risultati: il magazzino è davvero vuoto, non è
  // una ricerca senza esiti.
  if (totale === 0 && !stato && !q && !senzaPaese) {
    return (
      <StatoVuoto
        titolo="Magazzino vuoto"
        descrizione="Nessun articolo registrato finora. Ogni acquisto inserito compare qui con il suo stato, dall'acquisto alla consegna."
        azione={{ href: "/inserimento", label: "Registra un acquisto" }}
      />
    );
  }

  function hrefPagina(p: number) {
    const qs = new URLSearchParams();
    if (senzaPaese) qs.set("paese", "mancante");
    else if (stato) qs.set("stato", stato);
    if (q) qs.set("q", q);
    if (p > 1) qs.set("p", String(p));
    const s = qs.toString();
    return s ? `/articoli?${s}` : "/articoli";
  }

  return (
    <div className="flex flex-col gap-4">
      <Filtri stato={stato} q={q} senzaPaese={senzaPaese} />
      <ArticoliTable articoli={righe} />
      <Paginazione
        pagina={pagina}
        perPagina={ARTICOLI_PER_PAGINA}
        totale={totale}
        hrefPagina={hrefPagina}
        etichetta="articoli"
      />
    </div>
  );
}
