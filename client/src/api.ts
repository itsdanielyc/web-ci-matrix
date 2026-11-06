// The seam between the UI and the backend. The built client, served by the
// real server, talks to it over fetch ("live"). The Vite dev server, and so
// Playwright's UI suite, gets a labelled in-memory mock ("mock") unless
// VITE_BACKEND=live is set (then /api is proxied to a local server).
// The mock is held to the same contract as the server by tests/contract,
// which runs the same calls against both, so a UI test that passes against
// the mock means something.
import {
  ApiError,
  checkNewNote,
  ErrorBody,
  Health,
  messages,
  Note,
  NoteList,
  routes,
  type ErrorCode,
} from "../../contracts/notes.ts";
import { MOCK_SEED } from "./mock-seed.ts";

export interface Backend {
  readonly kind: "live" | "mock";
  health(): Promise<Health>;
  listNotes(): Promise<Note[]>;
  createNote(text: string): Promise<Note>;
  deleteNote(id: number): Promise<void>;
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The real adapter. `fetchImpl` lets the contract suite aim it at an in-process app. */
export function createLiveBackend(fetchImpl: Fetch = (input, init) => fetch(input, init), base = ""): Backend {
  async function call<T>(path: string, init: RequestInit, parse: (v: unknown) => T): Promise<T> {
    const res = await fetchImpl(base + path, init);
    if (res.status === 204) return parse(undefined);
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) throw toApiError(res.status, body);
    return parse(body);
  }
  return {
    kind: "live",
    health: () => call(routes.health, {}, (v) => Health.parse(v)),
    listNotes: () => call(routes.notes, {}, (v) => NoteList.parse(v)),
    createNote: (text) =>
      call(
        routes.notes,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) },
        (v) => Note.parse(v),
      ),
    deleteNote: (id) => call(routes.note(id), { method: "DELETE" }, () => undefined),
  };
}

/** Maps a non-2xx response to the contract's ApiError, whatever the body. */
export function toApiError(status: number, body: unknown): ApiError {
  const parsed = ErrorBody.safeParse(body);
  if (parsed.success) return new ApiError(parsed.data.error, parsed.data.message, status);
  const code: ErrorCode = status === 404 ? "not_found" : status === 400 ? "invalid_note" : "server_error";
  return new ApiError(code, `Unexpected response (HTTP ${status}).`, status);
}

/** The labelled mock: same interface, same validation, same ordering, same ids. */
export function createMockBackend(seed: string[] = [], now: () => Date = () => new Date()): Backend {
  let nextId = 1;
  let notes: Note[] = [];
  const add = (text: string, at: Date): Note => {
    const note: Note = { id: nextId++, text, createdAt: at.toISOString() };
    notes = [note, ...notes];
    return note;
  };
  for (const text of seed) add(text, new Date("2026-01-01T00:00:00.000Z"));
  return {
    kind: "mock",
    health: async () => ({ status: "ok" }),
    listNotes: async () => notes.map((n) => ({ ...n })),
    createNote: async (text) => {
      const checked = checkNewNote({ text });
      if (!checked.ok) throw new ApiError("invalid_note", checked.message, 400);
      return { ...add(checked.text, now()) };
    },
    deleteNote: async (id) => {
      if (!notes.some((n) => n.id === id)) throw new ApiError("not_found", messages.notFound, 404);
      notes = notes.filter((n) => n.id !== id);
    },
  };
}

export { MOCK_SEED };

const mode = import.meta.env.VITE_BACKEND ?? (import.meta.env.DEV ? "mock" : "live");

export const backend: Backend = mode === "live" ? createLiveBackend() : createMockBackend(MOCK_SEED);
