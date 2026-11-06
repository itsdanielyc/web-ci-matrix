// L1: client helpers and the live adapter's handling of responses the
// contract does not allow (it must refuse them, not render them).
import { describe, expect, it } from "vitest";
import { ApiError } from "../../contracts/notes.ts";
import { createLiveBackend, createMockBackend, MOCK_SEED, toApiError } from "../../client/src/api.ts";
import { countLabel, deleteLabel } from "../../client/src/view.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("view helpers", () => {
  it("counts notes in words", () => {
    expect(countLabel(0)).toBe("No notes yet.");
    expect(countLabel(1)).toBe("1 note");
    expect(countLabel(3)).toBe("3 notes");
  });

  it("names each delete button after its note", () => {
    expect(deleteLabel("buy milk")).toBe("Delete note: buy milk");
  });
});

describe("toApiError", () => {
  it("keeps a contract error body", () => {
    const err = toApiError(404, { error: "not_found", message: "gone" });
    expect(err).toBeInstanceOf(ApiError);
    expect([err.code, err.message, err.status]).toEqual(["not_found", "gone", 404]);
  });

  it("maps a body outside the contract by status", () => {
    expect(toApiError(502, "<html>bad gateway</html>").code).toBe("server_error");
    expect(toApiError(400, undefined).code).toBe("invalid_note");
  });
});

describe("live adapter", () => {
  it("rejects a response that breaks the contract", async () => {
    const live = createLiveBackend(async () => json(200, [{ id: "one", text: "x" }]));
    await expect(live.listNotes()).rejects.toThrow();
  });

  it("throws ApiError for an error response", async () => {
    const live = createLiveBackend(async () => json(500, { error: "server_error", message: "boom" }));
    await expect(live.listNotes()).rejects.toMatchObject({ code: "server_error", status: 500 });
  });

  it("labels itself live", () => {
    expect(createLiveBackend(async () => json(200, {})).kind).toBe("live");
  });
});

describe("mock adapter", () => {
  it("labels itself mock and serves its seed newest first", async () => {
    const mock = createMockBackend(MOCK_SEED);
    expect(mock.kind).toBe("mock");
    expect((await mock.listNotes()).map((n) => n.text)).toEqual([...MOCK_SEED].reverse());
  });

  it("returns copies, so callers cannot mutate its state", async () => {
    const mock = createMockBackend(["a"]);
    const [first] = await mock.listNotes();
    first.text = "changed";
    expect((await mock.listNotes())[0].text).toBe("a");
  });
});
