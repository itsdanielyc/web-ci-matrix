// L2: the same scenario runs through the client's adapter against the
// labelled mock and against the real server (the Hono app in-process, on an
// in-memory SQLite database), and the two transcripts must be identical.
// A difference here is the mock lying to the UI suite.
import { describe, expect, it } from "vitest";
import { ApiError, messages, Note, NoteList, NOTE_MAX } from "../../contracts/notes.ts";
import { createLiveBackend, createMockBackend, type Backend } from "../../client/src/api.ts";
import { createApp } from "../../server/src/app.ts";
import { openStore } from "../../server/src/store.ts";

type Step = { call: string; ok: unknown } | { call: string; error: { code: string; status: number; message: string } };

// createdAt differs by wall clock; the contract says only that it is ISO.
const normalize = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(normalize) : v && typeof v === "object" && "createdAt" in v ? { ...v, createdAt: "<iso>" } : v;

async function scenario(api: Backend): Promise<Step[]> {
  const steps: Step[] = [];
  const run = async (call: string, fn: () => Promise<unknown>) => {
    try {
      const value = await fn();
      if (call.startsWith("list")) NoteList.parse(value);
      if (call.startsWith("create")) Note.parse(value);
      steps.push({ call, ok: normalize(value) });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      steps.push({ call, error: { code: e.code, status: e.status, message: e.message } });
    }
  };
  await run("health", () => api.health());
  await run("list empty", () => api.listNotes());
  await run("create a", () => api.createNote("  first  "));
  await run("create b", () => api.createNote("second"));
  await run("list two", () => api.listNotes());
  await run("create empty", () => api.createNote("   "));
  await run("create too long", () => api.createNote("x".repeat(NOTE_MAX + 1)));
  await run("delete b", () => api.deleteNote(2));
  await run("delete b again", () => api.deleteNote(2));
  await run("delete unknown", () => api.deleteNote(999));
  // After deleting the newest note, the next id must not be reused.
  await run("create c", () => api.createNote("third"));
  await run("list final", () => api.listNotes());
  return steps;
}

function live(): Backend {
  const app = createApp(openStore(":memory:"));
  return createLiveBackend(async (input, init) => app.request(input, init));
}

describe("contract: mock and server answer the same calls the same way", () => {
  it("produces identical transcripts", async () => {
    const fromMock = await scenario(createMockBackend());
    const fromServer = await scenario(live());
    expect(fromMock).toEqual(fromServer);
  });

  // The comparison above would pass if both were wrong in the same way, so
  // pin the expected behaviour of one side explicitly.
  it("matches the documented behaviour", async () => {
    const steps = await scenario(live());
    const by = Object.fromEntries(steps.map((s) => [s.call, s]));
    expect(by["list empty"]).toEqual({ call: "list empty", ok: [] });
    expect(by["create a"]).toEqual({ call: "create a", ok: { id: 1, text: "first", createdAt: "<iso>" } });
    expect(by["create empty"]).toEqual({ call: "create empty", error: { code: "invalid_note", status: 400, message: messages.empty } });
    expect(by["create too long"]).toMatchObject({ error: { code: "invalid_note", message: messages.tooLong } });
    expect(by["delete b again"]).toEqual({ call: "delete b again", error: { code: "not_found", status: 404, message: messages.notFound } });
    expect(by["create c"]).toMatchObject({ ok: { id: 3, text: "third" } });
    expect((by["list final"] as { ok: { id: number }[] }).ok.map((n) => n.id)).toEqual([3, 1]);
  });
});
