# Verification ledger

Append-only. Each row says what was proven, where, and by which run. "Built"
is never rounded up to "tested"; anything not listed here is unverified.

| Date | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-06 | L0-L3 | tsc clean; 25 Vitest tests green: unit (contracts, server edges, client adapters), contract (one scenario through the mock and the in-process Hono app on `:memory:`, transcripts identical), integration (temp SQLite file reopened; real server process restarted on one file keeps the note) | windows x86_64 (local, Node 24.15) | `npm run lint`, `npx vitest run` locally |
| 2026-11-06 | L2 | Contract suite seen red: without `AUTOINCREMENT` the server reuses id 2 after deleting it (`produces identical transcripts` and `matches the documented behaviour` fail, `create c` expected id 3); with the mock appending instead of prepending, the transcripts differ | windows x86_64 (local) | local runs, code restored after each |
| 2026-11-06 | L4/L5 | Playwright against the mock on chromium and webkit: add, refuse empty with the contract's message, delete, ARIA tier 1 and geometry tier 2 baselines (captured here, shared); tier 3 skipped locally (no win32 baseline by design); "deletes a note" seen red with the delete call removed (`toHaveCount` expected 1, received 2) | windows x86_64 (local) | `npx playwright test --project chromium --project webkit` locally |
| 2026-11-06 | L6 | Built client served by the real server on a temp SQLite file: badge "live", title from client/index.html, health and list parsed with the contract, create, reload, see, delete, reload, gone; seen red when DELETE answers 204 without deleting (`toHaveCount` expected 0, received 1) | windows x86_64 (local), chromium and webkit | `npm run build`, `npx playwright test -c playwright.stack.config.ts --project chromium --project webkit` locally |

## Unverified

- Firefox does not launch on the developer machine (Windows 11: "side-by-side configuration is incorrect"); firefox is covered only by CI on ubuntu.
- The container smoke has not run locally (no docker on the developer machine); CI only.
- The L6 journey reloads the page, not the server: persistence across a server restart is proven at L3 (process restart) and L7 (container restart), not at L6.
- UI and real-stack suites run on ubuntu only; Windows and macOS browsers are not exercised.
