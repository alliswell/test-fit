# TestFit v2 — Version Closeout

**Status:** ✅ Green — build clean, all tests passing, no known crashes.
**As of:** 2026-07-24

TestFit v2 is a React + Vite single-page app for architectural floor-plan test fits:
a 2D plan canvas, four orthographic elevations, a live 3D model + isometric view, an
IT/MEP marker system, zones, a budget rollup, and a Docs (sheet/deck) stage for
presentation output.

---

## 1. Health snapshot

| Check | Result |
| --- | --- |
| `npx vite build` | ✅ clean (~4s; one benign "chunk > 1200 kB" advisory) |
| `npx vitest run` (unit) | ✅ **120 passing** / 6 files |
| `npx playwright test` (e2e) | ✅ **55 passing** |
| Runtime | ✅ no ErrorBoundary crashes; 3D lazy-chunk mounts cleanly |
| Persistence | ✅ autosave + `migrateProjectData` (schema at v16) |

Source: **~14.5k lines**. Largest units: `testfit.jsx` (5.6k, the main editor),
`testfit3d.jsx` (2.0k, the 3D/iso scene), `useCanvasEvents.js` (1.9k, extracted canvas
handlers), `ElevationView.jsx` (877), `DocsView.jsx` (594).

Key deps pinned: `three ^0.184`, **`three-bvh-csg ^0.0.17` (exact — see Learnings §4.2)**,
`@react-three/fiber ^8.18`, `@react-three/drei ^9.122`, `zustand ^5`, `vitest ^4`,
`@playwright/test ^1.60`.

---

## 2. What shipped in v2

**Drawing & modeling**
- 2D plan canvas with mitered wall footprints, doors/windows/columns, zones, floor
  regions, flow paths, dimensions, labels, revision clouds, smart guides.
- Shift-locks-to-axis on the measuring tool.
- Clear-inside (tape-measure) dimensions on **zones** (the named rooms), incl. a dashed
  inside-face overlay with per-edge clear dims.

**3D & isometric**
- Reworked walls (Pascal-style): each wall is one **mitered-footprint extrusion** with
  **CSG-subtracted openings** for true door/window reveals — walls tile gap-free with zero
  overlap at junctions by construction (no end-extensions, no cover-up posts).
- True **orthographic isometric** locked to the (±1,1,±1) diagonal, with animated
  ◄ ⟲ ► corner rotation that preserves zoom/pan.
- **Cutaway** (dollhouse): hide the foreground walls per camera corner.
- Realism pass: baseboards, corner plinths, wall-base AO, floor bump maps, toggleable
  ceiling; Clay / X-Ray / Detailed / Print 3D styles.

**Elevations**
- Four elevations with per-pane pan/zoom, dimension/label/revcloud tools, anchored dims
  that track moved items, section-cut-scoped dims, per-type door/window styling, NEW-tag
  for new construction, DEMO hatch/tag for demolition.
- Isometric elevation view.

**Docs (stage 5)**
- Deck strip + printable sheets (title block, per-slide notes), slides that **live-render**
  the current model (plan / elevation / 3D / budget / FF&E / title-section).
- Standard architectural scales, per-slide layer visibility + presets, drag-to-reorder +
  one-level nesting, sheet zoom, section/title slides with auto "In this section" index.

**Themes / output**
- **Print theme** — printer-friendly across 2D, 3D, and Docs at once (grayscale, value +
  dash instead of hue, white sheets, flat 3D).
- **Mono drawing system** — a canvas-only (not whole-UI) single-hue, fixed 4-tier drawing
  skin with swappable presets (blue/cream, blueprint, sepia, charcoal, oxblood), applied to
  plan / isometric / 3D. *(Elevation tiering still pending — see §5.)*

**IT/MEP & budget**
- Catalog-driven marker symbols (plan/elev/3D), white/black finishes, directional aim, door
  access-control readers; budget rollup pricing only `isNew`/`kind`-flagged construction.

---

## 3. Architecture & codebase state

The app is mid-refactor from one giant file toward focused modules. The discipline that's
working (documented in `CLAUDE.md`, keep enforcing it):

