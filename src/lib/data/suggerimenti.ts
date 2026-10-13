import type { createClient } from "@/lib/supabase/server";
import { parseNomeEtichetta } from "@/lib/validazione";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Porta un valore digitato in un form (categoria o piattaforma) nell'elenco dei
 * suggerimenti gestito da Impostazioni, così compare anche lì.
 *
 * Non blocca mai il salvataggio: restituisce un avviso da mostrare, non un
 * errore. 23505 = già presente (unicità case-insensitive): si ignora.
 */
export async function aggiungiSuggerimento(
  supabase: Supabase,
  tabella: "categorie" | "piattaforme",
  valore: string | null
): Promise<{ nome?: string; aggiunto: boolean; avviso?: string }> {
  if (!valore) return { aggiunto: false };
  const etichetta = tabella === "categorie" ? "Categoria" : "Piattaforma";

  const nome = parseNomeEtichetta(valore);
  if (!nome) {
    return {
      aggiunto: false,
      avviso: `${etichetta} non valida (max 60 caratteri): non è stata aggiunta all'elenco.`,
    };
  }

  const { data: ultimo, error: eOrdine } = await supabase
    .from(tabella)
    .select("ordine")
    .order("ordine", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eOrdine) {
    return { nome, aggiunto: false, avviso: `${etichetta} non aggiunta all'elenco: ${eOrdine.message}` };
  }

  const { error } = await supabase.from(tabella).insert({ nome, ordine: (ultimo?.ordine ?? -1) + 1 });
  if (error && error.code !== "23505") {
    return { nome, aggiunto: false, avviso: `${etichetta} non aggiunta all'elenco: ${error.message}` };
  }
  return { nome, aggiunto: !error };
}
