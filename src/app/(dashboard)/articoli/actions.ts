"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContestoPaese } from "@/lib/data/queries";
import {
  parseVendita,
  puoArchiviareArticolo,
  puoEliminareArticolo,
  UUID_RE,
  type CampoVendita,
} from "@/lib/validazione";
import { STATI_ARTICOLO, type StatoArticolo } from "@/types";

export interface StatoVendita {
  ok?: boolean;
  errore?: string;
  campi?: Partial<Record<CampoVendita, string>>;
  /** Contatore dei salvataggi riusciti: il dialog lo osserva per chiudersi. */
  seq: number;
}

function rivalidaPagine() {
  revalidatePath("/");
  revalidatePath("/articoli");
  revalidatePath("/vendite-ue");
}

/**
 * Registra (o corregge) i dati di vendita di un articolo.
 *
 * `profitto` non viene mai scritto: è una colonna generated, la calcola
 * Postgres da prezzo, costo, spedizione e fee.
 */
export async function registraVendita(
  stato: StatoVendita,
  formData: FormData
): Promise<StatoVendita> {
  const seq = stato.seq ?? 0;
  const ctx = await getContestoPaese();
  const esito = parseVendita(formData, ctx);
  if (!esito.ok) return { seq, campi: esito.campi, errore: esito.errore };
  const v = esito.valori;

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("articoli")
    .update(
      {
        stato: v.stato,
        data_vendita: v.dataVendita,
        prezzo_vendita: v.prezzoVendita,
        fee: v.fee,
        costo_spedizione: v.costoSpedizione,
        piattaforma_vendita: v.piattaformaVendita,
        destinazione: v.destinazione,
        paese_vendita: v.paeseVendita,
        spedizioniere: v.spedizioniere,
        prodotto_sponsorizzato: v.prodottoSponsorizzato,
        vendita_post_offerta: v.venditaPostOfferta,
      },
      { count: "exact" }
    )
    .eq("id", v.id);

  if (error) return { seq, errore: `Salvataggio non riuscito: ${error.message}` };
  // Un UPDATE che non tocca righe non è un errore per Postgres: senza policy di
  // SELECT sulla riga l'aggiornamento sparisce in silenzio.
  if (count === 0) return { seq, errore: "Articolo non trovato o non modificabile." };

  rivalidaPagine();
  return { ok: true, seq: seq + 1 };
}

/**
 * Cambia solo lo stato, per le transizioni che non richiedono dati aggiuntivi
 * (acquistato → in vendita, venduto → consegnato, e i ritorni indietro).
 */
export async function cambiaStato(id: string, nuovoStato: StatoArticolo): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Articolo non valido.");
  if (!(STATI_ARTICOLO as readonly string[]).includes(nuovoStato)) {
    throw new Error("Stato non valido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("articoli").update({ stato: nuovoStato }).eq("id", id);
  // Passare a venduto/consegnato senza dati di vendita viola il CHECK: il
  // messaggio di Postgres non è mostrabile, quindi lo traduciamo.
  if (error?.code === "23514") {
    throw new Error("Per segnare l'articolo come venduto servono data e prezzo di vendita.");
  }
  if (error) throw new Error(error.message);

  rivalidaPagine();
}

/**
 * Riporta un articolo in magazzino azzerando i dati di vendita.
 *
 * Serve a correggere una vendita registrata per errore: senza azzerare i campi
 * resterebbero valori di vendita su un articolo invenduto, e il profitto
 * calcolato tornerebbe a comparire appena lo stato torna venduto.
 */
export async function annullaVendita(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Articolo non valido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("articoli")
    .update({
      stato: "acquistato",
      data_vendita: null,
      prezzo_vendita: null,
      piattaforma_vendita: null,
      fee: null,
      costo_spedizione: null,
      destinazione: null,
      paese_vendita: null,
      spedizioniere: null,
      prodotto_sponsorizzato: false,
      vendita_post_offerta: false,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  rivalidaPagine();
}

/**
 * Media storica di un solo prodotto, calcolata qui e non via
 * `ricalcola_prezzi_medi`: quella funzione resta service-role.
 */
async function ricalcolaPrezziMediProdotto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  prodottoId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("articoli")
    .select("costo_acquisto, prezzo_vendita, stato")
    .eq("prodotto_id", prodottoId);
  if (error) throw new Error(error.message);

  const righe = data ?? [];
  let prezzo_medio_acquisto: number | null = null;
  let prezzo_medio_vendita: number | null = null;

  if (righe.length > 0) {
    const somma = (valori: number[]) => valori.reduce((acc, n) => acc + n, 0);
    const arrotonda = (n: number) => Math.round(n * 100) / 100;

    const costi = righe.map((r) => Number(r.costo_acquisto)).filter((n) => Number.isFinite(n));
    if (costi.length > 0) prezzo_medio_acquisto = arrotonda(somma(costi) / costi.length);

    const prezziVendita = righe
      .filter((r) => (r.stato === "venduto" || r.stato === "consegnato") && r.prezzo_vendita != null)
      .map((r) => Number(r.prezzo_vendita))
      .filter((n) => Number.isFinite(n));
    if (prezziVendita.length > 0) {
      prezzo_medio_vendita = arrotonda(somma(prezziVendita) / prezziVendita.length);
    }
  }

  const { error: updError } = await supabase
    .from("prodotti")
    .update({ prezzo_medio_acquisto, prezzo_medio_vendita })
    .eq("id", prodottoId);
  if (updError) throw new Error(updError.message);
}

export async function eliminaArticolo(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Articolo non valido.");

  const supabase = await createClient();
  const { data, error: loadError } = await supabase
    .from("articoli")
    .select("stato, prodotto_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!data) throw new Error("Articolo non trovato.");
  if (!puoEliminareArticolo(data.stato as StatoArticolo)) {
    throw new Error("Si possono eliminare solo articoli non ancora venduti.");
  }

  const { error, count } = await supabase.from("articoli").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  if (count === 0) throw new Error("Articolo non trovato o non eliminabile.");

  await ricalcolaPrezziMediProdotto(supabase, data.prodotto_id);

  revalidatePath("/");
  revalidatePath("/articoli");
  revalidatePath("/catalogo");
}

export async function archiviaArticolo(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Articolo non valido.");

  const supabase = await createClient();
  const { data, error: loadError } = await supabase
    .from("articoli")
    .select("stato, archiviato_at")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!data) throw new Error("Articolo non trovato.");
  if (!puoArchiviareArticolo(data.stato as StatoArticolo, data.archiviato_at != null)) {
    throw new Error("Si possono archiviare solo articoli già venduti.");
  }

  const { error } = await supabase
    .from("articoli")
    .update({ archiviato_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/articoli");
}

export async function ripristinaArticolo(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Articolo non valido.");

  const supabase = await createClient();
  const { data, error: loadError } = await supabase
    .from("articoli")
    .select("stato")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!data) throw new Error("Articolo non trovato.");
  if (data.stato !== "venduto" && data.stato !== "consegnato") {
    throw new Error("Si possono ripristinare solo articoli già venduti.");
  }

  const { error } = await supabase.from("articoli").update({ archiviato_at: null }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/articoli");
}
