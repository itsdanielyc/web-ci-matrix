// Small pure helpers the UI uses; unit-tested without a DOM.
export function countLabel(n: number): string {
  if (n === 0) return "No notes yet.";
  return n === 1 ? "1 note" : `${n} notes`;
}

export function deleteLabel(text: string): string {
  return `Delete note: ${text}`;
}
