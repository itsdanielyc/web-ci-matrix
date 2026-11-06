// L6 "real stack": the built client served by the real server (node
// server/src/index.ts) on a fresh temp SQLite database, driven by Playwright.
// Nothing is mocked; the badge must read "live". Run with `npm run test:e2e`,
// which builds the client first.
import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.STACK_PORT ?? 4173);
const viewport = { width: 1024, height: 700 };
// Evaluated once in the runner process, which is the one that starts the
// server; a new database file per run.
const dbPath = process.env.STACK_DB ?? join(tmpdir(), `spike-stack-${process.pid}-${Date.now()}.db`);

export default defineConfig({
  testDir: "tests/stack",
  fullyParallel: false,
  // One server, one database: the journeys run one after another.
  workers: 1,
  forbidOnly: !!process.env.CI,
  // The doctrine allows one retry at L6 for environmental noise.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-stack" }]] : "list",
  outputDir: "test-results-stack",
  use: {
    baseURL: `http://localhost:${port}`,
    viewport,
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport } },
  ],
  webServer: {
    command: "node server/src/index.ts",
    url: `http://localhost:${port}/api/health`,
    env: { PORT: String(port), DB_PATH: dbPath, STATIC_DIR: "dist/client" },
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
  },
});
