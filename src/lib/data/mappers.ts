import { STATI_ARTICOLO, type Articolo, type Prodotto, type StatoArticolo } from "@/types";
import type { Tables } from "@/types/database";

/**
 * Conversione righe Postgres → tipi di dominio (snake_case → camelCase).
 *
 * Postgres `numeric` arriva come stringa via PostgREST quando il valore eccede
 * la precisione di un double, quindi non ci si può fidare del tipo dichiarato:
 * normalizziamo sempre con `Number`.
 */

function numero(v: number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function numeroObbligatorio(v: number | string | null): number {
  return numero(v) ?? 0;
}

function statoValido(v: string): StatoArticolo {
  // Il CHECK constraint sul DB rende questo caso impossibile; il fallback evita
  // che un valore inatteso (migration futura, import manuale) rompa la UI.
  return (STATI_ARTICOLO as readonly string[]).includes(v)
    ? (v as StatoArticolo)
    : "acquistato";
}

export function toProdotto(row: Tables<"prodotti">): Prodotto {
  return {
    id: row.id,
    barcode: row.barcode,
    nome: row.nome,
    categoria: row.categoria,
    piattaformaGioco: row.piattaforma_gioco,
    prezzoMedioAcquisto: numero(row.prezzo_medio_acquisto),
    prezzoMedioVendita: numero(row.prezzo_medio_vendita),
    note: row.note,
    fotoUrl: row.foto_url,
  };
}

/** Riga `articoli` con il prodotto collegato, come la restituisce la select con join. */
export type RigaArticoloConProdotto = Tables<"articoli"> & {
  prodotti: Pick<Tables<"prodotti">, "nome" | "categoria"> | null;
};

export function toArticolo(row: RigaArticoloConProdotto): Articolo {
  return {
    id: row.id,
    prodottoId: row.prodotto_id,
    // La FK è NOT NULL con ON DELETE RESTRICT: il prodotto esiste sempre. Il
    // fallback copre solo il caso in cui la RLS nascondesse la riga collegata.
    prodottoNome: row.prodotti?.nome ?? "Prodotto sconosciuto",
    categoria: row.prodotti?.categoria ?? null,
    dataAcquisto: row.data_acquisto,
    costoAcquisto: numeroObbligatorio(row.costo_acquisto),
    fonteAcquisto: row.fonte_acquisto,
    stato: statoValido(row.stato),
    dataVendita: row.data_vendita,
    prezzoVendita: numero(row.prezzo_vendita),
    piattaformaVendita: row.piattaforma_vendita,
    fee: numero(row.fee),
    costoSpedizione: numero(row.costo_spedizione),
    destinazione: row.destinazione,
    spedizioniere: row.spedizioniere,
    note: row.note,
    prodottoSponsorizzato: row.prodotto_sponsorizzato,
    venditaPostOfferta: row.vendita_post_offerta,
    profitto: numero(row.profitto),
  };
}
