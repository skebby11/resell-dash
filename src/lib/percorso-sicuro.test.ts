import { describe, expect, it } from "vitest";
import { percorsoInternoSicuro } from "./percorso-sicuro";

describe("percorsoInternoSicuro", () => {
  it("accetta path interni", () => {
    expect(percorsoInternoSicuro("/")).toBe("/");
    expect(percorsoInternoSicuro("/articoli?stato=venduto")).toBe("/articoli?stato=venduto");
  });

  it("ripiega su / se manca o non è un path assoluto", () => {
    expect(percorsoInternoSicuro(null)).toBe("/");
    expect(percorsoInternoSicuro(undefined)).toBe("/");
    expect(percorsoInternoSicuro("")).toBe("/");
    expect(percorsoInternoSicuro("articoli")).toBe("/");
    expect(percorsoInternoSicuro("https://evil.com")).toBe("/");
  });

  it("scarta destinazioni esterne mascherate", () => {
    expect(percorsoInternoSicuro("//evil.com")).toBe("/");
    expect(percorsoInternoSicuro("/\\evil.com")).toBe("/");
    expect(percorsoInternoSicuro("/\\\\evil.com")).toBe("/");
    expect(percorsoInternoSicuro("/\t/evil.com")).toBe("/");
    expect(percorsoInternoSicuro("/\n/evil.com")).toBe("/");
  });
});
