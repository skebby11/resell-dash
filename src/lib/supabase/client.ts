import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Attenzione: le NEXT_PUBLIC_* vanno lette con accesso statico
// (`process.env.NEXT_PUBLIC_X`). Next.js le sostituisce a build time con una
// trasformazione testuale: un accesso dinamico come `process.env[nome]` non
// viene inlineato e nel bundle browser risulterebbe undefined.
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
 * Client Supabase per componenti "use client" (browser).
 * `createBrowserClient` è già un singleton: chiamarlo più volte non crea
 * istanze aggiuntive.
 */
export function createClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_PUBLISHABLE_KEY)
  );
}
