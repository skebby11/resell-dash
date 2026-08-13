"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContestoPaese, getPaeseVenditaArticolo } from "@/lib/data/queries";
import {
  parseVendita,
  puoArchiviareArticolo,
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
  const idRaw = String(formData.get("id") ?? "").trim();
  const [ctxBase, paeseVenditaAttuale] = await Promise.all([
    getContestoPaese(),
    UUID_RE.test(idRaw) ? getPaeseVenditaArticolo(idRaw) : Promise.resolve(null),
  ]);
  const esito = parseVendita(formData, { ...ctxBase, paeseVenditaAttuale });
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
      // Un invenduto non può restare in archivio: la lista Archivio è
      // per i venduti, e senza questo clear l'articolo sparirebbe da entrambe.
      archiviato_at: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  rivalidaPagine();
}

/**
 * Elimina l'articolo e ricalcola le medie del prodotto in un'unica funzione
 * SQL (0019_scritture_transazionali_articoli): la funzione blocca la riga
 * prodotto per la durata della transazione, così un'eliminazione concorrente
 * su un altro articolo dello stesso prodotto aspetta invece di sovrascrivere
 * la media con un valore calcolato su dati non ancora aggiornati.
 */
export async function eliminaArticolo(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Articolo non valido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("elimina_articolo_con_ricalcolo", { articolo_id: id });
  if (error) throw new Error(error.message);

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

  // Stesso predicato ripetuto in scrittura del delete sopra: senza vincolare
  // stato e archiviato_at qui, una richiesta concorrente potrebbe archiviare
  // un articolo tornato invenduto nel frattempo, o ri-archiviare inutilmente.
  const { error, count } = await supabase
    .from("articoli")
    .update({ archiviato_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .in("stato", ["venduto", "consegnato"])
    .is("archiviato_at", null);
  if (error) throw new Error(error.message);
  if (count === 0) throw new Error("Articolo non trovato o non archiviabile.");

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

  const { error, count } = await supabase
    .from("articoli")
    .update({ archiviato_at: null }, { count: "exact" })
    .eq("id", id)
    .in("stato", ["venduto", "consegnato"]);
  if (error) throw new Error(error.message);
  if (count === 0) throw new Error("Articolo non trovato o non ripristinabile.");

  revalidatePath("/articoli");
}
