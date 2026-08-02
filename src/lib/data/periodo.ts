/**
 * Parsing e preset del filtro periodo della dashboard, come funzioni pure su
 * stringhe non fidate (parametri URL `?da=&a=`) — testabili senza Next.js né
 * database, sullo stesso modello di `src/lib/validazione.ts`.
 *
 * Le date risolte qui alimentano `dashboard_kpi`/`dashboard_vendite_mensili`/
 * `dashboard_distribuzione_*` via `supabase.rpc()`: un parametro non
 * interpretabile deve diventare "nessun limite", non un errore 500.
 */

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface Periodo {
  da?: string;
  a?: string;
}

/** Data ISO valida da un parametro URL non fidato, o `undefined` se non lo è. */
export function normalizzaData(raw: string | undefined): string | undefined {
  if (!raw || !DATA_RE.test(raw)) return undefined;
  // `new Date` accetta anche date di calendario inesistenti come "2026-02-30"
  // interpretandole per overflow (diventa marzo): un range con quel bordo
  // silenziosamente sbagliato è peggio di uno senza limite.
  const [anno, mese, giorno] = raw.split("-").map(Number);
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  const valida =
    d.getUTCFullYear() === anno && d.getUTCMonth() === mese - 1 && d.getUTCDate() === giorno;
  return valida ? raw : undefined;
}

/**
 * Filtro periodo risolto da parametri URL non fidati (`?da=&a=`).
 *
 * Un intervallo invertito (da > a) non ha un significato sensato: si azzera a
 * "nessun limite" invece di restituire un filtro che non troverebbe mai nulla
 * senza dirlo.
 */
export function risolviPeriodo(rawDa: string | undefined, rawA: string | undefined): Periodo {
  let da = normalizzaData(rawDa);
  let a = normalizzaData(rawA);
  if (da && a && da > a) {
    da = undefined;
    a = undefined;
  }
  return { da, a };
}

function isoData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type PresetPeriodo = "anno-corrente" | "anno-precedente" | "ultimi-12-mesi";

/** Preset calcolati rispetto a "oggi", per i link rapidi del filtro periodo. */
export function presetPeriodo(oggi: Date): Record<PresetPeriodo, Required<Periodo>> {
  const anno = oggi.getUTCFullYear();
  const inizioUltimi12 = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - 11, 1));
  return {
    "anno-corrente": { da: `${anno}-01-01`, a: `${anno}-12-31` },
    "anno-precedente": { da: `${anno - 1}-01-01`, a: `${anno - 1}-12-31` },
    "ultimi-12-mesi": { da: isoData(inizioUltimi12), a: isoData(oggi) },
  };
}

/** Preset che corrisponde esattamente al periodo risolto, o `undefined` (custom/tutto). */
export function presetAttivo(periodo: Periodo, oggi: Date): PresetPeriodo | "tutto" | undefined {
  if (periodo.da === undefined && periodo.a === undefined) return "tutto";
  const preset = presetPeriodo(oggi);
  const voce = (Object.entries(preset) as [PresetPeriodo, Required<Periodo>][]).find(
    ([, p]) => p.da === periodo.da && p.a === periodo.a
  );
  return voce?.[0];
}
