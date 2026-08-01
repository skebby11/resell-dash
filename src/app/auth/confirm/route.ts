import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Solo path interni: evita che `next` diventi un open redirect. */
function destinazioneSicura(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/**
 * Atterraggio del magic link: scambia il token contenuto nel link con una
 * sessione, poi redirige nell'app.
 *
 * Gestisce entrambe le forme in cui il link può arrivare:
 *   - `?code=…`  flusso PKCE, prodotto dal template email di default
 *     (`{{ .ConfirmationURL }}`). Richiede il code verifier salvato nei cookie,
 *     quindi il link va aperto sullo stesso browser da cui è stato richiesto.
 *   - `?token_hash=…&type=…`  se il template email viene personalizzato con
 *     `{{ .TokenHash }}`. Non dipende dal verifier, quindi funziona anche da un
 *     browser diverso.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = destinazioneSicura(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(
      new URL(`/auth/errore?motivo=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return NextResponse.redirect(
      new URL(`/auth/errore?motivo=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  return NextResponse.redirect(new URL("/auth/errore?motivo=link-incompleto", request.url));
}
