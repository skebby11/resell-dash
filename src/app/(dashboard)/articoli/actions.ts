"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContestoPaese } from "@/lib/data/queries";
import { parseVendita, UUID_RE, type CampoVendita } from "@/lib/validazione";
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
