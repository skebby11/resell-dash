import { describe, expect, it } from "vitest";
import {
  importoOpzionale,
  parseCodicePaese,
  parseInserimento,
  parseNomeCanale,
  parseTipoCanale,
  parseVendita,
  puoArchiviareArticolo,
  puoEliminareArticolo,
  stessoNomeCanale,
  type ContestoPaese,
} from "@/lib/validazione";
import { PAESI_UE } from "@/types";

const ID = "3542aae4-7fa7-4882-84fb-dfd1c2e07ade";

const CTX_IT: ContestoPaese = {
  paeseOrigine: "IT",
  codiciAmmessi: new Set([...PAESI_UE.map((p) => p.codice), "US"]),
};

function fd(campi: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campi)) f.append(k, v);
  return f;
}

function vendita(campi: Record<string, string>, ctx: ContestoPaese = CTX_IT) {
  return parseVendita(fd(campi), ctx);
}

describe("importoOpzionale", () => {
  it("distingue campo vuoto (null) da valore non interpretabile (undefined)", () => {
    expect(importoOpzionale("")).toBeNull();
    expect(importoOpzionale("   ")).toBeNull();
    expect(importoOpzionale("abc")).toBeUndefined();
    expect(importoOpzionale("12,3,4")).toBeUndefined();
  });

  it("accetta la virgola decimale italiana", () => {
    expect(importoOpzionale("12,50")).toBe(12.5);
    expect(importoOpzionale("0,05")).toBe(0.05);
  });

  it("accetta anche il punto decimale (input type=number)", () => {
    expect(importoOpzionale("12.50")).toBe(12.5);
  });

  it("rifiuta i valori negativi", () => {
    expect(importoOpzionale("-1")).toBeUndefined();
    expect(importoOpzionale("-0,01")).toBeUndefined();
  });

  it("accetta lo zero, che è un importo legittimo", () => {
    expect(importoOpzionale("0")).toBe(0);
    expect(importoOpzionale("0,00")).toBe(0);
  });

  it("rifiuta Infinity e NaN travestiti da numero", () => {
    expect(importoOpzionale("Infinity")).toBeUndefined();
    expect(importoOpzionale("1e999")).toBeUndefined();
  });
});

