"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface StatoLogin {
  errore?: string;
  inviato?: boolean;
}

// Validazione volutamente minima: il formato definitivo lo decide GoTrue.
// Serve solo a evitare una chiamata di rete per input palesemente non-email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Origin dell'app, per costruire il link di ritorno del magic link. */
async function origineApp(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Percorso interno sicuro verso cui rimandare dopo il login. */
function normalizzaNext(next: string | null): string {
  // Solo path assoluti interni: `//evil.com` o `https://evil.com` diventerebbero
  // un open redirect se passati a Supabase come destinazione.
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function inviaMagicLink(
  _stato: StatoLogin,
  formData: FormData
): Promise<StatoLogin> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = normalizzaNext(String(formData.get("next") ?? "") || null);

  if (!EMAIL_RE.test(email)) {
    return { errore: "Inserisci un indirizzo email valido." };
  }

  const supabase = await createClient();
  const origine = await origineApp();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Nessuna registrazione dall'app: gli account autorizzati vengono creati
      // a mano (Dashboard o Admin API) e inseriti in `utenti_autorizzati`.
      shouldCreateUser: false,
      emailRedirectTo: `${origine}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  // Un'email non autorizzata produce un errore ("Signups not allowed for otp").
  // Non lo mostriamo: distinguere "non autorizzata" da "link inviato"
  // trasformerebbe questo form in un oracolo per enumerare gli account.
  // L'unico errore che vale la pena esporre è il rate limit, perché è
  // azionabile dall'utente legittimo.
  if (error?.status === 429) {
    return { errore: "Troppi tentativi ravvicinati. Riprova tra qualche minuto." };
  }

  return { inviato: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
