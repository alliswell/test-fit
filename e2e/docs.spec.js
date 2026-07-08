import { test, expect } from "@playwright/test";

// Docs / presentation stage: saved views become live-rendering printable slides.
// Fresh isolated context per test (clean localStorage), same as happy-path.spec.js.

const readModel = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("testfit-autosave") || "{}"));

async function newProject(page) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "New", exact: true }).click();
}

async function planCenter(page) {
  const box = await page.getByTestId("plan-canvas").boundingBox();
  return { box, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

async function drawWall(page, x1, y1, x2, y2) {
  await page.keyboard.press("w");
  await page.mouse.click(x1, y1);
  await page.mouse.click(x2, y2);
  await page.mouse.dblclick(x2, y2);
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
}

test("save plan view → slide appears in Docs with sheet + title block; persists", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);

  // Save the plan pane's view to the deck.
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");

  // Docs stage shows the deck entry, the sheet, the readonly slide canvas + title block.
  await expect(page.getByTestId("docs-view")).toBeVisible();
  await expect(page.getByTestId("deck-slide-0")).toBeVisible();
  await expect(page.getByTestId("deck-slide-0")).toContainText("Plan 01");
  await expect(page.getByTestId("docs-sheet")).toBeVisible();
  await expect(page.getByTestId("docs-slide-canvas")).toBeVisible();
  await expect(page.getByTestId("docs-sheet")).toContainText("01 / 01");

  // Persisted shape (autosave debounce ~800ms).
  await page.waitForTimeout(1000);
  const m = await readModel(page);
  expect(m.slides).toHaveLength(1);
  expect(m.slides[0].view).toBe("plan");
  expect(m.slides[0].rect.w).toBeGreaterThan(0);
  expect(m.docSettings).toEqual({ size: "letter", orientation: "landscape" });
});

test("elevation slide: save a Front pane view → readonly elevation renders on the sheet", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);

  // Split layout → pane 1 → Front elevation → save its view.
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").first().selectOption("front");
  await expect(page.getByText("FRONT ELEVATION")).toBeVisible();
  await page.getByTestId("save-to-docs-1").click();
  await page.keyboard.press("5");

  await expect(page.getByTestId("deck-slide-0")).toContainText("Front Elevation 01");
  // The sheet contains the elevation svg with wall faces (rects/polygons present).
  const sheet = page.getByTestId("docs-sheet");
  await expect(sheet).toBeVisible();
  expect(await sheet.locator("svg rect, svg polygon").count()).toBeGreaterThan(0);

  await page.waitForTimeout(1000);
  const m = await readModel(page);
  expect(m.slides[0].view).toBe("front");
  expect(m.slides[0].rect.w).toBeGreaterThan(0);
  expect(m.slides[0].rect.h).toBeGreaterThan(0);
});

test("slide notes: place, edit, persist, delete — model untouched", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");

  // Note tool → click the sheet → type → Enter commits.
  await page.getByTestId("note-tool").click();
  const sheet = page.getByTestId("docs-sheet");
  await sheet.click({ position: { x: 200, y: 150 } });
  await page.getByTestId("note-editor").fill("Verify clearances");
  await page.keyboard.press("Enter");
  await expect(sheet).toContainText("Verify clearances");

  await page.waitForTimeout(1000);
  let m = await readModel(page);
  expect(m.slides[0].notes).toHaveLength(1);
  expect(m.slides[0].notes[0].text).toBe("Verify clearances");
  expect(m.walls).toHaveLength(1); // model untouched

  // Select the note and delete it with the keyboard (local handler, not the model delete).
  // force: the note's own background rect (same interactive group) covers the text glyph.
  await sheet.getByText("Verify clearances").click({ force: true });
  await page.keyboard.press("Delete");
  await expect(sheet).not.toContainText("Verify clearances");
  await page.waitForTimeout(1000);
  m = await readModel(page);
  expect(m.slides[0].notes).toHaveLength(0);
  expect(m.walls).toHaveLength(1);
});

test("Edit model returns to Build with the plan canvas visible", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");
  await expect(page.getByTestId("docs-view")).toBeVisible();

  await page.getByTestId("edit-model").click();
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  await expect(page.getByTitle("Workflow stage (1–5)")).toContainText("Build");
});

