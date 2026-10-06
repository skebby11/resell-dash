"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { percorsoInternoSicuro } from "@/lib/percorso-sicuro";

export interface StatoLogin {
  errore?: string;
  inviato?: boolean;
  /** Email a cui è stato inviato il codice, per il secondo passaggio. */
  email?: string;
}

// Lunghezza configurabile su Supabase (mailer_otp_length, 6–10 cifre).
const CODICE_RE = /^\d{6,10}$/;

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

export async function inviaMagicLink(
  _stato: StatoLogin,
  formData: FormData
): Promise<StatoLogin> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = percorsoInternoSicuro(String(formData.get("next") ?? "") || null);

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

  return { inviato: true, email };
}

/**
 * Accesso con il codice numerico della stessa email, alternativa al link.
 *
 * Serve soprattutto all'app aggiunta alla Home su iPhone: ha cookie separati
 * da Safari, e il link dell'email si apre in Safari, quindi la sessione
 * finirebbe lì e non nell'app. Il codice si digita dentro l'app stessa.
 */
export async function verificaCodice(
  _stato: StatoLogin,
  formData: FormData
): Promise<StatoLogin> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const codice = String(formData.get("codice") ?? "").replace(/\s+/g, "");
  const next = percorsoInternoSicuro(String(formData.get("next") ?? "") || null);

  if (!EMAIL_RE.test(email)) return { errore: "Richiedi di nuovo il codice." };
  if (!CODICE_RE.test(codice)) {
    return { inviato: true, email, errore: "Il codice è composto solo da cifre." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: codice, type: "email" });

  if (error?.status === 429) {
    return { inviato: true, email, errore: "Troppi tentativi ravvicinati. Riprova tra qualche minuto." };
  }
  if (error) return { inviato: true, email, errore: "Codice non valido o scaduto." };

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
