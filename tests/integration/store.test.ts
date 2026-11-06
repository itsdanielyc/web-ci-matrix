// L3: the store and the API against a real SQLite file in a temp directory,
// including a restart (close and reopen) that must keep the data.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NoteList } from "../../contracts/notes.ts";
import { createApp } from "../../server/src/app.ts";
import { openStore, type NotesStore } from "../../server/src/store.ts";

let dir: string;
let file: string;
const open: NotesStore[] = [];
const openTracked = (path: string) => {
  const s = openStore(path);
  open.push(s);
  return s;
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "spike-int-"));
  file = join(dir, "notes.db");
});

afterEach(() => {
  // Windows refuses to delete a file SQLite still holds open.
  for (const s of open.splice(0)) {
    try {
      s.close();
    } catch {}
  }
  rmSync(dir, { recursive: true, force: true });
});

describe("notes on a SQLite file", () => {
  it("creates, lists newest first and deletes", () => {
    const store = openTracked(file);
    const a = store.create("alpha");
    const b = store.create("beta");
    expect(store.list().map((n) => n.id)).toEqual([b.id, a.id]);
    expect(store.remove(a.id)).toBe(true);
    expect(store.remove(a.id)).toBe(false);
    expect(store.list().map((n) => n.text)).toEqual(["beta"]);
  });

  it("keeps notes across a restart and never reuses an id", () => {
    const first = openTracked(file);
    first.create("kept");
    const gone = first.create("deleted before restart");
    first.remove(gone.id);
    first.close();
    open.splice(open.indexOf(first), 1);

    const second = openTracked(file);
    expect(second.list().map((n) => n.text)).toEqual(["kept"]);
    expect(second.create("after restart").id).toBe(gone.id + 1);
  });

  it("serves the persisted notes through the API after a restart", async () => {
    const before = createApp(openTracked(file));
    const created = await before.request("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "survives" }),
    });
    expect(created.status).toBe(201);
    open.pop()!.close();

    const after = createApp(openTracked(file));
    const res = await after.request("/api/notes");
    const list = NoteList.parse(await res.json());
    expect(list.map((n) => n.text)).toEqual(["survives"]);
  });
});
