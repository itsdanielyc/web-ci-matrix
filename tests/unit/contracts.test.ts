// L1: the validation rule both the server and the mock use.
import { describe, expect, it } from "vitest";
import { checkNewNote, messages, NOTE_MAX, Note } from "../../contracts/notes.ts";

describe("checkNewNote", () => {
  it("trims and accepts ordinary text", () => {
    expect(checkNewNote({ text: "  buy milk  " })).toEqual({ ok: true, text: "buy milk" });
  });

  it("refuses empty and whitespace-only text", () => {
    expect(checkNewNote({ text: "" })).toEqual({ ok: false, message: messages.empty });
    expect(checkNewNote({ text: " \n\t " })).toEqual({ ok: false, message: messages.empty });
  });

  it("accepts exactly the maximum and refuses one more", () => {
    expect(checkNewNote({ text: "x".repeat(NOTE_MAX) }).ok).toBe(true);
    expect(checkNewNote({ text: "x".repeat(NOTE_MAX + 1) })).toEqual({ ok: false, message: messages.tooLong });
  });

  it("refuses bodies without a string text field", () => {
    for (const body of [undefined, null, 42, {}, { text: 7 }, "text"]) {
      expect(checkNewNote(body)).toEqual({ ok: false, message: messages.notJson });
    }
  });
});

describe("Note schema", () => {
  it("requires an ISO timestamp and a positive integer id", () => {
    expect(Note.safeParse({ id: 1, text: "a", createdAt: "2026-01-01T00:00:00.000Z" }).success).toBe(true);
    expect(Note.safeParse({ id: 0, text: "a", createdAt: "2026-01-01T00:00:00.000Z" }).success).toBe(false);
    expect(Note.safeParse({ id: 1, text: "a", createdAt: "yesterday" }).success).toBe(false);
  });
});
