import type {
  Articolo,
  Categoria,
  Destinazione,
  DistribuzioneVoce,
  FonteAcquisto,
  PiattaformaVendita,
  Prodotto,
  StatoArticolo,
  VenditaMensile,
} from "@/types";

// --- PRNG deterministico (mulberry32) per avere dati mock stabili tra server e client ---
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260724);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- Catalogo prodotti base ---
export const prodottiMock: Prodotto[] = [
  {
    id: "p-ps5-slim",
    barcode: "0711719574788",
    nome: "PlayStation 5 Slim",
    categoria: "Console",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 380,
    prezzoMedioVendita: 460,
    note: "Modello disco, richiestissima in inverno.",
  },
  {
    id: "p-ps5-digital",
    barcode: "0711719541148",
    nome: "PlayStation 5 Digital Edition",
    categoria: "Console",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 320,
    prezzoMedioVendita: 390,
  },
  {
    id: "p-xbox-series-x",
    barcode: "0889842640779",
    nome: "Xbox Series X",
    categoria: "Console",
    piattaformaGioco: "Xbox",
    prezzoMedioAcquisto: 340,
    prezzoMedioVendita: 410,
  },
  {
    id: "p-switch-oled",
    barcode: "0045496453435",
    nome: "Nintendo Switch OLED",
    categoria: "Console",
    piattaformaGioco: "Switch",
    prezzoMedioAcquisto: 260,
    prezzoMedioVendita: 315,
    note: "Sempre liquida, margine costante.",
  },
  {
    id: "p-switch-lite",
    barcode: "0045496882433",
    nome: "Nintendo Switch Lite",
    categoria: "Console",
    piattaformaGioco: "Switch",
    prezzoMedioAcquisto: 140,
    prezzoMedioVendita: 175,
  },
  {
    id: "p-fifa24",
    barcode: "5030946130545",
    nome: "EA Sports FC 24",
    categoria: "Videogiochi",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 18,
    prezzoMedioVendita: 32,
  },
  {
    id: "p-fc25",
    barcode: "5030946130583",
    nome: "EA Sports FC 25",
    categoria: "Videogiochi",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 32,
    prezzoMedioVendita: 52,
    note: "Alta domanda primi 3 mesi da uscita.",
  },
  {
    id: "p-zelda-totk",
    barcode: "0045496510601",
    nome: "The Legend of Zelda: Tears of the Kingdom",
    categoria: "Videogiochi",
    piattaformaGioco: "Switch",
    prezzoMedioAcquisto: 38,
    prezzoMedioVendita: 55,
  },
  {
    id: "p-mariokart8",
    barcode: "0045496420909",
    nome: "Mario Kart 8 Deluxe",
    categoria: "Videogiochi",
    piattaformaGioco: "Switch",
    prezzoMedioAcquisto: 30,
    prezzoMedioVendita: 45,
  },
  {
    id: "p-gta5",
    barcode: "5026555360976",
    nome: "Grand Theft Auto V",
    categoria: "Videogiochi",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 14,
    prezzoMedioVendita: 24,
  },
  {
    id: "p-elden-ring",
    barcode: "3391892017583",
    nome: "Elden Ring",
    categoria: "Videogiochi",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 28,
    prezzoMedioVendita: 42,
  },
  {
    id: "p-spiderman2",
    barcode: "0711719581700",
    nome: "Marvel's Spider-Man 2",
    categoria: "Videogiochi",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 34,
    prezzoMedioVendita: 50,
  },
  {
    id: "p-dualsense",
    barcode: "0711719541032",
    nome: "Controller DualSense",
    categoria: "Controller",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 42,
    prezzoMedioVendita: 62,
  },
  {
    id: "p-xbox-wireless",
    barcode: "0889842654387",
    nome: "Controller Xbox Wireless",
    categoria: "Controller",
    piattaformaGioco: "Xbox",
    prezzoMedioAcquisto: 38,
    prezzoMedioVendita: 55,
  },
  {
    id: "p-pro-controller",
    barcode: "0045496430027",
    nome: "Nintendo Switch Pro Controller",
    categoria: "Controller",
    piattaformaGioco: "Switch",
    prezzoMedioAcquisto: 45,
    prezzoMedioVendita: 65,
  },
  {
    id: "p-cuffie-gaming",
    nome: "Cuffie Gaming Pulse 3D",
    categoria: "Accessori",
    piattaformaGioco: "PS5",
    prezzoMedioAcquisto: 40,
    prezzoMedioVendita: 58,
  },
  {
    id: "p-caricabatterie-switch",
    nome: "Base di Ricarica Switch",
    categoria: "Accessori",
    piattaformaGioco: "Switch",
    prezzoMedioAcquisto: 15,
    prezzoMedioVendita: 24,
  },
  {
    id: "p-custodia-switch",
    nome: "Custodia Rigida Switch",
    categoria: "Accessori",
    piattaformaGioco: "Switch",
    prezzoMedioAcquisto: 8,
    prezzoMedioVendita: 15,
  },
];