describe("parseInserimento", () => {
  const valido = {
    prodotto: "  zelda   botw  switch ",
    data_acquisto: "2026-07-01",
    costo_acquisto: "24,90",
    fonte_acquisto: "Vinted",
    note: " custodia rotta ",
  };

  it("normalizza gli spazi nel nome prodotto e converte la virgola", () => {
    const r = parseInserimento(fd(valido));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.nomeProdotto).toBe("zelda botw switch");
    expect(r.valori.costoAcquisto).toBe(24.9);
    expect(r.valori.note).toBe("custodia rotta");
  });

  it("porta a null i campi facoltativi vuoti invece di stringhe vuote", () => {
    const r = parseInserimento(fd({ ...valido, note: "  ", categoria: "" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.note).toBeNull();
    expect(r.valori.categoria).toBeNull();
  });

  it("richiede prodotto, data, costo e fonte", () => {
    const r = parseInserimento(new FormData());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.campi).sort()).toEqual([
      "costo_acquisto",
      "data_acquisto",
      "fonte_acquisto",
      "prodotto",
    ]);
  });

  it("distingue costo assente da costo non valido", () => {
    const assente = parseInserimento(fd({ ...valido, costo_acquisto: "" }));
    const invalido = parseInserimento(fd({ ...valido, costo_acquisto: "-5" }));
    expect(assente.ok).toBe(false);
    expect(invalido.ok).toBe(false);
    if (assente.ok || invalido.ok) return;
    expect(assente.campi.costo_acquisto).toMatch(/Indica/);
    expect(invalido.campi.costo_acquisto).toMatch(/non negativo/);
  });

  it("rifiuta una data non ISO", () => {
    for (const d of ["01/07/2026", "2026-7-1", "domani", ""]) {
      const r = parseInserimento(fd({ ...valido, data_acquisto: d }));
      expect(r.ok, `data ${d}`).toBe(false);
    }
  });

  it("rifiuta un nome prodotto oltre i 200 caratteri", () => {
    const r = parseInserimento(fd({ ...valido, prodotto: "x".repeat(201) }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.campi.prodotto).toMatch(/troppo lungo/);
  });

  it("accetta costo zero (regali, lotti a costo nullo)", () => {
    const r = parseInserimento(fd({ ...valido, costo_acquisto: "0" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.costoAcquisto).toBe(0);
  });
});

describe("parseVendita", () => {
  const valido = {
    id: ID,
    stato: "venduto",
    data_vendita: "2026-07-30",
    prezzo_vendita: "45,00",
    fee: "2,25",
    costo_spedizione: "5,11",
    piattaforma_vendita: "eBay",
    destinazione: "Italia",
    spedizioniere: "BRT",
  };

  it("interpreta i valori e riconosce le checkbox assenti come false", () => {
    const r = vendita(valido);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori).toMatchObject({
      id: ID,
      stato: "venduto",
      prezzoVendita: 45,
      fee: 2.25,
      costoSpedizione: 5.11,
      piattaformaVendita: "eBay",
      prodottoSponsorizzato: false,
      venditaPostOfferta: false,
    });
  });

  it("considera spuntata una checkbox presente, qualunque sia il valore inviato", () => {
    const r = vendita({ ...valido, prodotto_sponsorizzato: "on" });
    const r2 = vendita({ ...valido, prodotto_sponsorizzato: "" });
    expect(r.ok && r.valori.prodottoSponsorizzato).toBe(true);
    expect(r2.ok && r2.valori.prodottoSponsorizzato).toBe(true);
  });

  it("accetta fee e spedizione vuote, che restano null", () => {
    const r = vendita({ ...valido, fee: "", costo_spedizione: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.fee).toBeNull();
    expect(r.valori.costoSpedizione).toBeNull();
  });

  it("segnala fee non valida senza confonderla con fee assente", () => {
    const r = vendita({ ...valido, fee: "-3" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.campi.fee).toMatch(/non valida/);
  });

  it("distingue prezzo assente da prezzo non valido", () => {
    const assente = vendita({ ...valido, prezzo_vendita: "" });
    const invalido = vendita({ ...valido, prezzo_vendita: "abc" });
    expect(assente.ok).toBe(false);
    expect(invalido.ok).toBe(false);
    if (assente.ok || invalido.ok) return;
    expect(assente.campi.prezzo_vendita).toMatch(/Indica/);
    expect(invalido.campi.prezzo_vendita).toMatch(/non valido/);
  });

  it("rifiuta un id che non è un UUID", () => {
    for (const id of ["", "1", "'; drop table articoli; --", `${ID}x`]) {
      const r = vendita({ ...valido, id });
      expect(r.ok, `id ${id}`).toBe(false);
      if (r.ok) return;
      expect(r.errore).toBe("Articolo non valido.");
    }
  });

  it("accetta consegnato e rifiuta gli stati non di vendita", () => {
    const consegnato = vendita({ ...valido, stato: "consegnato" });
    expect(consegnato.ok && consegnato.valori.stato).toBe("consegnato");

    for (const stato of ["acquistato", "in vendita"]) {
      const r = vendita({ ...valido, stato });
      expect(r.ok, `stato ${stato}`).toBe(false);
      if (!r.ok) expect(r.errore).toMatch(/solo vendite/);
    }
  });

  it("rifiuta uno stato inventato", () => {
    const r = vendita({ ...valido, stato: "regalato" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errore).toBe("Stato non valido.");
  });

  it("richiede la data di vendita: il CHECK del database la pretende", () => {
    const r = vendita({ ...valido, data_vendita: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.campi.data_vendita).toMatch(/Indica/);
  });

  it("porta a null i campi testuali facoltativi lasciati vuoti", () => {
    const r = vendita({
      ...valido,
      piattaforma_vendita: "",
      destinazione: " ",
      spedizioniere: "",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.piattaformaVendita).toBeNull();
    expect(r.valori.destinazione).toBeNull();
    expect(r.valori.spedizioniere).toBeNull();
  });
});

describe("parseVendita — paese di vendita", () => {
  const base = {
    id: ID,
    stato: "venduto",
    data_vendita: "2026-07-30",
    prezzo_vendita: "45,00",
  };

  it("destinazione Italia impone il paese di origine, qualunque cosa mandi il client", () => {
    const r1 = vendita({ ...base, destinazione: "Italia" });
    const r2 = vendita({ ...base, destinazione: "Italia", paese_vendita: "FR" });
    expect(r1.ok && r1.valori.paeseVendita).toBe(CTX_IT.paeseOrigine);
    expect(r2.ok && r2.valori.paeseVendita).toBe(CTX_IT.paeseOrigine);
  });

  it("con paeseOrigine DE, destinazione Italia impone DE", () => {
    const ctx: ContestoPaese = {
      paeseOrigine: "DE",
      codiciAmmessi: CTX_IT.codiciAmmessi,
    };
    const r = vendita({ ...base, destinazione: "Italia", paese_vendita: "FR" }, ctx);
    expect(r.ok && r.valori.paeseVendita).toBe("DE");
  });

  it("destinazione Estero con un paese UE valido lo accetta", () => {
    const r = vendita({ ...base, destinazione: "Estero", paese_vendita: "FR" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.destinazione).toBe("Estero");
    expect(r.valori.paeseVendita).toBe("FR");
  });

  it("destinazione Estero accetta anche un paese extra-UE ammesso (es. US)", () => {
    const r = vendita({ ...base, destinazione: "Estero", paese_vendita: "US" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.paeseVendita).toBe("US");
  });

  it("un salvataggio invariato resta valido se l'origine è cambiata e ora coincide col paese storico", () => {
    const ctx: ContestoPaese = { ...CTX_IT, paeseOrigine: "US", paeseVenditaAttuale: "US" };
    const r = vendita({ ...base, destinazione: "Estero", paese_vendita: "US" }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.paeseVendita).toBe("US");
  });

  it("un cambio verso un paese uguale all'origine ma diverso dallo storico resta rifiutato", () => {
    const ctx: ContestoPaese = { ...CTX_IT, paeseOrigine: "US", paeseVenditaAttuale: "FR" };
    const r = vendita({ ...base, destinazione: "Estero", paese_vendita: "US" }, ctx);
    expect(r.ok).toBe(false);
  });

  it("destinazione Estero senza paese è una lacuna legittima, non un errore", () => {
    const r = vendita({ ...base, destinazione: "Estero" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.paeseVendita).toBeNull();
  });

  it("rifiuta un codice paese non ammessi (es. Regno Unito, post Brexit)", () => {
    const r = vendita({ ...base, destinazione: "Estero", paese_vendita: "GB" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.campi.paese_vendita).toMatch(/non valido/);
  });

  it("rifiuta il codice del paese di origine quando la destinazione è Estero", () => {
    const r = vendita({ ...base, destinazione: "Estero", paese_vendita: "IT" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.campi.paese_vendita).toMatch(/non valido/);
  });

  it("senza destinazione il paese resta ignoto, senza errore", () => {
    const r = vendita(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valori.destinazione).toBeNull();
    expect(r.valori.paeseVendita).toBeNull();
  });

  it("accetta tutti i codici UE tranne il paese di origine quando la destinazione è Estero", () => {
    for (const { codice } of PAESI_UE) {
      if (codice === CTX_IT.paeseOrigine) continue;
      const r = vendita({ ...base, destinazione: "Estero", paese_vendita: codice });
      expect(r.ok, `codice ${codice}`).toBe(true);
      if (r.ok) expect(r.valori.paeseVendita).toBe(codice);
    }
  });
});

describe("parseCodicePaese", () => {
  it("normalizza a due lettere maiuscole", () => {
    expect(parseCodicePaese("us")).toBe("US");
  });

  it("rifiuta codici non ISO a due lettere", () => {
    expect(parseCodicePaese("U")).toBeUndefined();
    expect(parseCodicePaese("USA")).toBeUndefined();
    expect(parseCodicePaese("u1")).toBeUndefined();
  });
});

describe("puoEliminareArticolo", () => {
  it("permette l'eliminazione solo per acquistato e in vendita", () => {
    expect(puoEliminareArticolo("acquistato")).toBe(true);
    expect(puoEliminareArticolo("in vendita")).toBe(true);
    expect(puoEliminareArticolo("venduto")).toBe(false);
    expect(puoEliminareArticolo("consegnato")).toBe(false);
  });
});

describe("puoArchiviareArticolo", () => {
  it("permette l'archiviazione solo per venduto/consegnato non già archiviato", () => {
    expect(puoArchiviareArticolo("venduto", false)).toBe(true);
    expect(puoArchiviareArticolo("venduto", true)).toBe(false);
    expect(puoArchiviareArticolo("acquistato", false)).toBe(false);
  });
});

describe("parseTipoCanale", () => {
  it("accetta esattamente i tre tipi noti", () => {
    expect(parseTipoCanale("piattaforma_vendita")).toBe("piattaforma_vendita");
    expect(parseTipoCanale("fonte_acquisto")).toBe("fonte_acquisto");
    expect(parseTipoCanale("spedizioniere")).toBe("spedizioniere");
  });

  it("rifiuta qualunque altro valore", () => {
    for (const v of ["", "categoria", "Piattaforma_Vendita", "spedizionieri"]) {
      expect(parseTipoCanale(v), `valore ${v}`).toBeUndefined();
    }
  });
});

describe("parseNomeCanale", () => {
  it("normalizza gli spazi come il nome prodotto", () => {
    expect(parseNomeCanale("  Poste   Italiane  ")).toBe("Poste Italiane");
  });

  it("rifiuta il nome vuoto", () => {
    expect(parseNomeCanale("")).toBeUndefined();
    expect(parseNomeCanale("   ")).toBeUndefined();
  });

  it("rifiuta oltre 60 caratteri, allineato al CHECK del database", () => {
    expect(parseNomeCanale("x".repeat(60))).toBe("x".repeat(60));
    expect(parseNomeCanale("x".repeat(61))).toBeUndefined();
  });
});

describe("stessoNomeCanale", () => {
  it("confronta senza distinguere maiuscole/minuscole, come l'indice unico", () => {
    expect(stessoNomeCanale("eBay", "ebay")).toBe(true);
    expect(stessoNomeCanale("eBay", "EBAY")).toBe(true);
    expect(stessoNomeCanale("eBay", "Vinted")).toBe(false);
  });
});