- **Pure math/data** → `src/imports/{model,geometry}.js` (+ `*.test.js`). Single source of
  truth. E.g. wall-footprint math is shared verbatim between the 2D plan and the 3D solids.
- **Constants/catalogs** → `src/constants/{theme,specs}.js`.
- **Props-only components** → `src/components/` (must never import `testfit.jsx` — no cycles).
- **Cross-cutting UI state** → `src/store/` zustand stores (view, layers, selection,
  geometry, interaction, docs).
- **The editor shell** → `testfit.jsx`; the 3D chunk (`testfit3d.jsx` + `wallGeo3d.js`) is
  lazy-loaded so three.js stays out of the initial bundle.

**Done refactors:** `useCanvasEvents` hook extracted (testfit.jsx shrank ~6.9k → ~5.1k);
top bar → `TopBar.jsx`.
**Still monolithic:** the sidebar and the inspector/option panel (~1.5k lines) remain inline
in `testfit.jsx` — the two biggest remaining extraction targets.

---

## 4. Engineering learnings (the hard-won ones)

### 4.1 Geometry on **concave / L-shaped** plans breaks centroid shortcuts
The single biggest recurring theme this version. Any "which way does this wall face / which
side is interior" decision that leans on the **node centroid** is only correct for **convex**
footprints. On an L-shape, a re-entrant (notch) wall's exterior can point *toward* the
centroid, so centroid heuristics silently invert.
- **Fix pattern:** derive facing/inside-outside from the **traced boundary loop's winding**
  (`boundaryOutwardNormals` — step a hair off the edge midpoint; the side that leaves the
  polygon is outward). Robust on concave plans.
- **Still latent:** `Marker3D` mount-side in `testfit3d.jsx` still uses the old centroid
  heuristic — same class of bug for markers on concave-wall interiors (follow-up filed).
- **Rule of thumb going forward:** never use a node-centroid dot for wall inside/outside;
  use the loop winding.

### 4.2 Mitered wall junctions: get the miter buckets right or you get z-fighting
The 3-wall-junction "glitch" (flicker on orbit) was **two stacked bugs** in `wallEndMiter`,
proven by a point-in-polygon overlap count, not guessed:
1. Left/right neighbour buckets were assigned by angle relative to the wall's *outgoing*
   direction, which **inverts at the n2 end**. Masked by a single-neighbour fallback.
2. That fallback fired at T-junctions where the collinear continuation lands in neither
   bucket, mitering both edges against the perpendicular wall → two collinear segments cut
   crossing diagonals → overlapping coplanar solids → z-fighting.
- **Fix:** bucket neighbours by which **face** they sit on (dot with the wall normal),
  which is end-independent; collinear neighbours dot to ~0 and correctly fall in neither
  bucket. Verified: junction overlap dropped from 210 sample-points to **0** at T/X/Y.
- **Lesson:** for shared geometry, **measure the invariant** (overlap area, gap area) in a
  unit test rather than eyeballing a render — 2D hid this bug for months because it paints
  caps behind a flat fill.

### 4.3 CSG output needs procedural edges
`three-bvh-csg` boolean output is **non-indexed with T-vertices** that break
`EdgesGeometry` (unpaired edges). We draw wall outlines **procedurally** from the known
analytic shape (footprint quad × height minus rectangular cuts) instead. `three-bvh-csg`
is pinned to **exactly 0.0.17** — 0.0.18 needs three-mesh-bvh 0.9.x which drei 9.x forbids.
CSG evaluate is wrapped in try/catch with an uncut-prism fallback (rebuild a fresh prism —
the first successful subtract disposes the original).

### 4.4 Orthographic isometric: image scale lives in `camera.zoom`, not position
An ortho camera's **position does not set image scale** — only `camera.zoom` does. r3f's
ortho frustum is the canvas size in world units, so visible height = `size.height / zoom`.
Saving a Docs slide's camera pose therefore **must persist `zoom`**, or the slide silently
re-fits to the whole building. Corner rotation swings the camera about the current target
(absolute azimuth, re-aimed each click) so zoom/pan survive.

