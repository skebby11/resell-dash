import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Copertine prodotto da IGDB (lookup barcode → UPCitemdb → IGDB, vedi
    // src/lib/integrations/lookup.ts). `next/image` richiede un host
    // esplicito in remotePatterns per ogni sorgente remota; `domains` è
    // deprecato in Next 16.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.igdb.com",
        pathname: "/igdb/image/upload/**",
      },
    ],
  },
};

export default nextConfig;
