/**
 * Logica di deduplicazione e riconciliazione per l'import incrementale del
 * CSV inventario (vedi `scripts/import-csv.ts`). Isolata in un modulo puro —
 * nessuna chiamata a Supabase qui dentro — perché è la parte delicata
 * dell'import: decide se una riga del foglio è nuova, corrisponde a un
 * articolo già in database (e va aggiornato) o è ambigua/in conflitto e va
 * solo segnalata. Pensata per essere verificata con un test, non solo letta.
 *
 * Gli articoli non hanno una chiave naturale nello schema: l'impronta usata
 * per riconoscere "la stessa riga già importata" è nome normalizzato + data
 * di acquisto + costo di acquisto. Un costo diverso indica di norma un
 * esemplare fisico diverso — ma quando nome e data d'acquisto coincidono e
 * sia il foglio sia il database hanno UNA sola riga così, è più verosimile
 * una correzione di battitura sul costo che due acquisti distinti dello
 * stesso identico modello lo stesso giorno (vedi `classificaRiga`, ramo
 * "correzione di costo" — caso reale: "puppeteer ps3 umido", costo 0 in
 * database corretto a 0,10 nel foglio).
 *
 * Il foglio viene rieditato più volte dal proprietario: oltre a righe nuove,
 * capita che una riga già importata come "acquistato" risulti ora venduta.
 * L'aggiornamento dei soli campi del lato vendita è ammesso solo quando la
 * corrispondenza è univoca *e* il database non ha già dati di vendita che
 * divergono da quelli del foglio — il proprietario registra vendite anche
 * dall'app, quindi sovrascrivere in silenzio rischierebbe di distruggere un
 * dato inserito a mano. Vedi le regole complete nel commento di
 * `classificaRiga`.
 */

export function normalizzaNome(nome: string): string {
  return nome.toLowerCase().replace(/\s+/g, " ").trim();
}

export function impronta(nomeNormalizzato: string, dataAcquisto: string, costoAcquisto: number): string {
  return `${nomeNormalizzato}|${dataAcquisto}|${costoAcquisto.toFixed(2)}`;
}

/** Chiave "stesso nome, stessa data d'acquisto" usata per il ramo di correzione costo. */
function chiaveCorrezione(nomeNormalizzato: string, dataAcquisto: string): string {
  return `${nomeNormalizzato}|${dataAcquisto}`;
}

/** I soli campi del lato vendita: quelli che l'import incrementale può scrivere su un
 * articolo già esistente. Non includono mai `data_acquisto`, `fonte_acquisto`, `note`,
 * `prodotto_id` (mai toccati) né `profitto` (colonna generated). */
export interface CampiVendita {
  stato: string;
  dataVendita: string | null;
  prezzoVendita: number | null;
  piattaformaVendita: string | null;
  fee: number | null;
  costoSpedizione: number | null;
  destinazione: string | null;
  paeseVendita: string | null;
  spedizioniere: string | null;
  sponsorizzato: boolean;
  postOfferta: boolean;
}

export interface ArticoloEsistente {
  id: string;
  nomeNormalizzato: string;
  dataAcquisto: string;
  costoAcquisto: number;
  vendita: CampiVendita;
}

export interface ArticoloCandidato {
  nomeNormalizzato: string;
  dataAcquisto: string;
  costoAcquisto: number;
  vendita: CampiVendita;
}

/** Un articolo "ha dati di vendita" solo se è registrato come venduto/consegnato: il CHECK
 * `articoli_venduto_richiede_dati_vendita` garantisce che in quel caso data e prezzo di
 * vendita siano valorizzati, quindi basta guardare lo stato. */
function haDatiVendita(v: CampiVendita): boolean {
  return v.stato === "venduto" || v.stato === "consegnato";
}

function arrotonda(n: number | null): number | null {
  return n == null ? null : Math.round(n * 100);
}

/** Confronta tutti i campi del lato vendita: torna true solo se sono identici. */
export function venditaUguale(a: CampiVendita, b: CampiVendita): boolean {
  return (
    a.stato === b.stato &&
    a.dataVendita === b.dataVendita &&
    arrotonda(a.prezzoVendita) === arrotonda(b.prezzoVendita) &&
    (a.piattaformaVendita ?? null) === (b.piattaformaVendita ?? null) &&
    arrotonda(a.fee) === arrotonda(b.fee) &&
    arrotonda(a.costoSpedizione) === arrotonda(b.costoSpedizione) &&
    (a.destinazione ?? null) === (b.destinazione ?? null) &&
    (a.paeseVendita ?? null) === (b.paeseVendita ?? null) &&
    (a.spedizioniere ?? null) === (b.spedizioniere ?? null) &&
    a.sponsorizzato === b.sponsorizzato &&
    a.postOfferta === b.postOfferta
  );
}

export type EsitoRiga =
  | { esito: "inserisci" }
  | { esito: "gia_presente" }
  | { esito: "aggiorna"; id: string }
  | { esito: "correzione_costo"; id: string; costoDb: number }
  | { esito: "conflitto"; id: string; motivo: string }
  | { esito: "ambiguo"; motivo: string };

