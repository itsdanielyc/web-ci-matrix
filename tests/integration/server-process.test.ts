// L3: the real server process (node server/src/index.ts, as production runs
// it) on a temp database: health, create, list, then stop the process, start
// a new one on the same file and see the note again.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Health, Note, NoteList } from "../../contracts/notes.ts";

const dir = mkdtempSync(join(tmpdir(), "spike-proc-"));
const env = { ...process.env, PORT: "0", DB_PATH: join(dir, "notes.db"), STATIC_DIR: dir };
const running: ChildProcess[] = [];

function start(): Promise<{ base: string; proc: ChildProcess }> {
  const proc = spawn(process.execPath, ["server/src/index.ts"], { env, stdio: ["ignore", "pipe", "pipe"] });
  running.push(proc);
  return new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${out}`)), 15_000);
    const onData = (chunk: Buffer) => {
      out += chunk.toString();
      const m = out.match(/listening on (http:\/\/localhost:\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ base: m[1], proc });
      }
    };
    proc.stdout!.on("data", onData);
    proc.stderr!.on("data", (c: Buffer) => (out += c.toString()));
    proc.on("exit", (code) => reject(new Error(`server exited early (${code}):\n${out}`)));
  });
}

function stop(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    // A process killed by a signal has exitCode null and signalCode set.
    if (proc.exitCode !== null || proc.signalCode !== null) return resolve();
    proc.once("exit", () => resolve());
    proc.kill("SIGTERM");
  });
}

afterAll(async () => {
  await Promise.all(running.map(stop));
  rmSync(dir, { recursive: true, force: true });
});

describe("server process", () => {
  it("persists a note across a restart", async () => {
    const first = await start();
    expect(Health.parse(await (await fetch(`${first.base}/api/health`)).json())).toEqual({ status: "ok" });
    const res = await fetch(`${first.base}/api/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "from the first process" }),
    });
    expect(res.status).toBe(201);
    const created = Note.parse(await res.json());
    await stop(first.proc);

    const second = await start();
    const list = NoteList.parse(await (await fetch(`${second.base}/api/notes`)).json());
    expect(list).toEqual([created]);
    await stop(second.proc);
  });
});
