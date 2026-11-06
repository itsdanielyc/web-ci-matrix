// L1: the server's HTTP edges that the contract suite does not reach through
// the client adapter (malformed bodies, bad ids, unknown routes, crashes).
import { afterEach, describe, expect, it } from "vitest";
import { messages } from "../../contracts/notes.ts";
import { createApp } from "../../server/src/app.ts";
import { openStore, type NotesStore } from "../../server/src/store.ts";

let store: NotesStore;
afterEach(() => store?.close());

function app() {
  store = openStore(":memory:");
  return createApp(store);
}

describe("server edges", () => {
  it("answers health", async () => {
    const res = await app().request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("refuses a body that is not JSON", async () => {
    const res = await app().request("/api/notes", { method: "POST", body: "not json" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_note", message: messages.notJson });
  });

  it("treats a non-numeric id as not found", async () => {
    const res = await app().request("/api/notes/abc", { method: "DELETE" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("answers unknown routes with the contract's error body", async () => {
    const res = await app().request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("maps a store crash to server_error without leaking the cause", async () => {
    store = openStore(":memory:");
    const broken: NotesStore = { ...store, list: () => { throw new Error("disk on fire"); } };
    const original = console.error;
    console.error = () => {};
    try {
      const res = await createApp(broken).request("/api/notes");
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("server_error");
      expect(JSON.stringify(body)).not.toContain("disk on fire");
    } finally {
      console.error = original;
    }
  });
});
