// Production entry: the API plus the built client on one port.
// Node 24 runs this TypeScript directly (type stripping), so the server has
// no build step: `node server/src/index.ts`.
//   PORT        default 8787 (0 picks a free port; the chosen one is logged)
//   DB_PATH     default data/notes.db
//   STATIC_DIR  default dist/client (the output of `vite build`)
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { openStore } from "./store.ts";

const port = Number(process.env.PORT ?? 8787);
const dbPath = resolve(process.env.DB_PATH ?? "data/notes.db");
const staticDir = resolve(process.env.STATIC_DIR ?? "dist/client");

mkdirSync(dirname(dbPath), { recursive: true });
const store = openStore(dbPath);
const app = createApp(store, { staticDir });

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`listening on http://localhost:${info.port} (db ${dbPath})`);
});

const shutdown = () => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
