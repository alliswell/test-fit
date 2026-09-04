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
  // The workflow stages live in a single dropdown; the trigger shows the active stage.
  const stageTrigger = page.getByTitle("Workflow stage (1–6)");
  await expect(stageTrigger).toBeVisible();
  await expect(stageTrigger).toContainText("Build");
  await stageTrigger.click();
  for (const m of ["Build", "IT/MEP", "Zones", "Furnish", "Budget", "Docs"]) {
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
  await expect(page.getByTestId("plan-canvas").locator("text", { hasText: /\d+ sf/ }).first()).toBeVisible(); // .first(): the ghost now also shows a "sf clear" line
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
  const fdims = m.elevAnnotations?.front?.dims || [];
  expect(fdims.length).toBeGreaterThan(0);
  expect(fdims[0].cut).toBeNull(); // drawn with no section cut → scoped to the no-cut view
});

test("elevation: a door flagged New construction shows a NEW tag", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  await page.keyboard.press("w");
  await page.mouse.click(cx - 160, cy);
  await page.mouse.click(cx + 160, cy);
  await page.mouse.dblclick(cx + 160, cy);
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");

  // Place a door and flag it new construction (it stays selected → inspector is showing).
  await page.locator("button:has(svg.lucide-door-open)").click();
  await page.mouse.click(cx, cy);
  await page.getByTestId("new-construction").check();

  // Front elevation carries the NEW tag for the flagged opening.
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();
  await expect(elev).toContainText("NEW");
});

test("isometric view: locked ortho corners, and saves as an iso slide", async ({ page }) => {
  const seed = {
    version: "testfit-v16", pxPerFoot: 20,
    nodes: [
      { id: "a", x: 380, y: 280 }, { id: "b", x: 820, y: 280 },
      { id: "c", x: 820, y: 580 }, { id: "d", x: 380, y: 580 },
    ],
    walls: [
      { id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
      { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" },
    ],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").last().selectOption("iso");
  await page.waitForTimeout(1500);

  // Rotate arrows swing 90° per press through ne→se→sw→nw; start is "se".
  await expect(page.getByTestId("iso-rot-left")).toBeVisible();
  await expect(page.getByTestId("iso-fit")).toBeVisible();
  await page.getByTestId("iso-rot-right").click();   // se → sw
  await page.getByTestId("iso-rot-right").click();   // sw → nw
  await page.waitForTimeout(300);

  // Saving records an "iso" slide carrying the viewing corner.
  await page.getByTestId("save-to-docs-1").click();
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("testfit-autosave") || "{}").slides || []).length > 0, null, { timeout: 5000 });
  let slides = await page.evaluate(() => JSON.parse(localStorage.getItem("testfit-autosave") || "{}").slides || []);
  expect(slides[0].view).toBe("iso");
  expect(slides[0].cam3d.isoCorner).toBe("nw");

  // The snapshot must carry the ORTHOGRAPHIC zoom: an ortho camera's position doesn't set
  // the image scale, so without it the slide silently re-fit to the whole building.
  const box = await page.locator("canvas").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  await page.getByTestId("save-to-docs-1").click();
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("testfit-autosave") || "{}").slides || []).length > 1, null, { timeout: 5000 });
  slides = await page.evaluate(() => JSON.parse(localStorage.getItem("testfit-autosave") || "{}").slides || []);
  expect(slides[1].cam3d.zoom).toBeGreaterThan(slides[0].cam3d.zoom * 1.2); // zoomed-in framing preserved
});

test("demo wall keeps its openings in 3D and tags them DEMO in elevation", async ({ page }) => {
  // A demo wall carrying a door + window. The openings must survive as real cuts in 3D
  // (they used to be swallowed by the uncut red mass) and read as demo in elevation.
  const seed = {
    version: "testfit-v16", pxPerFoot: 20,
    nodes: [
      { id: "a", x: 380, y: 300 }, { id: "b", x: 800, y: 300 },
      { id: "c", x: 800, y: 560 }, { id: "d", x: 380, y: 560 },
    ],
    walls: [
      { id: "wTop", n1: "a", n2: "b", kind: "existing" },
      { id: "wRight", n1: "b", n2: "c", kind: "existing" },
      { id: "wFront", n1: "c", n2: "d", kind: "demo" },
      { id: "wLeft", n1: "d", n2: "a", kind: "existing" },
    ],
    doors: [{ id: "dDemo", x: 500, y: 560, angle: 0, width: 36, doorType: "Wood", phase: "existing" }],
    windows: [{ id: "wDemo", x: 700, y: 560, angle: 0, width: 48, height: 48, sill: 30, type: "Window", phase: "existing" }],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();
  // Wall + door + window on the demo wall each carry a DEMO tag.
  await expect(elev.getByText("DEMO", { exact: true })).toHaveCount(3);
});

test("elevation dims scope to the section cut: only the active cut's measurements show", async ({ page }) => {
  // Seed a wall + a front section cut at 700 + two dims: one tied to that cut, one to the
  // no-cut view. Only the cut-700 dim should render while the 700 cut is active.
  const seed = {
    version: "testfit-v16", pxPerFoot: 20,
    nodes: [{ id: "a", x: -100, y: 0 }, { id: "b", x: 100, y: 0 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }],
    guides: [{ id: "g1", dir: "front", pos: 700 }],
    elevAnnotations: { front: { dims: [
      { id: "dA", x1: -50, y1: -100, x2: 50, y2: -100, offset: 30, cut: 700 },  // 100px = 5' → shows
      { id: "dB", x1: -30, y1: -140, x2: 30, y2: -140, offset: 30, cut: null }, // 60px = 3' → hidden
    ], labels: [], revClouds: [] } },
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");

  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();
  await expect(elev).toContainText("5'-0\"");       // dim tied to the active cut (700)
  await expect(elev).not.toContainText("3'-0\"");   // no-cut dim is hidden while the cut is active
});

test("elevation dim anchored to a wall + a marker follows the marker when it moves", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // A wall + a wall-mounted speaker on it.
  await page.keyboard.press("w");
  await page.mouse.click(cx - 180, cy);
  await page.mouse.click(cx + 180, cy);
  await page.mouse.dblclick(cx + 180, cy);
  await page.keyboard.press("Escape");
  await page.keyboard.press("2"); // IT/MEP mode
  await page.getByText("Speakers / AV", { exact: true }).first().click();
  await page.mouse.click(cx - 100, cy);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);

  const m0 = await readModel(page);
  const wallId = m0.walls[0].id, markerId = m0.markers[0].id;

  // Split to the Front elevation, where both the wall and the marker project.
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();
  const wallEl = page.getByTestId("elev-wall-" + wallId);
  const markerEl = page.getByTestId("elev-marker-" + markerId);
  await expect(markerEl).toBeVisible();
  const wallBox = await wallEl.boundingBox(), markerBox = await markerEl.boundingBox();

  // Dimension tool: wall's floor-left corner → the marker → pull the offset.
  await page.keyboard.press("m");
  await page.mouse.click(wallBox.x + 2, wallBox.y + wallBox.height - 2);
  await page.mouse.click(markerBox.x + markerBox.width / 2, markerBox.y + markerBox.height / 2);
  await page.mouse.click(wallBox.x + 40, wallBox.y - 30);
  await page.waitForTimeout(900);

  const m1 = await readModel(page);
  const dim = (m1.elevAnnotations?.front?.dims || [])[0];
  expect(dim).toBeTruthy();
  expect(dim.a1).toMatchObject({ id: wallId, kind: "wall" });     // snapped onto the wall corner
  expect(dim.a2).toMatchObject({ id: markerId, kind: "marker" }); // snapped onto the marker
  const labelBefore = await page.getByTestId("elev-dim-label-" + dim.id).textContent();

  // Move the marker 5ft further along the wall (via the sidebar + arrow-nudge — precise,
  // and independent of plan-canvas drag hit-testing).
  await page.getByRole("button", { name: "▢", exact: true }).click();
  await page.getByText("Wall Speaker", { exact: false }).first().click();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  expect((await readModel(page)).markers[0].x).toBe(m0.markers[0].x + 5 * m0.pxPerFoot);

  // Back to the elevation: the SAME dimension now reads a different, larger length — it
  // followed the marker instead of freezing at the position it was drawn at.
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  await expect(page.getByTestId("elev-dim-label-" + dim.id)).not.toHaveText(labelBefore);
  await expect(page.getByTestId("elev-dim-label-" + dim.id)).toHaveText("11'-2\""); // 5' further → exact geometry
});

test("dragging a dimension's endpoint directly detaches it from its anchor", async ({ page }) => {
  // Seed a wall + a dim already anchored to it at both ends (a1/a2), like one drawn corner-
  // to-corner. Dragging p1 by hand should clear a1 (it's now a free point) while p2 stays
  // anchored — a manual override shouldn't silently keep following the old item.
  const seed = {
    version: "testfit-v16", pxPerFoot: 20,
    nodes: [{ id: "a", x: -100, y: 0 }, { id: "b", x: 100, y: 0 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }],
    elevAnnotations: { front: { dims: [
      { id: "d1", x1: -100, y1: 0, x2: 100, y2: 0, offset: 40, cut: null,
        a1: { id: "w1", kind: "wall", part: "u1vb" }, a2: { id: "w1", kind: "wall", part: "u2vb" } },
    ], labels: [], revClouds: [] } },
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");

  await page.getByRole("button", { name: "◫", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="front"]') }).first().selectOption("front");
  const elev = page.locator("svg").filter({ hasText: "FRONT ELEVATION" });
  await expect(elev).toBeVisible();

  // Select the dim (click its line), then drag the p1 handle to a new spot.
  await page.getByTestId("elev-dim-label-d1").click({ force: true });
  const handle = elev.locator("circle").first(); // p1/p2 grab handles appear only while selected
  const hbox = await handle.boundingBox();
  await page.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hbox.x + 60, hbox.y - 40, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(900);

  const m = await readModel(page);
  const d = m.elevAnnotations.front.dims[0];
  // Exactly one endpoint detached (whichever handle was actually grabbed); the other keeps
  // its anchor — a manual drag only overrides the point you touched.
  const detached = [d.a1, d.a2].filter(a => a === null).length;
  expect(detached).toBe(1);
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

test("Flow Path + Floor Region are Build-only: rail buttons hide and K/A shortcuts are inert elsewhere", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // Build mode (default): both tools are in the rail, and the shortcut actually activates
  // the tool (drawing a 2-point flow path, closed with Enter, lands in the model).
  await expect(page.getByTestId("tool-flowpath")).toBeVisible();
  await expect(page.getByTestId("tool-floorregion")).toBeVisible();
  await page.keyboard.press("k");
  await page.mouse.click(cx - 60, cy);
  await page.mouse.click(cx + 60, cy);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  expect((await readModel(page)).flowPaths || []).toHaveLength(1);

  // Switch to IT/MEP: the buttons disappear from the rail.
  await page.keyboard.press("2");
  await expect(page.getByTestId("tool-flowpath")).toHaveCount(0);
  await expect(page.getByTestId("tool-floorregion")).toHaveCount(0);

  // K/A no longer activate the tools — clicking empty canvas (off the existing flow path,
  // so there's no ambiguity with select-clicking it) commits nothing new.
  await page.keyboard.press("k");
  await page.mouse.click(cx - 150, cy - 150);
  await page.keyboard.press("a");
  await page.mouse.click(cx - 120, cy - 150);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);

  const m = await readModel(page);
  expect(m.flowPaths || []).toHaveLength(1);   // unchanged from the Build-mode draw above
  expect(m.floorRegions || []).toHaveLength(0); // never created — A was inert here
});

test("planning-view layer presets mirror Docs: one click sets the layer visibility", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);
  // A room so Floors + walls have content (visibility is state, but keep it realistic).
  await page.keyboard.press("r");
  await page.mouse.click(cx - 140, cy - 90);
  await page.mouse.click(cx + 140, cy + 90);
  await page.keyboard.press("v");

  const active = (id) => page.getByTestId("plan-layer-preset-" + id);
  const rowEyeOff = (key) => page.getByTestId("plan-layer-row-" + key).locator("svg.lucide-eye-off");
  const rowEyeOn = (key) => page.getByTestId("plan-layer-row-" + key).locator("svg.lucide-eye");

  // Default: everything on → "All" is the active preset.
  await expect(active("all")).toHaveAttribute("data-active", "true");
  await expect(rowEyeOn("zones")).toHaveCount(1);

  // Dimensioned: grid + dims + floors + labels + revClouds ON; zones + flowPaths + rulers OFF.
  await active("dimensioned").click();
  await expect(active("dimensioned")).toHaveAttribute("data-active", "true");
  await expect(active("all")).not.toHaveAttribute("data-active", "true");
  await expect(rowEyeOn("dims")).toHaveCount(1);
  await expect(rowEyeOn("floorRegions")).toHaveCount(1);
  await expect(rowEyeOff("zones")).toHaveCount(1);
  await expect(rowEyeOff("flowPaths")).toHaveCount(1);

  // Electrical: master IT/MEP comes on (device layers shown); dims + zones off.
  await active("electrical").click();
  await expect(active("electrical")).toHaveAttribute("data-active", "true");
  await expect(rowEyeOn("itmep")).toHaveCount(1);
  await expect(rowEyeOff("dims")).toHaveCount(1);

  // Clean: floors only — Zones/Dimensions/Grid/IT-MEP all off.
  await active("clean").click();
  await expect(active("clean")).toHaveAttribute("data-active", "true");
  await expect(rowEyeOn("floorRegions")).toHaveCount(1);
  await expect(rowEyeOff("itmep")).toHaveCount(1);
  await expect(rowEyeOff("grid")).toHaveCount(1);

  // All: restores every layer.
  await active("all").click();
  await expect(active("all")).toHaveAttribute("data-active", "true");
  await expect(rowEyeOn("zones")).toHaveCount(1);
  await expect(rowEyeOn("itmep")).toHaveCount(1);
  await expect(rowEyeOn("grid")).toHaveCount(1);
});

