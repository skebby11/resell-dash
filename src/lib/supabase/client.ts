import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase per componenti "use client" (browser).
 * Stub: richiede solo le env NEXT_PUBLIC_*. Nessuna chiamata reale finché
 * il progetto non viene collegato a un'istanza Supabase (vedi .env.example).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return createBrowserClient(url, anonKey);
}
