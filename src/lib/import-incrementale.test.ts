import { describe, expect, it } from "vitest";
import {
  classificaRiga,
  contaChiaviCorrezione,
  impronta,
  nomeSimileValoriDiversi,
  normalizzaNome,
  venditaUguale,
  type ArticoloCandidato,
  type ArticoloEsistente,
  type CampiVendita,
} from "./import-incrementale";

const NON_VENDUTO: CampiVendita = {
  stato: "acquistato",
  dataVendita: null,
  prezzoVendita: null,
  piattaformaVendita: null,
  fee: null,
  costoSpedizione: null,
  destinazione: null,
  paeseVendita: null,
  spedizioniere: null,
  sponsorizzato: false,
  postOfferta: false,
};

function venduto(overrides: Partial<CampiVendita> = {}): CampiVendita {
  return {
    ...NON_VENDUTO,
    stato: "consegnato",
    dataVendita: "2026-08-02",
    prezzoVendita: 50,
    piattaformaVendita: "Vinted",
    ...overrides,
  };
}

describe("normalizzaNome", () => {
  it("appiattisce maiuscole e spazi multipli", () => {
    expect(normalizzaNome("  Mario   Maker  3DS ")).toBe("mario maker 3ds");
  });
});

describe("impronta", () => {
  it("include nome, data e costo con due decimali fissi", () => {
    expect(impronta("mario maker 3ds", "2026-07-28", 2.5)).toBe("mario maker 3ds|2026-07-28|2.50");
  });
});

describe("venditaUguale", () => {
  it("true per campi identici", () => {
    expect(venditaUguale(venduto(), venduto())).toBe(true);
  });
  it("false se il prezzo differisce", () => {
    expect(venditaUguale(venduto(), venduto({ prezzoVendita: 51 }))).toBe(false);
  });
  it("ignora differenze oltre il centesimo dovute a virgola mobile", () => {
    expect(venditaUguale(venduto({ prezzoVendita: 0.1 + 0.2 }), venduto({ prezzoVendita: 0.3 }))).toBe(true);
  });
});