test("the plan grid coarsens as you zoom out, so it stays a scale reference", async ({ page }) => {
  await page.goto("/");
  const grid = page.getByTestId("plan-grid-base");
  const zoomPct = async () => {
    const txt = await page.getByTestId("app-statusbar").innerText();
    return Number(txt.match(/ZOOM\s*(\d+)%/)[1]);
  };

  // Default zoom (100%): the grid is at its finest, 1' pitch.
  await expect(grid).toHaveAttribute("data-grid-step", "1");

  // Zoom out below 60% (three Ctrl+- presses land ~58%) → 5' pitch.
  for (let i = 0; i < 3; i++) await page.keyboard.press("Control+-");
  expect(await zoomPct()).toBeLessThan(60);
  expect(await zoomPct()).toBeGreaterThanOrEqual(40);
  await expect(grid).toHaveAttribute("data-grid-step", "5");

  // Zoom out below 40% (three more presses, ~34% total) → 10' pitch.
  for (let i = 0; i < 3; i++) await page.keyboard.press("Control+-");
  expect(await zoomPct()).toBeLessThan(40);
  await expect(grid).toHaveAttribute("data-grid-step", "10");

  // Zooming back in restores the fine grid.
  for (let i = 0; i < 6; i++) await page.keyboard.press("Control+=");
  await expect(grid).toHaveAttribute("data-grid-step", "1");
});

test("plan line weights follow the 100% look: magnified above 100%, pinned below it", async ({ page }) => {
  const seed = {
    version: "testfit-v17", pxPerFoot: 20,
    nodes: [
      { id: "a", x: 400, y: 300 }, { id: "b", x: 700, y: 300 },
      { id: "c", x: 700, y: 500 }, { id: "d", x: 400, y: 500 },
    ],
    walls: [
      { id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
      { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" },
    ],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");

  // The whole live-editing canvas renders through one `scale(zoom)` group; a wall edge's
  // strokeWidth attribute is a plain literal (1.5) with no per-zoom math of its own. Line
  // weights follow the 100% look: ABOVE 100% the canvas is a magnifier (no vector-effect,
  // strokes scale with their geometry); BELOW 100% `vector-effect: non-scaling-stroke` pins
  // them to the 100% screen weight so edges don't fade to hairlines. So the meaningful
  // assertion is that the pin is wired up exactly when zoomed out (class present, computed
  // style resolves) and absent when zoomed in — not a pixel measurement, which
  // getBoundingClientRect doesn't reliably expose for a zero-height <line>'s stroke paint.
  const wallEdgeStyle = () => page.evaluate(() => {
    const line = [...document.querySelectorAll('[data-testid="plan-canvas"] line[stroke-width="1.5"]')]
      .find(l => l.getAttribute("y1") === l.getAttribute("y2"));
    return line && { ve: getComputedStyle(line).vectorEffect, sw: line.getAttribute("stroke-width") };
  });
  // At exactly 100% nothing is pinned — the reference look.
  await expect(page.locator('[data-testid="plan-canvas"] g.tf-const-stroke')).toHaveCount(0);
  expect(await wallEdgeStyle()).toEqual({ ve: "none", sw: "1.5" });

  for (let i = 0; i < 8; i++) await page.keyboard.press("Control+="); // 100% → clamps at 400%
  await expect(page.locator('[data-testid="plan-canvas"] g.tf-const-stroke')).toHaveCount(0);
  expect(await wallEdgeStyle()).toEqual({ ve: "none", sw: "1.5" });

  for (let i = 0; i < 16; i++) await page.keyboard.press("Control+-"); // 400% → well under 100%
  await expect(page.locator('[data-testid="plan-canvas"] g.tf-const-stroke')).toHaveCount(1);
  expect(await wallEdgeStyle()).toEqual({ ve: "non-scaling-stroke", sw: "1.5" });
  // A flow path's walkway band is a WIDTH (36"), not a line weight: it always scales.
  expect(await page.evaluate(() => {
    const band = [...document.querySelectorAll('[data-testid="plan-canvas"] path')].find(p => Number(p.getAttribute("stroke-width")) > 20);
    return band ? getComputedStyle(band).vectorEffect : "no-band";
  })).toMatch(/none|no-band/);

  // Docs/print rendering reuses the same draw code at a fixed architectural-scale zoom,
  // where line weights SHOULD stay proportional to the drawing — it must NOT pick up the
  // constant-weight override meant only for live editing.
  await page.getByTestId("save-to-docs-0").click();
  await page.keyboard.press("6");
  await expect(page.getByTestId("docs-slide-canvas")).toBeVisible();
  await expect(page.locator('[data-testid="docs-slide-canvas"] g.tf-const-stroke')).toHaveCount(0);
});

test("dimension text grows as you zoom out, so it stays readable on screen", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "DimText" })), CARRY_ROOM);
  await page.goto("/");

  // A wall dimension's on-screen height = its font-size attribute x the canvas zoom. Read the
  // attribute and multiply, rather than trusting a bounding box for rotated SVG text.
  const onScreenPx = async () => page.evaluate(() => {
    const g = document.querySelector('[data-testid="plan-canvas"] g[transform*="scale"]');
    const z = parseFloat(g.getAttribute("transform").match(/scale\(([\d.]+)\)/)[1]);
    const t = [...document.querySelectorAll('[data-testid="plan-canvas"] text')]
      .find(el => /^\d+'-\d+"$/.test(el.textContent.trim()));
    return t ? parseFloat(t.getAttribute("font-size")) * z : null;
  });

  const at100 = await onScreenPx();
  expect(at100).toBeGreaterThan(0);

  for (let i = 0; i < 5; i++) await page.keyboard.press("Control+-");   // ~40%
  const zoomedOut = await onScreenPx();
  expect(zoomedOut).toBeCloseTo(at100, 1);   // same on-screen size, not 40% of it

  // Zooming IN is deliberately left alone — text is already comfortable there.
  for (let i = 0; i < 10; i++) await page.keyboard.press("Control+=");
  const zoomedIn = await onScreenPx();
  expect(zoomedIn).toBeGreaterThan(at100);
});

test("rect room shows clear-inside dims: draw ghost + floor-region inspector", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // 16' × 11' centerline rect at 20 px/ft; 7" walls → clear inside 15'-5" × 10'-5" ≈ 161 sf.
  await page.keyboard.press("r");
  await page.mouse.click(cx - 160, cy - 110);
  await page.mouse.move(cx + 160, cy + 110);
  await expect(page.getByTestId("plan-canvas")).toContainText("176 sf");
  await expect(page.getByTestId("plan-canvas")).toContainText("161 sf clear");
  await page.mouse.click(cx + 160, cy + 110);
  await page.keyboard.press("v");

  // Select the auto floor region → inspector shows centerline AND clear areas.
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId("floor-clear-sf")).toContainText("161 sf");
});

