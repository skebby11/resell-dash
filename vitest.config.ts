import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // Next.js risolve "server-only" internamente (non è una dipendenza npm
      // del progetto); Vitest ha bisogno di un alias esplicito per non fallire
      // sui moduli server-only testati con dipendenze mockate (vedi test/server-only-stub.ts).
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
