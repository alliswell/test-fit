import { test, expect } from "@playwright/test";

// Each test gets a fresh, isolated context (clean localStorage), so the app boots to the
// empty default project unless the test itself persists something.

// Read the autosaved model blob from localStorage — robust, state-based assertions that
// don't depend on fragile DOM/canvas inspection.
const readModel = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("testfit-autosave") || "{}"));

// Reset to an empty project (handles the "New project?" confirm if content exists).
async function newProject(page) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "New", exact: true }).click();
}

// Center of the plan canvas, in page coordinates.
async function planCenter(page) {
  const box = await page.getByTestId("plan-canvas").boundingBox();
  return { box, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

test("shell renders: stage dropdown, tool rail, layout switcher, plan canvas", async ({ page }) => {
  await page.goto("/");
  // The four workflow stages live in a single dropdown; the trigger shows the active stage.
  const stageTrigger = page.getByTitle("Workflow stage (1–4)");
  await expect(stageTrigger).toBeVisible();
  await expect(stageTrigger).toContainText("Build");
  await stageTrigger.click();
  for (const m of ["Build", "IT/MEP", "Zones", "Budget"]) {
    await expect(page.getByRole("button", { name: m, exact: true })).toBeVisible();
  }
  // switching stages from the menu updates the trigger and closes the menu
  await page.getByRole("button", { name: "Zones", exact: true }).click();
  await expect(stageTrigger).toContainText("Zones");
  await page.keyboard.press("1"); // back to Build via the unchanged shortcut
  await expect(stageTrigger).toContainText("Build");
  // layout switcher glyph buttons live in the top bar
  for (const g of ["▢", "◫", "⊞"]) {
    await expect(page.getByRole("button", { name: g, exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  await expect(page.getByTestId("project-name")).toBeVisible();
});

test("layout switcher: single → quad exposes per-pane view selectors → back to single", async ({ page }) => {
  await page.goto("/");
  // single: only pane 0's own selector
  await expect(page.locator("select")).toHaveCount(1);
  await page.getByRole("button", { name: "⊞", exact: true }).click();   // quad
  // 3 aux panes each get a view-picker <select> (pane 0 is the locked "Plan" chip)
  await expect(page.locator("select")).toHaveCount(3);
  await page.getByRole("button", { name: "▢", exact: true }).click();   // back to single
  await expect(page.locator("select")).toHaveCount(1);
});

test("single-pane view dropdown swaps Plan → 3D → Front elevation → Plan", async ({ page }) => {
  await page.goto("/");
  const chip = page.locator("select").first();
  await chip.selectOption("3d");
  await expect(page.locator("canvas")).toBeVisible();          // WebGL 3D canvas mounted
  await chip.selectOption("front");
  await expect(page.getByText("FRONT ELEVATION")).toBeVisible();
  await chip.selectOption("plan");
  await expect(page.getByTestId("plan-canvas")).toBeVisible(); // editing canvas restored
});

test("crash-safe autosave round-trips across a reload", async ({ page }) => {
  await page.goto("/");

  // Draw a wall first (before focusing the name field, so the 'w' shortcut isn't typed into it)
  // — verifies geometry (now in the geometry store) round-trips, not just the project name.
  const { cx, cy } = await planCenter(page);
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");

  const marker = "E2E_PERSIST_" + Date.now();
  await page.getByTestId("project-name").fill(marker);

  await page.waitForTimeout(1100);          // > 800ms autosave debounce
  const wallsBefore = (await readModel(page)).walls?.length || 0;
  expect(wallsBefore).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByTestId("project-name")).toHaveValue(marker);
  expect((await readModel(page)).walls?.length || 0).toBe(wallsBefore); // geometry persisted
});

test("draw a wall: select Wall tool, click two points, finish → a wall renders", async ({ page }) => {
  await page.goto("/");
  // start from a clean canvas
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "New", exact: true }).click();

  const canvas = page.getByTestId("plan-canvas");
  await expect(canvas).toBeVisible();
  const wallsBefore = await page.locator('line[stroke="transparent"]').count();

  await page.keyboard.press("w");           // Wall tool shortcut
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.click(cx - 120, cy);     // start node
  await page.mouse.click(cx + 120, cy);     // commit segment
  await page.mouse.dblclick(cx + 120, cy);  // finish the chain
  await page.keyboard.press("Escape");

  await expect
    .poll(() => page.locator('line[stroke="transparent"]').count())
    .toBeGreaterThan(wallsBefore);
});

test("selection: click a wall opens the option panel, Escape deselects (Zustand-backed)", async ({ page }) => {
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "New", exact: true }).click();

  const canvas = page.getByTestId("plan-canvas");
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  // draw one horizontal wall through the center
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");

  // select it — the option panel (with its collapse chevron) appears only when selected
  await page.keyboard.press("v");
  await page.mouse.click(cx, cy);
  const panelToggle = page.locator('button[title="Collapse panel"]');
  await expect(panelToggle).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panelToggle).toHaveCount(0);
});

