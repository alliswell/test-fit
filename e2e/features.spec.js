import { test, expect } from "@playwright/test";

// Autosave is debounced ~800 ms; poll it rather than sleeping.
const readModel = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("testfit-autosave") || "{}"));
async function newProject(page) {
  // New is a two-step inline confirm when there is content (no native dialog).
  const btn = page.getByTestId("new-project");
  await btn.click();
  if ((await btn.textContent())?.startsWith("New?")) await btn.click();
}
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

test("projects: save to the in-app list, start new, open it back, delete it", async ({ page }) => {
  const seed = {
    version: "testfit-v17", pxPerFoot: 20, projectName: "Seeded",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 500, y: 200 }, { id: "c", x: 500, y: 450 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "new" }],
    zones: [], furniture: [], markers: [], doors: [], windows: [], columns: [], dims: [], labels: [], revClouds: [], flowPaths: [], floorRegions: [], guides: [], snapshots: [], slides: [],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  await expect.poll(async () => (await readModel(page)).walls?.length).toBe(2);

  // Save ▾ › name it › Save. The dev build has no artifact db, so this is the IndexedDB backend.
  await page.getByTestId("save-menu").click();
  await expect(page.getByTestId("project-save-block")).toContainText("this browser");
  await page.getByTestId("project-name-input").fill("Club A");
  await page.getByTestId("project-save").click();
  await expect(page.getByText("Project saved")).toBeVisible();

  // New is a two-step confirm while there is content; the model empties.
  const newBtn = page.getByTestId("new-project");
  await newBtn.click();
  await expect(newBtn).toHaveText(/^New\?/);
  await newBtn.click();
  await expect.poll(async () => (await readModel(page)).walls?.length).toBe(0);

  // Load ▾ › Projects › Club A brings the walls and the name back.
  await page.getByTestId("load-menu").click();
  const entry = page.getByTestId("project-entry");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("Club A");
  await entry.click();
  await expect(page.getByText("Project opened")).toBeVisible();
  await expect.poll(async () => (await readModel(page)).walls?.length).toBe(2);
  await expect.poll(async () => (await readModel(page)).projectName).toBe("Club A");

  // Saving under the same name updates the entry rather than adding one.
  await page.getByTestId("save-menu").click();
  await expect(page.getByTestId("project-name-input")).toHaveValue("Club A");
  await expect(page.getByTestId("project-save")).toHaveText("Update");
  await page.getByTestId("project-save").click();
  await expect(page.getByText("Project saved")).toBeVisible();
  await page.getByTestId("load-menu").click();
  await expect(page.getByTestId("project-entry")).toHaveCount(1);

  // Delete is two-step too (✕ → "Delete?").
  const del = page.getByTestId("project-delete");
  await del.click();
  await expect(del).toHaveText("Delete?");
  await del.click();
  await expect(page.getByText("Project deleted")).toBeVisible();
  await expect(page.getByTestId("project-entry")).toHaveCount(0);
});
