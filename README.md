# spike (web-only)

A minimal SaaS-shaped notes app whose only purpose is to prove Keel's
testing loop for the `web-only` profile on free GitHub-hosted runners: a
Vite + TypeScript client, a Hono server on Node 24 with `node:sqlite`, a
zod contract shared by both, and a labelled mock. `VERIFICATION.md` is the
ledger of what has actually been proven, by which run.

## Layout

```
contracts/notes.ts   zod schemas, routes, error codes, the validation rule
client/              Vite root: index.html, src/api.ts (live adapter or labelled mock), src/main.ts
server/src/          store.ts (node:sqlite), app.ts (Hono, store injected), index.ts (entry)
tests/unit/          L1 Vitest: contracts, server edges, client helpers and adapters
tests/contract/      L2 Vitest: one scenario through the mock and through the in-process server, transcripts compared
tests/integration/   L3 Vitest: temp SQLite file, close and reopen; the real server process restarted on one file
tests/ui/            L4/L5 Playwright vs the mock: behaviour, ARIA, geometry, pixels
tests/stack/         L6 Playwright vs the built client served by the real server on a temp database
Dockerfile           L7 analogue: scripts/container-smoke.sh builds, runs, probes, restarts and stops it
```

## Layers

| Layer | What | Where it runs |
|---|---|---|
| L0-L3 | tsc; Vitest unit, contract (mock vs server), integration (temp SQLite, process restart) | `unit` job on ubuntu and windows |
| L4/L5 | Playwright on chromium, webkit and firefox against the Vite dev server and the mock; ARIA snapshot and geometry (one baseline each), per-engine pixels (linux) | `ui` job on ubuntu |
| L6 | The built client served by `node server/src/index.ts` on a temp SQLite file; create, reload, see, delete, reload; one call parsed with the contract | `stack` job on ubuntu |
| L7 | `docker build`, run with a volume, health, create and list, restart keeps the note, stop | `container` job on ubuntu |
| sheet | Every real-stack screenshot on one HTML page | `contact sheet` job |

Pixel baselines come from the `snapshots` workflow on the runner, never
from a laptop: dispatched on a branch it commits there; on main it opens a
pull request.

## Commands

```bash
npm ci
npm run lint              # tsc over client, server, contracts and tests
npm run test:unit         # L1
npm run test:contract     # L2
npm run test:integration  # L3
npm run test:ui           # L4/L5, starts Vite with the mock itself
npm run test:e2e          # L6, builds the client and starts the real server itself
npm run test:container    # L7, needs docker
npm start                 # server on :8787 serving dist/client (run npm run build first)
npm run dev               # client against the mock;  npm run dev:live proxies /api to :8787
npm run triage [run-id]   # digest of a CI run
```

## License

MIT.