test("selected zone overlays the clear-inside outline with exact per-edge dims", async ({ page }) => {
  // Seed a 16'×11' walled room with a zone whose edges sit ON the wall centerlines —
  // selecting the zone must dash the inside-face outline and dimension it 15'-5" × 10'-5".
  const seed = {
    version: "testfit-v16", pxPerFoot: 20,
    nodes: [
      { id: "a", x: 400, y: 300 }, { id: "b", x: 720, y: 300 },
      { id: "c", x: 720, y: 520 }, { id: "d", x: 400, y: 520 },
    ],
    walls: [
      { id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
      { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" },
    ],
    zones: [{ id: "z1", type: "entry", label: "Entry", phase: "existing",
      points: [{ x: 400, y: 300 }, { x: 720, y: 300 }, { x: 720, y: 520 }, { x: 400, y: 520 }] }],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");

  await page.keyboard.press("3"); // Zones stage
  // Select the zone via its sidebar row ("Entry" + "176 sf") — deterministic vs. canvas coords.
  await page.locator("div").filter({ hasText: /^Entry176 sf$/ }).click();
  await expect(page.getByTestId("zone-clear-sf")).toContainText("161 sf");
  await expect(page.getByTestId("plan-canvas").getByText("15'-5\"").first()).toBeVisible();
  await expect(page.getByTestId("plan-canvas").getByText("10'-5\"").first()).toBeVisible();
});

test("Furnish stage (4): place a parametric furniture piece, then edit + persist it", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  const { cx, cy } = await planCenter(page);

  // Stage 4 is Furnish; its sidebar shows the furniture catalog.
  await page.keyboard.press("4");
  await expect(page.getByTitle("Workflow stage (1–6)")).toContainText("Furnish");
  await expect(page.locator("text=SEATING").first()).toBeVisible();

  // Arm a Desk from the catalog, drop it on the canvas.
  await page.getByRole("button", { name: /Desk/ }).first().click();
  await page.mouse.click(cx, cy);

  // It persists to the model as a furniture record with catalog defaults (5' × 2.5').
  await expect.poll(async () => (await readModel(page)).furniture?.length).toBe(1);
  let f = (await readModel(page)).furniture[0];
  expect(f.type).toBe("desk");
  expect(f).toMatchObject({ w: 5, d: 2.5, angle: 0 });

  // Placing selects it → the inspector exposes Width/Depth/Rotation + Delete.
  await expect(page.locator("text=Delete Furniture")).toBeVisible();

  // The Furniture layer row reflects the count.
  await expect(page.locator("div").filter({ hasText: /^Furniture1$/ }).first()).toBeVisible();

  // Re-select on the canvas (this sets selectedIds, routing delete through the multi-select
  // path) then delete via the keyboard — the path a user actually takes.
  await page.keyboard.press("v");
  await page.mouse.click(cx, cy);
  await expect(page.locator("text=Delete Furniture")).toBeVisible();
  await page.keyboard.press("Delete");
  await expect.poll(async () => (await readModel(page)).furniture?.length).toBe(0);
});

test("Furnish this zone: drops the zone type's furniture set, arranged, idempotent", async ({ page }) => {
  const seed = {
    version: "testfit-v17", pxPerFoot: 20,
    nodes: [{ id: "a", x: 200, y: 150 }, { id: "b", x: 1000, y: 150 }, { id: "c", x: 1000, y: 750 }, { id: "d", x: 200, y: 750 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
    zones: [{ id: "z1", type: "softseating", label: "Soft Seating", phase: "existing",
      points: [{ x: 300, y: 250 }, { x: 760, y: 250 }, { x: 760, y: 640 }, { x: 300, y: 640 }] }],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  await page.keyboard.press("3"); // Zones stage
  await page.locator("div").filter({ hasText: /^Soft Seating/ }).first().click();

  await page.getByTestId("furnish-zone").click();
  // Soft Seating plan = sofa + 2 chairs + coffee + side table + 2 lamps = 7 pieces, tagged.
  await expect.poll(async () => (await readModel(page)).furniture?.length).toBe(7);
  expect((await readModel(page)).furniture.every(f => f.fromZone === "z1")).toBe(true);
  // re-furnishing replaces (never piles up)
  await page.getByTestId("furnish-zone").click();
  await expect.poll(async () => (await readModel(page)).furniture?.length).toBe(7);
});

test("furniture: copy/paste + alt-drag duplicate + '/' repeat behave like other symbols", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  await page.keyboard.press("4"); // Furnish
  const { cx, cy } = await planCenter(page);
  const count = async () => (await readModel(page)).furniture?.length ?? 0;

  await page.getByRole("button", { name: /Desk/ }).first().click(); // arm Desk
  await page.mouse.click(cx, cy);
  await expect.poll(count).toBe(1);

  // Ctrl/Cmd+C then +V duplicates the selected piece.
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect.poll(count).toBe(2);

  // Alt-drag the original → a dragged copy; this also arms "/" (records the delta).
  await page.mouse.click(cx, cy);
  await page.keyboard.down("Alt");
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 50, cy); await page.waitForTimeout(140);
  await page.mouse.move(cx + 160, cy, { steps: 8 }); await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect.poll(count).toBe(3);

  // "/" 3 Enter → distribute 3 more copies along the alt-drag vector.
  await page.keyboard.press("/");
  await page.keyboard.press("3");
  await page.keyboard.press("Enter");
  await expect.poll(count, { timeout: 3000 }).toBe(6);
  expect((await readModel(page)).furniture.every(f => f.type === "desk" && !f.fromZone)).toBe(true);
});

test("Mono skin options live in the topbar split-button dropdown, not the sidebar", async ({ page }) => {
  await page.goto("/");
  await newProject(page);
  // The skin panel is not in the sidebar — it's behind the Mono chevron.
  await expect(page.getByTestId("mono-skin-panel")).toHaveCount(0);
  await expect(page.getByTestId("mono-toggle")).toHaveAttribute("data-mono", "off");

  await page.getByTestId("mono-menu").click();
  await expect(page.getByTestId("mono-skin-panel")).toBeVisible();

  // Picking a preset from the dropdown applies it and turns Mono on so it's visible.
  await page.getByTestId("mono-preset-blueprint").click();
  await expect(page.getByTestId("mono-toggle")).toHaveAttribute("data-mono", "on");
});

test("selection respects the mode: a Build-only floor region isn't selectable in IT/MEP", async ({ page }) => {
  const seed = {
    version: "testfit-v17", pxPerFoot: 20,
    nodes: [{ id: "a", x: 200, y: 150 }, { id: "b", x: 1000, y: 150 }, { id: "c", x: 1000, y: 750 }, { id: "d", x: 200, y: 750 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
    floorRegions: [{ id: "fr1", material: "Wood", phase: "existing",
      points: [{ x: 350, y: 300 }, { x: 850, y: 300 }, { x: 850, y: 600 }, { x: 350, y: 600 }] }],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  const { cx, cy } = await planCenter(page);
  const stage = page.getByTitle("Workflow stage (1–6)");

  // IT/MEP mode: clicking the floor region (a Build-only item) must NOT select it.
  await page.keyboard.press("2");
  await expect(stage).toContainText("IT/MEP");
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId("room-title")).toHaveCount(0);

  // Build mode: the same click selects it (its "Room · <n> sf" inspector appears).
  await page.keyboard.press("1");
  await expect(stage).toContainText("Build");
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId("room-title")).toBeVisible();
});

test("outlets are stored on the wall centerline but drawn standing off it, into the room", async ({ page }) => {
  // A closed room; its walls wind so the interior normal is consistently the +1 side.
  const seed = {
    version: "testfit-v17", projectName: "Outlets", pxPerFoot: 20,
    nodes: [{ id: "a", x: 200, y: 160 }, { id: "b", x: 640, y: 160 },
            { id: "c", x: 640, y: 480 }, { id: "d", x: 200, y: 480 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("2"); // IT/MEP

  // Drop a duplex just inside each of the four walls — every wall orientation.
  for (const [x, y] of [[300, 200], [300, 440], [240, 300], [600, 300]]) {
    await page.keyboard.press("e");
    await page.getByText("Duplex", { exact: true }).click();
    await page.mouse.click(box.x + x, box.y + y);
  }
  await expect.poll(async () => (await readModel(page)).markers?.length ?? 0).toBe(4);

  const m = await readModel(page);
  const OFF = (3.5 / 12) * 20 + 12;           // wallDeviceOffsetPx at 20 px/ft
  const room = { x: 420, y: 320 };            // room center
  for (const k of m.markers) {
    // Stored ON the centerline — that's what elevation/3D/dims read.
    expect(Math.abs(k.x - 200) < 1 || Math.abs(k.x - 640) < 1 ||
           Math.abs(k.y - 160) < 1 || Math.abs(k.y - 480) < 1).toBe(true);
    expect(k.side).toBeDefined();
    // Drawn offset perpendicular to its wall, and always toward the room's interior.
    const a = k.angle || 0;
    const dx = -Math.sin(a) * k.side * OFF, dy = Math.cos(a) * k.side * OFF;
    expect(Math.hypot(dx, dy)).toBeCloseTo(OFF, 5);
    expect((room.x - k.x) * dx + (room.y - k.y) * dy).toBeGreaterThan(0); // points inward
  }
});

test("an outlet is selected by clicking the symbol where it's drawn, not the wall it sits on", async ({ page }) => {
  const seed = {
    version: "testfit-v17", projectName: "OutletPick", pxPerFoot: 20,
    nodes: [{ id: "a", x: 200, y: 160 }, { id: "b", x: 640, y: 160 },
            { id: "c", x: 640, y: 480 }, { id: "d", x: 200, y: 480 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("2");

  await page.keyboard.press("e");
  await page.getByText("Duplex", { exact: true }).click();
  await page.mouse.click(box.x + 300, box.y + 200);   // top wall, clicked from inside
  await expect.poll(async () => (await readModel(page)).markers?.length ?? 0).toBe(1);
  const mk = (await readModel(page)).markers[0];

  // Clear the selection, then click the DRAWN symbol (offset into the room).
  await page.mouse.click(box.x + 450, box.y + 320);
  await expect(page.getByText(/Duplex Outlet/)).toHaveCount(0);
  const OFF = (3.5 / 12) * 20 + 12;
  await page.mouse.click(box.x + mk.x, box.y + mk.y + OFF * mk.side);
  await expect(page.getByText(/Duplex Outlet/).first()).toBeVisible();
});

test("Build mode can't select or move IT/MEP components — not even by marquee", async ({ page }) => {
  // A camera (security layer, IT/MEP-only) and a duplex outlet (power layer, shared with
  // Build) sitting side by side, so one marquee covers both.
  const seed = {
    version: "testfit-v17", projectName: "ModeDrag", pxPerFoot: 20,
    nodes: [{ id: "a", x: 200, y: 160 }, { id: "b", x: 640, y: 160 },
            { id: "c", x: 640, y: 480 }, { id: "d", x: 200, y: 480 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
    markers: [
      { id: "cam", layer: "security", componentType: "camera_indoor", x: 380, y: 300, angle: 0, label: "Indoor Camera", phase: "existing" },
      { id: "out", layer: "power", componentType: "outlet_duplex", x: 300, y: 160, angle: 0, side: 1, label: "Duplex Outlet (In-Wall)", phase: "existing" },
    ],
  };
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), seed);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);
  const camAt = (m) => m.markers.find(k => k.id === "cam");

  // Build mode: marquee over open floor that encloses the camera.
  await expect(page.getByTitle("Workflow stage (1–6)")).toContainText("Build");
  await page.mouse.move(box.x + 330, box.y + 250);
  await page.mouse.down();
  await page.mouse.move(box.x + 430, box.y + 350, { steps: 8 });
  await page.mouse.up();
  // Nudge whatever got selected.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(900);
  expect(camAt(await readModel(page)).x).toBe(camAt(before).x); // camera never moved

  // IT/MEP mode: the same marquee + nudge DOES move it — the component is editable there.
  await page.keyboard.press("2");
  await page.mouse.move(box.x + 330, box.y + 250);
  await page.mouse.down();
  await page.mouse.move(box.x + 430, box.y + 350, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => camAt(await readModel(page)).x).toBeGreaterThan(camAt(before).x);
});

// A closed room whose winding makes the interior the +1 side of every wall.
const ROOM_SEED = {
  version: "testfit-v17", pxPerFoot: 20,
  nodes: [{ id: "a", x: 200, y: 160 }, { id: "b", x: 640, y: 160 },
          { id: "c", x: 640, y: 480 }, { id: "d", x: 200, y: 480 }],
  walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
          { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
};

test("lighting drops the linear fixtures, and already-placed ones don't survive a load", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({
    ...s, projectName: "Linear",
    markers: [
      { id: "l2", layer: "power", componentType: "light_linear_2", x: 300, y: 300, angle: 0, phase: "existing" },
      { id: "l4", layer: "power", componentType: "light_linear_4", x: 400, y: 300, angle: 0, phase: "existing" },
      { id: "can", layer: "power", componentType: "light_can_4", x: 500, y: 300, angle: 0, phase: "existing" },
    ],
  })), ROOM_SEED);
  await page.goto("/");
  await page.keyboard.press("2");
  await page.keyboard.press("l");

  // Retired from the palette…
  await expect(page.getByText("Linear 2'", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Linear 4'", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sconce", { exact: true })).toHaveCount(1);
  // …and any already-placed ones are dropped on load, leaving the still-valid can.
  await expect.poll(async () => (await readModel(page)).markers.map(m => m.id)).toEqual(["can"]);
});

test("a sconce records the room it lights, so plan shows both its wall and its throw", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "Sconce" })), ROOM_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("2");

  for (const [x, y] of [[300, 200], [240, 300], [600, 300]]) {   // inside the top/left/right walls
    await page.keyboard.press("l");
    await page.getByText("Sconce", { exact: true }).click();
    await page.mouse.click(box.x + x, box.y + y);
  }
  await expect.poll(async () => (await readModel(page)).markers?.length ?? 0).toBe(3);

  const OFF = (3.5 / 12) * 20 + 12;
  const room = { x: 420, y: 320 };
  for (const k of (await readModel(page)).markers) {
    expect(k.componentType).toBe("light_sconce");
    expect(k.side).toBeDefined();
    const a = k.angle || 0;
    const dx = -Math.sin(a) * k.side * OFF, dy = Math.cos(a) * k.side * OFF;
    expect((room.x - k.x) * dx + (room.y - k.y) * dy).toBeGreaterThan(0); // offset + throw point inward
  }
});

test("wall devices get a mount-height slider that starts at the industry standard and persists", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({
    ...s, projectName: "Heights",
    markers: [
      { id: "o1", layer: "power", componentType: "outlet_duplex", x: 300, y: 160, angle: 0, side: 1, label: "Duplex Outlet (In-Wall)", phase: "existing" },
      { id: "c1", layer: "power", componentType: "light_can_4", x: 420, y: 320, angle: 0, label: "4\" Recessed Can", phase: "existing" },
    ],
  })), ROOM_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("2");

  // Wall-mounted outlet → slider, defaulting to the 18" receptacle standard.
  const OFF = (3.5 / 12) * 20 + 12;
  await page.mouse.click(box.x + 300, box.y + 160 + OFF);
  await expect(page.getByText("Mount Height (AFF)")).toBeVisible();
  const slider = page.locator("input[type=range]").last();
  await expect(slider).toHaveValue("18");
  await expect(slider).toHaveAttribute("max", "106");   // ceiling 108" − 2

  await slider.fill("42");
  await expect.poll(async () => (await readModel(page)).markers.find(m => m.id === "o1").mountY).toBe(42);
  await expect(page.getByText(/standard 18"/)).toBeVisible();

  // Reset drops the override so the device follows the catalog standard again.
  await page.getByRole("button", { name: "Reset" }).click();
  await expect.poll(async () => (await readModel(page)).markers.find(m => m.id === "o1").mountY ?? null).toBeNull();

  // A ceiling fixture has no wall to measure from — no slider.
  await page.mouse.click(box.x + 420, box.y + 320);
  await expect(page.getByText(/Recessed Can/).first()).toBeVisible();
  await expect(page.getByText("Mount Height (AFF)")).toHaveCount(0);
});

test("moving a zone carries the furniture inside it, and leaves everything else put", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({
    ...s, projectName: "ZoneCarry",
    zones: [{ id: "z1", type: "ops", label: "Ops", x: 260, y: 220, w: 200, h: 160, phase: "existing" }],
    furniture: [
      { id: "inA", type: "desk",       x: 300, y: 260, angle: 0, w: 5, d: 2.5, phase: "existing" },
      { id: "inB", type: "task_chair", x: 420, y: 340, angle: 0, w: 2, d: 2,   phase: "existing" },
      { id: "out", type: "task_chair", x: 600, y: 420, angle: 0, w: 2, d: 2,   phase: "existing" },
    ],
  })), ROOM_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("3"); // Zones

  const before = await readModel(page);
  const posOf = (m, id) => { const f = m.furniture.find(x => x.id === id); return { x: f.x, y: f.y }; };

  // Grab the zone body (not an edge) and drag it.
  await page.mouse.move(box.x + 360, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 340, { steps: 10 });
  await page.mouse.move(box.x + 440, box.y + 380, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).zones[0].x).toBeGreaterThan(before.zones[0].x);
  const after = await readModel(page);
  const dx = after.zones[0].x - before.zones[0].x, dy = after.zones[0].y - before.zones[0].y;
  expect(dx).not.toBe(0);

  // Both enclosed pieces shifted by exactly the zone's delta — the layout arrives intact.
  for (const id of ["inA", "inB"]) {
    expect(posOf(after, id).x - posOf(before, id).x).toBe(dx);
    expect(posOf(after, id).y - posOf(before, id).y).toBe(dy);
  }
  // The piece outside the zone never moved.
  expect(posOf(after, "out")).toEqual(posOf(before, "out"));
});

test("a locked furniture layer opts out of the zone carry", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({
    ...s, projectName: "ZoneCarryLocked",
    zones: [{ id: "z1", type: "ops", label: "Ops", x: 260, y: 220, w: 200, h: 160, phase: "existing" }],
    furniture: [{ id: "inA", type: "desk", x: 300, y: 260, angle: 0, w: 5, d: 2.5, phase: "existing" }],
  })), ROOM_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("3");

  // Lock the Furniture layer via the padlock in its layer row.
  await page.getByTestId("plan-layer-row-furniture").getByTitle("Lock layer").click();
  await expect(page.getByTestId("plan-layer-row-furniture").getByTitle(/Locked/)).toBeVisible();

  const before = await readModel(page);
  await page.mouse.move(box.x + 360, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 440, box.y + 380, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).zones[0].x).toBeGreaterThan(before.zones[0].x);
  const after = await readModel(page);
  expect(after.furniture[0].x).toBe(before.furniture[0].x); // locked → stayed
  expect(after.furniture[0].y).toBe(before.furniture[0].y);
});

