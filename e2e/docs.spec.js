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
  // A note being edited shows ONLY its editor — the empty "Label…" placeholder used to
  // render underneath and poke out from behind the textarea.
  await expect(sheet).not.toContainText("Label…");
  // …and the editor is centered on the note anchor (not hanging down-right of it).
  const ed = await page.getByTestId("note-editor").boundingBox();
  const sh = await sheet.boundingBox();
  expect(Math.abs((ed.x + ed.width / 2) - (sh.x + 200))).toBeLessThan(6);
  expect(Math.abs((ed.y + ed.height / 2) - (sh.y + 150))).toBeLessThan(6);
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

test("per-slide layers: presets set slide.vis; toggling a layer pins a custom set", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");
  await page.waitForTimeout(1000);
  // Fresh slide inherits the editor layers.
  expect((await readModel(page)).slides[0].vis).toBeNull();

  // Electrical preset: dims off, electrical on.
  await page.getByTestId("layer-preset-electrical").click();
  await page.waitForTimeout(900);
  let vis = (await readModel(page)).slides[0].vis;
  expect(vis).not.toBeNull();
  expect(vis.dims).toBe(false);
  expect(vis.elec).toBe(true);
  expect(vis.zones).toBe(false);

  // Toggle a layer (Zones) → still an explicit object, now zones on.
  await page.getByTestId("layer-row-zones").click();
  await page.waitForTimeout(900);
  vis = (await readModel(page)).slides[0].vis;
  expect(vis.zones).toBe(true);
  expect(vis.elec).toBe(true); // other keys preserved

  // Back to Live → vis null (inherit).
  await page.getByTestId("layer-preset-live").click();
  await page.waitForTimeout(900);
  expect((await readModel(page)).slides[0].vis).toBeNull();
});

test("budget slide: add from deck strip → live totals + item schedule render", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  // Place an IT/MEP component (router) so the schedule has a row: stage 2 → P tool default.
  await page.keyboard.press("2");
  await page.keyboard.press("p");
  await page.mouse.click(cx, cy - 60);
  await page.keyboard.press("Escape");

  await page.keyboard.press("5");
  await page.getByTestId("add-template").click();
  await page.getByTestId("add-budget-slide").click();
  await expect(page.getByTestId("budget-sheet")).toBeVisible();
  await expect(page.getByTestId("budget-sheet")).toContainText("Total Estimate");
  await expect(page.getByTestId("budget-sheet")).toContainText("Item Schedule");
  await expect(page.getByTestId("budget-sheet")).toContainText("Existing wall");
  // the title-block title is an <input> (no innerText) — assert the deck-strip name
  await expect(page.getByTestId("deck-slide-0")).toContainText("Budget 01");

  await page.waitForTimeout(1000);
  const m = await readModel(page);
  const b = m.slides.find(s => s.view === "budget");
  expect(b).toBeTruthy();
  expect(b.rect).toBeNull();
});

test("budget: an as-built door is excluded from construction", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy); // "existing" kind → footage, $0
  // Place a door; it defaults to as-built (part of the existing plan → $0).
  await page.locator("button:has(svg.lucide-door-open)").click();
  await page.mouse.click(cx - 20, cy);
  await page.keyboard.press("Escape");

  await page.keyboard.press("5");
  await page.getByTestId("add-template").click();
  await page.getByTestId("add-budget-slide").click();
  const sheet = page.getByTestId("budget-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Construction");
  await expect(sheet).not.toContainText("New door"); // as-built → not in the budget
});

test("budget: flagging a door \"New\" rolls its cost into the total", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  // Place a door — it stays selected, so the inspector shows its New-construction toggle.
  await page.locator("button:has(svg.lucide-door-open)").click();
  await page.mouse.click(cx - 20, cy);
  await page.getByTestId("new-construction").check(); // flag it new construction
  await page.mouse.click(cx, cy - 150); // blur the checkbox so the stage shortcut fires

  await page.keyboard.press("5");
  await page.getByTestId("add-template").click();
  await page.getByTestId("add-budget-slide").click();
  const sheet = page.getByTestId("budget-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("New door · Wood");
  await expect(sheet).toContainText("$850"); // Wood door line + subtotal include it
});

