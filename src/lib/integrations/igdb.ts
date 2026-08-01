import "server-only";

/**
 * Ricerca titoli su IGDB, per il passo 2 del flusso barcode (vedi
 * src/lib/integrations/lookup.ts e il report di consegna): quando un codice
 * a barre non è ancora in catalogo, l'utente cerca il titolo a mano e sceglie
 * fra i risultati IGDB. Al salvataggio il barcode viene legato al prodotto
 * scelto/creato (src/app/(dashboard)/inserimento/actions.ts), così dalla
 * seconda scansione in poi risolve dal catalogo interno senza mai più
 * toccare IGDB.
 *
 * IGDB richiede un token OAuth "app" di Twitch (client_credentials): non è
 * verificabile senza TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET, quindi qui
 * l'assenza delle chiavi è un esito esplicito (`configurato: false`) e non
 * un errore generico o un 500.
 *
 * Endpoint verificati contro l'API reale (vedi report):
 *   - token:  POST https://id.twitch.tv/oauth2/token?client_id=…&client_secret=…&grant_type=client_credentials
 *             → { access_token, expires_in (secondi), token_type }
 *   - giochi: POST https://api.igdb.com/v4/games, header Client-ID + Bearer,
 *             corpo in linguaggio APICalypse (non JSON)
 *   - copertine: https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg
 *
 * Pertinenza della ricerca (il difetto segnalato nel task): con
 * `search "zelda breath of the wild"` senza filtri, i primi risultati erano
 * un bundle e una mod, non il gioco vero. Verificato dal vivo (vedi report):
 *   - Il campo `category` sui /games è in migrazione verso `game_type`
 *     (stessi valori enum, nuovo nome — vedi changelog IGDB "Enums to
 *     Tables"): combinarlo con `search` in un `where` restituisce [] a vuoto,
 *     mentre `game_type` funziona correttamente. Va usato `game_type`, non
 *     `category`.
 *   - IGDB non permette `sort` insieme a `search` (HTTP 406 "Search is
 *     sorting on relevancy and therefore sort is not applicable"): l'unica
 *     leva per il filtro di pertinenza è `where`, non un ordinamento custom.
 *   - `where game_type = (0,4,8,9,10,11)` (main_game, standalone_expansion,
 *     remake, remaster, expanded_game, port) esclude bundle (3), mod (5),
 *     dlc_addon (1), expansion (2), episode (6), season (7), pack (13),
 *     update (14) — esattamente le categorie del bug segnalato — pur
 *     mantenendo edizioni fisiche reali (Collector's/Limited Edition, che
 *     hanno spesso un barcode proprio) tra i risultati, a differenza di
 *     escludere anche `version_parent`.
 *   - Il filtro categoria non basta da solo su titoli generici: una fan-mod
 *     PC senza alcun dato di popolarità può comunque comparire come
 *     `main_game` e precedere il gioco vero per sola somiglianza testuale
 *     (visto dal vivo su "super mario odyssey", vedi report). Dato che IGDB
 *     vieta `sort` con `search`, il riordino avviene lato nostro: i
 *     risultati con un segnale di popolarità reale (`total_rating_count` o
 *     `follows` > 0) vengono anteposti a quelli senza, a parità mantenendo
 *     l'ordine di rilevanza originale di IGDB (sort stabile).
 */

const TIMEOUT_MS = 8000;
const MARGINE_SCADENZA_MS = 60_000;
const LIMITE_RISULTATI = 20;
const MASSIMO_CANDIDATI_MOSTRATI = 10;

// game_type: main_game=0, standalone_expansion=4, remake=8, remaster=9,
// expanded_game=10, port=11. Esclude dlc_addon(1), expansion(2), bundle(3),
// mod(5), episode(6), season(7), pack(13), update(14): sono gli stessi
// esempi rumorosi segnalati nel task (bundle e mod).
const GAME_TYPE_AMMESSI = "(0,4,8,9,10,11)";

interface TokenTwitch {
  accessToken: string;
  scadenza: number; // epoch ms
}

// Cache di modulo: il token Twitch dura settimane, richiederlo a ogni ricerca
// sarebbe uno spreco di quota e di latenza. Sopravvive finché il processo
// server resta caldo; un riavvio semplicemente lo rigenera alla prima ricerca.
let tokenCache: TokenTwitch | null = null;

type EsitoToken = { ok: true; token: string } | { ok: false; errore: string };

async function ottieniToken(clientId: string, clientSecret: string): Promise<EsitoToken> {
  if (tokenCache && tokenCache.scadenza - MARGINE_SCADENZA_MS > Date.now()) {
    return { ok: true, token: tokenCache.accessToken };
  }

  let res: Response;
  try {
    const url = new URL("https://id.twitch.tv/oauth2/token");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("grant_type", "client_credentials");
    res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return { ok: false, errore: "Twitch (autenticazione IGDB) non raggiungibile (timeout o rete)." };
  }

  if (!res.ok) {
    return {
      ok: false,
      errore: `Autenticazione Twitch/IGDB fallita (HTTP ${res.status}). Verifica TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET.`,
    };
  }

  const dati = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!dati.access_token || !dati.expires_in) {
    return { ok: false, errore: "Risposta di autenticazione Twitch inattesa." };
  }

  tokenCache = { accessToken: dati.access_token, scadenza: Date.now() + dati.expires_in * 1000 };
  return { ok: true, token: dati.access_token };
}

