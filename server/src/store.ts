// Persistence for notes on node:sqlite (built into Node 24, no native addon to
// compile in CI or in the container). ":memory:" for unit and contract tests,
// a temp file for integration tests, a volume path in production.
import { DatabaseSync } from "node:sqlite";
import type { Note } from "../../contracts/notes.ts";

export interface NotesStore {
  list(): Note[];
  create(text: string): Note;
  remove(id: number): boolean;
  close(): void;
}

type Row = { id: number; text: string; created_at: string };

export function openStore(path: string, now: () => Date = () => new Date()): NotesStore {
  const db = new DatabaseSync(path);
  // AUTOINCREMENT: ids are never reused after a delete, matching the mock.
  db.exec(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  const listStmt = db.prepare("SELECT id, text, created_at FROM notes ORDER BY id DESC");
  const insertStmt = db.prepare("INSERT INTO notes (text, created_at) VALUES (?, ?) RETURNING id, text, created_at");
  const deleteStmt = db.prepare("DELETE FROM notes WHERE id = ?");
  const toNote = (r: Row): Note => ({ id: Number(r.id), text: r.text, createdAt: r.created_at });
  return {
    list: () => (listStmt.all() as Row[]).map(toNote),
    create: (text) => toNote(insertStmt.get(text, now().toISOString()) as Row),
    remove: (id) => Number(deleteStmt.run(id).changes) > 0,
    close: () => db.close(),
  };
}
