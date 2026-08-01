/**
 * Popola il catalogo prodotti su Supabase partendo dai modelli in
 * `src/lib/mock-data.ts`.
 *
 *   npm run seed              solo catalogo (18 modelli)
 *   npm run seed -- --demo    catalogo + articoli dimostrativi
 *
 * Usa la service role key perché gira fuori da una sessione utente: senza
 * bypassare le RLS non passerebbe il controllo su `utenti_autorizzati`. Per lo
 * stesso motivo va eseguito solo in locale, mai da un contesto esposto.
 *
 * Idempotente sul catalogo: i prodotti con barcode noto sono deduplicati per
 * barcode, gli altri per nome. Gli articoli demo invece vengono inseriti a ogni
 * run (sono dati di prova, non anagrafica) e solo con --demo.
 */
import { createClient } from "@supabase/supabase-js";
import { articoliMock, prodottiMock } from "../src/lib/mock-data";
import type { Database } from "../src/types/database";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Valorizzale in .env.local."
  );
  process.exit(1);
}

const supabase = createClient<Database>(URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const conDemo = process.argv.includes("--demo");

async function seedCatalogo(): Promise<Map<string, string>> {
  const { data: esistenti, error: erroreLettura } = await supabase
    .from("prodotti")
    .select("id, nome, barcode");
  if (erroreLettura) throw new Error(`Lettura prodotti: ${erroreLettura.message}`);

  const perBarcode = new Map(
    (esistenti ?? []).filter((p) => p.barcode).map((p) => [p.barcode as string, p.id])
  );
  const perNome = new Map((esistenti ?? []).map((p) => [p.nome, p.id]));

  const daInserire = prodottiMock.filter((p) =>
    p.barcode ? !perBarcode.has(p.barcode) : !perNome.has(p.nome)
  );

  if (daInserire.length > 0) {
    const { data, error } = await supabase
      .from("prodotti")
      .insert(
        daInserire.map((p) => ({
          nome: p.nome,
          barcode: p.barcode ?? null,
          categoria: p.categoria,
          piattaforma_gioco: p.piattaformaGioco ?? null,
          prezzo_medio_acquisto: p.prezzoMedioAcquisto,
          prezzo_medio_vendita: p.prezzoMedioVendita,
          note: p.note ?? null,
        }))
      )
      .select("id, nome");
    if (error) throw new Error(`Inserimento prodotti: ${error.message}`);
    for (const row of data ?? []) perNome.set(row.nome, row.id);
    console.log(`Catalogo: ${data?.length ?? 0} prodotti inseriti.`);
  } else {
    console.log("Catalogo: già popolato, nessun inserimento.");
  }

  // Mappa id-mock → id reale, per collegare gli articoli demo.
  const mappa = new Map<string, string>();
  for (const p of prodottiMock) {
    const id = perNome.get(p.nome);
    if (id) mappa.set(p.id, id);
  }
  return mappa;
}

async function seedArticoli(mappa: Map<string, string>) {
  const righe = articoliMock
    .map((a) => {
      const prodottoId = mappa.get(a.prodottoId);
      if (!prodottoId) return null;
      return {
        prodotto_id: prodottoId,
        data_acquisto: a.dataAcquisto,
        costo_acquisto: a.costoAcquisto,
        fonte_acquisto: a.fonteAcquisto,
        stato: a.stato,
        data_vendita: a.dataVendita,
        prezzo_vendita: a.prezzoVendita,
        piattaforma_vendita: a.piattaformaVendita,
        fee: a.fee,
        costo_spedizione: a.costoSpedizione,
        destinazione: a.destinazione,
        spedizioniere: a.spedizioniere,
        prodotto_sponsorizzato: a.prodottoSponsorizzato,
        vendita_post_offerta: a.venditaPostOfferta,
        // `profitto` è una colonna generata: la calcola Postgres, non noi.
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error, count } = await supabase
    .from("articoli")
    .insert(righe, { count: "exact" });
  if (error) throw new Error(`Inserimento articoli: ${error.message}`);
  console.log(`Articoli demo: ${count ?? righe.length} inseriti.`);
}

async function main() {
  const mappa = await seedCatalogo();
  if (conDemo) await seedArticoli(mappa);
  else console.log("Articoli demo saltati (aggiungi --demo per inserirli).");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
