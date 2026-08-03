import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toArticolo, toProdotto, type RigaArticoloConProdotto } from "./mappers";
import {
  STATI_ARTICOLO,
  type Articolo,
  type DistribuzioneVoce,
  type Kpi,
  type Prodotto,
  type StatoArticolo,
  type VenditaMensile,
} from "@/types";
import type { Tables } from "@/types/database";

/**
 * Data Access Layer: unico punto da cui l'app legge da Postgres.
 *
 * Ogni funzione crea il proprio client (è un'operazione leggera: configura solo
 * una fetch con i cookie della richiesta corrente) e legge come utente
 * autenticato, quindi sotto RLS. Nessuna query usa la service role key: se
 * l'utente non è in `utenti_autorizzati`, il database restituisce zero righe.
 */

/** Errore di lettura: propagato per non mostrare una pagina di zeri su un guasto. */
function erroreLettura(entita: string, messaggio: string): never {
  throw new Error(`Lettura ${entita} da Supabase fallita: ${messaggio}`);
}

export interface Pagina<T> {
  righe: T[];
  /** Totale delle righe che soddisfano il filtro, non solo quelle di questa pagina. */
  totale: number;
  pagina: number;
  perPagina: number;
}

/** Numero di pagina valido (base 1) a partire da un parametro non fidato. */
export function normalizzaPagina(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** `%` e `_` sono wildcard per LIKE: senza escape la ricerca darebbe risultati sbagliati. */
function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** PostgREST: offset oltre l'ultima riga disponibile. */
const RANGE_NON_SODDISFACIBILE = "PGRST103";

interface RisultatoRange<T> {
  data: T[] | null;
  error: { code?: string; message: string } | null;
  count: number | null;
}

/**
 * Esegue una query paginata riportando all'ultima pagina valida le richieste
 * fuori intervallo.
 *
 * Serve perché PostgREST risponde 416 quando l'offset supera il numero di righe:
 * un `?p=999` in un segnalibro, o l'ultima pagina svuotata da una cancellazione,
 * altrimenti diventerebbero un errore 500 invece di mostrare dei dati.
 */
async function eseguiPaginata<T>(
  entita: string,
  esegui: (da: number, a: number) => PromiseLike<RisultatoRange<T>>,
  conta: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  pagina: number,
  perPagina: number
): Promise<Pagina<T>> {
  const da = (pagina - 1) * perPagina;
  const primo = await esegui(da, da + perPagina - 1);

  if (primo.error?.code === RANGE_NON_SODDISFACIBILE) {
    const { count, error } = await conta();
    if (error) erroreLettura(entita, error.message);
    const totale = count ?? 0;
    const ultima = Math.max(1, Math.ceil(totale / perPagina));
    // Nessun dato: restituiamo una pagina vuota coerente, senza secondo giro.
    if (totale === 0) return { righe: [], totale: 0, pagina: 1, perPagina };

    const inizio = (ultima - 1) * perPagina;
    const ripetuto = await esegui(inizio, inizio + perPagina - 1);
    if (ripetuto.error) erroreLettura(entita, ripetuto.error.message);
    return {
      righe: ripetuto.data ?? [],
      totale: ripetuto.count ?? totale,
      pagina: ultima,
      perPagina,
    };
  }

  if (primo.error) erroreLettura(entita, primo.error.message);
  return { righe: primo.data ?? [], totale: primo.count ?? 0, pagina, perPagina };
}

const SELECT_ARTICOLI = `
  id, prodotto_id, data_acquisto, costo_acquisto, fonte_acquisto, stato,
  data_vendita, prezzo_vendita, piattaforma_vendita, fee, costo_spedizione,
  destinazione, spedizioniere, prodotto_sponsorizzato, vendita_post_offerta,
  profitto, note, created_at,
  prodotti!inner ( nome, categoria )
`;

export const ARTICOLI_PER_PAGINA = 50;

/**
 * Articoli filtrati e paginati, dal più recente per data di acquisto.
 *
 * Filtro, ricerca e paginazione stanno sul database e non in memoria: con oltre
 * mille articoli, servire tutte le righe a ogni visita produce megabyte di HTML
 * per mostrarne cinquanta.
 */
export async function getArticoliPaginati({
  stato,
  q,
  pagina = 1,
  perPagina = ARTICOLI_PER_PAGINA,
}: {
  stato?: StatoArticolo;
  q?: string;
  pagina?: number;
  perPagina?: number;
}): Promise<Pagina<Articolo>> {
  const supabase = await createClient();

  function base(select: string, opzioni: { count: "exact"; head?: boolean }) {
    let query = supabase.from("articoli").select(select, opzioni);
    if (stato) query = query.eq("stato", stato);
    // Ricerca sul nome del prodotto collegato: possibile perché l'embed è !inner.
    if (q) query = query.ilike("prodotti.nome", `%${escapeLike(q)}%`);
    return query;
  }

  const pag = await eseguiPaginata<RigaArticoloConProdotto>(
    "articoli",
    (da, a) =>
      base(SELECT_ARTICOLI, { count: "exact" })
        .order("data_acquisto", { ascending: false })
        // `id` come tie-break: senza un ordine totale, righe con la stessa data
        // possono cambiare pagina tra una richiesta e l'altra e sparire dall'elenco.
        .order("id", { ascending: true })
        .range(da, a) as unknown as PromiseLike<RisultatoRange<RigaArticoloConProdotto>>,
    () => base(SELECT_ARTICOLI, { count: "exact", head: true }),
    pagina,
    perPagina
  );

  return { ...pag, righe: pag.righe.map(toArticolo) };
}

/** `numeric` di Postgres arriva come stringa quando eccede la precisione di un double. */
function num(v: number | string | null): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Dati della dashboard, aggregati da Postgres.
 *
 * Non si leggono le righe per sommarle in memoria: PostgREST tronca a 1000 le
 * righe restituite da una select senza range, silenziosamente, e i KPI
 * risulterebbero sottostimati appena superata quella soglia. Le viste
 * restituiscono invece pochi record, indipendentemente dal volume.
 */
export async function getDatiDashboard(): Promise<{
  kpi: Kpi;
  mensili: VenditaMensile[];
  categoria: DistribuzioneVoce[];
  piattaforma: DistribuzioneVoce[];
  fonte: DistribuzioneVoce[];
  destinazione: DistribuzioneVoce[];
}> {
  const supabase = await createClient();

  // Query indipendenti: in parallelo il costo è quello della più lenta.
  const [kpiRes, mensiliRes, catRes, piatRes, fonteRes, destRes] = await Promise.all([
    supabase.from("v_kpi").select("*").maybeSingle(),
    supabase.from("v_vendite_mensili").select("*").order("mese", { ascending: true }),
    supabase.from("v_distribuzione_categoria").select("*"),
    supabase.from("v_distribuzione_piattaforma").select("*"),
    supabase.from("v_distribuzione_fonte").select("*"),
    supabase.from("v_distribuzione_destinazione").select("*"),
  ]);

  for (const [nome, res] of [
    ["KPI", kpiRes],
    ["vendite mensili", mensiliRes],
    ["distribuzione categoria", catRes],
    ["distribuzione piattaforma", piatRes],
    ["distribuzione fonte", fonteRes],
    ["distribuzione destinazione", destRes],
  ] as const) {
    if (res.error) erroreLettura(nome, res.error.message);
  }

  const k = kpiRes.data;
  // Database vuoto: la vista restituisce comunque una riga di zeri, ma se un
  // giorno non lo facesse i KPI devono restare zero e non NaN.
  const kpi: Kpi = {
    numeroVendite: num(k?.numero_vendite ?? 0),
    prezzoMedioVendita: num(k?.prezzo_medio_vendita ?? 0),
    venditeTotali: num(k?.vendite_totali ?? 0),
    profittoTotale: num(k?.profitto_totale ?? 0),
    fondiImmobilizzati: num(k?.fondi_immobilizzati ?? 0),
    capitale: num(k?.capitale ?? 0),
  };

  const voci = (righe: { label: string | null; value: number | null }[] | null) =>
    (righe ?? [])
      .filter((r): r is { label: string; value: number | null } => r.label != null)
      .map((r) => ({ label: r.label, value: num(r.value) }));

  return {
    kpi,
    mensili: (mensiliRes.data ?? [])
      .filter((r): r is typeof r & { mese: string } => r.mese != null)
      .map((r) => {
        // `mese` è il primo giorno del mese come date: bastano anno e mese.
        const mese = r.mese.slice(0, 7);
        return {
          mese,
          meseLabel: etichettaMese(mese),
          numeroVendite: num(r.numero_vendite),
          totaleVendite: num(r.totale_vendite),
          prezzoMedio: num(r.prezzo_medio_vendita),
          profitto: num(r.profitto_totale),
        };
      }),
    categoria: voci(catRes.data),
    piattaforma: voci(piatRes.data),
    fonte: voci(fonteRes.data),
    destinazione: voci(destRes.data),
  };
}

const MESE_LABEL = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });

