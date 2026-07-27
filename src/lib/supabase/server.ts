import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variabile d'ambiente mancante: ${name}. Configurala in .env.local prima di creare un client Supabase reale (vedi .env.example).`
    );
  }
  return value;
}

/**
 * Client Supabase per Server Components / Route Handlers.
 * Stub: legge le env server-side. Nessuna connessione reale finché non
 * viene configurata un'istanza Supabase (vedi .env.example).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll chiamato da un Server Component: ignorabile se c'è middleware
          // che rinnova la sessione.
        }
      },
    },
  });
}

/**
 * Client Supabase con service role, da usare SOLO in contesti server-side
 * fidati (mai esporre al browser). Stub in attesa di configurazione reale.
 */
export function createServiceRoleClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createServerClient(url, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
