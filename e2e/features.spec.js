import { test, expect } from "@playwright/test";

// Autosave is debounced ~800 ms; poll it rather than sleeping.
const readModel = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("testfit-autosave") || "{}"));
async function newProject(page) { page.once("dialog", (d) => d.accept()); await page.getByRole("button", { name: "New", exact: true }).click(); }
async function planCenter(page) { const box = await page.getByTestId("plan-canvas").boundingBox(); return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 }; }

test("⌘D duplicates the selection in place and leaves the clipboard alone", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  await page.keyboard.press("4"); // Furnish
  const { cx, cy } = await planCenter(page);
  const count = async () => (await readModel(page)).furniture?.length ?? 0;
  await page.getByRole("button", { name: /Desk/ }).first().click();
  await page.mouse.click(cx, cy);
  await expect.poll(count).toBe(1);
  // The placed piece is selected; ⌘D duplicates it, offset one step, and selects the copy.
  await page.keyboard.press("Control+d");
  await expect(page.getByText(/Duplicated 1 item/)).toBeVisible();
  await expect.poll(count).toBe(2);
  const m = await readModel(page);
  expect(m.furniture[1].x - m.furniture[0].x).toBe(20);
  // ⌘D again duplicates the copy (the new selection), not the original.
  await page.keyboard.press("Control+d");
  await expect.poll(count).toBe(3);
  // Nothing was copied to the clipboard: ⌘V is a no-op.
  await page.keyboard.press("Control+v");
  await page.waitForTimeout(400);
  expect(await count()).toBe(3);
  // The plain D shortcut (dimensions toggle) still works without a modifier.
  await page.keyboard.press("d");
  await expect.poll(async () => (await readModel(page)).showDims).toBe(false);
});

test("autosave history: an earlier state can be restored from the Load menu", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const earlier = {
    version: "testfit-v17", pxPerFoot: 20, projectName: "Earlier Draft",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 500, y: 200 }, { id: "c", x: 500, y: 450 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "new" }],
    zones: [], furniture: [], markers: [], doors: [], windows: [], columns: [], dims: [], labels: [], revClouds: [], flowPaths: [], floorRegions: [], guides: [], snapshots: [], slides: [],
  };
  await page.evaluate((entry) => {
    localStorage.setItem("testfit-autosave-history", JSON.stringify([{ ts: Date.now() - 5 * 60_000, data: entry }]));
    localStorage.setItem("testfit-autosave-history-ts", String(Date.now() - 5 * 60_000));
  }, earlier);
  await page.getByTestId("load-menu").click();
  const entry = page.getByTestId("autosave-entry");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("5 min ago");
  await expect(entry).toContainText("2 walls");
  await entry.click();
  await expect(page.getByText(/Restored earlier autosave/)).toBeVisible();
  await expect.poll(async () => (await readModel(page)).walls?.length).toBe(2);
  await expect.poll(async () => (await readModel(page)).projectName).toBe("Earlier Draft");
  // The state that was replaced (the empty new project) became the newest entry, so the
  // restore itself can be undone from the same menu.
  await page.getByTestId("load-menu").click();
  await expect(page.getByTestId("autosave-entry")).toHaveCount(2);
  await expect(page.getByTestId("autosave-entry").first()).toContainText("just now");
});
