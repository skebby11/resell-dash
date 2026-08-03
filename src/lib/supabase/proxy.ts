import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Route raggiungibili senza sessione. */
const ROUTE_PUBBLICHE = ["/login", "/auth/confirm", "/auth/errore"];

function isRoutePubblica(pathname: string): boolean {
  return ROUTE_PUBBLICHE.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Rinnova la sessione Supabase e fa da gate sulle route protette.
 *
 * Tre responsabilità, nell'ordine:
 *   1. rinnovare l'access token scaduto (lo fa `getClaims()`);
 *   2. propagare il token rinnovato ai Server Components (`request.cookies.set`);
 *   3. propagarlo al browser (`response.cookies.set`) + header anti-cache, che
 *      impediscono a CDN e reverse proxy di servire la sessione di un utente a
 *      un altro.
 *
 * Il redirect qui è solo UX (evita di mostrare la shell a chi non è loggato):
 * il vero confine di sicurezza sono le RLS sul database.
 */
export async function aggiornaSessione(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    // Env non configurate: lascia passare la richiesta invece di far fallire
    // ogni route. Le pagine mostreranno l'errore di configurazione.
    return response;
  }

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // getClaims() e non getSession(): verifica la firma del JWT contro le chiavi
  // pubbliche del progetto. getSession() legge solo i cookie, che sono
  // falsificabili, e non va mai usato per decisioni di autorizzazione.
  const { data } = await supabase.auth.getClaims();
  const autenticato = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!autenticato && !isRoutePubblica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Dopo il login si torna dove l'utente stava andando.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (autenticato && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
