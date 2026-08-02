// Il locale "it-IT" di CLDR ha minimumGroupingDigits: 2, quindi con il
// default useGrouping: "auto" il separatore delle migliaia scatta solo da
// 5 cifre in su (20.757,35 €) ma non a 4 (3512,00 €). È un comportamento
// corretto per CLDR, ma in una colonna di importi allineati l'incoerenza
// rende il confronto visivo più difficile. Forziamo quindi il
// raggruppamento sempre attivo con useGrouping: "always" (opzione
// stringa introdotta in ECMA-402 / ES2023, supportata da Node 24 e dal
// lib "esnext" di TypeScript in questo progetto), così 3512 diventa
// "3.512,00 €" come 20757 diventa "20.757,35 €".
const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
  useGrouping: "always",
});

const currencyFormatterCompact = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  // Stessa scelta del formatter principale, per coerenza fra tabelle e
  // grafici: questo formatter è usato sia nel tooltip dei grafici (spazio
  // abbondante) sia nei tick dell'asse Y (larghezza fissa di 68px). Non
  // differenziamo useGrouping fra i due usi: il separatore aggiunge al
  // più un carattere ("3.512 €" vs "3512 €"), un impatto trascurabile
  // sullo spazio disponibile, mentre valori raggruppati in modo
  // incoerente lungo lo stesso asse sarebbero più confusi di un'etichetta
  // di un carattere più lunga.
  useGrouping: "always",
});

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatCurrencyCompact(value: number): string {
  return currencyFormatterCompact.format(value);
}

export function formatDate(iso: string): string {
  // Interpreta le date "date-only" (YYYY-MM-DD) come mezzanotte UTC e le
  // formatta in UTC, cosi il giorno mostrato non dipende dal fuso locale.
  return dateFormatter.format(new Date(iso));
}

// Stessa motivazione di currencyFormatter: raggruppamento sempre attivo
// per coerenza con gli importi in valuta (usato ad es. nel paginatore e
// per i conteggi vendite in /vendite-ue, accanto a colonne di importi).
const numberFormatter = new Intl.NumberFormat("it-IT", { useGrouping: "always" });

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}