test("a polygon zone carries its furniture too", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({
    ...s, projectName: "PolyCarry",
    zones: [{ id: "z1", type: "cafe", label: "Cafe", phase: "existing",
      points: [{ x: 260, y: 220 }, { x: 460, y: 220 }, { x: 460, y: 380 }, { x: 260, y: 380 }] }],
    furniture: [
      { id: "in",  type: "cafe_table", x: 340, y: 300, angle: 0, w: 3, d: 3, phase: "existing" },
      { id: "out", type: "cafe_table", x: 600, y: 300, angle: 0, w: 3, d: 3, phase: "existing" },
    ],
  })), ROOM_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("3");

  const before = await readModel(page);
  const cxOf = (m) => m.zones[0].points.reduce((s, p) => s + p.x, 0) / m.zones[0].points.length;

  await page.mouse.move(box.x + 360, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 420, box.y + 360, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => cxOf(await readModel(page))).toBeGreaterThan(cxOf(before));
  const after = await readModel(page);
  const dx = cxOf(after) - cxOf(before);
  const dy = after.zones[0].points[0].y - before.zones[0].points[0].y;

  const at = (m, id) => m.furniture.find(f => f.id === id);
  expect(at(after, "in").x - at(before, "in").x).toBeCloseTo(dx, 6);
  expect(at(after, "in").y - at(before, "in").y).toBeCloseTo(dy, 6);
  expect(at(after, "out").x).toBe(at(before, "out").x);
});


// Smoke coverage: a furnished, wired plan driven through every stage and view while
// watching the console — the cheapest guard against a whole-view render regression.
const SMOKE_SEED = {
  version: "testfit-v17", projectName: "Smoke", pxPerFoot: 20,
  nodes: [{ id: "a", x: 200, y: 160 }, { id: "b", x: 640, y: 160 },
          { id: "c", x: 640, y: 480 }, { id: "d", x: 200, y: 480 }],
  walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "new" },
          { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "pony" }],
  doors: [{ id: "d1", x: 400, y: 480, angle: 0, width: 36, doorType: "Wood", phase: "existing" }],
  windows: [{ id: "wi1", x: 400, y: 160, angle: 0, width: 48, height: 48, sill: 36, type: "Window", phase: "existing" }],
  zones: [{ id: "z1", type: "cafe", label: "Cafe", x: 260, y: 220, w: 200, h: 160, phase: "existing" }],
  furniture: [{ id: "f1", type: "cafe_table", x: 340, y: 300, angle: 0, w: 3, d: 3, phase: "existing" },
              { id: "f2", type: "task_chair", x: 400, y: 340, angle: 0.5, w: 2, d: 2, phase: "existing" }],
  markers: [
    { id: "o1", layer: "power", componentType: "outlet_duplex", x: 300, y: 160, angle: 0, side: 1, mountY: 18, label: "Duplex", phase: "existing" },
    { id: "s1", layer: "power", componentType: "switch_single", x: 500, y: 480, angle: Math.PI, side: 1, label: "Switch", phase: "existing" },
    { id: "sc", layer: "power", componentType: "light_sconce", x: 200, y: 300, angle: -Math.PI / 2, side: 1, label: "Sconce", phase: "existing" },
    { id: "ca", layer: "power", componentType: "light_can_4", x: 420, y: 300, angle: 0, label: "Can", phase: "existing" },
    { id: "cam", layer: "security", componentType: "camera_indoor", x: 640, y: 300, angle: Math.PI / 2, label: "Cam", phase: "existing" },
    // legacy shapes: a marker with no `side` (pre-offset) and one with a retired type
    { id: "old", layer: "power", componentType: "outlet_quad", x: 300, y: 480, angle: Math.PI, label: "Legacy", phase: "existing" },
    { id: "gone", layer: "power", componentType: "light_linear_4", x: 350, y: 300, angle: 0, label: "Retired", phase: "existing" },
  ],
};

test("smoke: every stage and view renders clean", async ({ page }) => {
  test.setTimeout(180000);
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));

  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), SMOKE_SEED);
  await page.goto("/");
  await expect(page.getByTestId("plan-canvas")).toBeVisible();

  for (const [key, name] of [["1", "Build"], ["2", "IT/MEP"], ["3", "Zones"], ["4", "Furnish"], ["5", "Budget"], ["6", "Docs"]]) {
    await page.keyboard.press(key);
    await expect(page.getByTitle("Workflow stage (1–6)")).toContainText(name);
    await page.waitForTimeout(180);
  }
  await page.keyboard.press("1");

  for (const v of ["3d", "iso", "front", "plan"]) {
    await page.locator("select").first().selectOption(v);
    await page.waitForTimeout(700);
  }
  // Mono + Print skins over the plan
  await page.getByTestId("mono-toggle").click().catch(() => {});
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Print", exact: true }).click().catch(() => {});
  await page.waitForTimeout(400);

  expect(errs).toEqual([]);
});

test("smoke: hidden IT/MEP components are no longer clickable", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), SMOKE_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("2");

  // "Delete Component" only renders for a SELECTED marker — an unambiguous signal
  // ("Indoor Camera" also appears in the sidebar's placed-components list either way).
  const selected = page.getByRole("button", { name: "Delete Component" });
  await page.mouse.click(box.x + 640, box.y + 300);
  await expect(selected).toBeVisible();

  // Hide the IT/MEP layer, then click the same spot — nothing should select.
  await page.mouse.click(box.x + 500, box.y + 250);            // clear selection
  await page.getByTestId("plan-layer-row-itmep").getByTitle("Hide layer").click();
  await expect(page.getByTestId("plan-layer-row-itmep").getByTitle("Show layer")).toBeVisible();
  await page.mouse.click(box.x + 640, box.y + 300);
  await expect(selected).toHaveCount(0);
});