/** "2026-03" → "Mar 2026". */
function etichettaMese(mese: string): string {
  const [anno, m] = mese.split("-").map(Number);
  const label = MESE_LABEL.format(new Date(Date.UTC(anno, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const PRODOTTI_PER_PAGINA = 48;

/** Catalogo prodotti, ricercabile e paginato, in ordine alfabetico. */
export async function getProdottiPaginati({
  q,
  pagina = 1,
  perPagina = PRODOTTI_PER_PAGINA,
}: {
  q?: string;
  pagina?: number;
  perPagina?: number;
}): Promise<Pagina<Prodotto>> {
  const supabase = await createClient();

  function base(opzioni: { count: "exact"; head?: boolean }) {
    const query = supabase.from("prodotti").select("*", opzioni);
    return q ? query.ilike("nome", `%${escapeLike(q)}%`) : query;
  }

  const pag = await eseguiPaginata<Tables<"prodotti">>(
    "prodotti",
    (da, a) =>
      base({ count: "exact" }).order("nome", { ascending: true }).range(da, a) as PromiseLike<
        RisultatoRange<Tables<"prodotti">>
      >,
    () => base({ count: "exact", head: true }),
    pagina,
    perPagina
  );

  return { ...pag, righe: pag.righe.map(toProdotto) };
}

/**
 * Nomi del catalogo per l'autocompletamento del form di inserimento.
 *
 * Solo nome e prezzo medio: con oltre ottocento prodotti, spedire l'anagrafica
 * completa al browser costerebbe centinaia di kilobyte per popolare una
 * datalist.
 */
export async function getNomiProdotti(): Promise<{ nome: string; prezzoMedioAcquisto: number | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prodotti")
    .select("nome, prezzo_medio_acquisto")
    .order("nome", { ascending: true });
  if (error) erroreLettura("prodotti", error.message);
  return (data ?? []).map((p) => ({
    nome: p.nome,
    prezzoMedioAcquisto: p.prezzo_medio_acquisto == null ? null : Number(p.prezzo_medio_acquisto),
  }));
}

/**
 * Prodotto per barcode esatto, o `null` se non censito.
 *
 * È l'unico passo del lookup barcode (vedi `src/lib/integrations/lookup.ts`):
 * se il codice è già legato a un prodotto risolve subito, senza alcuna
 * chiamata esterna. Il barcode è una chiave più affidabile del nome
 * normalizzato per capire se il prodotto esiste già.
 */
export async function getProdottoPerBarcode(barcode: string): Promise<Prodotto | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prodotti")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) erroreLettura("prodotto per barcode", error.message);
  return data ? toProdotto(data) : null;
}

/** Stato valido a partire da un parametro di query non fidato. */
export function normalizzaStato(raw: string | undefined): StatoArticolo | undefined {
  return (STATI_ARTICOLO as readonly string[]).includes(raw ?? "")
    ? (raw as StatoArticolo)
    : undefined;
}

/** Email dell'utente della sessione corrente, o null se non autenticato. */
export async function getUtenteCorrente(): Promise<{ email: string } | null> {
  const supabase = await createClient();
  // getClaims() verifica la firma del JWT: affidabile per decidere cosa
  // mostrare, a differenza di getSession() che legge solo i cookie.
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  return typeof email === "string" ? { email } : null;
}
