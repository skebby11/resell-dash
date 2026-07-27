const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const currencyFormatterCompact = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
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

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("it-IT").format(value);
}
