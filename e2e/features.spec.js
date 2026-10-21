import { test, expect } from "@playwright/test";

// Autosave is debounced ~800 ms; poll it rather than sleeping.
const readModel = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("testfit-autosave") || "{}"));
async function newProject(page) {
  // New is a two-step inline confirm when there is content (no native dialog).
  const btn = page.getByTestId("new-project");
  await btn.click();
  if ((await btn.textContent())?.startsWith("New?")) await btn.click();
}
// Menus close by clicking their full-screen backdrop (the toggle button sits under it).
async function closeMenu(page) { await page.mouse.click(8, 400); }
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

test("projects: save, update, save-as-new, rename, open, delete", async ({ page }) => {
  const seed = {
    version: "testfit-v17", pxPerFoot: 20, projectName: "Seeded",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 500, y: 200 }, { id: "c", x: 500, y: 450 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "new" }],
    zones: [], furniture: [], markers: [], doors: [], windows: [], columns: [], dims: [], labels: [], revClouds: [], flowPaths: [], floorRegions: [], guides: [], snapshots: [], slides: [],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  await expect.poll(async () => (await readModel(page)).walls?.length).toBe(2);
  const entries = page.getByTestId("project-entry");

  // Unbound editor: Save creates an entry and the title takes the name.
  await page.getByTestId("save-menu").click();
  await expect(page.getByTestId("project-save-block")).toContainText("this browser");
  await expect(page.getByTestId("project-save")).toHaveText("Save");
  await page.getByTestId("project-name-input").fill("Club A");
  await page.getByTestId("project-save").click();
  await expect(page.getByText("Project saved")).toBeVisible();
  await expect.poll(async () => (await readModel(page)).projectName).toBe("Club A");

  // Bound now: the button reads Update, and "Save as new" forks a second entry (same name allowed).
  await page.getByTestId("save-menu").click();
  await expect(page.getByTestId("project-save")).toHaveText("Update");
  await expect(page.getByTestId("project-save-block")).toContainText("Open: Club A");
  await page.getByTestId("project-save").click();
  await expect(page.getByText("Project updated")).toBeVisible();
  await page.getByTestId("save-menu").click();
  await page.getByTestId("project-save-as-new").click();
  await expect(page.getByText("Project saved").first()).toBeVisible(); // a fresh toast (the first may have expired)
  await page.getByTestId("load-menu").click();
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText("open");      // newest first, and it is the open one
  await expect(entries.nth(1)).not.toContainText("open");

  // Rename the older copy inline (✎ → type → Enter).
  await entries.nth(1).getByTestId("project-rename").click();
  await page.getByTestId("project-rename-input").fill("Club A rev2");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Project renamed")).toBeVisible();
  await expect(entries.nth(1)).toContainText("Club A rev2");
  await expect(entries.first()).toContainText("Club A");
  await closeMenu(page);

  // New unbinds: the Save menu offers a plain Save again.
  const newBtn = page.getByTestId("new-project");
  await newBtn.click();
  await expect(newBtn).toHaveText(/^New\?/);
  await newBtn.click();
  await expect.poll(async () => (await readModel(page)).walls?.length).toBe(0);
  await page.getByTestId("save-menu").click();
  await expect(page.getByTestId("project-save")).toHaveText("Save");
  await closeMenu(page);

  // Open the renamed one: walls, name and the "open" marker follow.
  await page.getByTestId("load-menu").click();
  await entries.filter({ hasText: "Club A rev2" }).click();
  await expect(page.getByText("Project opened")).toBeVisible();
  await expect.poll(async () => (await readModel(page)).walls?.length).toBe(2);
  await expect.poll(async () => (await readModel(page)).projectName).toBe("Club A rev2");
  await page.getByTestId("load-menu").click();
  await expect(entries.filter({ hasText: "Club A rev2" })).toContainText("open");

  // Delete is two-step (✕ → "Delete?"), per row.
  for (const remaining of [1, 0]) {
    const del = page.getByTestId("project-delete").first();
    await del.click();
    await expect(del).toHaveText("Delete?");
    await del.click();
    await expect(entries).toHaveCount(remaining);
  }
});

test("furnish checks: overlap flags, the clearance apron, and wall-hug snapping", async ({ page }) => {
  // A 20' wall along y=200 (x 200→600) and three sofas: two overlapping, one free.
  const seed = {
    version: "testfit-v18", pxPerFoot: 20, projectName: "Furnish checks",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 600, y: 200 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "new" }],
    furniture: [
      { id: "s1", type: "sofa", x: 300, y: 500, angle: 0, w: 7, d: 3, label: "" },
      { id: "s2", type: "sofa", x: 360, y: 500, angle: 0, w: 7, d: 3, label: "" },   // overlaps s1
      { id: "s3", type: "sofa", x: 700, y: 400, angle: 0, w: 7, d: 3, label: "" },
    ],
    zones: [], markers: [], doors: [], windows: [], columns: [], dims: [], labels: [], revClouds: [], flowPaths: [], floorRegions: [], guides: [], snapshots: [], slides: [],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  await expect.poll(async () => (await readModel(page)).furniture?.length).toBe(3);
  const box = await page.getByTestId("plan-canvas").boundingBox();

  // Flags exist only in Furnish, and say what is wrong in words.
  await expect(page.getByTestId("furniture-flag")).toHaveCount(0);
  await page.keyboard.press("4");
  await page.keyboard.press("v");
  await expect(page.getByTestId("furniture-flag")).toHaveCount(2);
  await expect(page.getByTestId("furniture-flag").first()).toContainText("overlaps 1");

  // Selecting the free sofa shows its 36" apron with nothing inside it.
  await page.mouse.click(box.x + 700, box.y + 400);
  await expect(page.getByTestId("furniture-apron")).toHaveCount(1);
  await expect(page.getByTestId("furniture-apron")).toContainText("36″ clearance");
  await expect(page.getByTestId("furniture-apron")).toHaveAttribute("data-hits", "0");

  // Drag it to within 10" of the wall: it snaps back-flush (y ≈ 200 + half wall + 1.5') and
  // says so while dragging. Snapping along the wall lands it on the grid at x = 400.
  await page.mouse.move(box.x + 700, box.y + 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 245, { steps: 10 });
  await expect(page.getByTestId("furniture-snap-label")).toBeVisible();
  await page.mouse.up();
  await expect.poll(async () => (await readModel(page)).furniture.find(f => f.id === "s3").x).toBe(400);
  const s3 = (await readModel(page)).furniture.find(f => f.id === "s3");
  expect(s3.y).toBeGreaterThan(230);  // 200 + half the wall's thickness + 1.5' (30px): flush, not at the cursor's 245
  expect(s3.y).toBeLessThan(241);
  expect(Math.abs(s3.angle)).toBeLessThan(0.01);
  await expect(page.getByTestId("furniture-snap-label")).toHaveCount(0); // cleared on mouse-up

  // Clearance is a project setting: 2' shrinks the apron label.
  await page.getByTestId("furniture-clearance").fill("2");
  await expect(page.getByTestId("furniture-apron")).toContainText("24″ clearance");
  await expect.poll(async () => (await readModel(page)).furnitureClearance).toBe(2);
});
