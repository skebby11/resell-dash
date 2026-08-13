"use server";

import { revalidatePath } from "next/cache";
import { getPaeseOrigine } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import {
  parseCodicePaese,
  parseNomeCanale,
  parseNomeEtichetta,
  parseTipoCanale,
  UUID_RE,
} from "@/lib/validazione";
import { ETICHETTA_TIPO_CANALE, type TipoCanale } from "@/types";

/**
 * Server action per la gestione dei canali configurabili
 * (0013_canali_configurabili) e dei paesi (0014_paesi_configurabili):
 * aggiunta, rinomina, attivazione/disattivazione, riordino. Validazione
 * autorevole in `src/lib/validazione.ts`; qui restano solo le operazioni
 * che richiedono il database (unicità, conteggio storico).
 */

function rivalidaPagine() {
  revalidatePath("/impostazioni");
  // Le colonne di articoli non cambiano mai qui (tranne la rinomina con
  // "aggiorna storico"), ma i form leggono i canali attivi dal database: se
  // qualcuno tocca /inserimento o /articoli subito dopo una modifica deve
  // vedere l'elenco aggiornato, non quello cache.
  revalidatePath("/inserimento");
  revalidatePath("/articoli");
  revalidatePath("/vendite-ue");
}

export interface StatoCanale {
  ok?: boolean;
  errore?: string;
  /** Il form si svuota rimontando con questa key come `seq`, come gli altri form dell'app. */
  seq: number;
}

/** Messaggio di duplicato, uguale per creazione e rinomina. */
function messaggioDuplicato(tipo: TipoCanale, nome: string): string {
  return `"${nome}" esiste già tra ${ETICHETTA_TIPO_CANALE[tipo].toLowerCase()}: nessun duplicato creato.`;
}

/** Aggiunge un canale attivo, in coda all'ordine esistente per quel tipo. */
export async function creaCanale(stato: StatoCanale, formData: FormData): Promise<StatoCanale> {
  const seq = stato.seq ?? 0;
  const tipo = parseTipoCanale(String(formData.get("tipo") ?? ""));
  const nome = parseNomeCanale(String(formData.get("nome") ?? ""));
  if (!tipo) return { seq, errore: "Tipo di canale non valido." };
  if (!nome) return { seq, errore: "Indica un nome (max 60 caratteri)." };

  const supabase = await createClient();
  // Ordine in coda: il canale più usato lo si porta in cima con "sposta su",
  // non è un calcolo automatico da un conteggio storico che non esiste ancora
  // per un canale appena creato.
  const { data: ultimo, error: eOrdine } = await supabase
    .from("canali")
    .select("ordine")
    .eq("tipo", tipo)
    .order("ordine", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eOrdine) return { seq, errore: eOrdine.message };

  const { error } = await supabase
    .from("canali")
    .insert({ tipo, nome, ordine: (ultimo?.ordine ?? -1) + 1 });
  if (error?.code === "23505") return { seq, errore: messaggioDuplicato(tipo, nome) };
  if (error) return { seq, errore: `Salvataggio non riuscito: ${error.message}` };

  rivalidaPagine();
  return { ok: true, seq: seq + 1 };
}

export interface StatoRinomina {
  ok?: boolean;
  errore?: string;
  seq: number;
}

/**
 * Rinomina un canale. Gli articoli storici NON vengono toccati per default:
 * contengono già la vecchia stringa come testo libero, e riscriverli in massa
 * a ogni rinomina sarebbe un effetto collaterale enorme per un'operazione che
 * sembra innocua. Il checkbox "aggiorna_storico" nel form rende la scelta
 * esplicita e volontaria: se spuntato, propaga la rinomina anche agli
 * articoli che hanno esattamente il vecchio nome, cambiando così a quali
 * fette si sommano in v_distribuzione_piattaforma/v_distribuzione_fonte.
 * Se non spuntato, quegli articoli restano con il vecchio nome: continuano a
 * comparire nelle statistiche (non scompaiono), ma come voce separata dal
 * canale appena rinominato — la UI lo dice esplicitamente prima del salvataggio.
 */