test("FF&E schedule slide: zone items render with subtotals via the template menu", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  // place a zone (Zones stage → Z tool → click)
  await page.keyboard.press("3");
  await page.keyboard.press("z");
  await page.mouse.click(cx - 80, cy - 60);
  await page.keyboard.press("Escape");

  await page.keyboard.press("5");
  await page.getByTestId("add-template").click();
  await page.getByTestId("add-ffe-slide").click();
  const sheet = page.getByTestId("ffe-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Schedule by Area");
  await expect(sheet).toContainText("Project Rollup");
  await expect(sheet).toContainText("subtotal");

  await page.waitForTimeout(1000);
  const m = await readModel(page);
  expect(m.slides.find(s => s.view === "ffe")).toBeTruthy();
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

// Three-slide deck for the drag-and-drop specs: saved plan + budget + FF&E templates.
async function threeSlideDeck(page) {
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");
  await page.getByTestId("add-template").click();
  await page.getByTestId("add-budget-slide").click();
  await page.getByTestId("add-template").click();
  await page.getByTestId("add-ffe-slide").click();
}

// Drag a deck row so the pointer lands on `target` at vertical fraction `frac`
// (0.15 → "before" zone, 0.5 → "into" zone on a nestable top-level row).
async function dragRow(page, fromTestId, toTestId, frac) {
  const from = await page.getByTestId(fromTestId).boundingBox();
  const to = await page.getByTestId(toTestId).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 3 }); // trip the 4px threshold
  await page.mouse.move(to.x + to.width / 2, to.y + to.height * frac, { steps: 8 });
  await page.mouse.up();
}

test("deck drag & drop reorders slides (replaces the arrow buttons)", async ({ page }) => {
  await page.goto("/");
  await threeSlideDeck(page); // [plan, budget, ffe]

  // Drag the FF&E row (index 2) into the top quarter of the plan row (index 0) → "before".
  await dragRow(page, "deck-slide-2", "deck-slide-0", 0.15);
  await expect(page.getByTestId("deck-slide-0")).toContainText("FF&E Schedule");
  await expect(page.getByTestId("deck-slide-1")).toContainText("Plan 01");

  // Poll the debounced autosave until it reflects the reorder (single reads race the write).
  await expect.poll(async () => (await readModel(page)).slides?.map(s => s.view).join(",")).toBe("ffe,plan,budget");
  const m = await readModel(page);
  expect(m.slides.every(s => s.parentId === null)).toBe(true); // reorder, not nest
});

test("dropping a slide onto the middle of another nests it one level", async ({ page }) => {
  await page.goto("/");
  await threeSlideDeck(page); // [plan, budget, ffe]

  // Drop the budget row onto the middle of the plan row → child of plan.
  await dragRow(page, "deck-slide-1", "deck-slide-0", 0.5);

  // Poll until the nest lands: budget (index 1) becomes a child of plan (index 0).
  await expect.poll(async () => { const sl = (await readModel(page)).slides; return !!sl && sl[1]?.parentId === sl[0]?.id; }).toBe(true);
  const m = await readModel(page);
  expect(m.slides.map(s => s.view)).toEqual(["plan", "budget", "ffe"]);
  expect(m.slides[2].parentId).toBeNull();

  // Nested row renders indented; clicking it still selects (mouseup-no-move path).
  const parentBox = await page.getByTestId("deck-slide-0").boundingBox();
  const childBox = await page.getByTestId("deck-slide-1").boundingBox();
  expect(childBox.x - parentBox.x).toBeGreaterThanOrEqual(14);
  await page.getByTestId("deck-slide-1").click();
  await expect(page.getByTestId("budget-sheet")).toBeVisible();
});

test("sheet zoom: chip buttons zoom the sheet view; Fit restores 100%", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");

  await expect(page.getByTestId("sheet-zoom-pct")).toHaveText("100%");
  const w0 = (await page.getByTestId("docs-sheet").boundingBox()).width;

  await page.getByTestId("sheet-zoom-in").click();
  await page.getByTestId("sheet-zoom-in").click();
  await expect(page.getByTestId("sheet-zoom-pct")).toHaveText("144%");
  const wZoomed = (await page.getByTestId("docs-sheet").boundingBox()).width;
  expect(wZoomed).toBeGreaterThan(w0 * 1.35); // 1.2² ≈ 1.44 on-screen

  await page.getByTestId("sheet-zoom-fit").click();
  await expect(page.getByTestId("sheet-zoom-pct")).toHaveText("100%");
  const wFit = (await page.getByTestId("docs-sheet").boundingBox()).width;
  expect(Math.abs(wFit - w0)).toBeLessThan(2);
});

// Save a plan slide, then add a Title/Section slide from the template menu.
async function planPlusSection(page) {
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");
  await page.getByTestId("add-template").click();
  await page.getByTestId("add-title-slide").click();
}

