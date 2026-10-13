import { describe, expect, it } from "vitest";
import { piattaformaCanonica } from "./piattaforme";

describe("piattaformaCanonica", () => {
  it("abbrevia le PlayStation di IGDB", () => {
    expect(piattaformaCanonica("PlayStation 4")).toBe("PS4");
    expect(piattaformaCanonica("PlayStation 5")).toBe("PS5");
    expect(piattaformaCanonica("PlayStation")).toBe("PS1");
    expect(piattaformaCanonica("PlayStation Vita")).toBe("PS Vita");
  });

  it("usa le sigle Nintendo", () => {
    expect(piattaformaCanonica("Nintendo 3DS")).toBe("3DS");
    expect(piattaformaCanonica("New Nintendo 3DS")).toBe("3DS");
    expect(piattaformaCanonica("Nintendo DS")).toBe("DS");
    expect(piattaformaCanonica("Game Boy Advance")).toBe("GBA");
    expect(piattaformaCanonica("Game Boy")).toBe("GB");
  });

  it("ignora maiuscole e spazi superflui", () => {
    expect(piattaformaCanonica("  playstation   3 ")).toBe("PS3");
  });

  it("lascia invariate le piattaforme senza alias", () => {
    expect(piattaformaCanonica("Nintendo Switch")).toBe("Nintendo Switch");
    expect(piattaformaCanonica("PS4")).toBe("PS4");
  });
});
