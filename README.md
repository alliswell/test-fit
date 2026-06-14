# Test Fit

A browser-based **architectural test-fit and space-planning tool** for laying out
commercial and residential spaces. Draw walls, place doors / windows / columns,
define program zones, drop IT / MEP markers, annotate with dimensions, labels, and
revision clouds, paint floor regions, plan circulation with flow paths, and review
the result across a configurable multi-pane layout — a live **2D plan**, **2D
elevations** (Front / Back / Left / Right), and an interactive **3D model** with three
render styles, side by side — all snapshot-versioned, undoable, and saveable.

> "Test fitting" is the early-stage exercise of checking whether a program (the list
> of rooms / functions a tenant needs) actually fits within a given floor plate, and
> how. This tool is built to make that exploration fast, visual, and iterative.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Methodology](#methodology)
- [The Four Modes](#the-four-modes)
- [Tools & Features](#tools--features)
- [Views & Panes](#views--panes)
- [The 3D View](#the-3d-view)
- [Elevation Views](#elevation-views)
- [Snapshots](#snapshots)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Architecture](#architecture)
- [Running the Code](#running-the-code)
- [Data Model & Persistence](#data-model--persistence)

---

## What It Does

Test Fit is a single-page React application centered on two synchronized
representations of a space:

1. **A 2D plan** rendered as a single large inline `<svg>` with a pan/zoom transform
   group. Everything — walls, openings, zones, markers, annotations — is an SVG
   element, which keeps the drawing crisp at any zoom and trivially exportable.
2. **A live 3D model** (three.js via React Three Fiber) that extrudes the same
   geometry into massing, cuts openings, and renders furniture, fixtures, and
   finishes. It can be shown full-screen, toggled with the 2D plan, or viewed in a
   **split screen** with a draggable divider.

Both views read from one shared, in-memory state model. There is no external store —
state lives in a single top-level component as `useState` arrays per entity type
(nodes, walls, doors, windows, columns, zones, markers, dims, labels, revision
clouds, flow paths, floor regions).

---

## Methodology

The application encodes a specific way of thinking about space planning:

### Real-world units, stored in pixels

All geometry is stored in **canvas pixels**, with a `pxPerFoot` constant (default 20)
converting to real-world feet and inches. Helper functions translate freely:
`ft(px)` → a feet-inch string, `sn(value, grid)` → snap-to-grid. A reference floor
plan image can be uploaded and **calibrated** by drawing a line of known length, so
you can trace over an existing as-built.

### Graph-based walls

Walls are not free-floating line segments — they are **edges in a node graph**. Each
wall references two node IDs (`n1`, `n2`); nodes are shared endpoints `{id, x, y}`.
This means:

- Dragging a node moves every wall connected to it, preserving corners.
- New endpoints **snap to existing nodes** within a radius (`SNAP_R`), so chains
  close cleanly and junctions stay welded.
- Walls automatically **miter** at corners and **split** when a new wall lands on an
  existing wall's body. Connected walls render **seamlessly**: each junction's inner and
  outer corners are computed geometrically (inner vs. outer decided by the interior
  bisector, not a wall's arbitrary node-order normal), so both walls agree on the exact
  shared corner points — no overshooting edges, crossing lines, or gaps at the joins.

Walls carry a *kind* (Existing / Demo / New / Pony), each with its own color,
thickness, and 2D hatch, plus a *material* (Drywall, Brick, CMU, Concrete, Plaster)
that drives both the 2D hatch and the 3D finish.

### Clearance-aware circulation

The **Flow Path** tool lets you sketch walkways as adjustable-width bands. It ships
with the standard architectural clearance presets so circulation planning follows
real rules of thumb:

| Preset   | Width | Use                                               |
| -------- | ----- | ------------------------------------------------- |
| Walkway  | 36"   | Main walking paths (code minimum)                 |
| Tight    | 48"   | Tighter spaces / passing behind seated chairs     |
| Dining   | 60"   | Dining: scoot a chair out and walk behind diners  |

The on-canvas band thickness scales 1:1 with the chosen clearance, so you literally
see whether furniture leaves enough room to move.

### Snapshots, not layers

Design alternatives are organized as **snapshots** — independent, named, full copies
of the entire model. Save the current state as a snapshot, keep working, then either
**update** that snapshot in place or **save a new** one. Switching snapshots loads
that state wholesale, so each is a clean standalone option you can flip between to
compare layouts. The active snapshot and whether the live model has unsaved changes
are always shown in the top-left switcher.

### Proximity-first interaction

Rather than requiring a pixel-perfect hover, nearby selectable elements light up as
the cursor *approaches* them — and only the elements that are actually selectable in
the **current mode** respond. In IT/MEP mode, for instance, walls and zones stay
inert while only markers react.

---

## The Four Modes

The four task-focused workflow stages are switched from a compact **stage dropdown** in
the top bar (the tinted button showing the current stage, e.g. "① Build"). The menu lists
all four stages with a numbered badge, a one-line description, a live content count
(walls / markers / zones / budget total) so you can see which stages have work in them,
and its keyboard shortcut — keys `1`–`4` switch stages directly without opening the menu:

1. **Build** — structure: walls, doors, windows, columns. The sidebar carries
   wall-kind and material pickers; the inspector edits the selected element.
2. **IT / MEP** — building systems. Component layers (Power / Electrical, Speakers /
   AV, IT / Network, MEP / Plumbing, Security), each with schematic marker symbols.
   Power splits into Electrical (outlets, switches, panels) and Lighting (recessed
   cans, pendants, linear fixtures, H-track, sconces).
3. **Zones** — program areas. Colored polygons drawn from an editable library, each
   with a name, color, default size, and cost-per-square-foot. Areas are computed
   and listed live.
4. **Budget** — rollups. Total area and cost across zones plus component counts.

Selection rules, cursors, and proximity hover are all gated per mode, so each mode
only surfaces the tools relevant to it.

---

## Tools & Features

**Drawing**
- **Wall** chains with node snapping, **Shift = 90° ortho** (locks the segment to
  horizontal or vertical, whichever way you're drawing), smart alignment
  guides, automatic mitering and wall-splitting.
- **Doors** (Wood / Glass / Metal / Case Opening) that snap onto walls and show a
  swing arc; flippable hinge side.
- **Windows** with sill height and width; Window or Cut-Opening types.
- **Columns** — round or square, free-standing, sized.

**Program & Systems**
- **Zones** as rectangles or editable polygons with vertex / edge handles and live
  square-footage.
- **IT / MEP markers** across five layers, rotatable, with schematic symbols.

**Annotation**
- **Dimensions** — click two snap points for a feet-inch dimension line. Select a
  dimension to expose draggable endpoint handles; grab one to resize/move the measured
  span, re-snapping to nearby nodes / wall midpoints / columns / markers (or freeing it).
- **Labels / Callouts** — free text, optionally with a leader line; inline editing,
  font / weight / color controls.
- **Revision Clouds** — closed polygons rendered as arc "bumps," closeable by
  clicking the first vertex or pressing Enter.

**Space planning**
- **Flow Paths** — adjustable-width circulation bands with clearance presets and a
  dashed centerline. Re-select the tool with a path selected to continue extending it.
- **Floor Regions** — paint areas of the floor with a material (Wood / Concrete /
  Vinyl / Carpet); rendered as a hatch in 2D and a textured surface in 3D. Selecting a
  region shows its **area in square feet** in the inspector.
- **Floor material** — a project-wide default floor, overridden by any floor region.

**Editing**
- Click to select, marquee-drag to multi-select, drag to move.
- Arrow keys nudge 1" (Shift = 1'); Backspace deletes.
- Vertex / edge editing on every polygon type (zones, clouds, flow paths, floor
  regions): drag handles, double-click an edge to insert a vertex, double-click a
  vertex to remove it.
- A consolidated **Layers** panel (alphabetized) where each layer can be **hidden**
  (checkbox) or **locked** (🔓/🔒). A locked layer stays visible but its items can't be
  hovered, selected, or edited — clicks pass through to whatever is beneath. Includes a
  single master **IT / MEP** layer that hides/locks all markers in any mode. Layer
  hide/lock state is saved with the project.

**Project**
- Undo / redo via a JSON-snapshot history stack.
- Save / Load to a JSON file; **Export PNG** and **Export PDF** (under the Save
  dropdown).
- Named **version snapshots** and a reference-image underlay with opacity / scale /
  calibration.
- **Light and dark themes** (light is default; wall colors darken for contrast).
- **Collapsible sidebar** and responsive panel widths for small screens.
- **Left tool rail** — the tool palette is a fixed vertical rail on the left edge of the
  canvas area (full height, scrolls if a mode has more tools than fit). It's independent
  of the pane layout, so every tool stays reachable even in quad view.

---

## Views & Panes

The canvas is a **configurable pane layout** rather than a single view. A switcher in the
**top bar** (▢ single / ◫ split / ⊞ quad) sets how many panes are shown, and each
pane has its own selector chip (top-left) choosing what it displays:

- The **Plan** pane (top-left) is always the interactive editing canvas — all drawing
  tools, selection, and snapping live here.
- Every other pane independently shows **3D** or any of the four **elevations**
  (Front / Back / Left / Right).

Drag the divider(s) to resize — one vertical divider in split, a vertical + horizontal
cross in quad. Backtick `` ` `` quick-toggles between single and a Plan|3D split. A
common setup is the quad: Plan, 3D, Front elevation, Left elevation side by side. Every
pane reflects the **active snapshot**, so switching snapshots updates them all at once.

## The 3D View

Pick **3D** in any pane's selector (or `` ` `` for a quick Plan|3D split). Walls extrude
to ceiling height, openings are cut for doors and windows, and three render styles are
available:

- **Clay** — matte Lambert materials with a soft ambient + key light (default).
- **X-Ray** — transparent ghost walls with crisp edge lines and a prominent grid. Each
  wall reads as a **single outlined volume**: openings are modeled by splitting the wall
  into sill/header/solid sub-meshes, but the edge outlines are drawn once per wall (plus
  one outline per door/window/cut-opening) rather than per sub-mesh — so a wall with a
  window shows just the wall rectangle and the window rectangle, not every internal
  section boundary.
- **Detailed** — architectural-visualization quality:
  - ACES Filmic tone mapping, soft shadows, image-based lighting via a drei
    `<Environment>` plus a warm directional "sun" and a cool fill light.
  - PBR materials throughout: `meshStandardMaterial` walls / columns / floor,
    transmissive glass windows, wood-and-brass doors with casings, window frames and
    sills.
  - **Procedural textures** generated on a canvas for Brick / CMU walls and Wood /
    Concrete / Vinyl / Carpet floors, tiled at real-world scale via per-face UVs.
  - Light fixtures emit a warm glow with bloom tuned so only the emissive lenses
    bloom (not lit walls).
  - The floor **auto-fits the room** by tracing the outer perimeter of the wall graph.
  - Detailed mode is presentation-only: nothing is selectable, no hover highlights.

The camera orbits / pans / zooms and auto-fits on open; toggles control 3D zone
labels and dimensions.

---

## Elevation Views

Any aux pane can show a **2D elevation** — an orthographic side projection looking
along a cardinal axis: **Front / Back** (looking along Y) and **Left / Right** (along
X). Elevations are a true projection of the live model, so they always match the plan
and 3D.

Each elevation renders:

- **Walls** as vertical rectangles to their height (`ceilingHeight`, or a per-wall
  override; pony walls are shorter), colored by kind, demo walls dashed, depth-sorted.
- **Windows** at their real sill height and height; **doors** as openings to a standard
  7'-0" head; **columns** full-height.
- **IT/MEP markers** (outlets, switches, lights, AV, cameras, …) at their real **mounting
  height** above finished floor — outlets at 18", switches at 48", ceiling fixtures at the
  ceiling line, etc. Heights come from `markerMountYFt()` in `testfit3d.jsx` (resolving the
  `M3D` table's `"ceil"` / `"hangN"` forms), the **same source the 3D scene uses**, so 2D
  and 3D stay in sync. Markers are depth-culled like everything else (only the near face's
  items show) and are click-selectable from the elevation.
- A **finished-floor datum** (0'-0") and **ceiling line** with height labels.

Openings stay on the plane of the wall they belong to: an opening foreshortens to
edge-on (and is omitted) when its wall is perpendicular to the view. A proper
hidden-surface rule makes each elevation a straight-on view of a single face: a wall,
opening, or column is hidden when the union of **strictly nearer, at-least-as-tall**
walls fully spans its width. That occludes the back wall, interior partitions, a **pony
wall behind the front wall**, and columns tucked behind the near face — so Front and
Back (and Left and Right) read as distinct, non-x-ray faces rather than seeing through
to whatever stands behind. (The union test handles a near wall built from several
collinear segments.)

**Elevation guides (section cuts).** Pull a guide from any edge of the plan canvas
(Figma-style: the thin edge rails) to set where an elevation is taken — **Bottom = Front,
Top = Back, Left = Left, Right = Right**, the view looking inward from that edge. A guide
is a **section cut line**: its elevation renders only the geometry on the cut's far side
(everything between the viewer and the cut is removed), so the wall *at* the cut becomes
the visible face — letting you elevation an **interior** wall, not just the building's
outer face. Cropping reduces to "keep depth `d ≤ d(cut)`", which composes with the
hidden-surface rule above. Guides snap to wall coordinates, are draggable/selectable
(Delete to remove, or drag back onto the source edge), reframe their elevation live, and
persist with the project. One guide per direction; with none, the elevation shows the
whole building as before.

Placed guides **fade out** so they don't clutter the plan; they fade back in when you
**hover the matching edge rail** (revealing all of them), when the cursor nears a guide
line, or while a guide is selected or being dragged — and they remain hit-testable while
faded, so the cut is still grabbable.

While you **drag a guide**, the cursor drives that elevation's camera: the elevation pans
so the point under the cursor stays centered (a live scrub along the wall, keeping the
current zoom), then re-fits to the final cut on release.

Each open elevation also draws a **visible ruler along its edge** with a **camera indicator
on it** — a camera glyph centered on the ruler line plus a brighter bracket marking the
visible horizontal span — so you can see, on the plan, where each elevation is currently
looking. It slides along the ruler live as you scrub a guide or pan/zoom the elevation. You
can also **drag the camera marker along the ruler to pan that elevation** (cursor reflects
the axis: `ew-resize` on a horizontal front/back ruler, `ns-resize` on a vertical left/right
ruler); the pan sticks until the cut changes. (The elevation reports its visible extent up via an
`onView` callback; markers map plan coords → screen and assume `canvasRotation` 0, like the rails.)

The whole system is an **"Elevation Rulers" layer** in the Layers panel: **hide** it to clear
the guide lines, edge rails, and on-ruler camera markers from the plan (the elevations stay
cut — visibility is plan-side only), or **lock** it to keep them visible but non-interactive
(no selecting/dragging/creating guides, no camera-pan). Lock state persists with the project.

Each elevation pane has an **independent camera** (scroll to zoom, drag to pan;
auto-fits on open, and re-fits when its section cut changes). 

**View + annotate (v1):** click a wall / door / window / column to select it — the
right-hand inspector opens and edits round-trip into the model (e.g. changing ceiling
height instantly reshapes the elevation). With an elevation pane focused, the
**Dimension** and **Label** tools place annotations directly in that elevation's own
coordinate space (stored per direction). The **Dimension** tool behaves like the plan one:
**3 clicks** — two measured points (which **snap to object nodes**: the corners and
edge-midpoints of every wall / window / door / column, marker centers, and the
floor/ceiling datum lines), then a third click to **pull the dim line away** from those
points (its offset). It renders as a proper dimension string — extension lines, offset dim
line, diagonal ticks, rotated label — with a live snap ring and measurement preview while
drawing. Hold **Shift** while placing the second point to **lock the axis** (horizontal or
vertical from the first point) and snap onto any object edge that locked line crosses —
wall tops, window sills/heads, door heads, column/wall edges, and the floor/ceiling datums
— so heights and clear widths land exactly. Once placed, drag an endpoint handle to
re-measure or drag the dim line to pull the offset; select + Delete removes it.

The **Label** tool works exactly as it does in the plan: click to drop an **in-canvas
inline editor**, then type the text (Enter commits, Shift+Enter for a new line, Esc
cancels). The label isn't created until you commit non-empty text, so cancelling or
clicking away from an empty editor leaves nothing behind — no stray blank labels, and no
`window.prompt` (which embedded browsers block). **Click + drag** instead of a plain click
to make a **callout with a leader line**: the press point becomes the leader tip and the
release point the text box. Double-click an existing elevation label with the Select tool
to re-edit it; emptying its text and committing deletes it. Drag the text box to move it
(the leader tip stays anchored where it points), drag the **tip handle** to re-aim the
leader, select + Delete to remove. Selecting an elevation label opens an **option panel**
with the same styling controls as plan labels — font size, bold/italic, color, and Remove
Leader.

The **Revision Cloud** tool also works in elevations, exactly like the plan: click to
place the polygon's points (a live scalloped preview follows the cursor), then click back
on the first point — it highlights with a close ring — to close the cloud (Esc abandons
the draft). The finished cloud is auto-selected, opening an option panel with **Label**
(drawn at the centroid), **Arc Size**, **Color**, and Delete. With the Select tool, drag
a cloud to move it; select + Delete removes it. Clouds are stored per elevation under
`elevAnnotations[dir].revClouds` and persist with the project.

Editing geometry *within* an elevation (dragging a window's sill, etc.) is planned for a
later version.

---

## Snapshots

Snapshots are named, independent, full copies of the model — the single mechanism for
exploring and comparing design options. The top-left **snapshot switcher** shows the
active snapshot's name and a dot indicating whether the live model has unsaved changes.

- **Save as new snapshot** — capture the current model under a name.
- **Update "<name>"** — overwrite the active snapshot with the current model.
- **Switch** — click any snapshot to load its state (you're warned if the current
  state has unsaved changes).
- **Rename** (double-click a name) and **delete** (the × on a row).

Switching is a full state swap, so each snapshot is a clean, self-contained
alternative. All snapshots are stored in the project file and survive Save/Load.

---

## Keyboard Shortcuts

| Key       | Action                          |
| --------- | ------------------------------- |
| `1`–`4`   | Switch mode                     |
| `V`       | Select tool                     |
| `W`       | Wall (Build)                    |
| `C`       | Column (Build)                  |
| `E` / `L` | Outlet / Lighting (IT/MEP)      |
| `P`       | Marker (IT/MEP)                 |
| `Z`       | Zone (Zones)                    |
| `M`       | Dimension                       |
| `T`       | Label / Callout                 |
| `N`       | Revision Cloud                  |
| `K`       | Flow Path                       |
| `A`       | Floor Region                    |
| `D`       | Toggle auto-dimensions          |
| `G`       | Toggle grid                     |
| `` ` ``   | Quick Plan \| 3D split           |
| Arrows    | Nudge selection 1" (Shift = 1') |
| Backspace | Delete selection                |
| ⌘Z / ⌘⇧Z  | Undo / Redo                     |
| Esc       | Cancel current drawing          |

Shift while placing a single object (door / window / column / marker) keeps the tool
active for rapid repeat placement. While drawing a multi-point object (walls, revision
clouds, flow paths, floor regions), **hold Shift to lock the segment to 90° ortho** —
horizontal or vertical relative to the previous point.

---

## Architecture

```
src/
  main.tsx              # app entry
  app/App.tsx           # mounts the Test Fit component
  imports/
    testfit.jsx         # main editor: state, canvas handlers, plan SVG, panels, layout
    testfit3d.jsx       # the React Three Fiber 3D scene
    model.js            # pure model helpers (uid, geometry, migrateProjectData) — tested
    geometry.js         # pure drawing helpers (miter, smart guides, revCloudPath) — tested
  constants/            # theme.js (THEMES, wall kinds), specs.js (component catalogs)
  utils/                # labels.js (label box layout) and other pure helpers
  components/           # props-only React: ElevationView, ZoneLibraryModal, ui, icons
  store/                # zustand: viewStore, layersStore, selectionStore
```

**Where new code goes** — see [`CLAUDE.md`](CLAUDE.md) for the convention. In short: pure
logic → `imports/model.js`/`geometry.js` (+ a test); constants → `constants/`; reusable
pure helpers → `utils/`; new panels/views as **props-only components** → `components/`
(never importing `testfit.jsx`); shared UI state → `store/`. `testfit.jsx` keeps the
top-level state, the canvas event handlers, and layout composition.

**Tech stack**

- **React 18 + Vite** single-page app
- **three.js + @react-three/fiber + @react-three/drei** for the 3D view
- **lucide-react** icons, **Radix UI** primitives (tooltip, etc.)
- Inline `<svg>` for the 2D canvas (not canvas2d) — one big SVG with a pan/zoom
  `<g transform>`
- **Tailwind** for chrome/layout; most canvas styling is inline for precision

**State model (single top-level component, incrementally being extracted)**

Most entity state still lives as `useState` arrays in the top-level component (positions
in canvas pixels; named snapshots as full model blobs in a `snapshots` array). State is
being migrated slice-by-slice into **Zustand stores** under `src/store/`: `viewStore.js` (the pane layout — `panes` /
`splitPos` / `splitPosV` + `setLayout` / `setPaneView`), `layersStore.js` (per-layer
visibility flags + `lockedLayers`), and `selectionStore.js` (`selectedId` / `selType` /
`selectedIds`). The stores expose value-or-updater setters that mimic the `useState`
contract, so migrations are low-churn (existing call sites stay unchanged) and verifiable
against the unit + E2E suites (which drive the layout switcher, autosave reload, layers
panel, and click-to-select/deselect directly).

Because the stores expose `getState()`, **event-only** callbacks (`onDown` / `onUp` /
`delSel`, plus `hitTest` / `findProxHover` / `layerLocked` / `markerLocked`) read selection
and lock state at event time instead of closing over it — so those values drop out of the
`useCallback` dependency arrays. This shrinks the churn of these large handlers (they no
longer re-create on every selection change) and removed a latent stale-closure read of
`selectedId` in `onDown`. The reads are safe precisely because these callbacks never run
during render; the broadened E2E suite guards the behavior.

Key derived helpers:

- `captureModel` / `loadModel` — serialize / restore the full working state
- `migrateProjectData` (`model.js`) — normalize/upgrade any project blob
- `hitTest` — mode-aware pointer hit detection
- `findNear` — node snapping for drawing
- `findProxHover` — mode-gated proximity hover
- `traceOuterBoundary` (`geometry.js`) — planar face-trace for the auto-fit floor

---

## Running the Code

```bash
npm i          # install dependencies
npm run dev    # start the Vite dev server
npm run build  # production build
npm test       # unit tests (Vitest, watch mode)
npm run test:run  # unit tests once
npm run e2e    # end-to-end tests (Playwright; starts/reuses the dev server)
```

Pure logic is being extracted out of the two big component files into small, dependency-free,
unit-tested modules (no React/three/DOM):

- **`src/imports/model.js`** — persistence + geometry primitives: `migrateProjectData`
  (the persistence seam — defaults, type coercion, legacy `cutouts → windows` /
  `versions → snapshots` migrations), `dst`, `ptSeg`, `polyArea`, `polyCentroid`,
  `pointInPoly`, `orthoSnap`, `parseDimInput`, `isLightComponent`.
- **`src/imports/geometry.js`** — drawing geometry: `wallMiterPt`/`lineInt` (wall corner
  mitering), `applySmartGuides` (alignment snapping), `revCloudPath`, `wallResizeCursor`,
  and `traceOuterBoundary` (the room-perimeter face trace used by the 3D auto-fit floor,
  shared by both the 2D and 3D files).

Tests live alongside each module (`model.test.js`, `geometry.test.js`) — 30 unit tests
covering the subtle, regression-prone bits. This is the ongoing extraction of logic out of
the ~7,000-line main component.

**End-to-end tests** (`e2e/`, Playwright — 10 tests) cover the integration seams unit
tests can't reach: the app shell renders, the layout switcher cycles single ↔ quad, the
single-pane view dropdown swaps Plan / 3D / elevation, the **crash-safe autosave
round-trips across a reload**, the core **draw-a-wall** flow, click-to-select/deselect, the
layers panel, **dragging a wall body** (translates its nodes), **marquee multi-select +
group nudge**, and placing an **elevation dimension annotation** — all via real canvas
interactions. Canvas-mutating tests assert against the autosaved model blob in
`localStorage` (read with a `readModel` helper) rather than fragile DOM, and stable
`data-testid`s (`plan-canvas`, `project-name`) anchor the rest. This suite is the safety
net behind the handler-dep reductions described below.

Open the dev URL Vite prints (typically `http://localhost:5173`).

---

## Data Model & Persistence

A project serializes to a single JSON object containing every entity array
(`nodes`, `walls`, `zones`, `markers`, `doors`, `windows`, `columns`, `dims`,
`labels`, `revClouds`, `flowPaths`, `floorRegions`, `guides`), plus `floorMaterial`,
`elevAnnotations` (per-direction elevation dimensions/labels), the reference-image
settings, scale, the `snapshots` library, and the `panes`/`splitPos` view layout.

**Single serialization seam.** Three functions own all persistence and are the boundary
a future backend plugs into:

- `captureModel()` / `getProjectData()` — produce the JSON payload (stamped with
  `version: "testfit-v9"`).
- `migrateProjectData(d)` — a **pure** normalizer that upgrades any older/partial blob
  to the current shape (defaults missing arrays, folds legacy `cutouts` into windows,
  maps the retired named *versions* → `snapshots`, ignores retired *phase* tags).
- `applyProjectData(m, full)` — the **single hydrator**; `full` also restores the
  snapshot library + view layout (file import / autosave), `false` is model-only
  (snapshot switching).

Every load path — **file import, snapshot restore, and crash-safe autosave** — flows
through `migrate → apply`, so the field list can't drift between them. The same payload
backs Save/Load, undo/redo history, snapshots, and import/export.

**Crash-safe autosave.** The working session is debounced to `localStorage`
(`testfit-autosave`) on every change and restored on load, so a refresh or crash never
loses work. (Save-to-JSON remains the durable, portable backup.)
