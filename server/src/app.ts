// The HTTP API as a Hono app with no I/O of its own: the store is injected, so
// the contract suite can run the same calls in-process (app.request) against
// ":memory:" and the integration suite against a temp file.
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { checkNewNote, messages, routes, type ErrorBody } from "../../contracts/notes.ts";
import type { NotesStore } from "./store.ts";

export type AppOptions = { staticDir?: string };

export function createApp(store: NotesStore, options: AppOptions = {}): Hono {
  const app = new Hono();
  const fail = (code: ErrorBody["error"], message: string): ErrorBody => ({ error: code, message });

  app.get(routes.health, (c) => c.json({ status: "ok" }));

  app.get(routes.notes, (c) => c.json(store.list()));

  app.post(routes.notes, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(fail("invalid_note", messages.notJson), 400);
    }
    const checked = checkNewNote(body);
    if (!checked.ok) return c.json(fail("invalid_note", checked.message), 400);
    return c.json(store.create(checked.text), 201);
  });

  app.delete("/api/notes/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id < 1 || !store.remove(id)) {
      return c.json(fail("not_found", messages.notFound), 404);
    }
    return c.body(null, 204);
  });

  app.notFound((c) => c.json(fail("not_found", messages.notFound), 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json(fail("server_error", "Something went wrong on the server."), 500);
  });

  if (options.staticDir) {
    // The built client. API routes are registered first and win.
    app.use("/*", serveStatic({ root: options.staticDir }));
  }
  return app;
}