const FONTI: FonteAcquisto[] = ["Vinted", "Altro", "Amici/Parenti", "eBay"];
const PIATTAFORME: PiattaformaVendita[] = ["eBay", "Vinted", "Wallapop"];
const DESTINAZIONI: Destinazione[] = ["Italia", "Estero"];

// mesi generati: Feb 2026 -> Lug 2026 (6 mesi, coerente con "oggi" 2026-07-24)
const MESI = [
  { anno: 2026, mese: 1, giorni: 28 }, // febbraio (0-index mese=1)
  { anno: 2026, mese: 2, giorni: 31 },
  { anno: 2026, mese: 3, giorni: 30 },
  { anno: 2026, mese: 4, giorni: 31 },
  { anno: 2026, mese: 5, giorni: 30 },
  { anno: 2026, mese: 6, giorni: 24 }, // luglio, fino a "oggi"
];

function isoDate(anno: number, mese: number, giorno: number): string {
  const mm = String(mese + 1).padStart(2, "0");
  const dd = String(giorno).padStart(2, "0");
  return `${anno}-${mm}-${dd}`;
}

function addDays(anno: number, mese: number, giorno: number, delta: number): string {
  const d = new Date(Date.UTC(anno, mese, giorno + delta));
  return d.toISOString().slice(0, 10);
}

function generaArticoli(): Articolo[] {
  const articoli: Articolo[] = [];
  const nArticoli = 37;

  for (let i = 0; i < nArticoli; i++) {
    const prodotto = pick(prodottiMock);
    const periodo = pick(MESI);
    const giornoAcquisto = randInt(1, periodo.giorni);
    const dataAcquisto = isoDate(periodo.anno, periodo.mese, giornoAcquisto);

    const variazioneCosto = 0.85 + rand() * 0.3;
    const costoAcquisto = round2(prodotto.prezzoMedioAcquisto * variazioneCosto);
    const fonteAcquisto = pick(FONTI);

    // distribuzione stato: la maggior parte è venduta/consegnata (per popolare la dashboard),
    // una minoranza è ancora in vendita o appena acquistata (fondi immobilizzati)
    const statoRoll = rand();
    let stato: StatoArticolo;
    if (statoRoll < 0.62) stato = "venduto";
    else if (statoRoll < 0.78) stato = "consegnato";
    else if (statoRoll < 0.92) stato = "in vendita";
    else stato = "acquistato";

    const articolo: Articolo = {
      id: `a-${String(i + 1).padStart(3, "0")}`,
      prodottoId: prodotto.id,
      prodottoNome: prodotto.nome,
      categoria: prodotto.categoria,
      dataAcquisto,
      costoAcquisto,
      fonteAcquisto,
      stato,
    };

    if (stato === "venduto" || stato === "consegnato") {
      const giorniAttesa = randInt(3, 45);
      const dataVendita = addDays(periodo.anno, periodo.mese, giornoAcquisto, giorniAttesa);
      // se la vendita supera oggi, ricadi nel mese di acquisto stesso (clamp semplice)
      const dataVenditaFinale =
        dataVendita > "2026-07-24" ? isoDate(periodo.anno, periodo.mese, periodo.giorni) : dataVendita;

      const variazioneVendita = 0.88 + rand() * 0.35;
      const prezzoVendita = round2(prodotto.prezzoMedioVendita * variazioneVendita);
      const piattaformaVendita = pick(PIATTAFORME);
      const fee = round2(prezzoVendita * (piattaformaVendita === "eBay" ? 0.1 : piattaformaVendita === "Vinted" ? 0.05 : 0.03));
      const costoSpedizione = round2(4 + rand() * 8);
      const destinazione: Destinazione = rand() < 0.78 ? "Italia" : DESTINAZIONI[1];

      articolo.dataVendita = dataVenditaFinale;
      articolo.prezzoVendita = prezzoVendita;
      articolo.piattaformaVendita = piattaformaVendita;
      articolo.fee = fee;
      articolo.costoSpedizione = costoSpedizione;
      articolo.destinazione = destinazione;
      articolo.prodottoSponsorizzato = rand() < 0.15;
      articolo.venditaPostOfferta = rand() < 0.3;
      articolo.spedizioniere = pick(["BRT", "Poste Italiane", "GLS", "InPost"]);
      articolo.profitto = round2(prezzoVendita - costoAcquisto - costoSpedizione - fee);
    }

    articoli.push(articolo);
  }

  return articoli.sort((a, b) => a.dataAcquisto.localeCompare(b.dataAcquisto));
}

