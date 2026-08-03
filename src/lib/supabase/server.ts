import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// Accesso statico anche qui: le NEXT_PUBLIC_* sono inlineate a build time
// (vedi nota in client.ts). SUPABASE_SERVICE_ROLE_KEY resta server-only e non
// finisce mai nel bundle.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variabile d'ambiente mancante: ${name}. Configurala in .env.local prima di creare un client Supabase reale (vedi .env.example).`
    );
  }
  return value;
}

/**
 * Client Supabase per Server Components, Server Actions e Route Handlers.
 *
 * I Server Components non possono scrivere cookie: il refresh del token è
 * responsabilità del proxy (`src/proxy.ts`), che gira su ogni richiesta.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_PUBLISHABLE_KEY),
    {
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
            // Chiamato da un Server Component, che non può scrivere cookie:
            // ignorabile perché il proxy rinnova la sessione a monte.
            // Nota: gli header anti-cache passati come secondo argomento non
            // sono impostabili qui, ed è un altro motivo per cui il refresh
            // deve avvenire nel proxy.
          }
        },
      },
    }
  );
}

/**
 * Client con service role: bypassa completamente le RLS.
 *
 * Da usare SOLO in contesti server fidati e mai per servire dati in base a una
 * sessione utente. Non gestisce cookie e non fa refresh di token: non è un
 * client "di sessione", è una chiave amministrativa.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
