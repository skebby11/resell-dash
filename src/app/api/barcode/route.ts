import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cercaProdottoDaBarcode } from "@/lib/integrations/lookup";

/**
 * GET /api/barcode?barcode=…
 *
 * Passo 1 del lookup barcode (vedi README, sezione Barcode lookup): risolve
 * SOLO dal catalogo interno (`prodotti.barcode`), zero chiamate esterne. Se
 * il barcode non è ancora censito, `prodotto` è `null` e tocca al form
 * proporre la ricerca per titolo su IGDB (`GET /api/igdb`).
 *
 * Il proxy (`src/proxy.ts`) già nega l'accesso a `/api` senza sessione, ma è
 * un controllo ottimistico (redirect lato routing, non un vero gate): questa
 * route legge dal database per conto dell'utente, quindi verifica
 * l'autorizzazione anche qui, chiamando la stessa funzione RPC
 * `utente_autorizzato()` con cui le RLS proteggono le tabelle — un'unica
 * fonte di verità sull'allowlist invece di reimplementarla in TypeScript.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: autorizzato, error: erroreAuth } = await supabase.rpc("utente_autorizzato");
  if (erroreAuth || !autorizzato) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }

  const barcode = request.nextUrl.searchParams.get("barcode") ?? "";
  const esito = await cercaProdottoDaBarcode(barcode);
  if (!esito.ok) {
    return NextResponse.json({ errore: esito.errore }, { status: 400 });
  }
  return NextResponse.json(esito.risultato);
}
