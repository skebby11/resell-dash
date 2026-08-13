/**
 * Importa l'inventario dal CSV esportato da Google Sheets ("FLIP DASHBOARD -
 * Inventario").
 *
 *   npm run import -- --file "/percorso/Inventario.csv" --dry-run
 *   npm run import -- --file "/percorso/Inventario.csv"
 *   npm run import -- --file "..." --append        # non pretende un DB vuoto
 *   npm run import -- --file "..." --incrementale --dry-run
 *   npm run import -- --file "..." --incrementale   # solo le righe nuove
 *
 * Usa la service role key: gira fuori da una sessione utente, quindi senza
 * bypassare le RLS non passerebbe il controllo su `utenti_autorizzati`. Da
 * eseguire solo in locale.
 *
 * ------------------------------------------------------------------------
 * Modalità incrementale
 * ------------------------------------------------------------------------
 *
 * Il proprietario riesporta periodicamente lo stesso foglio: la maggior parte
 * delle righe è identica a quanto già importato, ma non tutte — puramente
 * inserire le righe nuove non basta, perché una riga già importata come
 * "acquistato" può nel frattempo risultare venduta nel foglio. La modalità
 * incrementale quindi non solo inserisce, ma aggiorna anche i soli campi del
 * lato vendita di articoli già esistenti, quando può farlo senza ambiguità.
 * La logica di classificazione — impronta esatta, correzione di costo,
 * conflitti, ambiguità — è isolata in `src/lib/import-incrementale.ts` per
 * essere testabile senza un database; qui sotto solo un riassunto.
 *
 * Per ogni riga del foglio:
 *
 * 1. **Impronta esatta** (nome normalizzato, data acquisto, costo acquisto)
 *    che individua **un solo** articolo in database:
 *    - se il database non ha ancora dati di vendita, o coincidono già con
 *      quelli del foglio → si aggiornano i campi lato vendita (o non si
 *      scrive nulla, se non c'è differenza);
 *    - se il database ha già dati di vendita **diversi** → conflitto, non si
 *      sovrascrive (il proprietario registra vendite anche dall'app).
 * 2. **Nessuna impronta esatta**, ma stesso nome e stessa data d'acquisto,
 *    costo diverso, univoco su entrambi i lati → trattata come correzione di
 *    costo (un costo diverso di norma significa un esemplare fisico diverso,
 *    ma stesso nome+data+univocità rendono più verosimile un refuso corretto
 *    nel foglio): si aggiornano costo e campi lato vendita insieme. Ogni
 *    correzione è sempre elencata nell'output, mai silenziosa.
 * 3. **Corrispondenza ambigua** (0 o più di 1 candidato per l'impronta esatta
 *    o per la correzione di costo) → si salta e si segnala, non si indovina.
 * 4. **Nessuna corrispondenza** → riga nuova, si inserisce. Se condivide il
 *    nome con un articolo esistente a data diversa, un avviso informativo lo
 *    segnala senza bloccare l'inserimento (un costo diverso resta comunque
 *    un esemplare fisico diverso, confermato dal proprietario).
 *
 * Mai toccati in un aggiornamento/correzione: `data_acquisto` (salvo il ramo
 * di correzione, che tocca solo `costo_acquisto`), `fonte_acquisto`, `note`,
 * `prodotto_id`; mai scritto `profitto` (colonna generated).
 *
 * ------------------------------------------------------------------------
 * Mappatura dal foglio allo schema, con le trasformazioni non ovvie
 * ------------------------------------------------------------------------
 *
 * - Righe senza "Nome Oggetto" → scartate. Sono il padding del foglio (nel file
 *   di riferimento: 1384 righe su 2503), non articoli.
 *
 * - "Fee" nel foglio è una PERCENTUALE ("5,00%"), mentre `articoli.fee` è un
 *   importo. Convertiamo: importo = prezzo_vendita × pct / 100. Verificato
 *   ricalcolando la colonna "Profitto" del foglio, che combacia al centesimo.
 *
 * - "Stato del Prodotto" ha una granularità diversa dai 4 stati dello schema:
 *     "Venduto - Consegnato"   → consegnato
 *     "Venduto - Spedito"      → venduto
 *     "Acquistato - Ritirato"  → acquistato
 *     "Acquistato - Reso"      → acquistato, con nota "Reso"
 *     (vuoto)                  → acquistato
 *   Il foglio non distingue "in vendita": la cella vuota significa solo "in
 *   inventario", quindi non inventiamo uno stato che il dato non contiene.
 *
 * - Righe marcate come vendute ma senza data o prezzo di vendita violerebbero il
 *   CHECK constraint. Vengono degradate ad "acquistato" e annotate, invece di
 *   essere scartate o di far fallire l'import: l'articolo esiste, è il suo stato
 *   che è inaffidabile.
 *
 * - "Comprato da" non ha una colonna corrispondente: finisce nella nota.
 *
 * - Date accettate: D/M/YY, DD/MM/YY, D/M/YYYY, DD/MM/YYYY. Gli anni a due cifre
 *   sono interpretati come 20xx.
 *
 * - `profitto` non viene mai scritto: è una colonna generated.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import type { StatoArticolo } from "../src/types";
import {
  classificaRiga,
  contaChiaviCorrezione,
  nomeSimileValoriDiversi,
  normalizzaNome,
  type ArticoloCandidato,
  type ArticoloEsistente,
  type CampiVendita,
} from "../src/lib/import-incrementale";

// ---------------------------------------------------------------- CLI ------

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const FILE = argomento("file");
const DRY_RUN = process.argv.includes("--dry-run");
const APPEND = process.argv.includes("--append");
const INCREMENTALE = process.argv.includes("--incrementale");

if (!FILE) {
  console.error(
    'Uso: npm run import -- --file "/percorso/Inventario.csv" [--dry-run] [--append] [--incrementale]'
  );
  process.exit(1);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_ROLE_KEY) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const supabase = createClient<Database>(URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------- parsing CSV ----

/**
 * Parser CSV minimale conforme a RFC 4180: gestisce virgolette, virgolette
 * raddoppiate e newline dentro i campi (l'header del foglio ne contiene).
 */
