// Le liste sottostanti sono i valori *noti* (seed e mock). Non sono vincoli:
// le colonne corrispondenti su Postgres sono `text` libero (nessun enum),
// quindi i tipi di dominio più sotto usano `string` per non mentire su cosa
// può realmente arrivare dal database.
//
// Categorie NON sono più lette da qui dai form (0015_categorie_configurabili):
// sono per-installazione, in tabella `categorie`, gestibili da Impostazioni.
// Questa lista sopravvive solo come (a) il seed della migration — deve restare
// identica ai valori inseriti lì — e (b) valori di esempio per i dati mock
// (src/lib/mock-data.ts).
export const CATEGORIE = ["Videogiochi", "Console", "Controller", "Accessori"] as const;
// Piattaforme di vendita, fonti di acquisto e spedizionieri NON sono più letti
// da qui dai form (0013_canali_configurabili): sono per-installazione, in
// tabella `canali`, gestibili da Impostazioni. Queste tre liste sopravvivono
// solo come (a) il seed della migration — devono restare identiche ai valori
// inseriti lì, altrimenti l'installazione esistente cambierebbe suggerimenti —
// e (b) valori di esempio per i dati mock (src/lib/mock-data.ts). Non sono più
// l'unica fonte di verità: quella è il database.
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

/**
 * I tre tipi di canale configurabile (0013_canali_configurabili). Corrispondono
 * 1:1 alle colonne `articoli.piattaforma_vendita/fonte_acquisto/spedizioniere`
 * che ciascun tipo suggerisce.
 */
export const TIPI_CANALE = ["piattaforma_vendita", "fonte_acquisto", "spedizioniere"] as const;
export type TipoCanale = (typeof TIPI_CANALE)[number];

/** Etichetta in italiano di un tipo di canale, per titoli e messaggi in UI. */
export const ETICHETTA_TIPO_CANALE: Record<TipoCanale, string> = {
  piattaforma_vendita: "Piattaforma di vendita",
  fonte_acquisto: "Fonte di acquisto",
  spedizioniere: "Spedizioniere",
};

/** Un canale configurabile, con quanti articoli storici usano ancora il suo nome. */
export interface Canale {
  id: string;
  tipo: TipoCanale;
  nome: string;
  attivo: boolean;
  ordine: number;
  /** Articoli la cui colonna corrispondente contiene esattamente `nome` (indipendentemente da questo canale essendo attivo o meno). */
  conteggioArticoli: number;
}

/** Un paese configurabile, con quanti articoli storici usano ancora il suo codice. */
export interface Paese {
  codice: string;
  nome: string;
  ue: boolean;
  attivo: boolean;
  ordine: number;
  /** Articoli con `paese_vendita` uguale a `codice` (indipendentemente da questo paese essendo attivo o meno). */
  conteggioArticoli: number;
}

/** Una categoria prodotto configurabile, con quanti modelli usano ancora il suo nome. */
export interface Categoria {
  id: string;
  nome: string;
  attivo: boolean;
  ordine: number;
  /** Prodotti la cui `categoria` corrisponde a `nome` (indipendentemente da questa riga essendo attiva o meno). */
  conteggioProdotti: number;
}

/**
 * I 27 stati membri UE (codice ISO 3166-1 alpha-2 → nome italiano), verificati
 * e non a memoria: il Regno Unito non ne fa più parte da Brexit; Norvegia,
 * Svizzera e Islanda non sono mai state membri UE pur essendo nello spazio
 * economico/Schengen.
 *
 * Non è più l'unica fonte di verità né il vincolo su `articoli.paese_vendita`
 * (il CHECK di 0009 è caduto in 0014_paesi_configurabili): i paesi sono
 * per-installazione, in tabella `paesi`, gestibili da Impostazioni. Questa
 * lista sopravvive solo come (a) il seed della migration — deve restare
 * identica ai valori inseriti lì, più US aggiunto a parte — e (b) valori di
 * esempio per i dati mock. `nomePaese` resta un fallback di etichetta se un
 * codice non è nella mappa caricata a runtime.
 */
