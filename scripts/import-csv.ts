/**
 * Importa l'inventario dal CSV esportato da Google Sheets ("FLIP DASHBOARD -
 * Inventario").
 *
 *   npm run import -- --file "/percorso/Inventario.csv" --dry-run
 *   npm run import -- --file "/percorso/Inventario.csv"
 *   npm run import -- --file "..." --append     # non pretende un DB vuoto
 *
 * Usa la service role key: gira fuori da una sessione utente, quindi senza
 * bypassare le RLS non passerebbe il controllo su `utenti_autorizzati`. Da
 * eseguire solo in locale.
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

// ---------------------------------------------------------------- CLI ------

function argomento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const FILE = argomento("file");
const DRY_RUN = process.argv.includes("--dry-run");
const APPEND = process.argv.includes("--append");

if (!FILE) {
  console.error('Uso: npm run import -- --file "/percorso/Inventario.csv" [--dry-run] [--append]');
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

interface Anomalia {
  riga: number;
  nome: string;
  motivo: string;
}

function trasforma(righe: string[][]) {
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
        destinazione: testo(r[COL.destinazione] ?? ""),
        spedizioniere: testo(r[COL.spedizioniere] ?? ""),
        prodotto_sponsorizzato: (r[COL.sponsorizzato] ?? "").trim().toUpperCase() === "TRUE",
        vendita_post_offerta: (r[COL.postOfferta] ?? "").trim().toUpperCase() === "TRUE",
        note: note.length > 0 ? note.join(" · ") : null,
      },
    });
  });

  return { articoli, anomalie, scartate };
}

// ------------------------------------------------------------ scrittura ----

/** Chiave di deduplicazione del catalogo: nome normalizzato. */
function chiaveProdotto(nome: string): string {
  return nome.toLowerCase().replace(/\s+/g, " ").trim();
}

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

async function main() {
  const righe = parseCsv(readFileSync(FILE!, "utf8"));
  const { articoli, anomalie, scartate } = trasforma(righe);

  console.log(`CSV: ${righe.length - 1} righe dati`);
  console.log(`  scartate (senza nome, padding del foglio): ${scartate}`);
  console.log(`  articoli da importare: ${articoli.length}`);

  const perChiave = new Map<string, { nome: string; categoria: string | null }>();
  for (const a of articoli) {
    const k = chiaveProdotto(a.nomeProdotto);
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

  if (DRY_RUN) {
    console.log("\n--dry-run: nessuna scrittura. Esempio di articolo trasformato:");
    console.log(JSON.stringify(articoli[0], null, 2));
    return;
  }

  const { count: articoliEsistenti } = await supabase
    .from("articoli")
    .select("id", { count: "exact", head: true });
  if (articoliEsistenti && articoliEsistenti > 0 && !APPEND) {
    // Gli articoli non hanno una chiave naturale: un secondo import creerebbe
    // duplicati indistinguibili. Meglio fermarsi che raddoppiare lo storico.
    console.error(
      `\nLa tabella articoli contiene già ${articoliEsistenti} righe. Svuotala, oppure usa --append se vuoi davvero aggiungere.`
    );
    process.exit(1);
  }

  // Catalogo: riusa i prodotti già presenti, inserisce solo i mancanti.
  const { data: giaPresenti, error: erroreLettura } = await supabase
    .from("prodotti")
    .select("id, nome");
  if (erroreLettura) throw new Error(`Lettura prodotti: ${erroreLettura.message}`);

  const idPerChiave = new Map<string, string>();
  for (const p of giaPresenti ?? []) idPerChiave.set(chiaveProdotto(p.nome), p.id);

  const daInserire = [...perChiave.entries()].filter(([k]) => !idPerChiave.has(k));
  console.log(`\nCatalogo: ${idPerChiave.size} già presenti, ${daInserire.length} da inserire`);

  if (daInserire.length > 0) {
    await inserisciABlocchi(
      "prodotti",
      daInserire.map(([, p]) => ({ nome: p.nome, categoria: p.categoria }))
    );
    const { data: aggiornati, error } = await supabase.from("prodotti").select("id, nome");
    if (error) throw new Error(`Rilettura prodotti: ${error.message}`);
    idPerChiave.clear();
    for (const p of aggiornati ?? []) idPerChiave.set(chiaveProdotto(p.nome), p.id);
  }

  const righeArticoli = articoli.map((a) => {
    const prodottoId = idPerChiave.get(chiaveProdotto(a.nomeProdotto));
    if (!prodottoId) throw new Error(`Prodotto non risolto: ${a.nomeProdotto}`);
    return { ...a.riga, prodotto_id: prodottoId };
  });

  console.log(`Articoli: ${righeArticoli.length} da inserire`);
  await inserisciABlocchi("articoli", righeArticoli);

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
