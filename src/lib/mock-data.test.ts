import { describe, expect, it } from "vitest";
import {
  articoliMock,
  kpi,
  venditePerCategoria,
  venditePerDestinazione,
  venditePerFonte,
  venditePerMese,
  venditePerPiattaforma,
} from "@/lib/mock-data";

// I dati mock sono generati con un PRNG deterministico (mulberry32, seed fisso),
// quindi articoliMock e le aggregazioni derivate sono stabili tra le run di test.

const venduti = articoliMock.filter((a) => a.stato === "venduto" || a.stato === "consegnato");
const nonVenduti = articoliMock.filter((a) => a.stato === "acquistato" || a.stato === "in vendita");

describe("articoliMock - invarianti null-safe", () => {
  it("contiene sia articoli venduti che non venduti (precondizione per i test seguenti)", () => {
    expect(venduti.length).toBeGreaterThan(0);
    expect(nonVenduti.length).toBeGreaterThan(0);
  });

  it("gli articoli NON venduti hanno profitto null e nessun dato di vendita", () => {
    for (const a of nonVenduti) {
      expect(a.profitto).toBeNull();
      expect(a.prezzoVendita).toBeNull();
      expect(a.dataVendita).toBeNull();
      expect(a.piattaformaVendita).toBeNull();
      expect(a.fee).toBeNull();
      expect(a.costoSpedizione).toBeNull();
    }
  });

  it("gli articoli venduti/consegnati hanno sempre un profitto numerico valorizzato", () => {
    for (const a of venduti) {
      expect(typeof a.profitto).toBe("number");
      expect(Number.isNaN(a.profitto)).toBe(false);
      expect(typeof a.prezzoVendita).toBe("number");
    }
  });
});

describe("kpi - aggregazioni", () => {
  it("numeroVendite conta solo gli articoli venduti/consegnati, non quelli invenduti", () => {
    expect(kpi.numeroVendite).toBe(venduti.length);
    expect(kpi.numeroVendite).toBeLessThan(articoliMock.length);
  });

  it("prezzoMedioVendita e venditeTotali si calcolano solo sui venduti con prezzo valorizzato", () => {
    const totaleAtteso =
      Math.round(venduti.reduce((s, a) => s + (a.prezzoVendita ?? 0), 0) * 100) / 100;
    const mediaAttesa = Math.round((totaleAtteso / venduti.length) * 100) / 100;

    expect(kpi.venditeTotali).toBeCloseTo(totaleAtteso, 2);
    expect(kpi.prezzoMedioVendita).toBeCloseTo(mediaAttesa, 2);
    // gli articoli non venduti (prezzoVendita null) non devono influenzare la media
    expect(Number.isNaN(kpi.prezzoMedioVendita)).toBe(false);
  });

  it("profittoTotale somma i profitti trattando i null come 0 (null-safe)", () => {
    const atteso = Math.round(venduti.reduce((s, a) => s + (a.profitto ?? 0), 0) * 100) / 100;
    expect(kpi.profittoTotale).toBeCloseTo(atteso, 2);
    expect(Number.isNaN(kpi.profittoTotale)).toBe(false);
  });

  it("fondiImmobilizzati somma solo il costo d'acquisto degli articoli non venduti", () => {
    const atteso = Math.round(nonVenduti.reduce((s, a) => s + a.costoAcquisto, 0) * 100) / 100;
    expect(kpi.fondiImmobilizzati).toBeCloseTo(atteso, 2);
  });

  it("capitale è la somma di fondiImmobilizzati e profittoTotale", () => {
    const atteso = Math.round((kpi.fondiImmobilizzati + kpi.profittoTotale) * 100) / 100;
    expect(kpi.capitale).toBeCloseTo(atteso, 2);
  });
});

describe("venditePerMese", () => {
  const mesi = venditePerMese();

  it("restituisce almeno un mese e nessun valore NaN", () => {
    expect(mesi.length).toBeGreaterThan(0);
    for (const m of mesi) {
      expect(Number.isNaN(m.totaleVendite)).toBe(false);
      expect(Number.isNaN(m.prezzoMedio)).toBe(false);
      expect(Number.isNaN(m.profitto)).toBe(false);
      expect(Number.isNaN(m.numeroVendite)).toBe(false);
    }
  });

  it("è ordinato cronologicamente per chiave mese (YYYY-MM)", () => {
    const chiavi = mesi.map((m) => m.mese);
    const ordinate = [...chiavi].sort((a, b) => a.localeCompare(b));
    expect(chiavi).toEqual(ordinate);
  });

  it("il numero totale di vendite sui mesi combacia con il totale dei venduti", () => {
    const totaleVenditeMesi = mesi.reduce((s, m) => s + m.numeroVendite, 0);
    expect(totaleVenditeMesi).toBe(venduti.length);
  });
});

describe("distribuzioni (venditePerCategoria/Piattaforma/Fonte/Destinazione)", () => {
  it.each([
    ["venditePerCategoria", venditePerCategoria],
    ["venditePerPiattaforma", venditePerPiattaforma],
    ["venditePerFonte", venditePerFonte],
    ["venditePerDestinazione", venditePerDestinazione],
  ])("%s non produce valori NaN e la somma combacia col totale dei venduti", (_nome, fn) => {
    const voci = fn();
    expect(voci.length).toBeGreaterThan(0);
    for (const v of voci) {
      expect(Number.isNaN(v.value)).toBe(false);
      expect(v.value).toBeGreaterThan(0);
    }
    const totale = voci.reduce((s, v) => s + v.value, 0);
    expect(totale).toBe(venduti.length);
  });
});
