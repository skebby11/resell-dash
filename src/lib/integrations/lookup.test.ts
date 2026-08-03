import { describe, expect, it, vi, beforeEach } from "vitest";

const getProdottoPerBarcode = vi.fn();

vi.mock("@/lib/data/queries", () => ({ getProdottoPerBarcode: (...a: unknown[]) => getProdottoPerBarcode(...a) }));

// Import dopo i mock: vitest hoista i vi.mock, ma teniamo l'ordine esplicito per chiarezza.
const { cercaProdottoDaBarcode } = await import("@/lib/integrations/lookup");

const BARCODE = "045496590420";

beforeEach(() => {
  getProdottoPerBarcode.mockReset();
});

describe("cercaProdottoDaBarcode", () => {
  it("rifiuta un barcode non valido senza interrogare il catalogo", async () => {
    const esito = await cercaProdottoDaBarcode("abc");
    expect(esito.ok).toBe(false);
    expect(getProdottoPerBarcode).not.toHaveBeenCalled();
  });

  it("rifiuta un barcode di lunghezza non valida (né 8, 12 né 13 cifre)", async () => {
    const esito = await cercaProdottoDaBarcode("1234567");
    expect(esito.ok).toBe(false);
    expect(getProdottoPerBarcode).not.toHaveBeenCalled();
  });

  it("normalizza (spazi/trattini) prima di interrogare il catalogo", async () => {
    getProdottoPerBarcode.mockResolvedValue(null);
    await cercaProdottoDaBarcode("0454-9659-0420");
    expect(getProdottoPerBarcode).toHaveBeenCalledWith(BARCODE);
  });

  it("risolve dal catalogo interno quando il barcode è già legato a un prodotto, senza alcuna chiamata esterna", async () => {
    getProdottoPerBarcode.mockResolvedValue({
      id: "1",
      nome: "Zelda BOTW",
      categoria: "Videogiochi",
      prezzoMedioAcquisto: 35,
      prezzoMedioVendita: 50,
    });
    const esito = await cercaProdottoDaBarcode(BARCODE);
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.risultato.prodottoEsistente?.nome).toBe("Zelda BOTW");
    expect(esito.risultato.barcode).toBe(BARCODE);
  });

  it("ritorna prodottoEsistente null (mai un errore) quando il barcode non è censito: tocca all'utente cercare su IGDB", async () => {
    getProdottoPerBarcode.mockResolvedValue(null);
    const esito = await cercaProdottoDaBarcode(BARCODE);
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.risultato.prodottoEsistente).toBeNull();
  });
});
