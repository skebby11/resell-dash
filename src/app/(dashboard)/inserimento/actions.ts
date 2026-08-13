"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseInserimento, parseNomeEtichetta, type CampoInserimento } from "@/lib/validazione";
import { normalizzaBarcode } from "@/lib/integrations/barcode";

export interface StatoInserimento {
  ok?: boolean;
  errore?: string;
  /** Errori per campo, stesse chiavi dei `name` del form. */
  campi?: Partial<Record<CampoInserimento, string>>;
  /** Nome del prodotto creato al volo, per dirlo all'utente. */
  prodottoCreato?: string;
  /**
   * Avviso non bloccante da mostrare dopo un salvataggio comunque riuscito
   * (es. barcode non collegabile al prodotto trovato per nome). Non blocca
   * mai il salvataggio: è un'informazione, non un errore di validazione.
   */
  avviso?: string;
  /**
   * Contatore dei salvataggi riusciti. Il form lo usa come `key` per rimontare
   * i campi e svuotarli: azzerare lo stato dentro un effect innescherebbe
   * render a cascata (e la regola lint react-hooks/set-state-in-effect).
   */
  seq: number;
}

/** Confronto tra nomi: ignora maiuscole e spazi ripetuti. */
function normalizza(nome: string): string {
  return nome.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Registra un nuovo articolo acquistato.
 *
 * Il prodotto si indica per nome: se non esiste in catalogo viene creato. Con
 * oltre ottocento modelli, obbligare a censire il prodotto prima di registrare
 * l'acquisto sarebbe un passaggio in più per il caso più frequente, ossia
 * comprare qualcosa di nuovo.
 *
 * La validazione qui è quella autorevole: quella nel form è solo UX e un client
 * può saltarla. I vincoli del database (FK, CHECK su costo e stato) sono
 * l'ultima rete, e le RLS decidono se la scrittura è permessa.
 */
export async function creaArticolo(
  stato: StatoInserimento,
  formData: FormData
): Promise<StatoInserimento> {
  const seq = stato.seq ?? 0;
  const esito = parseInserimento(formData);
  if (!esito.ok) return { seq, campi: esito.campi, errore: esito.errore };
  const { nomeProdotto, categoria, dataAcquisto, costoAcquisto, fonteAcquisto, note } =
    esito.valori;

  // Barcode/copertina/piattaforma non passano da `parseInserimento` (modulo
  // non nostro): li leggiamo qui, con la stessa normalizzazione autorevole
  // usata dal lookup (src/lib/integrations/barcode.ts).
  const barcodeGrezzo = String(formData.get("barcode") ?? "").trim();
  const barcode = barcodeGrezzo ? normalizzaBarcode(barcodeGrezzo) : null;
  if (barcodeGrezzo && !barcode) {
    return {
      seq,
      errore: "Codice a barre non valido: servono solo cifre, 8/12/13 caratteri (EAN-8/UPC-A/EAN-13).",
    };
  }
  const fotoUrl = String(formData.get("foto_url") ?? "").trim() || null;
  const piattaformaGioco = String(formData.get("piattaforma_gioco") ?? "").trim() || null;

  const supabase = await createClient();

  // Categoria digitata (anche su un prodotto già esistente) → `categorie`,
  // così compare in Impostazioni. Si fa subito, prima dell'articolo: se il
  // prodotto è stato creato e l'articolo fallisce, il nome non deve sparire.
  // 23505 = già presente (unicità case-insensitive): si ignora.
  const nomeCategoria = categoria ? parseNomeEtichetta(categoria) : undefined;
  let avviso: string | undefined;
  if (categoria && !nomeCategoria) {
    avviso =
      "Categoria non valida (max 60 caratteri): non è stata aggiunta all'elenco.";
  } else if (nomeCategoria) {
    const { data: ultimo, error: eOrdine } = await supabase
      .from("categorie")
      .select("ordine")
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eOrdine) {
      avviso = `Categoria non aggiunta all'elenco: ${eOrdine.message}`;
    } else {
      const { error: eCategoria } = await supabase.from("categorie").insert({
        nome: nomeCategoria,
        ordine: (ultimo?.ordine ?? -1) + 1,
      });
      if (eCategoria && eCategoria.code !== "23505") {
        avviso = `Categoria non aggiunta all'elenco: ${eCategoria.message}`;
      } else if (!eCategoria) {
        revalidatePath("/impostazioni");
      }
    }
  }

  // Il barcode è una chiave di deduplica più affidabile del nome: se il
  // prodotto è già censito con questo codice va riusato, senza nemmeno
  // arrivare al confronto per nome.
  let prodottoId: string | undefined;
  if (barcode) {
    const { data: perBarcode, error: erroreBarcode } = await supabase
      .from("prodotti")
      .select("id")
      .eq("barcode", barcode)
      .maybeSingle();
    if (erroreBarcode) {
      return { seq, errore: `Ricerca per barcode non riuscita: ${erroreBarcode.message}` };
    }
    prodottoId = perBarcode?.id;
  }

  let prodottoCreato: string | undefined;
  // Distingue "trovato per barcode" (già gestito sopra) da "trovato per nome
  // in questo blocco": solo nel secondo caso ha senso provare a collegare
  // retroattivamente il barcode, perché nel primo il prodotto ce l'ha già.
  let trovatoPerNome = false;

  if (!prodottoId) {
    // Cerca un prodotto con lo stesso nome. `ilike` senza wildcard è un confronto
    // esatto ma insensibile alle maiuscole; il controllo su `normalizza` scarta i
    // falsi positivi dovuti a spazi differenti.
    const { data: candidati, error: erroreRicerca } = await supabase
      .from("prodotti")
      .select("id, nome")
      .ilike("nome", nomeProdotto)
      .limit(10);
    if (erroreRicerca) {
      return { seq, errore: `Ricerca del prodotto non riuscita: ${erroreRicerca.message}` };
    }
    prodottoId = candidati?.find((p) => normalizza(p.nome) === normalizza(nomeProdotto))?.id;
    trovatoPerNome = Boolean(prodottoId);
  }

  // Il prodotto esisteva già per nome ma non aveva ancora un barcode: è
  // esattamente il caso "barcode sconosciuto → l'utente cerca il titolo su
  // IGDB → sceglie un prodotto che in realtà era già in catalogo". Collegarlo
  // ora è ciò che rende il catalogo il database barcode del proprietario: da
  // qui in poi quel codice risolve dal passo 1, senza mai più toccare IGDB.
  // `.is("barcode", null)` evita di sovrascrivere un barcode diverso già
  // registrato su quel prodotto (dato più vecchio e presumibilmente corretto,
  // altrimenti l'avessimo già trovato al passo precedente); non collegare
  // nulla in quel caso non è un errore, solo un'occasione mancata da
  // segnalare come avviso non bloccante.
  if (trovatoPerNome && barcode && prodottoId) {
    const { data: collegato, error: erroreCollega } = await supabase
      .from("prodotti")
      .update({ barcode })
      .eq("id", prodottoId)
      .is("barcode", null)
      .select("id");
    if (erroreCollega) {
      const msg = `Prodotto salvato, ma il barcode non è stato collegato al catalogo: ${erroreCollega.message}`;
      avviso = avviso ? `${avviso} ${msg}` : msg;
    } else if (!collegato?.length) {
      const msg =
        "Prodotto salvato: il barcode non è stato collegato perché questo prodotto ne ha già uno diverso registrato.";
      avviso = avviso ? `${avviso} ${msg}` : msg;
    }
  }

  if (!prodottoId) {
    const { data: nuovo, error } = await supabase
      .from("prodotti")
      .insert({
        nome: nomeProdotto,
        categoria: nomeCategoria ?? categoria,
        barcode,
        foto_url: fotoUrl,
        piattaforma_gioco: piattaformaGioco,
      })
      .select("id")
      .single();
    if (error) return { seq, errore: `Creazione del prodotto non riuscita: ${error.message}` };
    prodottoId = nuovo.id;
    prodottoCreato = nomeProdotto;
  }

  const { error } = await supabase.from("articoli").insert({
    prodotto_id: prodottoId,
    data_acquisto: dataAcquisto,
    costo_acquisto: costoAcquisto,
    fonte_acquisto: fonteAcquisto,
    stato: "acquistato",
    note,
  });

  if (error) return { seq, errore: `Salvataggio non riuscito: ${error.message}` };

  // Le pagine che leggono articoli vanno rigenerate, altrimenti mostrano ancora
  // il render precedente alla scrittura.
  revalidatePath("/");
  revalidatePath("/articoli");
  if (prodottoCreato) revalidatePath("/catalogo");

  return { ok: true, seq: seq + 1, prodottoCreato, avviso };
}