export const PAESI_UE = [
  { codice: "AT", nome: "Austria" },
  { codice: "BE", nome: "Belgio" },
  { codice: "BG", nome: "Bulgaria" },
  { codice: "CY", nome: "Cipro" },
  { codice: "HR", nome: "Croazia" },
  { codice: "DK", nome: "Danimarca" },
  { codice: "EE", nome: "Estonia" },
  { codice: "FI", nome: "Finlandia" },
  { codice: "FR", nome: "Francia" },
  { codice: "DE", nome: "Germania" },
  { codice: "GR", nome: "Grecia" },
  { codice: "IE", nome: "Irlanda" },
  { codice: "IT", nome: "Italia" },
  { codice: "LV", nome: "Lettonia" },
  { codice: "LT", nome: "Lituania" },
  { codice: "LU", nome: "Lussemburgo" },
  { codice: "MT", nome: "Malta" },
  { codice: "NL", nome: "Paesi Bassi" },
  { codice: "PL", nome: "Polonia" },
  { codice: "PT", nome: "Portogallo" },
  { codice: "CZ", nome: "Repubblica Ceca" },
  { codice: "RO", nome: "Romania" },
  { codice: "SK", nome: "Slovacchia" },
  { codice: "SI", nome: "Slovenia" },
  { codice: "ES", nome: "Spagna" },
  { codice: "SE", nome: "Svezia" },
  { codice: "HU", nome: "Ungheria" },
] as const;

export type CodicePaeseUe = (typeof PAESI_UE)[number]["codice"];

const MAPPA_PAESI_UE = new Map<string, string>(PAESI_UE.map((p) => [p.codice, p.nome]));

/** Nome italiano di un codice paese noto nel seed UE, o il codice stesso se non riconosciuto. Fallback: a runtime le etichette arrivano da `paesi`. */
export function nomePaese(codice: string): string {
  return MAPPA_PAESI_UE.get(codice) ?? codice;
}
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
  /** Codice ISO paese, noto solo se inserito al momento della vendita. NULL = paese ignoto. */
  paeseVendita: string | null;
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

/** Una riga (paese o "senza paese") della tabella vendite per paese/anno. */
export interface VenditaPerPaese {
  /** Codice ISO, o null per il gruppo "senza paese noto". */
  paese: string | null;
  /** Nome da `paesi`; assente sulle righe "senza paese". */
  nome?: string;
  /** Destinazione della riga vista (`Italia`/`Estero`/null): serve a distinguere
   * due aggregati con lo stesso codice paese dopo un cambio di origine. */
  destinazione?: string | null;
  numeroVendite: number;
  totaleVendite: number;
  profittoTotale: number;
}

/** Un sottototale aggregato: numero vendite, totale e profitto. */
export interface SubtotaleVendite {
  numeroVendite: number;
  totaleVendite: number;
  profittoTotale: number;
}

/**
 * Un anno solare della tabella vendite per paese/anno, già aggregato.
 *
 * Il gruppo "senza paese noto" si sdoppia in due livelli di incertezza
 * diversi, che richiedono correzioni diverse (0012_vendite_senza_paese_destinazione):
 * - `senzaPaeseEstero`: destinazione = 'Estero', paese ignoto. Certamente
 *   venduto fuori Italia, manca solo quale paese UE.
 * - `senzaPaeseIgnota`: anche `destinazione` è NULL. Non si sa nemmeno se la
 *   vendita sia italiana o estera.
 */
export interface VenditaPerPaeseAnno {
  anno: number;
  /** Nome configurato del paese di origine, per l'etichetta del totale UE. */
  nomeOrigine: string;
  righe: VenditaPerPaese[];
  senzaPaeseEstero: VenditaPerPaese;
  senzaPaeseIgnota: VenditaPerPaese;
  /** Somma dei paesi UE tranne il paese di origine (righe con `ue` e codice ≠ origine). */
  totaleUeEsclusaItalia: SubtotaleVendite;
  /** Somma delle righe con paese noto, `ue === false` e codice ≠ origine. */
  extraUe: SubtotaleVendite;
  /**
   * Venduto fuori Italia come intervallo, non come singolo numero: un totale
   * unico o è "tutto certo" (nessuna lacuna, minimo = massimo) o nasconde
   * quanto già si sa. `minimo` = totaleUeEsclusaItalia + extraUe +
   * senzaPaeseEstero (certamente estero). `massimo` = minimo + senzaPaeseIgnota
   * (potrebbe esserlo). `incompleto` = esiste almeno una vendita senza paese:
   * quando è false, minimo e massimo coincidono e la UI mostra un totale pulito.
   */
  totaleFuoriItalia: {
    minimo: SubtotaleVendite;
    massimo: SubtotaleVendite;
    incompleto: boolean;
  };
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