export const articoliMock: Articolo[] = generaArticoli();

// --- Aggregazioni derivate per la dashboard ---

const venduti = articoliMock.filter((a) => a.stato === "venduto" || a.stato === "consegnato");
const nonVenduti = articoliMock.filter((a) => a.stato === "acquistato" || a.stato === "in vendita");

export const kpi = {
  numeroVendite: venduti.length,
  prezzoMedioVendita: round2(
    venduti.reduce((s, a) => s + (a.prezzoVendita ?? 0), 0) / (venduti.length || 1)
  ),
  venditeTotali: round2(venduti.reduce((s, a) => s + (a.prezzoVendita ?? 0), 0)),
  profittoTotale: round2(venduti.reduce((s, a) => s + (a.profitto ?? 0), 0)),
  fondiImmobilizzati: round2(nonVenduti.reduce((s, a) => s + a.costoAcquisto, 0)),
  get capitale() {
    return round2(this.fondiImmobilizzati + this.profittoTotale);
  },
};

const MESE_LABEL = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });

export function venditePerMese(): VenditaMensile[] {
  const gruppi = new Map<string, Articolo[]>();
  for (const a of venduti) {
    if (!a.dataVendita) continue;
    const chiave = a.dataVendita.slice(0, 7); // YYYY-MM
    if (!gruppi.has(chiave)) gruppi.set(chiave, []);
    gruppi.get(chiave)!.push(a);
  }

  return Array.from(gruppi.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mese, items]) => {
      const totale = round2(items.reduce((s, a) => s + (a.prezzoVendita ?? 0), 0));
      const profitto = round2(items.reduce((s, a) => s + (a.profitto ?? 0), 0));
      const [anno, m] = mese.split("-").map(Number);
      const label = MESE_LABEL.format(new Date(Date.UTC(anno, m - 1, 1)));
      return {
        mese,
        meseLabel: label.charAt(0).toUpperCase() + label.slice(1),
        numeroVendite: items.length,
        totaleVendite: totale,
        prezzoMedio: round2(totale / items.length),
        profitto,
      };
    });
}

function distribuzione<T extends string>(items: Articolo[], key: (a: Articolo) => T | undefined): DistribuzioneVoce[] {
  const conteggio = new Map<string, number>();
  for (const a of items) {
    const v = key(a);
    if (!v) continue;
    conteggio.set(v, (conteggio.get(v) ?? 0) + 1);
  }
  return Array.from(conteggio.entries()).map(([label, value]) => ({ label, value }));
}

export function venditePerCategoria(): DistribuzioneVoce[] {
  return distribuzione(venduti, (a) => a.categoria);
}

export function venditePerPiattaforma(): DistribuzioneVoce[] {
  return distribuzione(venduti, (a) => a.piattaformaVendita);
}

export function venditePerFonte(): DistribuzioneVoce[] {
  return distribuzione(venduti, (a) => a.fonteAcquisto);
}

export function venditePerDestinazione(): DistribuzioneVoce[] {
  return distribuzione(venduti, (a) => a.destinazione);
}

export const CATEGORIE: Categoria[] = ["Videogiochi", "Console", "Controller", "Accessori"];
