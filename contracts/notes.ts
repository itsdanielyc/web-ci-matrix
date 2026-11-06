// The API contract, shared by the client adapter (live and mock), the server
// and every suite. Schemas are zod, so the server validates input with them,
// the live adapter validates responses with them, and the mock produces
// values that pass them. Change this file first, in its own small PR.
import { z } from "zod";

export const NOTE_MAX = 200;

/** Request body for creating a note. Text is trimmed before validation. */
export const NewNote = z.object({ text: z.string() });
export type NewNote = z.infer<typeof NewNote>;

export const Note = z.object({
  id: z.number().int().positive(),
  text: z.string().min(1).max(NOTE_MAX),
  createdAt: z.iso.datetime(),
});
export type Note = z.infer<typeof Note>;

/** Newest first, by id. */
export const NoteList = z.array(Note);

export const Health = z.object({ status: z.literal("ok") });
export type Health = z.infer<typeof Health>;

export const ErrorCode = z.enum(["invalid_note", "not_found", "server_error"]);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ErrorBody = z.object({ error: ErrorCode, message: z.string() });
export type ErrorBody = z.infer<typeof ErrorBody>;

export const routes = {
  health: "/api/health",
  notes: "/api/notes",
  note: (id: number) => `/api/notes/${id}`,
} as const;

/** The one error type both adapters throw, so the UI handles them alike. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export const messages = {
  empty: "Write something first.",
  tooLong: `Keep it under ${NOTE_MAX} characters.`,
  notJson: "The request body must be JSON with a text field.",
  notFound: "That note no longer exists.",
} as const;

/**
 * The validation rule for a new note, used by the server and the mock alike:
 * the trimmed text, or the user-facing message that explains the refusal.
 */
export function checkNewNote(input: unknown): { ok: true; text: string } | { ok: false; message: string } {
  const parsed = NewNote.safeParse(input);
  if (!parsed.success) return { ok: false, message: messages.notJson };
  const text = parsed.data.text.trim();
  if (text.length === 0) return { ok: false, message: messages.empty };
  if (text.length > NOTE_MAX) return { ok: false, message: messages.tooLong };
  return { ok: true, text };
}
