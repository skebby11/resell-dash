import type { NextRequest } from "next/server";
import { aggiornaSessione } from "@/lib/supabase/proxy";

// In Next.js 16 il file `middleware.ts` è stato rinominato in `proxy.ts` e
// l'export `middleware` in `proxy`. Stessa funzionalità, solo nomi nuovi.
export async function proxy(request: NextRequest) {
  return aggiornaSessione(request);
}

export const config = {
  // Non gira su asset statici e immagini: risparmia una chiamata di verifica
  // del token su richieste che non toccano Supabase.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