/** Conta, per ogni chiave nome+data d'acquisto, quante righe del CSV la condividono — serve a
 * `classificaRiga` per rifiutare una correzione di costo quando più righe del foglio
 * potrebbero competere per lo stesso articolo esistente. */
export function contaChiaviCorrezione(candidati: ArticoloCandidato[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of candidati) {
    const k = chiaveCorrezione(c.nomeNormalizzato, c.dataAcquisto);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function valutaScritturaVendita(candidato: ArticoloCandidato, esistente: ArticoloEsistente): EsitoRiga {
  if (!haDatiVendita(esistente.vendita)) {
    return haDatiVendita(candidato.vendita) ? { esito: "aggiorna", id: esistente.id } : { esito: "gia_presente" };
  }
  if (venditaUguale(esistente.vendita, candidato.vendita)) return { esito: "gia_presente" };
  return {
    esito: "conflitto",
    id: esistente.id,
    motivo: "l'articolo in database ha già dati di vendita diversi da quelli del foglio",
  };
}

/**
 * Classifica una riga del CSV rispetto a quanto già nel database:
 *
 * 1. Impronta esatta (nome, data acquisto, costo acquisto) con una sola
 *    corrispondenza → se il database non ha ancora dati di vendita, o
 *    coincidono con quelli del foglio: `aggiorna` (o `gia_presente` se non
 *    c'è nulla da scrivere); se il database ha già dati di vendita diversi:
 *    `conflitto`, non si sovrascrive. Più di una corrispondenza → `ambiguo`.
 * 2. Nessuna impronta esatta, ma stesso nome e stessa data d'acquisto (costo
 *    diverso) individuano un'unica riga sia nel foglio sia nel database:
 *    `correzione_costo`, con la stessa logica di conflitto sulla vendita.
 *    Più corrispondenze da un lato o dall'altro → `ambiguo`, nessuna
 *    correzione applicata.
 * 3. Altrimenti → `inserisci`.
 */
export function classificaRiga(
  candidato: ArticoloCandidato,
  esistenti: ArticoloEsistente[],
  conteggioChiaviCsv: Map<string, number>
): EsitoRiga {
  const impCandidato = impronta(candidato.nomeNormalizzato, candidato.dataAcquisto, candidato.costoAcquisto);
  const corrispondenzeEsatte = esistenti.filter(
    (e) => impronta(e.nomeNormalizzato, e.dataAcquisto, e.costoAcquisto) === impCandidato
  );

  if (corrispondenzeEsatte.length > 1) {
    return {
      esito: "ambiguo",
      motivo: `${corrispondenzeEsatte.length} articoli già in database condividono nome, data e costo di acquisto`,
    };
  }
  if (corrispondenzeEsatte.length === 1) {
    return valutaScritturaVendita(candidato, corrispondenzeEsatte[0]);
  }

  const chiave = chiaveCorrezione(candidato.nomeNormalizzato, candidato.dataAcquisto);
  const stessaChiaveDb = esistenti.filter((e) => chiaveCorrezione(e.nomeNormalizzato, e.dataAcquisto) === chiave);

  if (stessaChiaveDb.length > 1) {
    return {
      esito: "ambiguo",
      motivo: `${stessaChiaveDb.length} articoli in database condividono nome e data di acquisto con costi diversi: correzione non applicabile`,
    };
  }
  if (stessaChiaveDb.length === 1) {
    if ((conteggioChiaviCsv.get(chiave) ?? 0) > 1) {
      return {
        esito: "ambiguo",
        motivo:
          "più righe nel foglio condividono nome e data d'acquisto con un solo articolo in database: la correzione di costo non è univoca",
      };
    }
    const [e] = stessaChiaveDb;
    const esitoVendita = valutaScritturaVendita(candidato, e);
    if (esitoVendita.esito === "conflitto") return esitoVendita;
    // "aggiorna" o "gia_presente" diventano entrambi una correzione di costo: anche se i
    // campi vendita coincidono/sono assenti su entrambi i lati, il costo va comunque
    // corretto — è l'unica differenza residua tra foglio e database.
    return { esito: "correzione_costo", id: e.id, costoDb: e.costoAcquisto };
  }

  return { esito: "inserisci" };
}

/**
 * Solo per segnalazione, non per decidere: un articolo esistente con lo stesso nome
 * normalizzato ma data d'acquisto diversa (quindi non un candidato a correzione di costo,
 * vedi sopra) e impronta diversa. Non blocca l'inserimento — rende solo visibile
 * nell'output un possibile refuso o un acquisto ripetuto dello stesso modello, da
 * controllare a occhio.
 */
export function nomeSimileValoriDiversi(
  candidato: ArticoloCandidato,
  esistenti: ArticoloEsistente[]
): ArticoloEsistente | undefined {
  const impCandidato = impronta(candidato.nomeNormalizzato, candidato.dataAcquisto, candidato.costoAcquisto);
  return esistenti.find(
    (e) =>
      e.nomeNormalizzato === candidato.nomeNormalizzato &&
      impronta(e.nomeNormalizzato, e.dataAcquisto, e.costoAcquisto) !== impCandidato
  );
}
