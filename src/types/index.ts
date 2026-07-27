export type Categoria = "Videogiochi" | "Console" | "Controller" | "Accessori";

export type PiattaformaVendita = "eBay" | "Vinted" | "Wallapop";

export type FonteAcquisto = "Vinted" | "Altro" | "Amici/Parenti" | "eBay";

export type Destinazione = "Italia" | "Estero";

export type StatoArticolo = "acquistato" | "in vendita" | "venduto" | "consegnato";

/** Anagrafica prodotto: la "scheda" di un modello (es. "PS5 Slim", "FIFA 24"). */
export interface Prodotto {
  id: string;
  barcode?: string;
  nome: string;
  categoria: Categoria;
  piattaformaGioco?: string; // es. PS5, Xbox Series X, Nintendo Switch
  /** Media storica dei costi di acquisto; null finché non c'è ancora uno storico. */
  prezzoMedioAcquisto: number | null;
  /** Media storica dei prezzi di vendita; null finché non c'è ancora uno storico. */
  prezzoMedioVendita: number | null;
  note?: string;
  fotoUrl?: string;
}

/** Singolo esemplare fisico acquistato/rivenduto, collegato a un Prodotto. */
export interface Articolo {
  id: string;
  prodottoId: string; // NOT NULL, ON DELETE RESTRICT lato DB: un articolo riferisce sempre un prodotto valido
  prodottoNome: string;
  categoria: Categoria;

  dataAcquisto: string; // ISO date
  costoAcquisto: number;
  fonteAcquisto: FonteAcquisto;
  stato: StatoArticolo;

  // Dati di vendita: nullable, valorizzati solo quando stato è 'venduto'/'consegnato'.
  dataVendita: string | null; // ISO date
  prezzoVendita: number | null;
  piattaformaVendita: PiattaformaVendita | null;
  fee: number | null;
  costoSpedizione: number | null;
  destinazione: Destinazione | null;
  spedizioniere: string | null;

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
