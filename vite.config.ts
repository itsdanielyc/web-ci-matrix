// The client lives in client/; `vite build` writes dist/client, which the
// server serves in production. `npm run dev` answers with the labelled mock;
// `npm run dev:live` proxies /api to a server started with `npm start`.
import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  clearScreen: false,
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      "/api": `http://localhost:${process.env.PORT ?? 8787}`,
    },
  },
});
