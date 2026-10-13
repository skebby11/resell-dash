/**
 * Convenzione dei nomi di piattaforma: le PlayStation in forma breve (PS1…PS5).
 *
 * IGDB restituisce i nomi per esteso ("PlayStation 4"); senza conversione ogni
 * titolo cercato su IGDB riporterebbe nell'elenco la variante lunga, già unita
 * a mano in Impostazioni. Si applica sia ai suggerimenti IGDB sia al
 * salvataggio, così vale anche per un nome digitato. Chiavi in minuscolo.
 */
const ALIAS_PIATTAFORMA: Record<string, string> = {
  playstation: "PS1",
  "playstation 1": "PS1",
  "playstation 2": "PS2",
  "playstation 3": "PS3",
  "playstation 4": "PS4",
  "playstation 5": "PS5",
  "playstation vita": "PS Vita",
  "playstation portable": "PSP",
};

/** Nome di piattaforma secondo la convenzione dell'app; invariato se non c'è un alias. */
export function piattaformaCanonica(nome: string): string {
  const pulito = nome.trim().replace(/\s+/g, " ");
  return ALIAS_PIATTAFORMA[pulito.toLowerCase()] ?? pulito;
}