describe("classificaRiga", () => {
  const puppeteerDb: ArticoloEsistente = {
    id: "db-puppeteer",
    nomeNormalizzato: "puppeteer ps3 umido",
    dataAcquisto: "2026-04-05",
    costoAcquisto: 0,
    vendita: NON_VENDUTO,
  };

  function candidato(overrides: Partial<ArticoloCandidato> = {}): ArticoloCandidato {
    return {
      nomeNormalizzato: "puppeteer ps3 umido",
      dataAcquisto: "2026-04-05",
      costoAcquisto: 0,
      vendita: NON_VENDUTO,
      ...overrides,
    };
  }

  it("impronta esatta, database non ancora venduto, foglio venduto → aggiorna", () => {
    const esito = classificaRiga(candidato({ vendita: venduto() }), [puppeteerDb], new Map());
    expect(esito).toEqual({ esito: "aggiorna", id: "db-puppeteer" });
  });

  it("impronta esatta, entrambi non venduti → già presente, nessuna scrittura", () => {
    const esito = classificaRiga(candidato(), [puppeteerDb], new Map());
    expect(esito).toEqual({ esito: "gia_presente" });
  });

  it("impronta esatta, dati di vendita coincidenti → già presente", () => {
    const db = { ...puppeteerDb, vendita: venduto() };
    const esito = classificaRiga(candidato({ vendita: venduto() }), [db], new Map());
    expect(esito).toEqual({ esito: "gia_presente" });
  });

  it("impronta esatta, database già venduto con dati diversi → conflitto, non sovrascrive", () => {
    const db = { ...puppeteerDb, vendita: venduto({ prezzoVendita: 999 }) };
    const esito = classificaRiga(candidato({ vendita: venduto() }), [db], new Map());
    expect(esito.esito).toBe("conflitto");
  });

  it("impronta esatta con più corrispondenze in database → ambiguo", () => {
    const esito = classificaRiga(candidato(), [puppeteerDb, { ...puppeteerDb, id: "db-puppeteer-2" }], new Map());
    expect(esito.esito).toBe("ambiguo");
  });

  it("nessuna impronta esatta, stesso nome e data, costo diverso, univoco: correzione di costo (caso puppeteer)", () => {
    const conteggio = contaChiaviCorrezione([candidato({ costoAcquisto: 0.1 })]);
    const esito = classificaRiga(candidato({ costoAcquisto: 0.1, vendita: venduto() }), [puppeteerDb], conteggio);
    expect(esito).toEqual({ esito: "correzione_costo", id: "db-puppeteer", costoDb: 0 });
  });

  it("correzione di costo anche quando non ci sono dati di vendita da nessuna parte", () => {
    const conteggio = contaChiaviCorrezione([candidato({ costoAcquisto: 0.1 })]);
    const esito = classificaRiga(candidato({ costoAcquisto: 0.1 }), [puppeteerDb], conteggio);
    expect(esito).toEqual({ esito: "correzione_costo", id: "db-puppeteer", costoDb: 0 });
  });

  it("stesso nome/data ma database già venduto con dati diversi → conflitto, niente correzione", () => {
    const db = { ...puppeteerDb, vendita: venduto({ prezzoVendita: 999 }) };
    const conteggio = contaChiaviCorrezione([candidato({ costoAcquisto: 0.1 })]);
    const esito = classificaRiga(candidato({ costoAcquisto: 0.1, vendita: venduto() }), [db], conteggio);
    expect(esito.esito).toBe("conflitto");
  });

  it("più righe del foglio competono per la stessa correzione → ambiguo", () => {
    const candidati = [candidato({ costoAcquisto: 0.1 }), candidato({ costoAcquisto: 0.2 })];
    const conteggio = contaChiaviCorrezione(candidati);
    const esito = classificaRiga(candidati[0], [puppeteerDb], conteggio);
    expect(esito.esito).toBe("ambiguo");
  });

  it("più articoli in database condividono nome e data con costi diversi → ambiguo", () => {
    const conteggio = contaChiaviCorrezione([candidato({ costoAcquisto: 0.1 })]);
    const esito = classificaRiga(
      candidato({ costoAcquisto: 0.1 }),
      [puppeteerDb, { ...puppeteerDb, id: "db-puppeteer-2", costoAcquisto: 5 }],
      conteggio
    );
    expect(esito.esito).toBe("ambiguo");
  });

  it("nessuna corrispondenza per nome, data o costo → inserisci", () => {
    const esito = classificaRiga(candidato({ nomeNormalizzato: "zelda totk", dataAcquisto: "2026-07-28" }), [
      puppeteerDb,
    ], new Map());
    expect(esito).toEqual({ esito: "inserisci" });
  });
});

describe("nomeSimileValoriDiversi", () => {
  const esistente: ArticoloEsistente = {
    id: "db-1",
    nomeNormalizzato: "mario kart 8 switch",
    dataAcquisto: "2026-05-11",
    costoAcquisto: 27.39,
    vendita: NON_VENDUTO,
  };

  it("segnala un nome coincidente con data/costo diversi, senza deciderne l'esito", () => {
    const trovato = nomeSimileValoriDiversi(
      { nomeNormalizzato: "mario kart 8 switch", dataAcquisto: "2026-07-29", costoAcquisto: 16.64, vendita: NON_VENDUTO },
      [esistente]
    );
    expect(trovato).toEqual(esistente);
  });

  it("non segnala nulla quando l'impronta coincide", () => {
    const trovato = nomeSimileValoriDiversi(
      { nomeNormalizzato: "mario kart 8 switch", dataAcquisto: "2026-05-11", costoAcquisto: 27.39, vendita: NON_VENDUTO },
      [esistente]
    );
    expect(trovato).toBeUndefined();
  });

  it("non segnala nulla per nomi diversi", () => {
    const trovato = nomeSimileValoriDiversi(
      { nomeNormalizzato: "zelda totk", dataAcquisto: "2026-07-28", costoAcquisto: 40, vendita: NON_VENDUTO },
      [esistente]
    );
    expect(trovato).toBeUndefined();
  });
});
