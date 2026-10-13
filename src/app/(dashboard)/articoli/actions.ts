"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getContestoPaese, getPaeseVenditaArticolo } from "@/lib/data/queries";
import { aggiungiSuggerimento } from "@/lib/data/suggerimenti";
import {
  parseInserimento,
  parseNomeEtichetta,
  parseVendita,
  puoArchiviareArticolo,
  UUID_RE,
  type CampoInserimento,
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

export interface StatoModifica {
  ok?: boolean;
  errore?: string;
  campi?: Partial<Record<CampoInserimento, string>>;
  /** Contatore dei salvataggi riusciti: il dialog lo osserva per chiudersi. */
  seq: number;
}

/** Confronto tra nomi: ignora maiuscole e spazi ripetuti (come in inserimento). */
function normalizza(nome: string): string {
  return nome.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Modifica un articolo già registrato: prodotto, categoria, piattaforma, data,
 * costo, fonte e note.
 *
 * Categoria e piattaforma sono attributi del *modello*, non della singola
 * copia: se il prodotto resta lo stesso si aggiornano sul modello (e valgono
 * per tutte le sue copie). Se si digita un altro nome l'articolo passa a quel
 * modello, creato al volo se non esiste (come in inserimento); in quel caso un
 * modello già in catalogo tiene la sua anagrafica. Le medie dei prodotti
 * coinvolti si riallineano dal trigger su `articoli` (0022).
 *
 * `profitto` non viene mai scritto: è una colonna generated.
 */
export async function modificaArticolo(
  stato: StatoModifica,
  formData: FormData
): Promise<StatoModifica> {
  const seq = stato.seq ?? 0;
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return { seq, errore: "Articolo non valido." };

  const esito = parseInserimento(formData);
  if (!esito.ok) return { seq, campi: esito.campi, errore: esito.errore };
  const { nomeProdotto, categoria, dataAcquisto, costoAcquisto, fonteAcquisto, note } = esito.valori;
  const piattaformaGioco = String(formData.get("piattaforma_gioco") ?? "").trim() || null;

  const nomeCategoria = categoria ? parseNomeEtichetta(categoria) : undefined;
  if (categoria && !nomeCategoria) return { seq, errore: "Categoria non valida (max 60 caratteri)." };
  const nomePiattaforma = piattaformaGioco ? parseNomeEtichetta(piattaformaGioco) : undefined;
  if (piattaformaGioco && !nomePiattaforma) {
    return { seq, errore: "Piattaforma non valida (max 60 caratteri)." };
  }

  const supabase = await createClient();

  const { data: articolo, error: eArticolo } = await supabase
    .from("articoli")
    .select("prodotto_id")
    .eq("id", id)
    .maybeSingle();
  if (eArticolo) return { seq, errore: `Lettura non riuscita: ${eArticolo.message}` };
  if (!articolo) return { seq, errore: "Articolo non trovato." };

  const { data: attuale, error: eProdotto } = await supabase
    .from("prodotti")
    .select("nome")
    .eq("id", articolo.prodotto_id)
    .maybeSingle();
  if (eProdotto) return { seq, errore: `Lettura non riuscita: ${eProdotto.message}` };

  // Categoria e piattaforma nuove entrano tra i suggerimenti di Impostazioni.
  const [esitoCategoria, esitoPiattaforma] = [
    await aggiungiSuggerimento(supabase, "categorie", nomeCategoria ?? null),
    await aggiungiSuggerimento(supabase, "piattaforme", nomePiattaforma ?? null),
  ];
  const avvisi = [esitoCategoria.avviso, esitoPiattaforma.avviso].filter(Boolean);

  let prodottoId = articolo.prodotto_id;
  if (attuale && normalizza(attuale.nome) === normalizza(nomeProdotto)) {
    // Stesso modello: categoria e piattaforma (e una correzione di
    // maiuscole/spazi nel nome) si applicano all'anagrafica.
    const { error } = await supabase
      .from("prodotti")
      .update({
        nome: nomeProdotto,
        categoria: nomeCategoria ?? null,
        piattaforma_gioco: nomePiattaforma ?? null,
      })
      .eq("id", prodottoId);
    if (error) return { seq, errore: `Aggiornamento del prodotto non riuscito: ${error.message}` };
  } else {
    const { data: candidati, error: eRicerca } = await supabase
      .from("prodotti")
      .select("id, nome")
      .ilike("nome", nomeProdotto)
      .limit(10);
    if (eRicerca) return { seq, errore: `Ricerca del prodotto non riuscita: ${eRicerca.message}` };
    const trovato = candidati?.find((p) => normalizza(p.nome) === normalizza(nomeProdotto));
    if (trovato) {
      prodottoId = trovato.id;
    } else {
      const { data: nuovo, error } = await supabase
        .from("prodotti")
        .insert({
          nome: nomeProdotto,
          categoria: nomeCategoria ?? null,
          piattaforma_gioco: nomePiattaforma ?? null,
        })
        .select("id")
        .single();
      if (error) return { seq, errore: `Creazione del prodotto non riuscita: ${error.message}` };
      prodottoId = nuovo.id;
    }
  }

  const { error, count } = await supabase
    .from("articoli")
    .update(
      {
        prodotto_id: prodottoId,
        data_acquisto: dataAcquisto,
        costo_acquisto: costoAcquisto,
        fonte_acquisto: fonteAcquisto,
        note,
      },
      { count: "exact" }
    )
    .eq("id", id);
  if (error) return { seq, errore: `Salvataggio non riuscito: ${error.message}` };
  if (count === 0) return { seq, errore: "Articolo non trovato o non modificabile." };

  rivalidaPagine();
  revalidatePath("/catalogo");
  if (esitoCategoria.aggiunto || esitoPiattaforma.aggiunto) {
    revalidatePath("/impostazioni");
    revalidatePath("/inserimento");
  }
  return { ok: true, seq: seq + 1, errore: avvisi.length ? avvisi.join(" ") : undefined };
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
