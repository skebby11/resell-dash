import type { MetadataRoute } from "next";

/**
 * Web app manifest: rende l'app installabile ("Aggiungi a Home" su iPhone,
 * "Installa app" su Android/desktop) e la apre a schermo intero, senza la
 * barra del browser.
 *
 * iOS legge da qui nome e modalità standalone, ma l'icona della Home la prende
 * da `apple-icon.png` (tag apple-touch-icon), non dall'elenco `icons`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rewind — Dashboard Reselling",
    short_name: "Rewind",
    description: "Dashboard di gestione acquisti e rivendite retrogaming.",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Stessi colori del tema chiaro (globals.css): sfondo e blu notte della chrome.
    background_color: "#faf9f5",
    theme_color: "#0b1d2a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Glifo dentro la safe zone: la stessa immagine va bene anche ritagliata.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