function parseCsv(testo: string): string[][] {
  const righe: string[][] = [];
  let campo = "";
  let riga: string[] = [];
  let inVirgolette = false;

  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (inVirgolette) {
      if (c === '"') {
        if (testo[i + 1] === '"') {
          campo += '"';
          i++;
        } else inVirgolette = false;
      } else campo += c;
      continue;
    }
    if (c === '"') inVirgolette = true;
    else if (c === ",") {
      riga.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = "";
    } else campo += c;
  }
  if (campo || riga.length > 0) {
    riga.push(campo);
    righe.push(riga);
  }
  return righe;
}

/** Numero da formato italiano: `€0,10`, `€ 14,90`, `1.234,56`, `5,00%`, `0`. */
function numero(raw: string): number | null {
  const v = raw.replace(/[€%\s ]/g, "").trim();
  if (!v) return null;
  // Il punto è separatore delle migliaia, la virgola quello decimale.
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Data italiana → ISO `YYYY-MM-DD`. */
function data(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const giorno = Number(m[1]);
  const mese = Number(m[2]);
  const anno = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (giorno < 1 || giorno > 31 || mese < 1 || mese > 12) return null;
  const iso = `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
  // Scarta date impossibili (31/02) che Postgres rifiuterebbe.
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toISOString().slice(0, 10) === iso ? iso : null;
}

/** Testo pulito, oppure null. Normalizza i segnaposto di dato assente. */
function testo(raw: string): string | null {
  const v = raw.replace(/\s+/g, " ").trim();
  if (!v || v === "0" || v === "-" || /^opzione \d+$/i.test(v)) return null;
  return v;
}

const COL = {
  stato: 1,
  nome: 2,
  dataAcquisto: 3,
  fonte: 4,
  costoAcquisto: 5,
  categoria: 6,
  compratoDa: 7,
  note: 8,
  dataVendita: 9,
  prezzoVendita: 10,
  piattaforma: 11,
  sponsorizzato: 12,
  postOfferta: 13,
  fee: 14,
  destinazione: 15,
  spedizioniere: 16,
  costoSpedizione: 17,
} as const;

const MAPPA_STATI: Record<string, { stato: StatoArticolo; nota?: string }> = {
  "Venduto - Consegnato": { stato: "consegnato" },
  "Venduto - Spedito": { stato: "venduto" },
  "Acquistato - Ritirato": { stato: "acquistato" },
  "Acquistato - Reso": { stato: "acquistato", nota: "Reso" },
};

interface ArticoloImportato {
  nomeProdotto: string;
  categoria: string | null;
  riga: Omit<Database["public"]["Tables"]["articoli"]["Insert"], "prodotto_id">;
}

/** Il foglio ha solo "Italia"/"Estero": mappa su `destinazione` + `paese_vendita`
 * senza mai indovinare il paese estero, che il foglio non registra.
 * `Italia` diventa il paese di origine dell'installazione; per l'estero il
 * paese resta NULL — il CHECK di coerenza dello schema ammette NULL a
 * prescindere da `destinazione`. Nessun codice assente da `paesi` viene
 * inserito automaticamente. */
function destinazionePaese(
  raw: string,
  paeseOrigine: string
): { destinazione: string | null; paeseVendita: string | null } {
  const destinazione = testo(raw);
  if (destinazione === "Italia") return { destinazione, paeseVendita: paeseOrigine };
  return { destinazione, paeseVendita: null };
}

interface Anomalia {
  riga: number;
  nome: string;
  motivo: string;
}

function trasforma(righe: string[][], paeseOrigine: string) {
  const articoli: ArticoloImportato[] = [];
  const anomalie: Anomalia[] = [];
  let scartate = 0;

  righe.slice(1).forEach((r, idx) => {
    const numRiga = idx + 2; // +1 header, +1 base-1
    const nome = testo(r[COL.nome] ?? "");
    if (!nome) {
      scartate++;
      return;
    }

    const dataAcquisto = data(r[COL.dataAcquisto] ?? "");
    const costoAcquisto = numero(r[COL.costoAcquisto] ?? "");
    if (!dataAcquisto || costoAcquisto == null || costoAcquisto < 0) {
      anomalie.push({
        riga: numRiga,
        nome,
        motivo: `scartata: data acquisto ("${r[COL.dataAcquisto] ?? ""}") o costo ("${r[COL.costoAcquisto] ?? ""}") non validi`,
      });
      return;
    }

    const statoGrezzo = (r[COL.stato] ?? "").trim();
    const mappato = MAPPA_STATI[statoGrezzo] ?? { stato: "acquistato" as StatoArticolo };
    let stato = mappato.stato;

    const dataVendita = data(r[COL.dataVendita] ?? "");
    const prezzoVendita = numero(r[COL.prezzoVendita] ?? "");
    const note: string[] = [];
    if (mappato.nota) note.push(mappato.nota);

    // Il CHECK constraint pretende data E prezzo per venduto/consegnato.
    if ((stato === "venduto" || stato === "consegnato") && !(dataVendita && prezzoVendita != null)) {
      note.push(`Nel foglio risultava «${statoGrezzo}» ma senza dati di vendita completi`);
      anomalie.push({
        riga: numRiga,
        nome,
        motivo: `stato «${statoGrezzo}» senza data/prezzo → importata come "acquistato"`,
      });
      stato = "acquistato";
    }

    // La fee del foglio è una percentuale del prezzo di vendita.
    //
    // Nessun arrotondamento al centesimo: il 5% di 18,90 è 0,945, e `numeric`
    // lo memorizza esatto. Arrotondare qui introdurrebbe uno scostamento che il
    // dato di partenza non ha (~0,20 € sull'intero storico) e renderebbe i
    // totali non riconciliabili con il foglio.
    const feePct = numero(r[COL.fee] ?? "");
    const fee = feePct != null && prezzoVendita != null ? prezzoVendita * (feePct / 100) : null;

    const compratoDa = testo(r[COL.compratoDa] ?? "");
    if (compratoDa) note.push(`Comprato da: ${compratoDa}`);
    const noteFoglio = testo(r[COL.note] ?? "");
    if (noteFoglio) note.push(noteFoglio);

    const { destinazione, paeseVendita } = destinazionePaese(r[COL.destinazione] ?? "", paeseOrigine);

    articoli.push({
      nomeProdotto: nome,
      categoria: testo(r[COL.categoria] ?? ""),
      riga: {
        data_acquisto: dataAcquisto,
        costo_acquisto: costoAcquisto,
        fonte_acquisto: testo(r[COL.fonte] ?? "") ?? "Non specificata",
        stato,
        data_vendita: dataVendita,
        prezzo_vendita: prezzoVendita,
        piattaforma_vendita: testo(r[COL.piattaforma] ?? ""),
        fee,
        costo_spedizione: numero(r[COL.costoSpedizione] ?? ""),
        destinazione,
        paese_vendita: paeseVendita,
        spedizioniere: testo(r[COL.spedizioniere] ?? ""),
        prodotto_sponsorizzato: (r[COL.sponsorizzato] ?? "").trim().toUpperCase() === "TRUE",
        vendita_post_offerta: (r[COL.postOfferta] ?? "").trim().toUpperCase() === "TRUE",
        note: note.length > 0 ? note.join(" · ") : null,
      },
    });
  });

  return { articoli, anomalie, scartate };
}

// ---------------------------------------------------- incrementale: util ----

type RigaArticolo = ArticoloImportato["riga"];

/** Traduce i campi lato vendita di una riga trasformata nella forma usata dalla logica di
 * classificazione (src/lib/import-incrementale.ts). */
function campiVenditaDaRiga(riga: RigaArticolo): CampiVendita {
  return {
    stato: riga.stato as string,
    dataVendita: riga.data_vendita ?? null,
    prezzoVendita: riga.prezzo_vendita ?? null,
    piattaformaVendita: riga.piattaforma_vendita ?? null,
    fee: riga.fee ?? null,
    costoSpedizione: riga.costo_spedizione ?? null,
    destinazione: riga.destinazione ?? null,
    paeseVendita: riga.paese_vendita ?? null,
    spedizioniere: riga.spedizioniere ?? null,
    sponsorizzato: riga.prodotto_sponsorizzato ?? false,
    postOfferta: riga.vendita_post_offerta ?? false,
  };
}

/** Stesso calcolo della colonna generated `articoli.profitto`, per proiettare i totali senza
 * dover già avere scritto nulla nel database. */
function calcolaProfitto(
  prezzoVendita: number,
  costoAcquisto: number,
  costoSpedizione: number | null | undefined,
  fee: number | null | undefined
): number {
  return prezzoVendita - costoAcquisto - (costoSpedizione ?? 0) - (fee ?? 0);
}

function descriviVendita(v: CampiVendita): string {
  if (v.stato !== "venduto" && v.stato !== "consegnato") return "non venduto";
  return `${v.stato} il ${v.dataVendita} a ${(v.prezzoVendita ?? 0).toFixed(2)}€`;
}
function descriviVenditaRiga(r: RigaArticolo): string {
  return descriviVendita(campiVenditaDaRiga(r));
}

/** Solo i campi del lato vendita, mai `data_acquisto`/`fonte_acquisto`/`note`/`prodotto_id`,
 * mai `profitto` (colonna generated): è l'unico payload che un aggiornamento/correzione può
 * scrivere su un articolo già esistente. */
function payloadVendita(riga: RigaArticolo): Database["public"]["Tables"]["articoli"]["Update"] {
  return {
    stato: riga.stato,
    data_vendita: riga.data_vendita,
    prezzo_vendita: riga.prezzo_vendita,
    piattaforma_vendita: riga.piattaforma_vendita,
    fee: riga.fee,
    costo_spedizione: riga.costo_spedizione,
    destinazione: riga.destinazione,
    paese_vendita: riga.paese_vendita,
    spedizioniere: riga.spedizioniere,
    prodotto_sponsorizzato: riga.prodotto_sponsorizzato,
    vendita_post_offerta: riga.vendita_post_offerta,
  };
}

interface RigaAggiornamento {
  id: string;
  nome: string;
  riga: RigaArticolo;
  prima: CampiVendita;
}
interface RigaCorrezione {
  id: string;
  nome: string;
  riga: RigaArticolo;
  costoDb: number;
  prima: CampiVendita;
}

// ------------------------------------------------------------ scrittura ----

async function inserisciABlocchi<T>(
  tabella: "prodotti" | "articoli",
  righe: T[],
  dimensione = 500
): Promise<void> {
  for (let i = 0; i < righe.length; i += dimensione) {
    const blocco = righe.slice(i, i + dimensione);
    // @ts-expect-error: insert è tipizzato per tabella, qui la scegliamo a runtime.
    const { error } = await supabase.from(tabella).insert(blocco);
    if (error) throw new Error(`Insert ${tabella} [${i}..${i + blocco.length}): ${error.message}`);
    process.stdout.write(`\r  ${tabella}: ${Math.min(i + blocco.length, righe.length)}/${righe.length}`);
  }
  process.stdout.write("\n");
}

/** Aggiornamenti mirati per `id`: niente batch — sono poche righe (aggiornamenti +
 * correzioni sono un'eccezione rara, non la norma di un import) e ognuna scrive valori
 * diversi, quindi un singolo `insert` a blocchi come per i nuovi articoli non si applica. */
async function aggiornaVendita(
  righe: { id: string; payload: Database["public"]["Tables"]["articoli"]["Update"] }[]
): Promise<void> {
  for (let i = 0; i < righe.length; i++) {
    const { id, payload } = righe[i];
    const { error } = await supabase.from("articoli").update(payload).eq("id", id);
    if (error) throw new Error(`Update articolo ${id}: ${error.message}`);
    process.stdout.write(`\r  aggiornamenti: ${i + 1}/${righe.length}`);
  }
  if (righe.length > 0) process.stdout.write("\n");
}

/** Stesso default di `getPaeseOrigine`: `IT` se la chiave manca o non è un ISO a due lettere. */
async function leggiPaeseOrigine(): Promise<string> {
  const { data, error } = await supabase
    .from("impostazioni")
    .select("valore")
    .eq("chiave", "paese_origine")
    .maybeSingle();
  if (error) throw new Error(`Lettura paese origine: ${error.message}`);
  const v = data?.valore;
  return typeof v === "string" && /^[A-Z]{2}$/.test(v) ? v : "IT";
}

async function main() {
  const paeseOrigine = await leggiPaeseOrigine();
  const righe = parseCsv(readFileSync(FILE!, "utf8"));
  const { articoli, anomalie, scartate } = trasforma(righe, paeseOrigine);

  console.log(`CSV: ${righe.length - 1} righe dati`);
  console.log(`  scartate (senza nome, padding del foglio): ${scartate}`);
  console.log(`  articoli da importare: ${articoli.length}`);

  const perChiave = new Map<string, { nome: string; categoria: string | null }>();
  for (const a of articoli) {
    const k = normalizzaNome(a.nomeProdotto);
    const esistente = perChiave.get(k);
    // La categoria può mancare su alcune occorrenze: teniamo la prima valorizzata.
    if (!esistente) perChiave.set(k, { nome: a.nomeProdotto, categoria: a.categoria });
    else if (!esistente.categoria && a.categoria) esistente.categoria = a.categoria;
  }
  console.log(`  prodotti distinti (catalogo): ${perChiave.size}`);

  const perStato = articoli.reduce<Record<string, number>>((acc, a) => {
    acc[a.riga.stato ?? "?"] = (acc[a.riga.stato ?? "?"] ?? 0) + 1;
    return acc;
  }, {});
  console.log("  per stato:", perStato);

  if (anomalie.length > 0) {
    console.log(`\n${anomalie.length} anomalie:`);
    for (const a of anomalie.slice(0, 20)) {
      console.log(`  riga ${a.riga}: ${a.nome} — ${a.motivo}`);
    }
    if (anomalie.length > 20) console.log(`  … e altre ${anomalie.length - 20}`);
  }

  // In modalità piena si importa tutto; in incrementale, si classifica ogni
  // riga rispetto al database (vedi src/lib/import-incrementale.ts) e si
  // popolano queste liste, lasciate vuote in modalità piena.
  let daImportare = articoli;
  const daAggiornare: RigaAggiornamento[] = [];
  const daCorreggere: RigaCorrezione[] = [];

  if (INCREMENTALE) {
    // PostgREST limita ogni risposta a 1000 righe: con 1122+ articoli serve
    // paginare, altrimenti la classificazione lavora su un sottoinsieme e
    // tratta come "nuove" righe già presenti oltre la millesima. `order("id")`
    // rende deterministico l'attraversamento tra una pagina e l'altra.
    type RigaEsistenteGrezza = {
      id: string;
      data_acquisto: string;
      costo_acquisto: number;
      stato: string;
      data_vendita: string | null;
      prezzo_vendita: number | null;
      piattaforma_vendita: string | null;
      fee: number | null;
      costo_spedizione: number | null;
      destinazione: string | null;
      paese_vendita: string | null;
      spedizioniere: string | null;
      prodotto_sponsorizzato: boolean;
      vendita_post_offerta: boolean;
      prodotti: { nome: string } | { nome: string }[];
    };
    const righeEsistenti: RigaEsistenteGrezza[] = [];
    const DIMENSIONE_PAGINA = 1000;
    for (let da = 0; ; da += DIMENSIONE_PAGINA) {
      const { data: pagina, error: erroreEsistenti } = await supabase
        .from("articoli")
        .select(
          "id, data_acquisto, costo_acquisto, stato, data_vendita, prezzo_vendita, piattaforma_vendita, fee, costo_spedizione, destinazione, paese_vendita, spedizioniere, prodotto_sponsorizzato, vendita_post_offerta, prodotti!inner ( nome )"
        )
        .order("id", { ascending: true })
        .range(da, da + DIMENSIONE_PAGINA - 1);
      if (erroreEsistenti) throw new Error(`Lettura articoli esistenti: ${erroreEsistenti.message}`);
      righeEsistenti.push(...((pagina as RigaEsistenteGrezza[] | null) ?? []));
      if (!pagina || pagina.length < DIMENSIONE_PAGINA) break;
    }

    const esistenti: ArticoloEsistente[] = righeEsistenti.map((r) => {
      // L'embed è tipizzato come oggetto singolo con !inner, ma per sicurezza
      // gestiamo anche il caso array (dipende dalla versione dei tipi generati).
      const prodottoRel = r.prodotti as { nome: string } | { nome: string }[];
      const nomeProdotto = Array.isArray(prodottoRel) ? (prodottoRel[0]?.nome ?? "") : prodottoRel.nome;
      return {
        id: r.id,
        nomeNormalizzato: normalizzaNome(nomeProdotto),
        dataAcquisto: r.data_acquisto,
        costoAcquisto: Number(r.costo_acquisto),
        vendita: {
          stato: r.stato,
          dataVendita: r.data_vendita,
          prezzoVendita: r.prezzo_vendita == null ? null : Number(r.prezzo_vendita),
          piattaformaVendita: r.piattaforma_vendita,
          fee: r.fee == null ? null : Number(r.fee),
          costoSpedizione: r.costo_spedizione == null ? null : Number(r.costo_spedizione),
          destinazione: r.destinazione,
          paeseVendita: r.paese_vendita,
          spedizioniere: r.spedizioniere,
          sponsorizzato: r.prodotto_sponsorizzato,
          postOfferta: r.vendita_post_offerta,
        },
      };
    });
    const mappaEsistentiPerId = new Map(esistenti.map((e) => [e.id, e]));

    const candidati: ArticoloCandidato[] = articoli.map((a) => ({
      nomeNormalizzato: normalizzaNome(a.nomeProdotto),
      dataAcquisto: a.riga.data_acquisto,
      costoAcquisto: Number(a.riga.costo_acquisto),
      vendita: campiVenditaDaRiga(a.riga),
    }));
    const conteggioChiaviCsv = contaChiaviCorrezione(candidati);

    const daInserireList: ArticoloImportato[] = [];
    const avvisiNomeSimile: { nome: string; dbData: string; dbCosto: number; csvData: string; csvCosto: number }[] =
      [];
    const conflitti: { nome: string; motivo: string }[] = [];
    const ambigui: { nome: string; motivo: string }[] = [];
    let giaPresenti = 0;

    articoli.forEach((a, idx) => {
      const candidato = candidati[idx];
      const esito = classificaRiga(candidato, esistenti, conteggioChiaviCsv);
      switch (esito.esito) {
        case "gia_presente":
          giaPresenti++;
          break;
        case "inserisci": {
          daInserireList.push(a);
          const simile = nomeSimileValoriDiversi(candidato, esistenti);
          if (simile) {
            avvisiNomeSimile.push({
              nome: a.nomeProdotto,
              dbData: simile.dataAcquisto,
              dbCosto: simile.costoAcquisto,
              csvData: candidato.dataAcquisto,
              csvCosto: candidato.costoAcquisto,
            });
          }
          break;
        }
        case "aggiorna":
          daAggiornare.push({
            id: esito.id,
            nome: a.nomeProdotto,
            riga: a.riga,
            prima: mappaEsistentiPerId.get(esito.id)!.vendita,
          });
          break;
        case "correzione_costo":
          daCorreggere.push({
            id: esito.id,
            nome: a.nomeProdotto,
            riga: a.riga,
            costoDb: esito.costoDb,
            prima: mappaEsistentiPerId.get(esito.id)!.vendita,
          });
          break;
        case "conflitto":
          conflitti.push({ nome: a.nomeProdotto, motivo: esito.motivo });
          break;
        case "ambiguo":
          ambigui.push({ nome: a.nomeProdotto, motivo: esito.motivo });
          break;
      }
    });

    // Proiezione dei totali: calcolata dagli stessi dati appena letti dal
    // database (nessuna query aggiuntiva), così non può divergere da quanto
    // classificato sopra.
    let ricaviAttuali = 0;
    let profittoAttuale = 0;
    for (const e of esistenti) {
      if (e.vendita.stato === "venduto" || e.vendita.stato === "consegnato") {
        const prezzo = e.vendita.prezzoVendita ?? 0;
        ricaviAttuali += prezzo;
        profittoAttuale += calcolaProfitto(prezzo, e.costoAcquisto, e.vendita.costoSpedizione, e.vendita.fee);
      }
    }
    let deltaRicavi = 0;
    let deltaProfitto = 0;
    for (const u of daAggiornare) {
      const prezzo = u.riga.prezzo_vendita ?? 0;
      deltaRicavi += prezzo;
      deltaProfitto += calcolaProfitto(
        prezzo,
        mappaEsistentiPerId.get(u.id)!.costoAcquisto,
        u.riga.costo_spedizione,
        u.riga.fee
      );
    }
    for (const c of daCorreggere) {
      if (c.riga.stato === "venduto" || c.riga.stato === "consegnato") {
        const prezzo = c.riga.prezzo_vendita ?? 0;
        deltaRicavi += prezzo;
        deltaProfitto += calcolaProfitto(prezzo, Number(c.riga.costo_acquisto), c.riga.costo_spedizione, c.riga.fee);
      }
    }
    for (const a of daInserireList) {
      if (a.riga.stato === "venduto" || a.riga.stato === "consegnato") {
        const prezzo = a.riga.prezzo_vendita ?? 0;
        deltaRicavi += prezzo;
        deltaProfitto += calcolaProfitto(prezzo, Number(a.riga.costo_acquisto), a.riga.costo_spedizione, a.riga.fee);
      }
    }

    console.log(`\nModalità incrementale — confronto con ${esistenti.length} articoli già in database:`);
    console.log(`  già presenti, nessuna differenza: ${giaPresenti}`);
    console.log(`  da inserire (articoli nuovi): ${daInserireList.length}`);
    if (avvisiNomeSimile.length > 0) {
      console.log(
        `  avviso: ${avvisiNomeSimile.length} riga/e da inserire hanno lo stesso nome di un articolo già in database con data/costo diversi (inserite comunque, controllare a occhio):`
      );
      for (const w of avvisiNomeSimile) {
        console.log(
          `    - ${w.nome}: in DB ${w.dbData}/${w.dbCosto.toFixed(2)} — nel foglio ${w.csvData}/${w.csvCosto.toFixed(2)}`
        );
      }
    }
    console.log(`  da aggiornare (dati di vendita su articoli già esistenti): ${daAggiornare.length}`);
    for (const u of daAggiornare) {
      console.log(`    - ${u.nome}: ${descriviVendita(u.prima)} → ${descriviVenditaRiga(u.riga)}`);
    }
    console.log(`  correzioni di costo (nome+data univoci, costo diverso): ${daCorreggere.length}`);
    for (const c of daCorreggere) {
      console.log(
        `    - ${c.nome}: costo ${c.costoDb.toFixed(2)} → ${Number(c.riga.costo_acquisto).toFixed(2)}; vendita ${descriviVendita(c.prima)} → ${descriviVenditaRiga(c.riga)}`
      );
    }
    console.log(`  conflitti (dati di vendita già presenti e diversi, non sovrascritti): ${conflitti.length}`);
    for (const c of conflitti) console.log(`    - ${c.nome}: ${c.motivo}`);
    console.log(`  ambigui (corrispondenza non univoca, saltati): ${ambigui.length}`);
    for (const a of ambigui) console.log(`    - ${a.nome}: ${a.motivo}`);

    const ricaviProiettati = ricaviAttuali + deltaRicavi;
    const profittoProiettato = profittoAttuale + deltaProfitto;
    console.log(`\nProiezione dopo l'applicazione:`);
    console.log(`  articoli: ${esistenti.length} → ${esistenti.length + daInserireList.length}`);
    console.log(`  ricavi: ${ricaviAttuali.toFixed(2)} → ${ricaviProiettati.toFixed(2)} (Δ ${deltaRicavi.toFixed(2)})`);
    console.log(
      `  profitto: ${profittoAttuale.toFixed(2)} → ${profittoProiettato.toFixed(2)} (Δ ${deltaProfitto.toFixed(2)})`
    );

    daImportare = daInserireList;
  }

  if (DRY_RUN) {
    if (daImportare.length > 0) {
      console.log("\n--dry-run: nessuna scrittura. Esempio di articolo da inserire:");
      console.log(JSON.stringify(daImportare[0], null, 2));
    } else {
      console.log("\n--dry-run: nessuna scrittura. Nessuna riga da inserire.");
    }
    return;
  }

  const { count: articoliEsistenti } = await supabase
    .from("articoli")
    .select("id", { count: "exact", head: true });
  if (articoliEsistenti && articoliEsistenti > 0 && !APPEND && !INCREMENTALE) {
    // Gli articoli non hanno una chiave naturale: un secondo import creerebbe
    // duplicati indistinguibili. Meglio fermarsi che raddoppiare lo storico.
    console.error(
      `\nLa tabella articoli contiene già ${articoliEsistenti} righe. Svuotala, oppure usa --append/--incrementale se vuoi davvero aggiungere.`
    );
    process.exit(1);
  }

  // Catalogo: riusa i prodotti già presenti, inserisce solo i mancanti. Basato
  // su tutte le righe del CSV (non solo su `daImportare`): un modello nuovo
  // potrebbe comparire per la prima volta anche in una riga già presente in
  // database per altri esemplari, ma non fa differenza doverlo comunque
  // risolvere qui per creare il catalogo.
  const { data: giaPresenti, error: erroreLettura } = await supabase
    .from("prodotti")
    .select("id, nome");
  if (erroreLettura) throw new Error(`Lettura prodotti: ${erroreLettura.message}`);

  const idPerChiave = new Map<string, string>();
  for (const p of giaPresenti ?? []) idPerChiave.set(normalizzaNome(p.nome), p.id);

  const daInserireCatalogo = [...perChiave.entries()].filter(([k]) => !idPerChiave.has(k));
  console.log(`\nCatalogo: ${idPerChiave.size} già presenti, ${daInserireCatalogo.length} da inserire`);

  if (daInserireCatalogo.length > 0) {
    await inserisciABlocchi(
      "prodotti",
      daInserireCatalogo.map(([, p]) => ({ nome: p.nome, categoria: p.categoria }))
    );
    const { data: aggiornati, error } = await supabase.from("prodotti").select("id, nome");
    if (error) throw new Error(`Rilettura prodotti: ${error.message}`);
    idPerChiave.clear();
    for (const p of aggiornati ?? []) idPerChiave.set(normalizzaNome(p.nome), p.id);
  }

  const righeArticoli = daImportare.map((a) => {
    const prodottoId = idPerChiave.get(normalizzaNome(a.nomeProdotto));
    if (!prodottoId) throw new Error(`Prodotto non risolto: ${a.nomeProdotto}`);
    return { ...a.riga, prodotto_id: prodottoId };
  });

  console.log(`Articoli: ${righeArticoli.length} da inserire`);
  await inserisciABlocchi("articoli", righeArticoli);

  if (daAggiornare.length > 0 || daCorreggere.length > 0) {
    console.log(`Articoli: ${daAggiornare.length} da aggiornare, ${daCorreggere.length} correzioni di costo`);
    await aggiornaVendita([
      ...daAggiornare.map((u) => ({ id: u.id, payload: payloadVendita(u.riga) })),
      ...daCorreggere.map((c) => ({
        id: c.id,
        payload: { ...payloadVendita(c.riga), costo_acquisto: c.riga.costo_acquisto },
      })),
    ]);
  }

  // Prezzi medi del catalogo, calcolati dallo storico appena importato: il
  // foglio non li conteneva, ma servono come riferimento in fase di acquisto.
  console.log("Ricalcolo dei prezzi medi sul catalogo…");
  const { error: erroreMedie } = await supabase.rpc("ricalcola_prezzi_medi");
  if (erroreMedie) console.warn(`  non riuscito (${erroreMedie.message}); puoi rilanciarlo in SQL.`);
  else console.log("  fatto.");

  console.log("\nImport completato.");
}

main().catch((e: unknown) => {
  console.error("\n" + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
