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
  prezzoMedioAcquisto: number;
  prezzoMedioVendita: number;
  note?: string;
  fotoUrl?: string;
}

/** Singolo esemplare fisico acquistato/rivenduto, collegato a un Prodotto. */
export interface Articolo {
  id: string;
  prodottoId: string;
  prodottoNome: string;
  categoria: Categoria;

  dataAcquisto: string; // ISO date
  costoAcquisto: number;
  fonteAcquisto: FonteAcquisto;
  stato: StatoArticolo;

  dataVendita?: string; // ISO date
  prezzoVendita?: number;
  piattaformaVendita?: PiattaformaVendita;
  fee?: number;
  costoSpedizione?: number;
  prodottoSponsorizzato?: boolean;
  venditaPostOfferta?: boolean;
  destinazione?: Destinazione;
  spedizioniere?: string;

  /** prezzoVendita - costoAcquisto - costoSpedizione - fee (solo se venduto) */
  profitto?: number;
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
