import { ApiError } from "../../contracts/notes.ts";
import { backend } from "./api.ts";
import { countLabel, deleteLabel } from "./view.ts";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const form = $<HTMLFormElement>("#note-form");
const input = $<HTMLInputElement>("#note-input");
const error = $<HTMLElement>("#form-error");
const list = $<HTMLUListElement>("#note-list");
const count = $<HTMLElement>("#note-count");
const badge = $<HTMLElement>("#backend-badge");
const status = $<HTMLElement>("#server-status");

// The label comes first: a test asserts it before anything else, so a suite
// can never pass against the wrong backend by accident.
badge.textContent = backend.kind;
badge.dataset.kind = backend.kind;

function showError(err: unknown) {
  error.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
}

async function refresh() {
  const notes = await backend.listNotes();
  list.replaceChildren(
    ...notes.map((note) => {
      const li = document.createElement("li");
      li.dataset.id = String(note.id);
      const text = document.createElement("span");
      text.className = "note-text";
      text.textContent = note.text;
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.setAttribute("aria-label", deleteLabel(note.text));
      del.addEventListener("click", async () => {
        try {
          await backend.deleteNote(note.id);
          error.textContent = "";
        } catch (err) {
          showError(err);
        }
        await refresh();
      });
      li.append(text, del);
      return li;
    }),
  );
  count.textContent = countLabel(notes.length);
  list.dataset.ready = "true";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await backend.createNote(input.value);
    input.value = "";
    error.textContent = "";
    await refresh();
  } catch (err) {
    showError(err);
  }
});

backend
  .health()
  .then((h) => (status.textContent = h.status))
  .catch(() => (status.textContent = "unreachable"));

refresh().catch(showError);
