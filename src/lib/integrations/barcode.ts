/**
 * Normalizzazione e validazione del codice a barre, come funzioni pure.
 *
 * Vive qui e non in `src/lib/validazione.ts` perché quel modulo appartiene al
 * form di inserimento "classico": questo serve sia al form sia alla route API
 * di lookup, ed è la validazione autorevole prima di inoltrare l'input a
 * servizi terzi (UPCitemdb, IGDB) a spese del proprietario dell'account.
 */

export type TipoBarcode = "EAN-8" | "UPC-A" | "EAN-13";

const LUNGHEZZE_VALIDE: Record<number, TipoBarcode> = {
  8: "EAN-8",
  12: "UPC-A",
  13: "EAN-13",
};

/**
 * Riduce l'input a sole cifre (tollera spazi e trattini, comuni quando il
 * codice viene ricopiato a mano) e verifica che la lunghezza risultante sia
 * uno dei formati noti. Ritorna `null` per qualunque altro input: chi chiama
 * non deve mai costruire una URL verso terzi con un valore non normalizzato.
 */
export function normalizzaBarcode(raw: string): string | null {
  const pulito = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(pulito)) return null;
  return pulito.length in LUNGHEZZE_VALIDE ? pulito : null;
}

/** Tipo di codice (solo per messaggi diagnostici, nessuna verifica del checksum). */
export function tipoBarcode(barcode: string): TipoBarcode | null {
  return LUNGHEZZE_VALIDE[barcode.length] ?? null;
}
