// L4/L5: UI tests in real browsers against the Vite dev server, where the
// labelled mock backend answers. chromium, webkit and firefox cover the
// engines a SaaS user brings. CI runs all three on ubuntu.
import { defineConfig, devices } from "@playwright/test";

const viewport = { width: 1024, height: 700 };

export default defineConfig({
  testDir: "tests/ui",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // One template for every snapshot kind. Pixel snapshots put the engine and
  // OS into their own name; ARIA and geometry snapshots are shared by design.
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFileName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      // Per-OS baselines still see antialiasing noise; allow a little.
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: "http://localhost:1420",
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
    command: "npm run dev -- --strictPort --port 1420",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
