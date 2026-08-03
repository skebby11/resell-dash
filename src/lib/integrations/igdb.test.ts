import { describe, expect, it } from "vitest";
import { annoDaTimestamp, ordinaCandidati, urlCopertina } from "@/lib/integrations/igdb";

describe("urlCopertina", () => {
  it("costruisce l'URL t_cover_big da un image_id IGDB", () => {
    expect(urlCopertina("co1rba")).toBe(
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rba.jpg"
    );
  });
});

describe("annoDaTimestamp", () => {
  it("converte un first_release_date IGDB (epoch secondi) in anno solare", () => {
    // The Legend of Zelda: Breath of the Wild, 3 marzo 2017.
    expect(annoDaTimestamp(1488499200)).toBe(2017);
  });

  it("ritorna null se il timestamp manca", () => {
    expect(annoDaTimestamp(undefined)).toBeNull();
  });
});

describe("ordinaCandidati", () => {
  // Fixture reale (vedi report): `search "zelda breath of the wild"` filtrato
  // per game_type = (0,4,8,9,10,11) restituisce il gioco vero per primo,
  // seguito dalle edizioni fisiche reali (version_parent verso lo stesso
  // gioco): nessun riordino necessario qui, solo la mappatura.
  it("mantiene l'ordine di rilevanza di IGDB quando tutti i risultati hanno un segnale di popolarità", () => {
    const grezzi = [
      { id: 7346, name: "The Legend of Zelda: Breath of the Wild", total_rating_count: 1858, platforms: [{ name: "Nintendo Switch" }, { name: "Wii U" }] },
      { id: 45137, name: "The Legend of Zelda: Breath of the Wild - Master Edition", total_rating_count: 3, platforms: [{ name: "Nintendo Switch" }] },
    ];
    expect(ordinaCandidati(grezzi).map((c) => c.nome)).toEqual([
      "The Legend of Zelda: Breath of the Wild",
      "The Legend of Zelda: Breath of the Wild - Master Edition",
    ]);
  });

  // Il caso che ha fallito nella ricerca dal vivo (vedi report): con
  // `search "super mario odyssey"`, IGDB restituisce prima una fan-mod PC
  // ("Super Mario Bros: Odyssey - Chapter 1", game_type main_game, ID
  // 134294) e SOLO dopo il gioco vero (ID 26758, total_rating_count 1858).
  // Il filtro per game_type da solo non basta: entrambi sono main_game.
  // IGDB vieta `sort` insieme a `search` (HTTP 406), quindi il riordino è
  // nostro: chi ha un segnale di popolarità reale va prima.
  it("antepone il risultato con un segnale di popolarità reale a una fan-mod senza alcun dato (caso Super Mario Odyssey)", () => {
    const grezzi = [
      { id: 134294, name: "Super Mario Bros: Odyssey - Chapter 1", platforms: [{ name: "PC (Microsoft Windows)" }] },
      { id: 26758, name: "Super Mario Odyssey", total_rating_count: 1858, follows: 88, platforms: [{ name: "Nintendo Switch" }] },
      { id: 250042, name: "Super Mario Odyssey Safari", platforms: [{ name: "PC (Microsoft Windows)" }] },
    ];
    const risultato = ordinaCandidati(grezzi);
    expect(risultato[0].nome).toBe("Super Mario Odyssey");
    expect(risultato[0].id).toBe(26758);
  });

  it("usa 'follows' come segnale di popolarità anche senza total_rating_count", () => {
    const grezzi = [
      { id: 1, name: "Oscuro senza segnali" },
      { id: 2, name: "Con follower", follows: 5 },
    ];
    expect(ordinaCandidati(grezzi)[0].nome).toBe("Con follower");
  });

  it("scarta risultati senza nome e limita a 10 candidati", () => {
    const grezzi: { id: number; name?: string }[] = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      name: `Gioco ${i}`,
    }));
    grezzi.push({ id: 999, name: undefined });
    const risultato = ordinaCandidati(grezzi);
    expect(risultato).toHaveLength(10);
    expect(risultato.every((c) => c.nome)).toBe(true);
  });

  it("mappa piattaforme e copertina, tollerando campi assenti", () => {
    const risultato = ordinaCandidati([
      { id: 1, name: "Gioco", cover: { image_id: "co1rba" }, platforms: [{ name: "PS5" }, { name: undefined }] },
    ]);
    expect(risultato[0]).toMatchObject({
      id: 1,
      nome: "Gioco",
      piattaforme: ["PS5"],
      copertina: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rba.jpg",
    });
  });
});
