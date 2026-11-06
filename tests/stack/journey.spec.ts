// L6: the real stack. The built client, served by the real server, on a temp
// SQLite file. A journey a user would take: create a note, reload the page,
// see it (it came back from the database), delete it, reload, it stays gone.
// One call is also checked against the contract module the mock uses, so the
// server cannot drift from the contract without a red here.
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Health, NoteList } from "../../contracts/notes.ts";

const notes = (page: import("@playwright/test").Page) => page.getByRole("list", { name: "Notes" }).getByRole("listitem");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // The label first: this suite must be talking to the real server.
  await expect(page.getByTestId("backend-badge")).toHaveText("live");
  await expect(page.getByTestId("server-status")).toHaveText("ok");
});

test("the page is the built client, titled from its own index.html", async ({ page }) => {
  const html = readFileSync("client/index.html", "utf8");
  const title = html.match(/<title>(.*)<\/title>/)![1];
  await expect(page).toHaveTitle(title);
});

test("the server answers in the shape the contract describes", async ({ request }) => {
  Health.parse(await (await request.get("/api/health")).json());
  NoteList.parse(await (await request.get("/api/notes")).json());
});

test("create, reload, see it, delete, reload, gone", async ({ page }, testInfo) => {
  // Unique per engine: the three projects share one server and database.
  const text = `Stack note from ${testInfo.project.name} ${Date.now()}`;
  const mine = notes(page).filter({ hasText: text });

  await page.getByLabel("Note", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(mine).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId("backend-badge")).toHaveText("live");
  await expect(mine).toHaveCount(1);

  const dir = join(process.cwd(), "artifacts", "stack");
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${testInfo.project.name}-${process.platform}.png`), fullPage: true });

  await page.getByRole("button", { name: `Delete note: ${text}` }).click();
  await expect(mine).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("backend-badge")).toHaveText("live");
  await expect(page.getByTestId("note-count")).not.toHaveText("…");
  await expect(mine).toHaveCount(0);
});
