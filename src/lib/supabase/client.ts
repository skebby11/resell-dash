import { createBrowserClient } from "@supabase/ssr";

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
 * Client Supabase per componenti "use client" (browser).
 * Stub: richiede solo le env NEXT_PUBLIC_*. Nessuna chiamata reale finché
 * il progetto non viene collegato a un'istanza Supabase (vedi .env.example).
 */
export function createClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createBrowserClient(url, anonKey);
}