// ── Room resize carries its floor and zone ────────────────────────────────────
// A floorRegion holds no reference to the walls it was drawn against, so the binding is
// positional: corners sitting ON a node come along when that node moves.
const CARRY_ROOM = {
  version: "testfit-v17", pxPerFoot: 20,
  nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 400, y: 200 },
          { id: "c", x: 400, y: 400 }, { id: "d", x: 200, y: 400 }],
  walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
          { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
  floorRegions: [{ id: "f1", material: "Wood", label: "", phase: "existing",
    points: [{ x: 200, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 400 }, { x: 200, y: 400 }] }],
};
const sortPts = (pts) => [...pts].map(p => [Math.round(p.x), Math.round(p.y)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
// The invariant that matters: the floor's corners still sit on the room's nodes.
const floorMatchesRoom = (m) => expect(sortPts(m.floorRegions[0].points)).toEqual(sortPts(m.nodes));

test("closing the last wall of a room gives it a floor automatically", async ({ page }) => {
  // Three walls of a square, pre-seeded — the room is still open, so no floor yet.
  await page.addInitScript(() => localStorage.setItem("testfit-autosave", JSON.stringify({
    version: "testfit-v17", pxPerFoot: 20, projectName: "AutoFloor",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 400, y: 200 },
            { id: "c", x: 400, y: 400 }, { id: "d", x: 200, y: 400 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" },
            { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }],
    floorRegions: [],
  })));
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  // Opening a plan must never rewrite it: an unclosed room stays floorless.
  await expect.poll(async () => (await readModel(page)).floorRegions.length).toBe(0);

  // Draw the closing wall d→a.
  await page.keyboard.press("w");
  await page.mouse.click(box.x + 200, box.y + 400);
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.mouse.dblclick(box.x + 200, box.y + 200);
  await page.keyboard.press("Escape");

  await expect.poll(async () => (await readModel(page)).floorRegions.length).toBe(1);
  const m = await readModel(page);
  expect(sortPts(m.floorRegions[0].points)).toEqual(sortPts(m.nodes));
  expect(m.floorRegions[0].material).toBe("Wood");
});

test("a partition wall splits one room into two, and the new room gets its own floor", async ({ page }) => {
  // One 400x200 room with a floor already. Dropping a wall down the middle creates a second
  // room; only the uncovered one should gain a floor.
  await page.addInitScript(() => localStorage.setItem("testfit-autosave", JSON.stringify({
    version: "testfit-v17", pxPerFoot: 20, projectName: "Partition",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "m", x: 400, y: 200 }, { id: "b", x: 600, y: 200 },
            { id: "c", x: 600, y: 400 }, { id: "n", x: 400, y: 400 }, { id: "d", x: 200, y: 400 }],
    walls: [{ id: "w1", n1: "a", n2: "m", kind: "existing" }, { id: "w2", n1: "m", n2: "b", kind: "existing" },
            { id: "w3", n1: "b", n2: "c", kind: "existing" }, { id: "w4", n1: "c", n2: "n", kind: "existing" },
            { id: "w5", n1: "n", n2: "d", kind: "existing" }, { id: "w6", n1: "d", n2: "a", kind: "existing" }],
    // Existing floor covers the LEFT half only.
    floorRegions: [{ id: "f1", material: "Wood", label: "", phase: "existing",
      points: [{ x: 200, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 400 }, { x: 200, y: 400 }] }],
  })));
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();

  await page.keyboard.press("w");
  await page.mouse.click(box.x + 400, box.y + 200);   // m
  await page.mouse.click(box.x + 400, box.y + 400);   // n
  await page.mouse.dblclick(box.x + 400, box.y + 400);
  await page.keyboard.press("Escape");

  // The left room already had a floor and must not get a duplicate; the right one is new.
  await expect.poll(async () => (await readModel(page)).floorRegions.length).toBe(2);
  const m = await readModel(page);
  const xs = m.floorRegions.map(f => Math.min(...f.points.map(p => p.x))).sort((a, b) => a - b);
  expect(xs).toEqual([200, 400]);
});

test("the Room card assigns a zone and can take the floor away — and it stays away", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "RoomCard" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.mouse.click(box.x + 300, box.y + 300);          // inside the room → its floor
  await expect(page.getByTestId("room-title")).toContainText("Room · 100 sf");

  // Zone starts as None; picking one gives the room a zone on the floor's own outline.
  await expect(page.getByTestId("room-zone")).toHaveValue("");
  await page.getByTestId("room-zone").selectOption("kitchen");
  await expect.poll(async () => (await readModel(page)).zones?.length ?? 0).toBe(1);
  let m = await readModel(page);
  expect(m.zones[0].type).toBe("kitchen");
  expect(sortPts(m.zones[0].points)).toEqual(sortPts(m.floorRegions[0].points));

  // Material swap.
  await page.getByTestId("room-floor-Concrete").click();
  await expect.poll(async () => (await readModel(page)).floorRegions[0].material).toBe("Concrete");

  // Floor: None removes it. The room is still enclosed, so this is the case that would
  // regress if auto-floor re-ran on "is enclosed" instead of "just became enclosed".
  await page.getByTestId("room-floor-none").click();
  await expect.poll(async () => (await readModel(page)).floorRegions.length).toBe(0);
  await page.waitForTimeout(600);
  expect((await readModel(page)).floorRegions).toHaveLength(0);
  expect((await readModel(page)).zones ?? []).toHaveLength(1);  // the zone outlives the floor
});

test("opening a closed-room plan that has no floor doesn't add one", async ({ page }) => {
  // The persistence half of "None means none": on restore, every room in the file reads as
  // freshly enclosed unless the effect seeds instead of diffing. Can't be checked with
  // page.reload() in a seeded test — addInitScript re-runs and overwrites what the app saved.
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave",
    JSON.stringify({ ...s, projectName: "NoFloorOnPurpose", floorRegions: [] })), CARRY_ROOM);
  await page.goto("/");
  await page.waitForTimeout(900);
  expect((await readModel(page)).floorRegions).toHaveLength(0);
  // …and the room is genuinely closed, so this isn't passing for the wrong reason.
  expect((await readModel(page)).walls).toHaveLength(4);
});

test("dragging a wall resizes the floor with the room", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "CarryWall" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);

  await page.mouse.move(box.x + 400, box.y + 300);   // midpoint of the right wall
  await page.mouse.down();
  await page.mouse.move(box.x + 440, box.y + 300, { steps: 8 });
  await page.mouse.move(box.x + 460, box.y + 300, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).nodes.find(n => n.id === "b").x).toBeGreaterThan(400);
  const after = await readModel(page);
  const dx = after.nodes.find(n => n.id === "b").x - 400;
  expect(dx).not.toBe(0);
  expect(after.floorRegions[0].points).toHaveLength(4);
  floorMatchesRoom(after);
  // the two corners on the dragged wall moved by exactly that delta; the others didn't
  expect(after.floorRegions[0].points[1].x - before.floorRegions[0].points[1].x).toBe(dx);
  expect(after.floorRegions[0].points[2].x - before.floorRegions[0].points[2].x).toBe(dx);
  expect(after.floorRegions[0].points[0]).toEqual(before.floorRegions[0].points[0]);
  expect(after.floorRegions[0].points[3]).toEqual(before.floorRegions[0].points[3]);
});

test("dragging a corner node reshapes the floor into a matching trapezoid", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "CarryNode" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);

  await page.mouse.move(box.x + 400, box.y + 200);   // corner node b
  await page.mouse.down();
  await page.mouse.move(box.x + 450, box.y + 160, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).nodes.find(n => n.id === "b").x).toBeGreaterThan(400);
  const after = await readModel(page);
  const nb = after.nodes.find(n => n.id === "b");
  expect(after.floorRegions[0].points[1]).toEqual({ x: nb.x, y: nb.y });  // corner tracks the node
  for (const i of [0, 2, 3]) expect(after.floorRegions[0].points[i]).toEqual(before.floorRegions[0].points[i]);
  floorMatchesRoom(after);
});

test("arrow-nudging a selected wall carries the floor, at sub-grid steps too", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "CarryNudge" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();

  await page.mouse.click(box.x + 400, box.y + 300);          // select the right wall
  await page.keyboard.press("Shift+ArrowRight");             // 1 ft = 20 px
  await expect.poll(async () => (await readModel(page)).nodes.find(n => n.id === "b").x).toBe(420);
  floorMatchesRoom(await readModel(page));

  await page.keyboard.press("ArrowRight");                   // 1 in — sub-grid
  await expect.poll(async () => (await readModel(page)).nodes.find(n => n.id === "b").x).toBeCloseTo(420 + 20 / 12, 5);
  floorMatchesRoom(await readModel(page));
});

test("a locked Floors layer opts out of the resize carry", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "CarryLocked" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);
  await page.getByTestId("plan-layer-row-floorRegions").getByTitle("Lock layer").click();

  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 300, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).nodes.find(n => n.id === "b").x).toBeGreaterThan(400);
  expect((await readModel(page)).floorRegions[0].points).toEqual(before.floorRegions[0].points);
});

test("a floor that isn't part of the room stays put when the room resizes", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({
    ...s, projectName: "CarryOther",
    floorRegions: [...s.floorRegions, { id: "f2", material: "Wood", label: "", phase: "existing",
      points: [{ x: 800, y: 200 }, { x: 900, y: 200 }, { x: 900, y: 300 }, { x: 800, y: 300 }] }],
  })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);

  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 300, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).nodes.find(n => n.id === "b").x).toBeGreaterThan(400);
  const after = await readModel(page);
  const at = (m, id) => m.floorRegions.find(f => f.id === id);
  expect(at(after, "f1").points).not.toEqual(at(before, "f1").points);
  expect(at(after, "f2").points).toEqual(at(before, "f2").points);
});

test("two rooms sharing a wall: dragging it grows one floor and shrinks the other", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("testfit-autosave", JSON.stringify({
    version: "testfit-v17", projectName: "CarryShared", pxPerFoot: 20,
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 400, y: 200 }, { id: "c", x: 400, y: 400 },
            { id: "d", x: 200, y: 400 }, { id: "e", x: 600, y: 200 }, { id: "f", x: 600, y: 400 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" },
            { id: "w5", n1: "b", n2: "e", kind: "existing" }, { id: "w6", n1: "e", n2: "f", kind: "existing" },
            { id: "w7", n1: "f", n2: "c", kind: "existing" }],
    floorRegions: [
      { id: "L", material: "Wood", label: "", phase: "existing",
        points: [{ x: 200, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 400 }, { x: 200, y: 400 }] },
      { id: "R", material: "Wood", label: "", phase: "existing",
        points: [{ x: 400, y: 200 }, { x: 600, y: 200 }, { x: 600, y: 400 }, { x: 400, y: 400 }] }],
  })));
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const area = (pts) => Math.abs(pts.reduce((s, p, i) => {
    const q = pts[(i + 1) % pts.length]; return s + (p.x * q.y - q.x * p.y);
  }, 0) / 2);
  const before = await readModel(page);
  const sumBefore = area(before.floorRegions[0].points) + area(before.floorRegions[1].points);

  await page.mouse.move(box.x + 400, box.y + 300);   // the shared wall w2
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 300, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).nodes.find(n => n.id === "b").x).toBeGreaterThan(400);
  const after = await readModel(page);
  const [L, R] = ["L", "R"].map(id => after.floorRegions.find(f => f.id === id));
  expect(area(L.points)).toBeGreaterThan(area(before.floorRegions[0].points));  // grew
  expect(area(R.points)).toBeLessThan(area(before.floorRegions[1].points));     // shrank
  expect(area(L.points) + area(R.points)).toBeCloseTo(sumBefore, 5);            // total preserved
});