export async function rinominaCanale(
  stato: StatoRinomina,
  formData: FormData
): Promise<StatoRinomina> {
  const seq = stato.seq ?? 0;
  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { seq, errore: "Canale non valido." };
  const nome = parseNomeCanale(String(formData.get("nome") ?? ""));
  if (!nome) return { seq, errore: "Indica un nome (max 60 caratteri)." };
  const aggiornaStorico = formData.get("aggiorna_storico") != null;

  const supabase = await createClient();
  const { data: attuale, error: eLettura } = await supabase
    .from("canali")
    .select("tipo, nome")
    .eq("id", id)
    .maybeSingle();
  if (eLettura) return { seq, errore: eLettura.message };
  if (!attuale) return { seq, errore: "Canale non trovato." };
  const tipo = parseTipoCanale(attuale.tipo);
  if (!tipo) return { seq, errore: "Tipo di canale non valido." };
  const vecchioNome = attuale.nome;

  const { error } = await supabase.from("canali").update({ nome }).eq("id", id);
  if (error?.code === "23505") return { seq, errore: messaggioDuplicato(tipo, nome) };
  if (error) return { seq, errore: `Salvataggio non riuscito: ${error.message}` };

  if (aggiornaStorico && vecchioNome !== nome) {
    // La colonna da aggiornare coincide col valore di `tipo` (scelta di
    // progettazione della migration 0013, non un caso): un branch esplicito
    // per tipo evita chiavi calcolate non tipizzate sull'update di articoli.
    const patch =
      tipo === "piattaforma_vendita"
        ? { piattaforma_vendita: nome }
        : tipo === "fonte_acquisto"
          ? { fonte_acquisto: nome }
          : { spedizioniere: nome };
    const colonna =
      tipo === "piattaforma_vendita" ? "piattaforma_vendita" : tipo === "fonte_acquisto" ? "fonte_acquisto" : "spedizioniere";
    const { error: eStorico } = await supabase.from("articoli").update(patch).eq(colonna, vecchioNome);
    if (eStorico) {
      return {
        seq,
        errore: `Canale rinominato, ma l'aggiornamento dello storico non è riuscito: ${eStorico.message}`,
      };
    }
  }

  rivalidaPagine();
  return { ok: true, seq: seq + 1 };
}

/**
 * Attiva/disattiva un canale. Disattivare non tocca `articoli`: è la scelta
 * di design centrale della migration 0013 (disattivazione, non cancellazione).
 */
export async function impostaAttivoCanale(id: string, attivo: boolean): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Canale non valido.");
  const supabase = await createClient();
  const { error } = await supabase.from("canali").update({ attivo }).eq("id", id);
  if (error) throw new Error(error.message);
  rivalidaPagine();
}

/**
 * Scambia l'ordine con il vicino immediato (stesso tipo) nella direzione data.
 * Uno scambio a due, non un riordino dell'intera lista: evita di dover
 * spedire dal client l'intero elenco ordinato per un semplice "sposta su/giù".
 */
export async function spostaCanale(id: string, direzione: "su" | "giu"): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Canale non valido.");
  const supabase = await createClient();

  const { data: riga, error } = await supabase
    .from("canali")
    .select("id, tipo, ordine")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!riga) throw new Error("Canale non trovato.");

  const vicinoQuery = supabase.from("canali").select("id, ordine").eq("tipo", riga.tipo);
  const { data: vicino, error: eVicino } =
    direzione === "su"
      ? await vicinoQuery.lt("ordine", riga.ordine).order("ordine", { ascending: false }).limit(1).maybeSingle()
      : await vicinoQuery.gt("ordine", riga.ordine).order("ordine", { ascending: true }).limit(1).maybeSingle();
  if (eVicino) throw new Error(eVicino.message);
  // Già in cima/in fondo: nessun vicino in quella direzione, nessuna azione.
  if (!vicino) return;

  const { error: e1 } = await supabase.from("canali").update({ ordine: vicino.ordine }).eq("id", riga.id);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from("canali").update({ ordine: riga.ordine }).eq("id", vicino.id);
  if (e2) throw new Error(e2.message);

  rivalidaPagine();
}

