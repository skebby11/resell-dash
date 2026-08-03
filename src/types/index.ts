// Le liste sottostanti sono i valori *noti*, usati per popolare i form e le
// legende. Non sono vincoli: le colonne corrispondenti su Postgres sono `text`
// libero (nessun enum), quindi i tipi di dominio più sotto usano `string` per
// non mentire su cosa può realmente arrivare dal database.
export const CATEGORIE = ["Videogiochi", "Console", "Controller", "Accessori"] as const;
// Piattaforme, fonti e spedizionieri includono i valori realmente presenti nello
// storico importato dal foglio: sono suggerimenti, non vincoli, perché le colonne
// sono `text` libero e prima o poi comparirà un canale nuovo.
export const PIATTAFORME_VENDITA = [
  "eBay",
  "Vinted",
  "Wallapop",
  "Subito",
  "Transazione Privata",
] as const;
export const FONTI_ACQUISTO = ["Vinted", "eBay", "Subito", "Wallapop", "Amici/Parenti", "Altro"] as const;
export const SPEDIZIONIERI = [
  "BRT",
  "Poste Italiane",
  "InPost",
  "UPS",
  "DHL",
  "Scambio a mano",
] as const;
export const DESTINAZIONI = ["Italia", "Estero"] as const;
// Piattaforme di gioco (console/handheld): suggerimenti per il datalist del
// form di inserimento, non un vincolo — `prodotti.piattaforma_gioco` è testo
// libero, tra l'altro perché il lookup IGDB può restituire varianti non elencate.
export const PIATTAFORME_GIOCO = [
  "PS5",
  "PS4",
  "Xbox Series X|S",
  "Xbox One",
  "Nintendo Switch",
  "Nintendo Switch OLED",
  "Nintendo Switch Lite",
  "PC",
] as const;

export type Categoria = (typeof CATEGORIE)[number];
export type PiattaformaVendita = (typeof PIATTAFORME_VENDITA)[number];
export type FonteAcquisto = (typeof FONTI_ACQUISTO)[number];
export type Spedizioniere = (typeof SPEDIZIONIERI)[number];
export type Destinazione = (typeof DESTINAZIONI)[number];

/**
 * Gli unici stati ammessi. A differenza delle liste sopra questo è un vincolo
 * reale: `articoli.stato` ha un CHECK constraint con esattamente questi valori.
 */
export const STATI_ARTICOLO = ["acquistato", "in vendita", "venduto", "consegnato"] as const;
export type StatoArticolo = (typeof STATI_ARTICOLO)[number];

/** Anagrafica prodotto: la "scheda" di un modello (es. "PS5 Slim", "FIFA 24"). */
export interface Prodotto {
  id: string;
  nome: string;
  categoria: string | null;
  /** Media storica dei costi di acquisto; null finché non c'è ancora uno storico. */
  prezzoMedioAcquisto: number | null;
  /** Media storica dei prezzi di vendita; null finché non c'è ancora uno storico. */
  prezzoMedioVendita: number | null;
  // Campi opzionali sul DB: il mapper li valorizza sempre (null se assenti),
  // ma restano `?` per poter scrivere literal concisi (seed, test, fixture).
  barcode?: string | null;
  piattaformaGioco?: string | null; // es. PS5, Xbox Series X, Nintendo Switch
  note?: string | null;
  fotoUrl?: string | null;
}

/** Singolo esemplare fisico acquistato/rivenduto, collegato a un Prodotto. */
export interface Articolo {
  id: string;
  prodottoId: string; // NOT NULL, ON DELETE RESTRICT lato DB: un articolo riferisce sempre un prodotto valido
  prodottoNome: string;
  categoria: string | null;

  dataAcquisto: string; // ISO date
  costoAcquisto: number;
  fonteAcquisto: string;
  stato: StatoArticolo;

  // Dati di vendita: nullable, valorizzati solo quando stato è 'venduto'/'consegnato'.
  dataVendita: string | null; // ISO date
  prezzoVendita: number | null;
  piattaformaVendita: string | null;
  fee: number | null;
  costoSpedizione: number | null;
  destinazione: string | null;
  spedizioniere: string | null;

  /** Note sul singolo esemplare: stato estetico, accessori, difetti. */
  note: string | null;

  prodottoSponsorizzato: boolean;
  venditaPostOfferta: boolean;

  /** prezzoVendita - costoAcquisto - costoSpedizione - fee. NULL finché non venduto/consegnato. */
  profitto: number | null;
}

export interface VenditaMensile {
  mese: string; // es. "2026-03"
  meseLabel: string; // es. "Mar 2026"
  numeroVendite: number;
  totaleVendite: number;
  prezzoMedio: number;
  profitto: number;
}

export interface DistribuzioneVoce {
  label: string;
  value: number;
}

export interface Kpi {
  numeroVendite: number;
  prezzoMedioVendita: number;
  venditeTotali: number;
  profittoTotale: number;
  /** Costo d'acquisto dello stock non ancora venduto (capitale fermo in merce). */
  fondiImmobilizzati: number;
  /** fondiImmobilizzati + profittoTotale. Non è un saldo di cassa. */
  capitale: number;
}