test("marquee-dragging a whole room moves its floor once, not twice", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "CarryMulti" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);

  await page.mouse.move(box.x + 150, box.y + 150);   // marquee the whole room
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 460, { steps: 10 });
  await page.mouse.up();
  await page.mouse.move(box.x + 300, box.y + 300);   // grab inside and drag
  await page.mouse.down();
  await page.mouse.move(box.x + 340, box.y + 300, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).nodes.find(n => n.id === "a").x).toBeGreaterThan(200);
  const after = await readModel(page);
  const nodeDx = after.nodes.find(n => n.id === "a").x - 200;
  // every floor corner moved by exactly the node delta — never 2x
  after.floorRegions[0].points.forEach((p, i) => {
    expect(p.x - before.floorRegions[0].points[i].x).toBe(nodeDx);
  });
  floorMatchesRoom(after);
});

test("alt-drag duplicating a room leaves the original's floor behind", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "CarryCopy" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);

  await page.mouse.move(box.x + 150, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 460, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 500, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await page.waitForTimeout(900);

  // The copy carries no floor of its own, but the ORIGINAL must keep the one it had.
  const after = await readModel(page);
  expect(after.floorRegions.find(f => f.id === "f1").points).toEqual(before.floorRegions[0].points);
});

// ── A room inside a room keeps its own floor ──────────────────────────────────
// Two floors used to sit stacked: the outer one spans the inner room, so its hatch showed
// through underneath and its sf counted a room it doesn't own.
const NESTED = {
  version: "testfit-v17", pxPerFoot: 20, projectName: "Nested",
  nodes: [{ id: "a", x: 160, y: 140 }, { id: "b", x: 660, y: 140 },
          { id: "c", x: 660, y: 520 }, { id: "d", x: 160, y: 520 },
          { id: "e", x: 300, y: 240 }, { id: "f", x: 500, y: 240 },
          { id: "g", x: 500, y: 400 }, { id: "h", x: 300, y: 400 }],
  walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
          { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" },
          { id: "w5", n1: "e", n2: "f", kind: "new" }, { id: "w6", n1: "f", n2: "g", kind: "new" },
          { id: "w7", n1: "g", n2: "h", kind: "new" }, { id: "w8", n1: "h", n2: "e", kind: "new" }],
  // Inner floor FIRST, so "smallest wins" is doing the work and not array order.
  floorRegions: [
    { id: "inner", material: "Carpet", label: "", phase: "existing",
      points: [{ x: 300, y: 240 }, { x: 500, y: 240 }, { x: 500, y: 400 }, { x: 300, y: 400 }] },
    { id: "outer", material: "Wood", label: "", phase: "existing",
      points: [{ x: 160, y: 140 }, { x: 660, y: 140 }, { x: 660, y: 520 }, { x: 160, y: 520 }] }],
};

test("the outer room's floor is carved out where the inner room sits", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), NESTED);
  await page.goto("/");
  // The outer floor draws as two subpaths — its ring plus the inner room knocked out by
  // fillRule evenodd. The inner floor is a plain ring; nothing is nested in it.
  const d = await page.getByTestId("floor-path-outer").getAttribute("d");
  expect(d.match(/M /g)).toHaveLength(2);
  expect(d).toContain("300,240");                       // the inner room's own corner
  expect(await page.getByTestId("floor-path-outer").getAttribute("fill-rule")).toBe("evenodd");
  expect((await page.getByTestId("floor-path-inner").getAttribute("d")).match(/M /g)).toHaveLength(1);
});

test("each room reports only its own area, carve-out excluded", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), NESTED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();

  await page.mouse.click(box.x + 220, box.y + 480);     // outer room, clear of the inner one
  // 25' × 19' = 475 centerline, less the 10' × 8' room inside it.
  await expect(page.getByTestId("room-title")).toHaveText("Room · 395 sf");

  await page.mouse.click(box.x + 400, box.y + 320);     // inside the inner room
  await expect(page.getByTestId("room-title")).toHaveText("Room · 80 sf");
});

test("clicking inside the inner room selects the inner floor, not the room around it", async ({ page }) => {
  // Both floors contain the point, and the OUTER one is stored last — first-match-wins
  // handed back the wrong room.
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), NESTED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.mouse.click(box.x + 400, box.y + 320);
  await page.getByTestId("room-floor-Vinyl").click();
  await expect.poll(async () =>
    (await readModel(page)).floorRegions.find(f => f.id === "inner").material).toBe("Vinyl");
  expect((await readModel(page)).floorRegions.find(f => f.id === "outer").material).toBe("Wood");
});

test("enclosing a room inside an already-floored room still gives it a floor", async ({ page }) => {
  // The outer room's floor covers the new room's interior point, which used to read as
  // "already floored" and denied the inner room a floor of its own.
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({
    ...s, walls: s.walls.filter(w => w.id !== "w8"),          // inner room one wall short
    floorRegions: s.floorRegions.filter(f => f.id === "outer"),
  })), NESTED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  expect((await readModel(page)).floorRegions).toHaveLength(1);

  await page.keyboard.press("w");
  await page.mouse.click(box.x + 300, box.y + 400);           // h → e closes the inner room
  await page.mouse.dblclick(box.x + 300, box.y + 240);

  await expect.poll(async () => (await readModel(page)).floorRegions.length).toBe(2);
  const added = (await readModel(page)).floorRegions.find(f => f.id !== "outer");
  expect(sortPts(added.points)).toEqual(sortPts([{ x: 300, y: 240 }, { x: 500, y: 240 },
                                                 { x: 500, y: 400 }, { x: 300, y: 400 }]));
});

// ── The grid stops at the floor ───────────────────────────────────────────────
// Resolve the mask a grid group actually points at. The id carries the canvas extent, so
// it's never a constant.
const gridMaskOf = async (page) => {
  const ref = await page.getByTestId("plan-grid").getAttribute("mask");
  expect(ref).toMatch(/^url\(#grid-floor-mask-/);
  return ref.slice(5, -1);
};
// Does the mask cover the grid it masks — both its REGION and its white field? A mask reads
// as zero outside its region, so anything the region misses is grid that silently vanishes.
const maskCoversGrid = (page, maskId) => page.evaluate((id) => {
  const m = document.getElementById(id);
  const b = document.querySelector('[data-testid="plan-grid"]').getBBox();
  const n = (el, a) => Number(el.getAttribute(a));
  const fits = (el) => n(el, "x") <= b.x && n(el, "y") <= b.y
    && n(el, "x") + n(el, "width") >= b.x + b.width
    && n(el, "y") + n(el, "height") >= b.y + b.height;
  return { region: fits(m), field: fits(m.querySelector("rect")) };
}, maskId);

test("the grid is masked out under a floor, and comes back when Floors is hidden", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), NESTED);
  await page.goto("/");
  const maskId = await gridMaskOf(page);

  // The mask must be cut from exactly the floors that render — same path strings, holes and
  // all. A mask that merely approximates the floor leaves the grid showing along the seam.
  const cut = await page.locator(`mask[id="${maskId}"] path`).evaluateAll(ns => ns.map(n => n.getAttribute("d")));
  const drawn = await Promise.all(["outer", "inner"].map(id =>
    page.getByTestId("floor-path-" + id).getAttribute("d")));
  expect(cut.sort()).toEqual(drawn.sort());
  // …over a white field, or the mask would hide the grid instead of revealing it.
  expect(await page.locator(`mask[id="${maskId}"] rect`).getAttribute("fill")).toBe("#fff");
  expect(await maskCoversGrid(page, maskId)).toEqual({ region: true, field: true });

  await page.getByTestId("plan-layer-row-floorRegions").locator("svg.lucide-eye").click();
  await expect(page.getByTestId("floor-path-outer")).toHaveCount(0);
  await expect(page.getByTestId("plan-grid")).not.toHaveAttribute("mask", /.*/);
});

test("the grid survives panning away from the plan", async ({ page }) => {
  // The mask REGION defaults to -10%,-10%,120%,120%, and under userSpaceOnUse those resolve
  // against the viewport but apply in zoomed model space — so panning past that window used
  // to drop the grid across most of the canvas, floor or no floor.
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify(s)), NESTED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.down("Space");
  await page.mouse.move(box.x + 800, box.y + 600);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up("Space");

  expect(await maskCoversGrid(page, await gridMaskOf(page))).toEqual({ region: true, field: true });
});

test("a plan with no floors leaves the grid unmasked", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave",
    JSON.stringify({ ...s, floorRegions: [] })), NESTED);
  await page.goto("/");
  await expect(page.getByTestId("plan-grid")).not.toHaveAttribute("mask", /.*/);
});

// ── New project ───────────────────────────────────────────────────────────────
test("New clears everything the model holds, not just the collections it used to list", async ({ page }) => {
  // New re-listed each collection by hand and the list drifted: furniture and columns were
  // never added, so a "new" project opened with the old ones still on the canvas.
  page.on("dialog", d => d.accept());
  await page.addInitScript(() => localStorage.setItem("testfit-autosave", JSON.stringify({
    version: "testfit-v17", pxPerFoot: 20, projectName: "Old Project",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 500, y: 200 },
            { id: "c", x: 500, y: 450 }, { id: "d", x: 200, y: 450 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
    floorRegions: [{ id: "f1", material: "Wood", label: "", phase: "existing",
      points: [{ x: 200, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 450 }, { x: 200, y: 450 }] }],
    furniture: [{ id: "fn1", type: "cafe_table", x: 300, y: 300, angle: 0, w: 3, d: 3, phase: "existing" }],
    columns: [{ id: "col1", x: 600, y: 600, size: 12, shape: "square", phase: "existing" }],
    guides: [{ id: "g1", dir: "front", pos: 300 }],
    zones: [{ id: "z1", type: "cafe", points: [{ x: 220, y: 220 }, { x: 400, y: 220 }, { x: 400, y: 400 }, { x: 220, y: 400 }] }],
    markers: [{ id: "mk1", type: "outlet", x: 250, y: 205, layer: "power", phase: "existing" }],
  })));
  await page.goto("/");
  await expect.poll(async () => (await readModel(page)).furniture.length).toBe(1);

  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect.poll(async () => (await readModel(page)).projectName).toBe("New Club");

  const m = await readModel(page);
  for (const k of ["nodes", "walls", "zones", "furniture", "markers", "doors", "windows",
                   "columns", "dims", "labels", "revClouds", "flowPaths", "floorRegions", "guides"])
    expect({ [k]: m[k] ?? [] }).toEqual({ [k]: [] });
  await expect(page.getByTestId("floor-path-f1")).toHaveCount(0);
});

// ── A placed floor is inert until double-clicked ──────────────────────────────
// A floor covers its entire room, so it sits under nearly every press inside that room.
// A plain click-drag used to slide it straight out of register with the walls.
test("dragging inside a room selects its floor but never moves it", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "FloorLock" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);

  await page.mouse.move(box.x + 300, box.y + 300);   // well inside the room, on the floor
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 340, { steps: 10 });
  await page.mouse.up();

  // Selected (Room card is up) but the shape is locked, and nothing moved.
  await expect(page.getByTestId("room-title")).toBeVisible();
  await expect(page.getByTestId("room-shape-lock")).toContainText("Locked in place");
  await page.waitForTimeout(900);
  const after = await readModel(page);
  expect(after.floorRegions[0].points).toEqual(before.floorRegions[0].points);
  expect(after.nodes).toEqual(before.nodes);
});

test("double-clicking a floor unlocks it, and then it drags", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "FloorUnlock" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const before = await readModel(page);

  await page.mouse.dblclick(box.x + 300, box.y + 300);
  await expect(page.getByTestId("room-shape-lock")).toContainText("Editing shape");

  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 300, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await readModel(page)).floorRegions[0].points[0].x).toBe(before.floorRegions[0].points[0].x + 80);
  const after = await readModel(page);
  after.floorRegions[0].points.forEach((p, i) => {
    expect(p.x - before.floorRegions[0].points[i].x).toBe(80);
    expect(p.y).toBe(before.floorRegions[0].points[i].y);
  });
  expect(after.nodes).toEqual(before.nodes);   // the walls stayed — only the floor moved
});

