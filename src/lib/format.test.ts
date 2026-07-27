import { afterEach, describe, expect, it } from "vitest";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "@/lib/format";

describe("formatCurrency", () => {
  it("formatta un valore positivo in EUR con 2 decimali, stile it-IT", () => {
    // Il separatore delle migliaia ("." per it-IT) dipende dai dati ICU/CLDR
    // disponibili nell'ambiente che esegue il test (può mancare in alcuni
    // runtime); lo rendiamo opzionale nel match e verifichiamo invece i
    // dettagli rilevanti per la logica: 2 decimali, virgola come separatore
    // decimale e simbolo/posizione della valuta.
    expect(formatCurrency(1234.5)).toMatch(/^1\.?234,50\s€$/);
  });

  it("formatta lo zero come 0,00 €", () => {
    expect(formatCurrency(0)).toMatch(/^0,00\s€$/);
  });

  it("gestisce valori negativi (es. profitto in perdita)", () => {
    const out = formatCurrency(-42.5);
    expect(out).toContain("-");
    expect(out).toMatch(/42,50/);
  });

  it("arrotonda a 2 decimali senza troncare in modo scorretto", () => {
    expect(formatCurrency(9.999)).toMatch(/^10,00\s€$/);
  });
});

describe("formatCurrencyCompact", () => {
  it("arrotonda per eccesso senza mostrare decimali", () => {
    expect(formatCurrencyCompact(1234.5)).toMatch(/^1\.?235\s€$/);
  });

  it("arrotonda per difetto quando la parte decimale è < 0.5", () => {
    expect(formatCurrencyCompact(1234.4)).toMatch(/^1\.?234\s€$/);
  });

  it("non produce mai decimali anche con input non intero", () => {
    expect(formatCurrencyCompact(0.4)).toMatch(/^0\s€$/);
  });
});

describe("formatDate (comportamento UTC)", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("formatta una data date-only YYYY-MM-DD nel giorno corretto", () => {
    expect(formatDate("2026-01-01")).toBe("01 gen 2026");
    expect(formatDate("2026-12-31")).toBe("31 dic 2026");
  });

  it("non fa slittare il giorno indietro in fusi orari con offset negativo (es. UTC-11)", () => {
    // Bug storico: senza forzare timeZone:'UTC' nel formatter, una data date-only
    // mezzanotte UTC veniva mostrata come il giorno precedente nei fusi orari
    // "indietro" rispetto a UTC (es. Pacific/Midway, UTC-11).
    process.env.TZ = "Pacific/Midway";
    expect(formatDate("2026-01-01")).toBe("01 gen 2026");
  });

  it("non fa slittare il giorno avanti in fusi orari con offset positivo (es. UTC+14)", () => {
    process.env.TZ = "Pacific/Kiritimati";
    expect(formatDate("2026-01-01")).toBe("01 gen 2026");
  });

  it("è coerente indipendentemente dal fuso orario del processo per la stessa data", () => {
    process.env.TZ = "Pacific/Midway";
    const midway = formatDate("2026-06-15");
    process.env.TZ = "Pacific/Kiritimati";
    const kiritimati = formatDate("2026-06-15");
    expect(midway).toBe(kiritimati);
    expect(midway).toBe("15 giu 2026");
  });
});

describe("formatNumber", () => {
  it("formatta un intero (separatore delle migliaia dipendente dai dati ICU dell'ambiente)", () => {
    expect(formatNumber(1234)).toMatch(/^1\.?234$/);
  });

  it("formatta lo zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});
