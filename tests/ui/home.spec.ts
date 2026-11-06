// L4 (behaviour against the mock) and L5 (the three visual tiers) for the
// notes screen. Runs on chromium, webkit and firefox.
import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { messages } from "../../contracts/notes.ts";
import { MOCK_SEED } from "../../client/src/mock-seed.ts";
import { assertGeometry, captureGeometry } from "./geometry";

const platform = process.platform; // win32 | darwin | linux
const notes = (page: import("@playwright/test").Page) => page.getByRole("list", { name: "Notes" }).getByRole("listitem");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // The label first: these tests must never pass against the wrong backend.
  await expect(page.getByTestId("backend-badge")).toHaveText("mock");
  await expect(page.getByTestId("server-status")).toHaveText("ok");
  await expect(notes(page)).toHaveCount(MOCK_SEED.length);
});

test("adds a note to the top of the list and clears the input", async ({ page }) => {
  await page.getByLabel("Note", { exact: true }).fill("  Buy milk  ");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(notes(page)).toHaveCount(MOCK_SEED.length + 1);
  await expect(notes(page).first()).toContainText("Buy milk");
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue("");
  await expect(page.getByTestId("note-count")).toHaveText(`${MOCK_SEED.length + 1} notes`);
});

test("refuses an empty note with the contract's message", async ({ page }) => {
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByRole("alert")).toHaveText(messages.empty);
  await expect(notes(page)).toHaveCount(MOCK_SEED.length);
});

test("deletes a note", async ({ page }) => {
  await page.getByRole("button", { name: `Delete note: ${MOCK_SEED[0]}` }).click();
  await expect(notes(page)).toHaveCount(MOCK_SEED.length - 1);
  await expect(page.getByRole("list", { name: "Notes" })).not.toContainText(MOCK_SEED[0]);
});

test("tier 1: accessibility structure is identical everywhere", async ({ page }) => {
  // One YAML baseline for every engine and OS: the semantic tree must not
  // depend on the platform.
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "home.aria.yml" });
});

test("tier 2: layout geometry stays within tolerance everywhere", async ({ page }) => {
  // One JSON baseline for every engine and OS, compared with an 8px tolerance.
  const actual = await captureGeometry(page);
  assertGeometry(join(test.info().project.testDir, "__snapshots__", "home.spec.ts", "home.geometry.json"), actual);
});

test("tier 3: pixels match the per-engine, per-OS baseline", async ({ page }, testInfo) => {
  // Baselines are captured in CI by the snapshots workflow, never on a laptop.
  // Locally, a missing baseline means "not captured yet", not a failure.
  const name = `home-${testInfo.project.name}-${platform}.png`;
  const baseline = join(testInfo.project.testDir, "__snapshots__", "home.spec.ts", name);
  test.skip(!process.env.CI && !existsSync(baseline), "no local pixel baseline; the snapshots workflow captures them on the runners");
  await expect(page).toHaveScreenshot(name, { fullPage: true });
});
