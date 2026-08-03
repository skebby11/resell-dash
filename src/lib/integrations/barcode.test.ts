import { describe, expect, it } from "vitest";
import { normalizzaBarcode, tipoBarcode } from "@/lib/integrations/barcode";

describe("normalizzaBarcode", () => {
  it("accetta EAN-8, UPC-A ed EAN-13", () => {
    expect(normalizzaBarcode("12345678")).toBe("12345678");
    expect(normalizzaBarcode("045496590420")).toBe("045496590420");
    expect(normalizzaBarcode("0045496590420")).toBe("0045496590420");
  });

  it("rimuove spazi e trattini prima di validare la lunghezza", () => {
    expect(normalizzaBarcode("0454-9659-0420")).toBe("045496590420");
    expect(normalizzaBarcode(" 045496590420 ")).toBe("045496590420");
  });

  it("rifiuta lunghezze non EAN-8/UPC-A/EAN-13", () => {
    expect(normalizzaBarcode("123")).toBeNull();
    expect(normalizzaBarcode("1234567890")).toBeNull();
    expect(normalizzaBarcode("")).toBeNull();
  });

  it("rifiuta caratteri non numerici, anche mascherati da injection", () => {
    expect(normalizzaBarcode("1234567a")).toBeNull();
    expect(normalizzaBarcode("045496590420; drop table prodotti;")).toBeNull();
  });
});

describe("tipoBarcode", () => {
  it("riconosce il formato dalla lunghezza", () => {
    expect(tipoBarcode("12345678")).toBe("EAN-8");
    expect(tipoBarcode("045496590420")).toBe("UPC-A");
    expect(tipoBarcode("0045496590420")).toBe("EAN-13");
    expect(tipoBarcode("123")).toBeNull();
  });
});
