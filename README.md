# Test Fit

A browser-based **architectural test-fit and space-planning tool** for laying out
commercial and residential spaces. Draw walls, place doors / windows / columns,
define program zones, drop IT / MEP markers, annotate with dimensions, labels, and
revision clouds, paint floor regions, plan circulation with flow paths, and review
the result in a live **2D plan** alongside an interactive **3D model** with three
render styles — all versioned, undoable, and saveable.

> "Test fitting" is the early-stage exercise of checking whether a program (the list
> of rooms / functions a tenant needs) actually fits within a given floor plate, and
> how. This tool is built to make that exploration fast, visual, and iterative.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Methodology](#methodology)
- [The Four Modes](#the-four-modes)
- [Tools & Features](#tools--features)
- [The 3D View](#the-3d-view)
- [Versioning (Phases)](#versioning-phases)
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

### Cumulative versioning

Design alternatives are organized as **phases** (Existing → v0 → v1 → v2 → v3). The
view is *cumulative*: the active phase shows its own items plus everything from
earlier phases. This mirrors how renovation and fit-out documents are layered — an
"existing conditions" base with successive design moves on top.

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

## The 3D View

Toggle 3D with the backtick `` ` `` key or the 2D/3D button; a **Split** view shows
both side by side with a draggable divider. Walls extrude to ceiling height, openings
are cut for doors and windows, and three render styles are available:

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

## Versioning (Phases)

Every entity carries a `phase`. The phase selector (top-left) sets the active phase;
the canvas shows the active phase plus all earlier ones. Markers placed in one phase
and deleted in a later phase are **soft-deleted** — they remain visible in earlier
phases and only disappear from the phase where they were removed forward. This makes
it safe to explore alternatives without destroying earlier work.

Named **versions** capture full project snapshots you can restore at any time.

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
| `` ` ``   | Toggle 3D view                  |
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

Each entity type is a `useState` array. Positions are canvas pixels. Phase-aware
position overrides live in a `px` map per element. Key derived helpers:

- `resolvePos` / `resolvePoints` — apply phase overrides
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
the reference-image settings, scale, phases, and named versions. The same payload
backs Save/Load, undo/redo snapshots, version history, and import/export — and is
forward-compatible: missing arrays default to empty, so older files load cleanly.