test("layers panel: visibility checkbox + lock toggle (Zustand-backed)", async ({ page }) => {
  await page.goto("/");

  // Lock toggle — nothing locked initially; locking then unlocking is reversible.
  const unlocked = page.locator('span[title="Lock layer"]');
  const locked = page.locator('span[title="Locked — click to unlock"]');
  await expect(locked).toHaveCount(0);
  expect(await unlocked.count()).toBeGreaterThan(0);
  await unlocked.first().click();
  await expect(locked).toHaveCount(1);
  await locked.first().click();
  await expect(locked).toHaveCount(0);

  // Visibility — the Zones layer row toggles between the eye / eye-off glyph.
  const zonesRow = page.getByText("Zones", { exact: true }).locator("xpath=..");
  await expect(zonesRow.locator('span[title="Hide layer"]')).toHaveCount(1); // visible
  await zonesRow.locator('span[title="Hide layer"]').click();
  await expect(zonesRow.locator('span[title="Show layer"]')).toHaveCount(1); // hidden
});

// ── onDown/onMove coverage: these guard the canvas-interaction handlers so their
// dependency arrays can be trimmed (getState) without silent regressions. ──

test("drag: dragging a wall body translates its nodes (onDown/onMove)", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  await page.waitForTimeout(900);
  const before = await readModel(page);
  expect(before.nodes.length).toBe(2);

  // Grab the wall by its body midpoint (~cx,cy) — robust vs. grid-snapped node hit
  // tolerance — and translate it. The wall drag moves both endpoint nodes.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy - 80, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(900);

  const after = await readModel(page);
  expect(after.nodes.length).toBe(2);
  const allMoved = after.nodes.every((n, i) => n.x !== before.nodes[i].x || n.y !== before.nodes[i].y);
  expect(allMoved).toBe(true);
});

test("merge: dragging a wall's endpoint onto another wall splits it into a T-junction", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // A long horizontal wall…
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");
  // …and a separate vertical stub below it (top end 60px clear of the wall).
  await page.keyboard.press("w");
  await page.mouse.click(cx, cy + 120);
  await page.mouse.click(cx, cy + 60);
  await page.mouse.dblclick(cx, cy + 60);
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  await page.waitForTimeout(900);
  const before = await readModel(page);
  expect(before.nodes.length).toBe(4);
  expect(before.walls.length).toBe(2);

  // Drag the stub up by its body so its top endpoint lands on the horizontal wall.
  await page.mouse.move(cx, cy + 90);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 30, { steps: 8 }); // body up 60 → top endpoint reaches the wall
  await page.mouse.up();
  await page.waitForTimeout(900);

  const after = await readModel(page);
  // The horizontal wall split in two; the stub's endpoint became the shared junction —
  // no extra node, one more wall.
  expect(after.nodes.length).toBe(4);
  expect(after.walls.length).toBe(3);
  // The welded endpoint is now a T-junction: one node referenced by three walls.
  const degree = {};
  after.walls.forEach((w) => { degree[w.n1] = (degree[w.n1] || 0) + 1; degree[w.n2] = (degree[w.n2] || 0) + 1; });
  expect(Math.max(...Object.values(degree))).toBe(3);
});