// ------------------------------------------------------------------ paesi ----

export interface StatoPaese {
  ok?: boolean;
  errore?: string;
  /** Il form si svuota rimontando con questa key come `seq`, come gli altri form dell'app. */
  seq: number;
}

/** 23505 su `paesi_pkey` (codice) o `ux_paesi_nome` (nome case-insensitive). */
function messaggioDuplicatoPaese(
  codice: string,
  nome: string,
  error: { message?: string; details?: string }
): string {
  const testo = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (testo.includes("ux_paesi_nome")) {
    return `"${nome}" esiste già: nessun duplicato creato.`;
  }
  if (testo.includes("paesi_pkey") || testo.includes("(codice)")) {
    return `"${codice}" esiste già: nessun duplicato creato.`;
  }
  return `"${codice}" o "${nome}" esiste già: nessun duplicato creato.`;
}

/** Aggiunge un paese attivo, in coda all'ordine esistente. Il codice è immutabile dopo l'insert. */
export async function creaPaese(stato: StatoPaese, formData: FormData): Promise<StatoPaese> {
  const seq = stato.seq ?? 0;
  const codice = parseCodicePaese(String(formData.get("codice") ?? ""));
  const nome = parseNomeEtichetta(String(formData.get("nome") ?? ""));
  if (!codice) return { seq, errore: "Codice paese non valido (due lettere)." };
  if (!nome) return { seq, errore: "Indica un nome (max 60 caratteri)." };
  const ue = formData.get("ue") != null;

  const supabase = await createClient();
  const { data: ultimo, error: eOrdine } = await supabase
    .from("paesi")
    .select("ordine")
    .order("ordine", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eOrdine) return { seq, errore: eOrdine.message };

  const { error } = await supabase
    .from("paesi")
    .insert({ codice, nome, ue, ordine: (ultimo?.ordine ?? -1) + 1 });
  if (error?.code === "23505") return { seq, errore: messaggioDuplicatoPaese(codice, nome, error) };
  if (error) return { seq, errore: `Salvataggio non riuscito: ${error.message}` };

  rivalidaPagine();
  return { ok: true, seq: seq + 1 };
}

/**
 * Aggiorna nome e flag UE. Il codice non si tocca: un codice sbagliato è
 * una riga nuova, non una riscrittura di `articoli` / `paese_origine`.
 */
export async function rinominaPaese(stato: StatoPaese, formData: FormData): Promise<StatoPaese> {
  const seq = stato.seq ?? 0;
  const codice = parseCodicePaese(String(formData.get("codice") ?? ""));
  if (!codice) return { seq, errore: "Paese non valido." };
  const nome = parseNomeEtichetta(String(formData.get("nome") ?? ""));
  if (!nome) return { seq, errore: "Indica un nome (max 60 caratteri)." };
  const ue = formData.get("ue") != null;

  const supabase = await createClient();
  const { data: attuale, error: eLettura } = await supabase
    .from("paesi")
    .select("codice")
    .eq("codice", codice)
    .maybeSingle();
  if (eLettura) return { seq, errore: eLettura.message };
  if (!attuale) return { seq, errore: "Paese non trovato." };

  const { error } = await supabase.from("paesi").update({ nome, ue }).eq("codice", codice);
  if (error?.code === "23505") return { seq, errore: `"${nome}" esiste già: nessun duplicato creato.` };
  if (error) return { seq, errore: `Salvataggio non riuscito: ${error.message}` };

  rivalidaPagine();
  return { ok: true, seq: seq + 1 };
}