test("a floor relocks the moment it stops being the selection", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "FloorRelock" })), CARRY_ROOM);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();

  await page.mouse.dblclick(box.x + 300, box.y + 300);
  await expect(page.getByTestId("room-shape-lock")).toContainText("Editing shape");
  await page.mouse.click(box.x + 750, box.y + 550);          // empty canvas → deselect
  await expect(page.getByTestId("room-title")).toHaveCount(0);
  const before = await readModel(page);

  await page.mouse.move(box.x + 300, box.y + 300);           // back onto the floor
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 300, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByTestId("room-shape-lock")).toContainText("Locked in place");
  await page.waitForTimeout(900);
  expect((await readModel(page)).floorRegions[0].points).toEqual(before.floorRegions[0].points);
});

// ── Furnish-stage parity + selection-lifetime bugs ────────────────────────────
const FURN_SEED = {
  version: "testfit-v17", pxPerFoot: 20,
  nodes: [{ id: "a", x: 200, y: 160 }, { id: "b", x: 640, y: 160 },
          { id: "c", x: 640, y: 480 }, { id: "d", x: 200, y: 480 }],
  walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
          { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
  furniture: [{ id: "t1", type: "cafe_table", x: 300, y: 260, angle: 0, w: 3, d: 3, phase: "existing" },
              { id: "t2", type: "cafe_table", x: 400, y: 340, angle: 0, w: 3, d: 3, phase: "existing" },
              { id: "far", type: "cafe_table", x: 900, y: 900, angle: 0, w: 3, d: 3, phase: "existing" }],
};

test("furniture can be marquee-selected, nudged and aligned in the Furnish stage", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "FurnParity" })), FURN_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("4"); // Furnish
  const before = await readModel(page);
  const at = (m, id) => m.furniture.find(f => f.id === id);

  // Marquee the two pieces inside the room (the third is far away).
  await page.mouse.move(box.x + 250, box.y + 210);
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 400, { steps: 10 });
  await page.mouse.up();

  // Nudge — furniture was previously the one draggable type arrow keys ignored.
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => at(await readModel(page), "t1").x).toBe(320);
  const mid = await readModel(page);
  expect(at(mid, "t2").x).toBe(420);                        // both selected pieces moved
  expect(at(mid, "far").x).toBe(at(before, "far").x);       // the unselected one did not

  // Align — the panel is gated on a homogeneous multi-selection, so this also proves
  // multiSelType now reports "furniture" rather than "mixed".
  await expect(page.getByText("Align & Distribute")).toBeVisible();  // panel needs a homogeneous multi-select
  await page.getByTitle("Align Top").click();
  await expect.poll(async () => {
    const m = await readModel(page);
    return at(m, "t1").y === at(m, "t2").y;
  }).toBe(true);
});

test("undo clears the multi-selection so Delete can't act on removed objects", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "UndoGhost" })), FURN_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("4");

  await page.mouse.move(box.x + 250, box.y + 210);
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 400, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => (await readModel(page)).furniture.find(f => f.id === "t1").x).toBe(320);

  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  // The selection is gone, so Delete must be a no-op rather than removing the restored pieces.
  await page.keyboard.press("Delete");
  await expect.poll(async () => (await readModel(page)).furniture.length).toBe(3);
});

test("alt-drag duplicating leaves the copies selected, ready for a follow-up action", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "CopySel" })), FURN_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("4");

  await page.mouse.move(box.x + 250, box.y + 210);
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 400, { steps: 10 });
  await page.mouse.up();

  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + 300, box.y + 260);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 420, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect.poll(async () => (await readModel(page)).furniture.length).toBe(5);

  // The copies stay selected — nudging proves it, and is what a "/" repeat or align needs.
  const afterCopy = await readModel(page);
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => {
    const m = await readModel(page);
    return m.furniture.filter((f, i) => f.x !== afterCopy.furniture[i].x).length;
  }).toBe(2);
});

test("a room can be typed instead of dragged, and Alt places off-grid", async ({ page }) => {
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await expect(page.getByTestId("snap-state")).toHaveText(/Snap 1'/);

  // Rect tool: first click anchors, then type the size rather than eyeballing the drag.
  await page.keyboard.press("r");
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.mouse.move(box.x + 340, box.y + 340);   // direction only — size comes from typing
  await expect(page.getByText(/Type a size to lock it/)).toBeVisible();
  for (const ch of "20x30") await page.keyboard.press(ch);
  await page.keyboard.press("Enter");

  await expect.poll(async () => (await readModel(page)).nodes?.length ?? 0).toBe(4);
  const m = await readModel(page);
  const xs = m.nodes.map(n => n.x), ys = m.nodes.map(n => n.y);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20 * m.pxPerFoot, 5);  // 20 ft wide
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(30 * m.pxPerFoot, 5);  // 30 ft deep
  expect(m.floorRegions).toHaveLength(1);   // the room still gets its floor
});

test("Alt suspends grid snapping so geometry can land off-grid", async ({ page }) => {
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  const snap = page.getByTestId("snap-state");
  await expect(snap).toHaveText(/Snap 1'/);
  await page.keyboard.down("Alt");
  await expect(snap).toHaveText("Snap off");
  await page.keyboard.up("Alt");
  await expect(snap).toHaveText(/Snap 1'/);
});

test("Cmd+A selects everything the current stage owns, and stops there", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({
    ...s, projectName: "SelectAll",
    markers: [{ id: "cam", layer: "security", componentType: "camera_indoor", x: 640, y: 300, angle: 0, label: "Cam", phase: "existing" }],
  })), FURN_SEED);
  await page.goto("/");
  await page.keyboard.press("4");                       // Furnish owns furniture only
  await page.keyboard.press("Control+a");
  await expect(page.getByText("Align & Distribute")).toBeVisible();

  // Nudging proves the whole stage's furniture is selected — and only furniture.
  const before = await readModel(page);
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => {
    const m = await readModel(page);
    return m.furniture.filter((f, i) => f.x !== before.furniture[i].x).length;
  }).toBe(3);
  expect((await readModel(page)).markers[0].x).toBe(before.markers[0].x);  // IT/MEP untouched
});

test("fit-to-view works on a project that has no walls", async ({ page }) => {
  // fitAll only looked at wall nodes, so a furniture/zone-only plan could never be framed.
  await page.addInitScript(() => localStorage.setItem("testfit-autosave", JSON.stringify({
    version: "testfit-v17", projectName: "NoWalls", pxPerFoot: 20, nodes: [], walls: [],
    furniture: [{ id: "f1", type: "cafe_table", x: 2000, y: 2000, angle: 0, w: 3, d: 3, phase: "existing" }],
  })));
  await page.goto("/");
  await page.keyboard.press("4");
  const zoomBefore = await page.getByTestId("app-statusbar").innerText();
  await page.keyboard.press("0");
  await page.waitForTimeout(300);
  // The piece sits far off-origin; fitting must move the view to frame it.
  const moved = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="plan-canvas"] g');
    return g ? g.getAttribute("transform") : "";
  });
  expect(moved).not.toBe("translate(0,0) scale(1)");
  expect(zoomBefore).toContain("ZOOM");
});

test("a project with no walls survives a reload", async ({ page }) => {
  // The restore gate only looked for nodes/walls/zones/markers, so a furniture-only plan
  // was silently discarded on reload.
  await page.addInitScript(() => localStorage.setItem("testfit-autosave", JSON.stringify({
    version: "testfit-v17", projectName: "FurnOnly", pxPerFoot: 20, nodes: [], walls: [],
    furniture: [{ id: "f1", type: "cafe_table", x: 300, y: 300, angle: 0, w: 3, d: 3, phase: "existing" },
                { id: "f2", type: "cafe_table", x: 420, y: 300, angle: 0, w: 3, d: 3, phase: "existing" }],
  })));
  await page.goto("/");
  await page.keyboard.press("4");
  await expect(page.getByText("PLACED FURNITURE (2)")).toBeVisible();
});

test("the shortcut sheet opens with ? and closes with Esc", async ({ page }) => {
  await page.goto("/");
  const sheet = page.getByTestId("shortcut-sheet");
  await expect(sheet).toHaveCount(0);
  await page.keyboard.press("?");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Select all in this stage")).toBeVisible();
  await expect(sheet.getByText("Hold: suspend grid snapping")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("destructive and clipboard actions confirm themselves with a toast", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "Toasts" })), FURN_SEED);
  await page.goto("/");
  const box = await page.getByTestId("plan-canvas").boundingBox();
  await page.keyboard.press("4");

  await page.mouse.click(box.x + 300, box.y + 260);        // select a piece
  await page.keyboard.press("Control+c");
  await expect(page.getByText(/Copied 1 item/)).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(page.getByText(/Deleted 1 item/)).toBeVisible();
});

// ── Minimap ───────────────────────────────────────────────────────────────────
// A 5×4 grid of rooms — far larger than the window, which is when the map earns its place.
const BIG_PLAN = (() => {
  const nodes = [], walls = [], floorRegions = [], furniture = [];
  let k = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const x = 200 + c * 420, y = 200 + r * 380, w = 360, h = 320;
    const id = ["a", "b", "c", "d"].map(sfx => `n${k}${sfx}`);
    nodes.push({ id: id[0], x, y }, { id: id[1], x: x + w, y }, { id: id[2], x: x + w, y: y + h }, { id: id[3], x, y: y + h });
    walls.push({ id: `w${k}1`, n1: id[0], n2: id[1], kind: "existing" }, { id: `w${k}2`, n1: id[1], n2: id[2], kind: "new" },
                { id: `w${k}3`, n1: id[2], n2: id[3], kind: "existing" }, { id: `w${k}4`, n1: id[3], n2: id[0], kind: "existing" });
    floorRegions.push({ id: `f${k}`, material: "Wood", label: "", phase: "existing",
      points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
    furniture.push({ id: `u${k}`, type: "cafe_table", x: x + w / 2, y: y + h / 2, angle: 0, w: 3, d: 3, phase: "existing" });
    k++;
  }
  return { version: "testfit-v17", projectName: "BigPlan", pxPerFoot: 20, nodes, walls, floorRegions, furniture };
})();

const planTransform = (page) => page.evaluate(() => {
  const g = document.querySelector('[data-testid="plan-canvas"] g');
  return g?.getAttribute("transform") || "";
});

test("the minimap summarises a large model and shows where the viewport is", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  const map = page.getByTestId("minimap");
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute("data-collapsed", "false");

  // One line per wall, one block per floor, one dot per piece — a simplified overview,
  // not a second copy of the drawing.
  const svg = page.getByTestId("minimap-canvas");
  await expect(svg.locator("line")).toHaveCount(BIG_PLAN.walls.length);
  await expect(svg.locator("polygon")).toHaveCount(BIG_PLAN.floorRegions.length);
  await expect(svg.locator("circle")).toHaveCount(BIG_PLAN.furniture.length);
  await expect(page.getByTestId("minimap-viewport")).toBeVisible();
});

