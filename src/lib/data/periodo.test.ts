import { describe, expect, it } from "vitest";
import {
  intervalloMeseNelPeriodo,
  normalizzaData,
  presetAttivo,
  presetPeriodo,
  risolviPeriodo,
} from "./periodo";

describe("normalizzaData", () => {
  it("accetta una data ISO valida", () => {
    expect(normalizzaData("2026-03-15")).toBe("2026-03-15");
  });

  it("rifiuta formati non ISO", () => {
    for (const v of ["15/03/2026", "2026-3-15", "domani", "", undefined]) {
      expect(normalizzaData(v)).toBeUndefined();
    }
  });

  it("rifiuta date di calendario inesistenti invece di normalizzarle per overflow", () => {
    expect(normalizzaData("2026-02-30")).toBeUndefined();
    expect(normalizzaData("2026-13-01")).toBeUndefined();
  });

  it("accetta il 29 febbraio in un anno bisestile", () => {
    expect(normalizzaData("2028-02-29")).toBe("2028-02-29");
  });
});

describe("risolviPeriodo", () => {
  it("nessun parametro -> nessun limite", () => {
    expect(risolviPeriodo(undefined, undefined)).toEqual({ da: undefined, a: undefined });
  });

  it("un input non valido diventa 'nessun limite', non un errore", () => {
    expect(risolviPeriodo("non una data", "2026-12-31")).toEqual({
      da: undefined,
      a: "2026-12-31",
    });
  });

  it("azzera un intervallo invertito invece di restituire un filtro sempre vuoto", () => {
    expect(risolviPeriodo("2026-12-31", "2026-01-01")).toEqual({ da: undefined, a: undefined });
  });

  it("accetta un intervallo valido", () => {
    expect(risolviPeriodo("2026-01-01", "2026-12-31")).toEqual({
      da: "2026-01-01",
      a: "2026-12-31",
    });
  });
});

describe("presetPeriodo", () => {
  const oggi = new Date(Date.UTC(2026, 7, 2)); // 2026-08-02

  it("anno corrente e anno precedente coprono l'intero anno solare", () => {
    const p = presetPeriodo(oggi);
    expect(p["anno-corrente"]).toEqual({ da: "2026-01-01", a: "2026-12-31" });
    expect(p["anno-precedente"]).toEqual({ da: "2025-01-01", a: "2025-12-31" });
  });

  it("ultimi 12 mesi finisce oggi e comprende il mese corrente per intero", () => {
    const p = presetPeriodo(oggi);
    expect(p["ultimi-12-mesi"].a).toBe("2026-08-02");
    expect(p["ultimi-12-mesi"].da).toBe("2025-09-01");
  });
});

describe("presetAttivo", () => {
  const oggi = new Date(Date.UTC(2026, 7, 2));

  it("nessun limite -> 'tutto'", () => {
    expect(presetAttivo({}, oggi)).toBe("tutto");
  });

  it("riconosce un periodo che combacia con un preset", () => {
    expect(presetAttivo({ da: "2026-01-01", a: "2026-12-31" }, oggi)).toBe("anno-corrente");
    expect(presetAttivo({ da: "2025-01-01", a: "2025-12-31" }, oggi)).toBe("anno-precedente");
  });

  it("un intervallo personalizzato non combacia con nessun preset", () => {
    expect(presetAttivo({ da: "2026-03-01", a: "2026-05-01" }, oggi)).toBeUndefined();
  });
});

describe("intervalloMeseNelPeriodo", () => {
  it("senza periodo restituisce il mese di calendario intero", () => {
    expect(intervalloMeseNelPeriodo("2026-03", {})).toEqual({
      da: "2026-03-01",
      a: "2026-03-31",
    });
  });

  it("febbraio non bisestile finisce il 28", () => {
    expect(intervalloMeseNelPeriodo("2026-02", {}).a).toBe("2026-02-28");
  });

  it("interseca un periodo a metà mese", () => {
    expect(intervalloMeseNelPeriodo("2026-03", { da: "2026-03-10", a: "2026-03-20" })).toEqual({
      da: "2026-03-10",
      a: "2026-03-20",
    });
  });

  it("periodo solo da ritaglia l'inizio e lascia la fine del mese", () => {
    expect(intervalloMeseNelPeriodo("2026-03", { da: "2026-03-10" })).toEqual({
      da: "2026-03-10",
      a: "2026-03-31",
    });
  });

  it("periodo solo a ritaglia la fine (ultimi-12-mesi sul mese corrente)", () => {
    expect(intervalloMeseNelPeriodo("2026-03", { a: "2026-03-20" })).toEqual({
      da: "2026-03-01",
      a: "2026-03-20",
    });
  });

  it("periodo più largo del mese restituisce il mese intero", () => {
    expect(intervalloMeseNelPeriodo("2026-03", { da: "2026-01-01", a: "2026-12-31" })).toEqual({
      da: "2026-03-01",
      a: "2026-03-31",
    });
  });

  it("febbraio bisestile finisce il 29", () => {
    expect(intervalloMeseNelPeriodo("2028-02", {}).a).toBe("2028-02-29");
  });

  it("una data non valida nel periodo viene ignorata", () => {
    expect(intervalloMeseNelPeriodo("2026-03", { da: "nonsenso" })).toEqual({
      da: "2026-03-01",
      a: "2026-03-31",
    });
  });

  it("un mese non nel formato YYYY-MM restituisce un intervallo vuoto, non date malformate", () => {
    for (const mese of ["2026-13", "garbage", "2026-3", "2026-02-01", "0000-02"]) {
      const r = intervalloMeseNelPeriodo(mese, {});
      expect(r.da > r.a).toBe(true);
    }
  });
});