test("title/section slide: renders a section sheet, nests a slide, and collapses to hide it", async ({ page }) => {
  await page.goto("/");
  await planPlusSection(page);            // deck: [Plan 01, Section 01]
  await expect(page.getByTestId("title-sheet")).toBeVisible();

  // Nest the plan under the section (drop onto its middle) → child follows parent.
  await dragRow(page, "deck-slide-0", "deck-slide-1", 0.5);
  await expect.poll(async () => (await readModel(page)).slides?.map(s => s.view).join(",")).toBe("title,plan");
  let m = await readModel(page);
  const titleSlide = m.slides.find(s => s.view === "title");
  expect(m.slides.find(s => s.view === "plan").parentId).toBe(titleSlide.id);

  // The section sheet auto-indexes its nested slides on the right ("In this section").
  await expect(page.getByTestId("title-contents")).toContainText("In this section");
  await expect(page.getByTestId("title-contents")).toContainText("Plan 01");

  // The nested plan row shows; collapsing the section hides it, expanding restores it.
  await expect(page.getByTestId("deck-slide-1")).toBeVisible();
  await page.getByTestId("deck-collapse-0").click();
  await expect(page.getByTestId("deck-slide-1")).toHaveCount(0);
  await page.getByTestId("deck-collapse-0").click();
  await expect(page.getByTestId("deck-slide-1")).toBeVisible();

  // Collapse never alters the nesting in the model, only the section's `collapsed` flag.
  m = await readModel(page);
  expect(m.slides.find(s => s.view === "plan").parentId).toBe(titleSlide.id);
});

test("collapse state persists across a reload", async ({ page }) => {
  await page.goto("/");
  await planPlusSection(page);            // deck: [Plan 01, Section 01]
  await dragRow(page, "deck-slide-0", "deck-slide-1", 0.5); // nest plan under section
  await expect.poll(async () => (await readModel(page)).slides?.map(s => s.view).join(",")).toBe("title,plan");

  // Collapse the section, then wait for the autosave to record collapsed: true.
  await page.getByTestId("deck-collapse-0").click();
  await expect.poll(async () => (await readModel(page)).slides?.find(s => s.view === "title")?.collapsed).toBe(true);

  // Reload → return to Docs. The section is still collapsed and its child stays hidden.
  await page.reload();
  await page.keyboard.press("5");
  await expect(page.getByTestId("deck-slide-0")).toContainText("Section");
  await expect(page.getByTestId("deck-slide-1")).toHaveCount(0);
  // Expanding after reload reveals the persisted child.
  await page.getByTestId("deck-collapse-0").click();
  await expect(page.getByTestId("deck-slide-1")).toContainText("Plan 01");
});

test("a section slide stays top-level when dropped onto another slide (never nests)", async ({ page }) => {
  await page.goto("/");
  await planPlusSection(page);            // deck: [Plan 01, Section 01]

  // Drop the section (index 1) onto the top of the plan (index 0): sections can't nest,
  // so it reorders above the plan and keeps parentId null.
  await dragRow(page, "deck-slide-1", "deck-slide-0", 0.15);
  await expect.poll(async () => (await readModel(page)).slides?.map(s => s.view).join(",")).toBe("title,plan");
  const m = await readModel(page);
  expect(m.slides.every(s => s.parentId === null)).toBe(true);
});

test("the + Template button sits above the deck rows", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");
  const btn = await page.getByTestId("add-template").boundingBox();
  const row = await page.getByTestId("deck-slide-0").boundingBox();
  expect(btn.y).toBeLessThan(row.y);
});

test("slides stay Vellum (light) for correct printing even when the app is in Dark mode", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");

  // The on-screen sheet (paper background + title block) renders Vellum, not the dark
  // canvas color — while the surrounding chrome (deck strip) stays dark as expected.
  const sheetBg = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="docs-sheet"]')).backgroundColor);
  expect(sheetBg).toBe("rgb(236, 228, 213)"); // Vellum canvas #ECE4D5
  const deckBg = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="docs-view"]')).backgroundColor);
  expect(deckBg).not.toBe("rgb(236, 228, 213)"); // chrome still follows the dark theme
});

test("Print theme renders docs sheets on pure-white paper", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);

  await page.getByRole("button", { name: "Print", exact: true }).click();
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");

  // The sheet is pure white in Print mode (vs. warm Vellum #ECE4D5 normally).
  const sheetBg = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="docs-sheet"]')).backgroundColor);
  expect(sheetBg).toBe("rgb(255, 255, 255)");
});

test("print output stays Vellum (light) even when the app is in Dark mode", async ({ page }) => {
  // Stub window.print before any app code runs, so Print/PDF never opens a real dialog —
  // this must be registered before the first navigation to take effect on this page load.
  await page.addInitScript(() => { window.print = () => {}; });
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  await drawWall(page, cx - 120, cy, cx + 120, cy);

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("5");
  await page.getByTestId("print-deck").click();
  await page.waitForTimeout(400);

  const bg = await page.evaluate(() => {
    const el = document.querySelector(".docs-print-root .docs-sheet-page");
    return el ? getComputedStyle(el).backgroundColor : null;
  });
  expect(bg).toBe("rgb(236, 228, 213)"); // Vellum canvas #ECE4D5
});