test("draw-weld: ending a drawn wall on another wall's body welds a T-junction and finishes the chain", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // A long horizontal wall…
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");
  // …then draw a stub from below, ending ON the wall's body (mid-span).
  await page.keyboard.press("w");
  await page.mouse.click(cx, cy + 100);
  await page.mouse.click(cx, cy); // lands on the wall → weld + auto-finish chain
  await page.keyboard.press("v");
  await page.waitForTimeout(900);

  const m = await readModel(page);
  // Horizontal wall split in two + the stub = 3 walls, 4 nodes, one degree-3 junction.
  expect(m.nodes.length).toBe(4);
  expect(m.walls.length).toBe(3);
  const degree = {};
  m.walls.forEach((w) => { degree[w.n1] = (degree[w.n1] || 0) + 1; degree[w.n2] = (degree[w.n2] || 0) + 1; });
  expect(Math.max(...Object.values(degree))).toBe(3);
});

test("rect room tool: two clicks create a closed 4-wall loop", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  await page.keyboard.press("r");
  await page.mouse.click(cx - 100, cy - 80);
  // Mid-draw the ghost shows live square footage in the rect's center.
  await page.mouse.move(cx + 100, cy + 80);
  await expect(page.getByTestId("plan-canvas").locator("text", { hasText: /\d+ sf/ })).toBeVisible();
  await page.mouse.click(cx + 100, cy + 80);
  await page.waitForTimeout(900);

  const m = await readModel(page);
  expect(m.nodes.length).toBe(4);
  expect(m.walls.length).toBe(4);
  // Closed loop: every corner has exactly two walls.
  const degree = {};
  m.walls.forEach((w) => { degree[w.n1] = (degree[w.n1] || 0) + 1; degree[w.n2] = (degree[w.n2] || 0) + 1; });
  expect(Object.values(degree).every((d) => d === 2)).toBe(true);
  // The room auto-gets a floor region matching its rectangle.
  expect(m.floorRegions.length).toBe(1);
  expect(m.floorRegions[0].points).toHaveLength(4);
});

test("crossing weld: drawing a wall across another creates a shared 4-way junction", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // Horizontal wall…
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");
  // …then a vertical wall drawn straight across it.
  await page.keyboard.press("w");
  await page.mouse.click(cx, cy - 100);
  await page.mouse.click(cx, cy + 100);
  await page.mouse.dblclick(cx, cy + 100);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);

  const m = await readModel(page);
  // Both walls split at the intersection: 5 nodes, 4 segments, one degree-4 junction.
  expect(m.nodes.length).toBe(5);
  expect(m.walls.length).toBe(4);
  const degree = {};
  m.walls.forEach((w) => { degree[w.n1] = (degree[w.n1] || 0) + 1; degree[w.n2] = (degree[w.n2] || 0) + 1; });
  expect(Math.max(...Object.values(degree))).toBe(4);
});

test("collinear connect: extending onto an existing wall splits instead of stacking", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // Existing vertical wall from (cx, cy-100) to (cx, cy+100)…
  await page.keyboard.press("w");
  await page.mouse.click(cx, cy - 100);
  await page.mouse.click(cx, cy + 100);
  await page.mouse.dblclick(cx, cy + 100);
  await page.keyboard.press("Escape");
  // …then draw in line with it, from above, ending mid-span at (cx, cy).
  await page.keyboard.press("w");
  await page.mouse.click(cx, cy - 220);
  await page.mouse.click(cx, cy);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);

  const m = await readModel(page);
  // 3 clean segments, no doubled pair, no wall spanning across an interior node.
  expect(m.nodes.length).toBe(4);
  expect(m.walls.length).toBe(3);
  const pairs = m.walls.map((w) => [w.n1, w.n2].sort().join("|"));
  expect(new Set(pairs).size).toBe(pairs.length); // no duplicate segments
  const degree = {};
  m.walls.forEach((w) => { degree[w.n1] = (degree[w.n1] || 0) + 1; degree[w.n2] = (degree[w.n2] || 0) + 1; });
  expect(Object.values(degree).sort().join(",")).toBe("1,1,2,2"); // one straight run
});