### 4.5 Two-theme architecture: chrome vs. canvas
Mono had to affect **only the drawing surface**, not the whole UI. The clean model is two
themes in play at once: `T` = UI chrome (follows Light/Dark/Print), `canvasT` = the drawing
(mono when on). Renderers shadow `T`/`wallKinds` with the canvas pair; shared leaf
components (`DoorSvg`/`WindowSvg`) take an explicit `tt` theme prop so they don't close over
the chrome theme. **Gotcha:** mono colors are emitted as **hex, never `hsl(...)`** — the
renderers append 8-digit alpha (`color + "25"`), and `hsl()+alpha` is invalid CSS that
silently renders **black**.

### 4.6 WebGL caps line width at 1px
Tier **weight** can't be drawn in the 3D/iso view — only lightness separates mono tiers
there. Real weights would need three.js `Line2`/fat lines (offered, not built).

### 4.7 The cutaway: when "correct" is a product decision, not a geometry problem
The dollhouse cutaway on an L-shape has **no single geometric rule** that satisfies every
case — at a notch, the door-wall and window-wall genuinely conflict (face-normal vs.
foreground disagree, and the user wants opposite things for each). We iterated through
face-normal → orphan-sweep → face-normal → **nearness**, and ultimately **asked the user**
to choose the trade-off (they picked nearness: hide walls whose midpoint is on the camera's
side of the centroid; accept that a perpendicular side wall can drop at some angles).
- **Lesson:** when two "correct" behaviors conflict and each guess costs a round-trip,
  **surface the trade-off and let the user pick** rather than iterating on guesses. Ground
  the question in real per-corner data.

### 4.8 Verification discipline that paid off
- Prove geometry claims by **computation** (overlap counts, per-corner hidden sets), not by
  staring at screenshots.
- Visual probes run in **isolated Playwright contexts** seeded via `addInitScript` — never
  mutate the user's live preview localStorage.
- Every change: `vite build` + `vitest run` + `playwright test`, plus a targeted visual
  probe when the change is observable; delete throwaway probes + `test-results/` after.

---

## 5. Known issues / deferred work

| Item | Where | Notes |
| --- | --- | --- |
| **Mono elevation tiering** | `ElevationView.jsx` | Task #47, still pending: ground line + silhouette T1 / facade + roof T2 / openings T3 / texture T4. Also still imports `WALL_KINDS` directly instead of the themed set — fix in the same pass. |
| **Mono full-surface verify** | — | Task #49, pending final pass. |
| **Marker mount-side on concave walls** | `testfit3d.jsx` ~L1033 (`Marker3D`) | Latent §4.1 bug: ceiling/floor markers can mount on the wrong face of a notch wall. Fix = reuse `boundaryOutwardNormals`. **Follow-up task filed.** |
| **Cutaway trade-off** | `geometry.cutawayHiddenWalls` | By design (user chose nearness): a perpendicular side wall (e.g. a window wall) can drop at some angles. A true-occlusion version (keep both walls everywhere) is scoped and available if wanted. |
| **Bundle size** | build | 3D chunk is large; benign advisory. `manualChunks` if it matters. |
| **Sidebar + inspector still inline** | `testfit.jsx` | ~1.5k-line inspector is the biggest remaining extraction target. |

---

## 6. Recommendations for the next version

1. **Finish the Mono elevation pass** (§5) to make the drawing system complete across all
   four surfaces.
2. **Sweep the codebase for centroid-based facing logic** (§4.1) and migrate to
   `boundaryOutwardNormals`; close the `Marker3D` follow-up.
3. **Continue the extraction refactor** — sidebar, then the inspector/option panel — as
   props-only components, reading store state directly to trim the prop surface.
4. **Consider fat lines (`Line2`)** if true tier weights in 3D/iso become important (§4.6).
5. Keep the **"measure the invariant" test discipline** (§4.2/4.8) for any shared geometry
   change — it's caught real regressions that renders hid.

---

*Reference: `CLAUDE.md` holds the detailed module map and the per-subsystem design notes
that back these learnings.*
