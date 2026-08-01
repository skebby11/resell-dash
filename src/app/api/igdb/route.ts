import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cercaGiochiIgdb } from "@/lib/integrations/igdb";

const LUNGHEZZA_MINIMA_QUERY = 2;

/**
 * GET /api/igdb?q=…
 *
 * Passo 2 del lookup barcode (vedi README, sezione Barcode lookup): usata
 * solo quando il barcode è sconosciuto al catalogo interno (`GET
 * /api/barcode` ha risposto `prodotto: null`). L'utente cerca il titolo a
 * mano e sceglie fra i candidati IGDB; al salvataggio il barcode viene
 * legato al prodotto scelto (vedi `src/app/(dashboard)/inserimento/actions.ts`),
 * così dalla scansione successiva risolve dal catalogo senza più toccare IGDB.
 *
 * Stessa verifica di autorizzazione di `/api/barcode`: questa route chiama
 * IGDB a spese/quota del proprietario dell'account, quindi non si affida solo
 * al redirect ottimistico del proxy.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: autorizzato, error: erroreAuth } = await supabase.rpc("utente_autorizzato");
  if (erroreAuth || !autorizzato) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < LUNGHEZZA_MINIMA_QUERY) {
    return NextResponse.json(
      { errore: `Titolo troppo corto: servono almeno ${LUNGHEZZA_MINIMA_QUERY} caratteri.` },
      { status: 400 }
    );
  }

  const esito = await cercaGiochiIgdb(query);
  return NextResponse.json(esito);
}
