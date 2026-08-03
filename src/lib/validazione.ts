import { PAESI_UE, STATI_ARTICOLO, type StatoArticolo } from "@/types";

/**
 * Parsing e validazione dei dati dei form, separati dalle server action.
 *
 * Vivono qui, come funzioni pure su `FormData`, per essere testabili senza
 * database né richiesta HTTP: è la parte più facile da sbagliare (numeri in
 * formato italiano, campi facoltativi, stati ammessi) e la meno comoda da
 * verificare attraverso l'interfaccia.
 *
 * Questa è la validazione autorevole: quella nei componenti è solo UX, e un
 * client può saltarla.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

export type Esito<T, C extends string> =
  | { ok: true; valori: T }
  | { ok: false; campi: Partial<Record<C, string>>; errore: string };

function stringa(formData: FormData, nome: string): string {
  return String(formData.get(nome) ?? "").trim();
}

/**
 * Importo facoltativo da input testuale.
 *
 * Tre esiti distinti, che i chiamanti devono trattare in modo diverso:
 *   `null`      campo vuoto (legittimo per fee e spedizione)
 *   `undefined` non interpretabile o negativo (errore)
 *   numero      valore valido
 */
export function importoOpzionale(raw: string): number | null | undefined {
  const v = raw.trim();
  if (!v) return null;
  // La virgola decimale è la norma su tastiera italiana.
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Una checkbox non spuntata non invia nulla: conta la presenza, non il valore. */
function spuntata(formData: FormData, nome: string): boolean {
  return formData.get(nome) !== null;
}

// ------------------------------------------------------- nuovo articolo ----

export type CampoInserimento =
  | "prodotto"
  | "data_acquisto"
  | "costo_acquisto"
  | "fonte_acquisto";

export interface ValoriInserimento {
  nomeProdotto: string;
  categoria: string | null;
  dataAcquisto: string;
  costoAcquisto: number;
  fonteAcquisto: string;
  note: string | null;
}

export function parseInserimento(
  formData: FormData
): Esito<ValoriInserimento, CampoInserimento> {
  const nomeProdotto = stringa(formData, "prodotto").replace(/\s+/g, " ");
  const dataAcquisto = stringa(formData, "data_acquisto");
  const costoRaw = stringa(formData, "costo_acquisto");
  const fonteAcquisto = stringa(formData, "fonte_acquisto");

  const campi: Partial<Record<CampoInserimento, string>> = {};

  if (!nomeProdotto) campi.prodotto = "Indica il prodotto.";
  else if (nomeProdotto.length > 200) campi.prodotto = "Nome troppo lungo (max 200 caratteri).";

  if (!DATA_RE.test(dataAcquisto)) campi.data_acquisto = "Indica la data di acquisto.";

  const costo = importoOpzionale(costoRaw);
  if (costo === null) campi.costo_acquisto = "Indica il costo di acquisto.";
  else if (costo === undefined)
    campi.costo_acquisto = "Il costo deve essere un numero valido e non negativo.";

  if (!fonteAcquisto) campi.fonte_acquisto = "Indica la fonte di acquisto.";

  if (Object.keys(campi).length > 0) {
    return { ok: false, campi, errore: "Compila correttamente i campi obbligatori." };
  }

  return {
    ok: true,
    valori: {
      nomeProdotto,
      categoria: stringa(formData, "categoria") || null,
      dataAcquisto,
      costoAcquisto: costo as number,
      fonteAcquisto,
      note: stringa(formData, "note") || null,
    },
  };
}

// ------------------------------------------------------------- vendita ----

export type CampoVendita =
  | "data_vendita"
  | "prezzo_vendita"
  | "fee"
  | "costo_spedizione"
  | "paese_vendita";

export interface ValoriVendita {
  id: string;
  stato: Extract<StatoArticolo, "venduto" | "consegnato">;
  dataVendita: string;
  prezzoVendita: number;
  fee: number | null;
  costoSpedizione: number | null;
  piattaformaVendita: string | null;
  destinazione: string | null;
  /** Codice ISO paese UE. Coerente con `destinazione`: vedi `risolviPaeseVendita`. */
  paeseVendita: string | null;
  spedizioniere: string | null;
  prodottoSponsorizzato: boolean;
  venditaPostOfferta: boolean;
}

const CODICI_PAESI_UE = new Set<string>(PAESI_UE.map((p) => p.codice));

/**
 * Deriva il paese di vendita dalla destinazione, invece di trattarli come due
 * campi indipendenti: il CHECK `articoli_paese_destinazione_coerenti` non
 * accetterebbe comunque una combinazione incoerente, quindi è la validazione
 * a doverla escludere per prima, con un messaggio comprensibile invece
 * dell'errore grezzo di Postgres.
 *
 *   destinazione 'Italia'  → sempre 'IT' (il client non decide il paese)
 *   destinazione 'Estero'  → il paese scelto, o `null` se non ancora noto
 *                            (legittimo: è esattamente la lacuna da colmare
 *                            a mano, non un errore di input)
 *   altro/assente          → `null`, nessun vincolo
 */
function risolviPaeseVendita(
  destinazione: string | null,
  paeseRaw: string | null
): { paeseVendita: string | null; errore?: string } {
  if (destinazione === "Italia") return { paeseVendita: "IT" };
  if (destinazione === "Estero") {
    if (!paeseRaw) return { paeseVendita: null };
    if (paeseRaw !== "IT" && CODICI_PAESI_UE.has(paeseRaw)) return { paeseVendita: paeseRaw };
    return { paeseVendita: null, errore: "Paese non valido." };
  }
  return { paeseVendita: null };
}

export function parseVendita(formData: FormData): Esito<ValoriVendita, CampoVendita> {
  const id = stringa(formData, "id");
  if (!UUID_RE.test(id)) return { ok: false, campi: {}, errore: "Articolo non valido." };

  const stato = stringa(formData, "stato") || "venduto";
  if (!(STATI_ARTICOLO as readonly string[]).includes(stato)) {
    return { ok: false, campi: {}, errore: "Stato non valido." };
  }
  // Il CHECK constraint sul database pretende data e prezzo per
  // venduto/consegnato: questo modulo non può portare ad altri stati.
  if (stato !== "venduto" && stato !== "consegnato") {
    return { ok: false, campi: {}, errore: "Questo modulo registra solo vendite." };
  }

  const dataVendita = stringa(formData, "data_vendita");
  const campi: Partial<Record<CampoVendita, string>> = {};
  if (!DATA_RE.test(dataVendita)) campi.data_vendita = "Indica la data di vendita.";

  // L'ordine dei controlli conta: `undefined` (non interpretabile) va verificato
  // prima di `null` (assente), altrimenti `== null` cattura entrambi e il
  // messaggio d'errore risulta sbagliato.
  const prezzo = importoOpzionale(stringa(formData, "prezzo_vendita"));
  if (prezzo === undefined) campi.prezzo_vendita = "Prezzo non valido o negativo.";
  else if (prezzo === null) campi.prezzo_vendita = "Indica il prezzo di vendita.";

  // Fee e spedizione sono facoltative: `null` è legittimo.
  const fee = importoOpzionale(stringa(formData, "fee"));
  if (fee === undefined) campi.fee = "Fee non valida o negativa.";

  const spedizione = importoOpzionale(stringa(formData, "costo_spedizione"));
  if (spedizione === undefined) campi.costo_spedizione = "Costo di spedizione non valido.";

  const destinazione = stringa(formData, "destinazione") || null;
  const { paeseVendita, errore: erroreePaese } = risolviPaeseVendita(
    destinazione,
    stringa(formData, "paese_vendita") || null
  );
  if (erroreePaese) campi.paese_vendita = erroreePaese;

  if (Object.keys(campi).length > 0) {
    return { ok: false, campi, errore: "Controlla i campi evidenziati." };
  }

  return {
    ok: true,
    valori: {
      id,
      stato,
      dataVendita,
      prezzoVendita: prezzo as number,
      fee: fee as number | null,
      costoSpedizione: spedizione as number | null,
      piattaformaVendita: stringa(formData, "piattaforma_vendita") || null,
      destinazione,
      paeseVendita,
      spedizioniere: stringa(formData, "spedizioniere") || null,
      prodottoSponsorizzato: spuntata(formData, "prodotto_sponsorizzato"),
      venditaPostOfferta: spuntata(formData, "vendita_post_offerta"),
    },
  };
}