/** Costruisce l'URL della cover: t_cover_big è un buon compromesso per una card di catalogo. */
export function urlCopertina(imageId: string): string {
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

/** Anno solare da un `first_release_date` IGDB (epoch secondi), o null se assente. */
export function annoDaTimestamp(timestamp: number | undefined): number | null {
  if (timestamp == null) return null;
  return new Date(timestamp * 1000).getUTCFullYear();
}

/** Un titolo fra cui l'utente può scegliere, con abbastanza contesto per distinguerlo da omonimi/edizioni. */
export interface CandidatoIgdb {
  id: number;
  nome: string;
  /** Tutte le piattaforme IGDB per questa scheda: un barcode è di UNA copia fisica precisa. */
  piattaforme: string[];
  anno: number | null;
  copertina?: string;
}

interface GiocoIgdbGrezzo {
  id: number;
  name?: string;
  cover?: { image_id?: string };
  platforms?: { name?: string }[];
  first_release_date?: number;
  total_rating_count?: number;
  follows?: number;
}

/**
 * Ordina i risultati grezzi anteponendo quelli con un segnale di popolarità
 * reale, e li converte in `CandidatoIgdb`. Estratta e pura per essere
 * testabile su fixture reali senza rete (vedi igdb.test.ts) — corregge il
 * caso "Super Mario Bros: Odyssey - Chapter 1" (fan-mod PC senza rating)
 * che altrimenti precede "Super Mario Odyssey" (il gioco vero) a parità di
 * `game_type`, dato che IGDB non permette `sort` insieme a `search`.
 */
export function ordinaCandidati(giochi: GiocoIgdbGrezzo[]): CandidatoIgdb[] {
  const conNome = giochi.filter((g): g is GiocoIgdbGrezzo & { name: string } => Boolean(g.name));

  const conPopolarita = (g: GiocoIgdbGrezzo) => (g.total_rating_count ?? 0) > 0 || (g.follows ?? 0) > 0;

  // Array.prototype.sort è stabile (garanzia ECMAScript): a parità di
  // "tier" resta l'ordine di rilevanza testuale che IGDB ha già calcolato.
  const ordinati = [...conNome].sort((a, b) => Number(conPopolarita(b)) - Number(conPopolarita(a)));

  return ordinati.slice(0, MASSIMO_CANDIDATI_MOSTRATI).map((g) => ({
    id: g.id,
    nome: g.name,
    piattaforme: (g.platforms ?? []).map((p) => p.name).filter((n): n is string => Boolean(n)),
    anno: annoDaTimestamp(g.first_release_date),
    copertina: g.cover?.image_id ? urlCopertina(g.cover.image_id) : undefined,
  }));
}

export interface RisultatoRicercaIgdb {
  /** false se mancano le credenziali Twitch: il chiamante non deve trattarlo come "nessun risultato". */
  configurato: boolean;
  risultati: CandidatoIgdb[];
  messaggioErrore?: string;
}

export async function cercaGiochiIgdb(titolo: string): Promise<RisultatoRicercaIgdb> {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return {
      configurato: false,
      risultati: [],
      messaggioErrore:
        "IGDB non configurato: mancano TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET (vedi README, sezione Barcode lookup).",
    };
  }

  const auth = await ottieniToken(clientId, clientSecret);
  if (!auth.ok) return { configurato: false, risultati: [], messaggioErrore: auth.errore };

  // Le virgolette nella query APICalypse vanno escapate: il titolo arriva
  // dall'utente, non è testo scritto da noi.
  const titoloEscapato = titolo.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const corpo =
    `search "${titoloEscapato}"; ` +
    `fields name, cover.image_id, platforms.name, first_release_date, total_rating_count, follows; ` +
    `where game_type = ${GAME_TYPE_AMMESSI}; ` +
    `limit ${LIMITE_RISULTATI};`;

  let res: Response;
  try {
    res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "text/plain",
      },
      body: corpo,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { configurato: true, risultati: [], messaggioErrore: "IGDB non raggiungibile (timeout o rete)." };
  }

  if (res.status === 429) {
    return { configurato: true, risultati: [], messaggioErrore: "Limite di richieste IGDB raggiunto: riprova tra poco." };
  }
  if (!res.ok) {
    return { configurato: true, risultati: [], messaggioErrore: `IGDB ha risposto con un errore (HTTP ${res.status}).` };
  }

  const grezzi = (await res.json()) as GiocoIgdbGrezzo[];
  return { configurato: true, risultati: ordinaCandidati(grezzi ?? []) };
}