export async function impostaAttivoPaese(codiceRaw: string, attivo: boolean): Promise<void> {
  const codice = parseCodicePaese(codiceRaw);
  if (!codice) throw new Error("Paese non valido.");

  if (!attivo) {
    const origine = await getPaeseOrigine();
    if (codice === origine) {
      throw new Error("Non puoi disattivare il paese di origine. Cambialo prima.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("paesi").update({ attivo }).eq("codice", codice);
  if (error) throw new Error(error.message);
  rivalidaPagine();
}

/**
 * Scambia l'ordine con il vicino immediato nella direzione data.
 * Uno scambio a due, non un riordino dell'intera lista.
 */
export async function spostaPaese(codiceRaw: string, direzione: "su" | "giu"): Promise<void> {
  const codice = parseCodicePaese(codiceRaw);
  if (!codice) throw new Error("Paese non valido.");
  const supabase = await createClient();

  const { data: riga, error } = await supabase
    .from("paesi")
    .select("codice, ordine")
    .eq("codice", codice)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!riga) throw new Error("Paese non trovato.");

  const vicinoQuery = supabase.from("paesi").select("codice, ordine");
  const { data: vicino, error: eVicino } =
    direzione === "su"
      ? await vicinoQuery.lt("ordine", riga.ordine).order("ordine", { ascending: false }).limit(1).maybeSingle()
      : await vicinoQuery.gt("ordine", riga.ordine).order("ordine", { ascending: true }).limit(1).maybeSingle();
  if (eVicino) throw new Error(eVicino.message);
  if (!vicino) return;

  const { error: e1 } = await supabase.from("paesi").update({ ordine: vicino.ordine }).eq("codice", riga.codice);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from("paesi").update({ ordine: riga.ordine }).eq("codice", vicino.codice);
  if (e2) throw new Error(e2.message);

  rivalidaPagine();
}

export async function eliminaPaese(codiceRaw: string): Promise<void> {
  const codice = parseCodicePaese(codiceRaw);
  if (!codice) throw new Error("Paese non valido.");

  const origine = await getPaeseOrigine();
  if (codice === origine) {
    throw new Error("Non puoi eliminare il paese di origine. Cambialo prima.");
  }

  const supabase = await createClient();
  const { data: conteggio, error: eCount } = await supabase
    .from("v_conteggio_paesi")
    .select("conteggio")
    .eq("codice", codice)
    .maybeSingle();
  if (eCount) throw new Error(eCount.message);
  const n = conteggio?.conteggio ?? 0;
  if (n > 0) {
    throw new Error(`Non puoi eliminare un paese usato da ${n} articol${n === 1 ? "o" : "i"}.`);
  }

  const { error } = await supabase.from("paesi").delete().eq("codice", codice);
  if (error) throw new Error(error.message);
  rivalidaPagine();
}

/**
 * Imposta il paese di origine dell'installazione. Deve esistere ed essere
 * attivo. `valore` è jsonb: si passa la stringa (`"IT"`) e supabase-js la
 * serializza; 0014 ha già inserito la riga, l'upsert copre il caso in cui
 * mancasse.
 */
export async function impostaPaeseOrigine(stato: StatoPaese, formData: FormData): Promise<StatoPaese> {
  const seq = stato.seq ?? 0;
  const codice = parseCodicePaese(String(formData.get("codice") ?? ""));
  if (!codice) return { seq, errore: "Paese non valido." };

  const supabase = await createClient();
  const { data: riga, error: eLettura } = await supabase
    .from("paesi")
    .select("codice, attivo")
    .eq("codice", codice)
    .maybeSingle();
  if (eLettura) return { seq, errore: eLettura.message };
  if (!riga) return { seq, errore: "Paese non trovato." };
  if (!riga.attivo) return { seq, errore: "Il paese di origine deve essere attivo." };

  const { error } = await supabase
    .from("impostazioni")
    .upsert({ chiave: "paese_origine", valore: codice }, { onConflict: "chiave" });
  if (error) return { seq, errore: `Salvataggio non riuscito: ${error.message}` };

  rivalidaPagine();
  return { ok: true, seq: seq + 1 };
}
