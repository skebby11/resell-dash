import { describe, expect, it } from "vitest";
import { articoliMock, prodottiMock } from "@/lib/mock-data";
import { STATI_ARTICOLO } from "@/types";

// I dati mock sono generati con un PRNG deterministico (mulberry32, seed fisso),
// quindi articoliMock è stabile tra le run.
//
// Questi test coprono gli invarianti che il seed deve rispettare per poter
// scrivere su Postgres: i vincoli del database (CHECK, NOT NULL) rifiuterebbero
// dati incoerenti, e `npm run seed -- --demo` fallirebbe a metà inserimento.

const venduti = articoliMock.filter((a) => a.stato === "venduto" || a.stato === "consegnato");
const nonVenduti = articoliMock.filter((a) => a.stato === "acquistato" || a.stato === "in vendita");

describe("prodottiMock", () => {
  it("ha nomi non vuoti e univoci: il seed deduplica per nome", () => {
    const nomi = prodottiMock.map((p) => p.nome);
    expect(nomi.every((n) => n.trim().length > 0)).toBe(true);
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it("ha barcode univoci dove presenti: la colonna ha un vincolo UNIQUE", () => {
    const barcode = prodottiMock.map((p) => p.barcode).filter((b): b is string => Boolean(b));
    expect(new Set(barcode).size).toBe(barcode.length);
  });

  it("non ha prezzi negativi: violerebbero i CHECK su prodotti", () => {
    for (const p of prodottiMock) {
      if (p.prezzoMedioAcquisto != null) expect(p.prezzoMedioAcquisto).toBeGreaterThanOrEqual(0);
      if (p.prezzoMedioVendita != null) expect(p.prezzoMedioVendita).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("articoliMock", () => {
  it("contiene sia articoli venduti che non venduti (precondizione dei test seguenti)", () => {
    expect(venduti.length).toBeGreaterThan(0);
    expect(nonVenduti.length).toBeGreaterThan(0);
  });

  it("usa solo stati ammessi dal CHECK constraint su articoli.stato", () => {
    for (const a of articoliMock) {
      expect(STATI_ARTICOLO).toContain(a.stato);
    }
  });

  it("riferisce sempre un prodotto esistente: la FK è NOT NULL", () => {
    const idProdotti = new Set(prodottiMock.map((p) => p.id));
    for (const a of articoliMock) {
      expect(idProdotti.has(a.prodottoId), a.prodottoId).toBe(true);
    }
  });

  it("ha data e costo di acquisto sempre valorizzati: sono NOT NULL sul database", () => {
    for (const a of articoliMock) {
      expect(a.dataAcquisto).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.costoAcquisto).toBeGreaterThanOrEqual(0);
      expect(a.fonteAcquisto.length).toBeGreaterThan(0);
    }
  });

  it("gli articoli NON venduti non hanno dati di vendita né profitto", () => {
    for (const a of nonVenduti) {
      expect(a.profitto).toBeNull();
      expect(a.prezzoVendita).toBeNull();
      expect(a.dataVendita).toBeNull();
      expect(a.piattaformaVendita).toBeNull();
      expect(a.fee).toBeNull();
      expect(a.costoSpedizione).toBeNull();
    }
  });

  it("i venduti hanno data e prezzo: il CHECK articoli_venduto_richiede_dati_vendita lo impone", () => {
    for (const a of venduti) {
      expect(a.dataVendita).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof a.prezzoVendita).toBe("number");
      expect(a.prezzoVendita).toBeGreaterThanOrEqual(0);
    }
  });

  it("il profitto dei venduti combacia con la formula della colonna generated", () => {
    for (const a of venduti) {
      const atteso =
        a.prezzoVendita! - a.costoAcquisto - (a.costoSpedizione ?? 0) - (a.fee ?? 0);
      expect(a.profitto).toBeCloseTo(atteso, 2);
    }
  });

  it("non vende un articolo prima di averlo comprato", () => {
    for (const a of venduti) {
      expect(a.dataVendita! >= a.dataAcquisto, `${a.id}: ${a.dataVendita} < ${a.dataAcquisto}`).toBe(
        true
      );
    }
  });
});