test("plan slide renders at a true standard scale shown in the title block", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");

  // The scale cell shows the auto-computed standard scale (input placeholder on the
  // editable sheet) — e.g. 1/2" = 1'-0" depending on viewport; assert the format.
  const sheet = page.getByTestId("docs-sheet");
  await expect(sheet).toBeVisible();
  const scalePh = await sheet.locator("input[placeholder*='1\\'-0\"']").first().getAttribute("placeholder");
  expect(scalePh).toMatch(/^(3|1-1\/2|1|3\/4|1\/2|3\/8|1\/4|3\/16|1\/8|3\/32|1\/16|1\/32)" = 1'-0"$/);
});

test("3D slide camera is locked until Edit view; Save/Reset controls appear", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);

  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").first().selectOption("3d");
  await page.waitForTimeout(2000); // lazy 3D chunk
  await page.getByTestId("save-to-docs-1").click();
  await page.keyboard.press("5");
  await page.waitForTimeout(1500);

  // Locked: only "Edit view" is offered.
  await expect(page.getByTestId("slide-cam-edit")).toBeVisible();
  await expect(page.getByTestId("slide-cam-save")).toHaveCount(0);
  // Unlock → Reset + Save appear; Save re-locks.
  await page.getByTestId("slide-cam-edit").click();
  await expect(page.getByTestId("slide-cam-reset")).toBeVisible();
  await page.getByTestId("slide-cam-save").click();
  await expect(page.getByTestId("slide-cam-edit")).toBeVisible();
});

test("plan slide crop editing: Edit view → drag → Save persists a shifted rect", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");
  await page.waitForTimeout(1000);
  const before = (await readModel(page)).slides[0].rect;

  await page.getByTestId("slide-cam-edit").click();
  const sheet = await page.getByTestId("docs-sheet").boundingBox();
  // drag the crop on the slide body
  await page.mouse.move(sheet.x + sheet.width / 2, sheet.y + sheet.height / 2);
  await page.mouse.down();
  await page.mouse.move(sheet.x + sheet.width / 2 + 90, sheet.y + sheet.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await page.getByTestId("slide-cam-save").click();
  await expect(page.getByTestId("slide-cam-edit")).toBeVisible(); // re-locked
  await page.waitForTimeout(1000);

  const after = (await readModel(page)).slides[0].rect;
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(1);
  expect(after.w).toBeCloseTo(before.w, 5); // pan only — no zoom in this gesture
});

test("note drag-placement creates a leader callout (label-tool style)", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");

  await page.getByTestId("note-tool").click();
  const sheet = await page.getByTestId("docs-sheet").boundingBox();
  // press at the anchor, drag to where the text should live, release
  await page.mouse.move(sheet.x + 200, sheet.y + 160);
  await page.mouse.down();
  await page.mouse.move(sheet.x + 330, sheet.y + 110, { steps: 6 });
  await page.mouse.up();
  // single word — multi-word notes wrap into tspans, which breaks substring matching
  await page.getByTestId("note-editor").fill("Sightlines");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("docs-sheet")).toContainText("Sightlines");

  await page.waitForTimeout(1000);
  const n = (await readModel(page)).slides[0].notes[0];
  expect(n.lx).not.toBeNull(); // leader tip at the press point
  expect(n.ly).not.toBeNull();
  expect(n.x).not.toBeCloseTo(n.lx, 0); // text sits away from the tip
});

test("plan slide live-renders model changes made after it was saved", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);

  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");
  // The slide canvas culls to its own viewport; wall polygons render inside it.
  const polysBefore = await page.getByTestId("docs-slide-canvas").locator("polygon").count();

  // Back to Build, draw a second (separate) wall, return to Docs.
  await page.keyboard.press("1");
  await drawWall(page, cx - 120, cy + 80, cx + 120, cy + 80);
  await page.keyboard.press("5");

  const polysAfter = await page.getByTestId("docs-slide-canvas").locator("polygon").count();
  expect(polysAfter).toBeGreaterThan(polysBefore); // new wall appeared on the slide
});
