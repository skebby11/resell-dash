import type { NextRequest } from "next/server";
import { aggiornaSessione } from "@/lib/supabase/proxy";

// In Next.js 16 il file `middleware.ts` è stato rinominato in `proxy.ts` e
// l'export `middleware` in `proxy`. Stessa funzionalità, solo nomi nuovi.
export async function proxy(request: NextRequest) {
  return aggiornaSessione(request);
}

export const config = {
  // Non gira su asset statici e immagini: risparmia una chiamata di verifica
  // del token su richieste che non toccano Supabase. Il manifest va escluso
  // anche per un altro motivo: senza sessione verrebbe rediretto a /login e
  // il browser riceverebbe HTML al posto del JSON.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
