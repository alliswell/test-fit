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
  existing wall's body.

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

The top bar switches between four task-focused modes (keys `1`–`4`):

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
- **Wall** chains with node snapping, Shift-to-45° angle constraint, smart alignment
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
- **Dimensions** — click two snap points for a feet-inch dimension line.
- **Labels / Callouts** — free text, optionally with a leader line; inline editing,
  font / weight / color controls.
- **Revision Clouds** — closed polygons rendered as arc "bumps," closeable by
  clicking the first vertex or pressing Enter.

**Space planning**
- **Flow Paths** — adjustable-width circulation bands with clearance presets and a
  dashed centerline. Re-select the tool with a path selected to continue extending it.
- **Floor Regions** — paint areas of the floor with a material (Wood / Concrete /
  Vinyl / Carpet); rendered as a hatch in 2D and a textured surface in 3D.
- **Floor material** — a project-wide default floor, overridden by any floor region.

**Editing**
- Click to select, marquee-drag to multi-select, drag to move.
- Arrow keys nudge 1" (Shift = 1'); Backspace deletes.
- Vertex / edge editing on every polygon type (zones, clouds, flow paths, floor
  regions): drag handles, double-click an edge to insert a vertex, double-click a
  vertex to remove it.
- A consolidated **Visibility** panel (alphabetized) toggles every layer, including a
  single master **IT / MEP** switch that hides all markers in any mode.

**Project**
- Undo / redo via a JSON-snapshot history stack.
- Save / Load to a JSON file; **Export PNG** and **Export PDF** (under the Save
  dropdown).
- Named **version snapshots** and a reference-image underlay with opacity / scale /
  calibration.
- **Light and dark themes** (light is default; wall colors darken for contrast).
- **Collapsible sidebar** and responsive panel widths for small screens.

---

## Views & Panes

The canvas is a **configurable pane layout** rather than a single view. A switcher
(bottom-right: ▢ single / ◫ split / ⊞ quad) sets how many panes are shown, and each
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
- **X-Ray** — transparent ghost walls with crisp edge lines and a prominent grid.
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
- A **finished-floor datum** (0'-0") and **ceiling line** with height labels.

Openings stay on the plane of the wall they belong to: an opening foreshortens to
edge-on (and is omitted) when its wall is perpendicular to the view. A near-face
hidden-surface rule means each elevation shows only the openings on the building face
it looks at — so Front and Back (and Left and Right) read as distinct faces rather than
mirror images of each other.

Each elevation pane has an **independent camera** (scroll to zoom, drag to pan;
auto-fits on open). 

**View + annotate (v1):** click a wall / door / window / column to select it — the
right-hand inspector opens and edits round-trip into the model (e.g. changing ceiling
height instantly reshapes the elevation). With an elevation pane focused, the
**Dimension** and **Label** tools place annotations directly in that elevation's own
coordinate space (stored per direction). Editing geometry *within* an elevation
(dragging a window's sill, etc.) is planned for a later version.

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

Shift while placing keeps the tool active for rapid repeat placement.

---

## Architecture

```
src/
  main.tsx              # app entry
  app/App.tsx           # mounts the Test Fit component
  imports/
    testfit.jsx         # 2D app: all state, UI, tools, modes, persistence (~6900 lines)
    testfit3d.jsx       # the React Three Fiber 3D scene (~1400 lines)
```

**Tech stack**

- **React 18 + Vite** single-page app
- **three.js + @react-three/fiber + @react-three/drei** for the 3D view
- **lucide-react** icons, **Radix UI** primitives (tooltip, etc.)
- Inline `<svg>` for the 2D canvas (not canvas2d) — one big SVG with a pan/zoom
  `<g transform>`
- **Tailwind** for chrome/layout; most canvas styling is inline for precision

**State model (single top-level component)**

Each entity type is a `useState` array. Positions are canvas pixels. Named snapshots
are stored as full model blobs in a `snapshots` array. Key derived helpers:

- `captureModel` / `loadModel` — serialize / restore the full working state
- `hitTest` — mode-aware pointer hit detection
- `findNear` — node snapping for drawing
- `findProxHover` — mode-gated proximity hover
- `traceOuterBoundary` (3D) — planar face-trace for the auto-fit floor

---

## Running the Code

```bash
npm i          # install dependencies
npm run dev    # start the Vite dev server
npm run build  # production build
```

Open the dev URL Vite prints (typically `http://localhost:5173`).

---

## Data Model & Persistence

A project serializes to a single JSON object containing every entity array
(`nodes`, `walls`, `zones`, `markers`, `doors`, `windows`, `columns`, `dims`,
`labels`, `revClouds`, `flowPaths`, `floorRegions`), plus `floorMaterial`,
`elevAnnotations` (per-direction elevation dimensions/labels), the reference-image
settings, scale, the `snapshots` library, and the `panes`/`splitPos` view layout. The
same payload backs Save/Load, undo/redo history, snapshots, and import/export — and is
forward-compatible: missing fields default (no elevation annotations, single Plan
pane), and older files that used the retired *phase* layering load cleanly (their
per-entity `phase` tags are ignored, and any legacy named *versions* are migrated into
snapshots on import).