test("marquee multi-select + group nudge moves the whole selection", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // an L-shaped chain → 3 nodes
  await page.keyboard.press("w");
  await page.mouse.click(cx - 100, cy - 100);
  await page.mouse.click(cx + 100, cy - 100);
  await page.mouse.click(cx + 100, cy + 100);
  await page.mouse.dblclick(cx + 100, cy + 100);
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  await page.waitForTimeout(900);
  const before = await readModel(page);
  expect(before.nodes.length).toBe(3);

  // marquee from an empty interior point (corners can sit under pane chips/HUD
  // overlays and would start a click, not a marquee) enclosing the whole L
  await page.mouse.move(cx - 170, cy + 170);
  await page.mouse.down();
  await page.mouse.move(cx + 170, cy - 170, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300); // let the marquee selection commit before nudging
  // group-move the marquee selection with the keyboard (precision-free, exercises the
  // selectedIds multi-move path that group-drag also uses)
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(900);

  const after = await readModel(page);
  expect(after.nodes.length).toBe(3);
  // every node shifted right by the same delta → marquee selected all, nudge moved all
  const deltas = after.nodes.map((n, i) => n.x - before.nodes[i].x);
  // all selected nodes shifted right by the same delta (float-tolerant) → marquee
  // selected all three and the nudge moved them as a group; y is untouched
  expect(deltas.every((d) => d > 0 && Math.abs(d - deltas[0]) < 1e-6)).toBe(true);
  expect(after.nodes.every((n, i) => n.y === before.nodes[i].y)).toBe(true);
});

test("elevation annotation: a dimension is stored under elevAnnotations[front]", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // draw a wall so the elevation has geometry
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");

  // split, set the aux pane to the Front elevation
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();
  const ebox = await elev.boundingBox();

  // dimension tool → 3 clicks (point, point, then pull the dim line away to set its offset)
  await page.keyboard.press("m");
  await page.mouse.click(ebox.x + ebox.width * 0.3, ebox.y + ebox.height * 0.6);
  await page.mouse.click(ebox.x + ebox.width * 0.6, ebox.y + ebox.height * 0.6);
  await page.mouse.click(ebox.x + ebox.width * 0.45, ebox.y + ebox.height * 0.4); // offset pull
  await page.waitForTimeout(900);

  const m = await readModel(page);
  expect((m.elevAnnotations?.front?.dims || []).length).toBeGreaterThan(0);
});

test("elevation labels: place + commit, abandoned editor leaves nothing, drag makes a callout", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // draw a wall so the elevation has geometry
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");

  // split, set the aux pane to the Front elevation
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();
  const ebox = await elev.boundingBox();

  // Label tool: click opens the inline editor on mouse-UP (real focus must survive the
  // release — this is exactly the focus-steal regression this test guards against).
  await page.keyboard.press("t");
  await page.mouse.click(ebox.x + ebox.width * 0.4, ebox.y + ebox.height * 0.5);
  const editor = page.locator("textarea");
  await expect(editor).toBeVisible();
  await expect(editor).toBeFocused();
  await editor.fill("Window Head");
  await page.keyboard.press("Enter");
  await expect(editor).toHaveCount(0);

  // Abandoning an empty editor (Escape) must not create a stray label.
  await page.mouse.click(ebox.x + ebox.width * 0.6, ebox.y + ebox.height * 0.5);
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);

  // Drag = callout: press at the leader-tip point, release where the text goes.
  await page.mouse.move(ebox.x + ebox.width * 0.35, ebox.y + ebox.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(ebox.x + ebox.width * 0.55, ebox.y + ebox.height * 0.3, { steps: 6 });
  await page.mouse.up();
  await expect(editor).toBeVisible();
  await editor.fill("Beam above");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900); // autosave debounce

  const m = await readModel(page);
  const labels = m.elevAnnotations?.front?.labels || [];
  expect(labels.map((l) => l.text).sort()).toEqual(["Beam above", "Window Head"]);
  const callout = labels.find((l) => l.text === "Beam above");
  expect(callout.lx).not.toBeNull();          // leader tip stored
  expect(labels.find((l) => l.text === "Window Head").lx ?? null).toBeNull(); // plain label has none
});