test("clicking the minimap re-centres the canvas there", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  const svg = page.getByTestId("minimap-canvas");
  await expect(svg).toBeVisible();
  const before = await planTransform(page);

  const box = await svg.boundingBox();
  await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.85);   // far corner
  await expect.poll(() => planTransform(page)).not.toBe(before);

  // Panning to the far corner means translating up and left.
  const [, tx, ty] = (await planTransform(page)).match(/translate\((-?[\d.]+),(-?[\d.]+)\)/);
  expect(Number(tx)).toBeLessThan(0);
  expect(Number(ty)).toBeLessThan(0);

  // And the "you are here" frame tracks it.
  const vp = await page.getByTestId("minimap-viewport").boundingBox();
  expect(vp.x + vp.width / 2).toBeGreaterThan(box.x + box.width / 2);
  expect(vp.y + vp.height / 2).toBeGreaterThan(box.y + box.height / 2);
});

test("the minimap collapses to a handle, and stays away when the model already fits", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  await expect(page.getByTestId("minimap-canvas")).toBeVisible();
  await page.getByTestId("minimap-toggle").click();
  await expect(page.getByTestId("minimap")).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByTestId("minimap-canvas")).toHaveCount(0);
  await page.getByTestId("minimap-toggle").click();
  await expect(page.getByTestId("minimap-canvas")).toBeVisible();

  // Fit everything → the model is fully on screen, so the map has nothing left to offer.
  await page.getByTestId("minimap-fit").click();
  await expect(page.getByTestId("minimap")).toHaveCount(0);
});

test("a small plan that already fits never shows a minimap", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("testfit-autosave", JSON.stringify({ ...s, projectName: "Small" })), CARRY_ROOM);
  await page.goto("/");
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  await expect(page.getByTestId("minimap")).toHaveCount(0);
});

test("dragging the minimap's header repositions it, and it snaps to the nearest corner", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  const handle = page.getByTestId("minimap-drag-handle");
  const canvasBox = await page.getByTestId("plan-canvas").boundingBox();
  const before = await page.getByTestId("minimap").boundingBox();
  // Starts bottom-left by default.
  expect(before.x).toBeLessThan(canvasBox.x + canvasBox.width / 2);
  expect(before.y).toBeGreaterThan(canvasBox.y + canvasBox.height / 2);

  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.9, canvasBox.y + canvasBox.height * 0.1, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250); // let the snap transition settle

  const after = await page.getByTestId("minimap").boundingBox();
  // Snapped to top-right: right-anchored, and clear of the canvas's own top-left chip.
  expect(after.x).toBeGreaterThan(canvasBox.x + canvasBox.width / 2);
  expect(after.y).toBeLessThan(canvasBox.y + canvasBox.height / 2);
  expect(Math.abs(after.x + after.width - (canvasBox.x + canvasBox.width))).toBeLessThan(20);
});

test("dragging to the top-left still clears the pane's own view-selector chip", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  const handle = page.getByTestId("minimap-drag-handle");
  const canvasBox = await page.getByTestId("plan-canvas").boundingBox();

  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.1, canvasBox.y + canvasBox.height * 0.1, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  // The pane-view chip ("Plan ▾") sits at the pane's own top-left — the minimap must not
  // render underneath it, or dragging back there would leave it permanently stuck (its
  // own drag handle would be unreachable, covered by a higher-z-index control).
  const chip = page.locator("select").first();
  const chipBox = await chip.boundingBox();
  const mapBox = await page.getByTestId("minimap").boundingBox();
  expect(mapBox.y).toBeGreaterThan(chipBox.y + chipBox.height);

  // Prove it's still actually draggable from here (i.e. genuinely not obscured) —
  // if it silently landed back under the chip, this second drag would be a no-op.
  const handle2box = await handle.boundingBox();
  await page.mouse.move(handle2box.x + handle2box.width / 2, handle2box.y + handle2box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.9, canvasBox.y + canvasBox.height * 0.9, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const mapBox2 = await page.getByTestId("minimap").boundingBox();
  expect(mapBox2.y).toBeGreaterThan(mapBox.y);
});

test("dragging to the bottom-right still clears the rotate-view button row", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  const handle = page.getByTestId("minimap-drag-handle");
  const canvasBox = await page.getByTestId("plan-canvas").boundingBox();

  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.9, canvasBox.y + canvasBox.height * 0.9, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  // The rotate-view row ("0°" + its neighbours) also docks bottom-right — the minimap
  // must sit ABOVE it, or it would cover those controls (and, dropped here again, land
  // right back on top of itself with no way to tell the two apart).
  const rot = await page.getByRole("button", { name: "0°", exact: true }).boundingBox();
  const mapBox = await page.getByTestId("minimap").boundingBox();
  expect(mapBox.y + mapBox.height).toBeLessThan(rot.y);

  // Prove the rotate buttons are still clickable — not covered — from here.
  await page.getByRole("button", { name: "0°", exact: true }).click();
  await expect(page.getByTestId("minimap")).toBeVisible(); // sanity: page still responsive
});

test("clicking inside the minimap still navigates after dragging it — the two gestures stay independent", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  const handle = page.getByTestId("minimap-drag-handle");
  const canvasBox = await page.getByTestId("plan-canvas").boundingBox();

  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.9, canvasBox.y + canvasBox.height * 0.9, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  // A drag that ends back over the header buttons must not also toggle them.
  await expect(page.getByTestId("minimap-canvas")).toBeVisible();

  const before = await planTransform(page);
  const svgBox = await page.getByTestId("minimap-canvas").boundingBox();
  await page.mouse.click(svgBox.x + svgBox.width * 0.2, svgBox.y + svgBox.height * 0.2);
  await expect.poll(() => planTransform(page)).not.toBe(before);
});

test("a quick click on Map still toggles collapse — it isn't swallowed by the drag handling", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  await page.getByTestId("minimap-toggle").click();
  await expect(page.getByTestId("minimap")).toHaveAttribute("data-collapsed", "true");
});

test("the collapsed pill is draggable too, and still toggles back on a plain click", async ({ page }) => {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), BIG_PLAN);
  await page.goto("/");
  await page.getByTestId("minimap-toggle").click();
  await expect(page.getByTestId("minimap")).toHaveAttribute("data-collapsed", "true");

  const canvasBox = await page.getByTestId("plan-canvas").boundingBox();
  const pill = page.getByTestId("minimap-toggle");
  const before = await pill.boundingBox();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.9, canvasBox.y + canvasBox.height * 0.1, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const after = await pill.boundingBox();
  expect(after.x).toBeGreaterThan(before.x);
  // Still collapsed — the drag must not have been misread as a toggle-click.
  await expect(page.getByTestId("minimap")).toHaveAttribute("data-collapsed", "true");

  // A genuine plain click still expands it.
  await page.getByTestId("minimap-toggle").click();
  await expect(page.getByTestId("minimap")).toHaveAttribute("data-collapsed", "false");
});

// ── Pane chrome ───────────────────────────────────────────────────────────────
const CHROME_ROOM = {
  version: "testfit-v17", projectName: "Chrome", pxPerFoot: 20,
  nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 480, y: 200 },
          { id: "c", x: 480, y: 600 }, { id: "d", x: 200, y: 600 }],
  walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
          { id: "w3", n1: "c", n2: "d", kind: "existing" }, { id: "w4", n1: "d", n2: "a", kind: "existing" }],
};

async function splitPlanAnd3D(page) {
  await page.addInitScript((b) => localStorage.setItem("testfit-autosave", JSON.stringify(b)), CHROME_ROOM);
  await page.goto("/");
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clay", exact: true })).toBeVisible();
}

test("plan and 3D pane chrome share one baseline along the bottom edge", async ({ page }) => {
  await splitPlanAnd3D(page);
  // The plan pane's rotation cluster used to sit ~28px higher than the 3D pane's controls,
  // because it was pushed up to clear the elevation-guide rail while the 3D pane wasn't.
  const rot = await page.getByRole("button", { name: "0°", exact: true }).boundingBox();
  const ceiling = await page.getByTestId("pane-ceiling").boundingBox();
  const style = await page.getByRole("button", { name: "Clay", exact: true }).boundingBox();
  for (const other of [ceiling, style]) {
    expect(Math.abs((rot.y + rot.height) - (other.y + other.height))).toBeLessThan(10);
  }
});

test("in Detailed 3D the floor texture stays on the building — the ground is theme paper", async ({ page }) => {
  // An OPEN outer run is the case that broke: traceOuterBoundary returns null, and the
  // fallback used to be a 500ft quad wearing the floor material, so a single wood plank was
  // stretched over the whole world. Sampled from the Docs capture of the real WebGL frame.
  await page.addInitScript(() => localStorage.setItem("testfit-autosave", JSON.stringify({
    version: "testfit-v17", pxPerFoot: 20, projectName: "GroundPaper",
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 700, y: 200 },
            { id: "c", x: 700, y: 600 }, { id: "d", x: 200, y: 600 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" },
            { id: "w2", n1: "b", n2: "c", kind: "existing" },
            { id: "w3", n1: "c", n2: "d", kind: "existing" }],   // no d-a: never closes
    floorRegions: [],
  })));
  await page.goto("/");
  await page.locator("select").first().selectOption("iso");
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Detailed", exact: true }).click();
  await page.waitForTimeout(2500);

  // Screenshot the live WebGL canvas, then decode it back inside the page to read a pixel —
  // saved slides re-render live rather than storing a bitmap, so there's nothing to sample
  // from localStorage.
  const shot = (await page.locator("canvas").first().screenshot()).toString("base64");
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = "data:image/png;base64," + b64; });
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    // Top-left corner — comfortably off the building in the locked iso framing.
    const d = ctx.getImageData(Math.round(img.width * 0.06), Math.round(img.height * 0.10), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }, shot);

  // Paper is a near-neutral warm off-white; the wood texture is heavily red-over-blue.
  // #C8A878 wood → r-b ≈ 80. Light paper → r-b ≈ 15.
  expect(px.r - px.b).toBeLessThan(40);
  expect(px.r).toBeGreaterThan(200);
});

test("the 3D ceiling toggle disables itself — with a reason — when it can't draw anything", async ({ page }) => {
  await splitPlanAnd3D(page);
  const ceiling = page.getByTestId("pane-ceiling");

  // Clay: a closed run of walls, so the slab has a shape → the button is live.
  await expect(ceiling).toHaveAttribute("aria-disabled", "false");

  // X-Ray deliberately skips the ceiling (it would hide the interior X-Ray exists to show),
  // so the button was previously a silent no-op with only a bare native `title`.
  await page.getByRole("button", { name: "X-Ray", exact: true }).click();
  await expect(ceiling).toHaveAttribute("aria-disabled", "true");
  await ceiling.hover();
  await expect(page.locator('[role="tooltip"]').filter({ hasText: /X-Ray/ }).first()).toBeVisible();
});

test("the ceiling toggle also explains itself when the plan has no closed run of walls", async ({ page }) => {
  // Two disconnected walls — traceOuterBoundary finds no loop, so there's no ceiling shape.
  await page.addInitScript(() => localStorage.setItem("testfit-autosave", JSON.stringify({
    version: "testfit-v17", projectName: "OpenPlan", pxPerFoot: 20,
    nodes: [{ id: "a", x: 200, y: 200 }, { id: "b", x: 480, y: 200 }],
    walls: [{ id: "w1", n1: "a", n2: "b", kind: "existing" }],
  })));
  await page.goto("/");
  await page.getByRole("button", { name: "◫", exact: true }).click();
  await expect(page.getByRole("button", { name: "Clay", exact: true })).toBeVisible();

  const ceiling = page.getByTestId("pane-ceiling");
  await expect(ceiling).toHaveAttribute("aria-disabled", "true");
  await ceiling.hover();
  await expect(page.locator('[role="tooltip"]').filter({ hasText: /closed run of walls/ }).first()).toBeVisible();
});
