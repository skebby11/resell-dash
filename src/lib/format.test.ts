import { afterEach, describe, expect, it } from "vitest";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "@/lib/format";

// Intl inserisce uno spazio insecabile (U+00A0), non uno spazio normale, fra
// l'importo e il simbolo di valuta. Lo rendiamo esplicito qui invece di
// scriverlo come carattere letterale nelle stringhe attese, così le
// asserzioni "toBe" non dipendono da un dettaglio invisibile a occhio nudo.
const NBSP = "\u00A0";

describe("formatCurrency", () => {
  it("formatta un valore positivo in EUR con 2 decimali, stile it-IT", () => {
    expect(formatCurrency(1234.5)).toBe(`1.234,50${NBSP}€`);
  });

  it("formatta lo zero come 0,00 €", () => {
    expect(formatCurrency(0)).toBe(`0,00${NBSP}€`);
  });

  it("gestisce valori negativi (es. profitto in perdita)", () => {
    const out = formatCurrency(-42.5);
    expect(out).toContain("-");
    expect(out).toMatch(/42,50/);
  });

  it("arrotonda a 2 decimali senza troncare in modo scorretto", () => {
    expect(formatCurrency(9.999)).toBe(`10,00${NBSP}€`);
  });

  describe("raggruppamento delle migliaia coerente (regressione bug /vendite-ue)", () => {
    // Bug in produzione: con useGrouping "auto" (default it-IT, che ha
    // minimumGroupingDigits: 2 in CLDR) il separatore compariva solo dai 5
    // cifre in su, quindi in una colonna di importi si vedeva "20.757,35 €"
    // ma anche "3512,00 €" senza punto. Forziamo useGrouping: "always" così
    // il raggruppamento è sempre presente, indipendentemente dal numero di
    // cifre. Questi test bloccano esplicitamente il comportamento (il punto
    // di raggruppamento deve comparire anche a 4 cifre, non solo a 5).
    it("importo a 4 cifre: il separatore delle migliaia compare comunque", () => {
      expect(formatCurrency(3512)).toBe(`3.512,00${NBSP}€`);
    });

    it("importo a 5 cifre: il separatore delle migliaia compare (comportamento invariato)", () => {
      expect(formatCurrency(20757.35)).toBe(`20.757,35${NBSP}€`);
    });

    it("importo sotto il migliaio: nessun separatore da inserire", () => {
      expect(formatCurrency(830.26)).toBe(`830,26${NBSP}€`);
    });

    it("importo negativo a 4 cifre: raggruppamento coerente anche col segno meno", () => {
      expect(formatCurrency(-3512)).toBe(`-3.512,00${NBSP}€`);
    });

    it("zero: nessun separatore, nessun segno", () => {
      expect(formatCurrency(0)).toBe(`0,00${NBSP}€`);
    });
  });
});

describe("formatCurrencyCompact", () => {
  it("arrotonda per eccesso senza mostrare decimali", () => {
    expect(formatCurrencyCompact(1234.5)).toBe(`1.235${NBSP}€`);
  });

  it("arrotonda per difetto quando la parte decimale è < 0.5", () => {
    expect(formatCurrencyCompact(1234.4)).toBe(`1.234${NBSP}€`);
  });

  it("non produce mai decimali anche con input non intero", () => {
    expect(formatCurrencyCompact(0.4)).toBe(`0${NBSP}€`);
  });

  it("raggruppa le migliaia anche a 4 cifre, come formatCurrency (coerenza fra tabelle e assi dei grafici)", () => {
    expect(formatCurrencyCompact(3512)).toBe(`3.512${NBSP}€`);
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
  it("formatta un intero a 4 cifre con separatore delle migliaia (coerente con formatCurrency)", () => {
    expect(formatNumber(1234)).toBe("1.234");
  });

  it("formatta lo zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});