test("elevation revision cloud: click-to-draw closes at the first point and is stored", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // draw a wall so the elevation has geometry
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");

  // split, set the aux pane to the Front elevation
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();
  const ebox = await elev.boundingBox();

  // revision cloud tool (N) → triangle, then close by clicking back on the first point
  await page.keyboard.press("n");
  await page.mouse.click(ebox.x + ebox.width * 0.25, ebox.y + ebox.height * 0.30);
  await page.mouse.click(ebox.x + ebox.width * 0.75, ebox.y + ebox.height * 0.30);
  await page.mouse.click(ebox.x + ebox.width * 0.50, ebox.y + ebox.height * 0.72);
  await page.mouse.click(ebox.x + ebox.width * 0.25, ebox.y + ebox.height * 0.30); // close
  await page.waitForTimeout(900); // autosave debounce

  const m = await readModel(page);
  const rcs = m.elevAnnotations?.front?.revClouds || [];
  expect(rcs.length).toBe(1);
  expect(rcs[0].points.length).toBe(3);
  // closing auto-selects the cloud → its option panel is open
  await expect(page.getByText("Elevation Revision Cloud")).toBeVisible();
});

test("door types in elevation: Case Opening renders dashed and stays clickable", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // draw a wall, then place a door on it (tool rail button — no keyboard shortcut)
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");
  await page.locator("button:has(svg.lucide-door-open)").click();
  await page.mouse.click(cx, cy); // snaps to the wall, auto-selects the new door

  // option panel is open for the selected door → set its type
  await page.getByRole("button", { name: "Case Opening", exact: true }).click();
  await page.keyboard.press("Escape"); // deselect

  // split, set the aux pane to the Front elevation
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();

  // Case Opening = dashed outline, no fill — and the transparent fill must keep it clickable
  const dashed = elev.locator('rect[stroke-dasharray="5 4"]');
  await expect(dashed).toHaveCount(1);
  await dashed.click();
  await expect(page.getByRole("button", { name: "Case Opening", exact: true })).toBeVisible(); // door panel reopened

  await page.waitForTimeout(900); // autosave debounce
  const m = await readModel(page);
  expect((m.doors || [])[0]?.doorType).toBe("Case Opening");
});

test("duplicate overlapping wall is deduped on load (door renders once)", async ({ page }) => {
  // Reproduces the 3D double-door bug: a reversed-duplicate wall (same node pair) makes each
  // wall copy claim the door in 3D. migrateProjectData must collapse it to one wall on load.
  const blob = {
    version: "testfit-v9", projectName: "Dedup",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 560, y: 200 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "a", kind: "existing" }],
    doors: [{ id: "d1", x: 380, y: 200, angle: 0, width: 36, doorType: "Wood", phase: "existing" }],
  };
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), blob);
  await page.goto("/");
  await page.waitForTimeout(1100); // > autosave debounce
  const m = await readModel(page);
  expect((m.walls || []).length).toBe(1);  // reversed-duplicate collapsed
  expect((m.doors || []).length).toBe(1);
});

test("IT/MEP finish: a black wall speaker stores finish:black", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  await page.keyboard.press("2"); // IT/MEP mode
  // pick the Speakers / AV layer → selects wall_speaker + the marker tool
  await page.getByText("Speakers / AV", { exact: true }).first().click();
  // finish toggle in the tool-settings panel
  await page.getByRole("button", { name: "black" }).click();
  // place on the canvas
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(900);

  const m = await readModel(page);
  const spk = (m.markers || []).find(k => k.componentType === "wall_speaker");
  expect(spk).toBeTruthy();
  expect(spk.finish).toBe("black");
});

test("IT/MEP door access: toggling Access Control sets door.accessControl", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // draw a wall, then place a door on it
  await page.keyboard.press("w");
  await page.mouse.click(cx - 120, cy);
  await page.mouse.click(cx + 120, cy);
  await page.mouse.dblclick(cx + 120, cy);
  await page.keyboard.press("Escape");
  await page.locator("button:has(svg.lucide-door-open)").click();
  await page.mouse.click(cx, cy); // auto-selects the new door

  // door inspector → enable Access Control (clicking the label toggles its checkbox)
  await page.getByText("Access Control (reader)").click();
  await page.waitForTimeout(900);

  const m = await readModel(page);
  expect((m.doors || [])[0]?.accessControl).toBe(true);
});
