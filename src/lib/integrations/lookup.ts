import "server-only";
import { getProdottoPerBarcode } from "@/lib/data/queries";
import { normalizzaBarcode } from "@/lib/integrations/barcode";
import type { Prodotto } from "@/types";

/**
 * Lookup barcode → catalogo interno.
 *
 * Il valore del barcode in questo dominio non è "risolvere un codice
 * sconosciuto tramite un servizio terzo": è riconoscere in un istante un
 * articolo che si è già trattato. Il catalogo (`prodotti.barcode`) è quindi
 * l'unica fonte qui, zero chiamate esterne:
 *
 *   1. Barcode già legato a un prodotto → risolve subito (nome, categoria,
 *      piattaforma, copertina, prezzi medi storici), senza rete né costi.
 *   2. Barcode sconosciuto → nessun tentativo automatico di indovinare: il
 *      chiamante (il form di inserimento) offre all'utente la ricerca per
 *      titolo su IGDB (vedi `cercaGiochiIgdb` in `igdb.ts` e la route
 *      `GET /api/igdb`). Al salvataggio il barcode viene legato al prodotto
 *      scelto/creato (`actions.ts`), così la volta successiva risolve da qui.
 *
 * In precedenza questa cascata proseguiva su UPCitemdb: rimosso (vedi
 * README, sezione Barcode lookup, e il report di consegna) perché la sua
 * quota gratuita "trial" funziona solo dal loro API explorer, non da
 * un'applicazione server — costruirci sopra sarebbe stato fragile e fuori
 * dai loro termini d'uso.
 */

export interface RisultatoLookupBarcode {
  barcode: string;
  /** Prodotto già in catalogo con questo barcode, o `null` se non censito. */
  prodottoEsistente: Prodotto | null;
}

export type EsitoLookupBarcode =
  | { ok: true; risultato: RisultatoLookupBarcode }
  | { ok: false; errore: string };

export async function cercaProdottoDaBarcode(barcodeGrezzo: string): Promise<EsitoLookupBarcode> {
  const barcode = normalizzaBarcode(barcodeGrezzo);
  if (!barcode) {
    return {
      ok: false,
      errore: "Codice a barre non valido: servono solo cifre, con lunghezza 8, 12 o 13 (EAN-8/UPC-A/EAN-13).",
    };
  }

  const prodottoEsistente = await getProdottoPerBarcode(barcode);
  return { ok: true, risultato: { barcode, prodottoEsistente } };
}
