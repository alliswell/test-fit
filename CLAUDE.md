# Test Fit — codebase guide

A React + Vite single-page app for floor-plan test fits: a 2D plan canvas, four
orthographic elevations, a 3D model, IT/MEP markers, zones, and a budget rollup.

## Code structure

The app grew from one giant file (`src/imports/testfit.jsx`). We are deliberately
splitting it for code health. **When adding a feature, put new code in the right place
instead of growing `testfit.jsx`:**

| What you're adding | Where it goes |
| --- | --- |
| Pure math / data transforms (geometry, parsing, migration) | `src/imports/model.js` or `src/imports/geometry.js` — and add a Vitest case in the matching `*.test.js` |
| Constants & catalogs (theme tokens, spec lists, option arrays) | `src/constants/` (`theme.js`, `specs.js`) |
| Reusable pure helpers (no React) | `src/utils/` (e.g. `labels.js`) |
| A props-only React component (panel, view, widget, modal, icon) | `src/components/` — one file per significant component |
| Cross-cutting UI state shared across components | `src/store/` (zustand: `viewStore`, `layersStore`, `selectionStore`) |
| The main editor: top-level state, canvas event handlers, layout composition | `src/imports/testfit.jsx` (the `TestfitTool` component) |

**Rules of thumb**
- New *panels/views* should be written as **props-only components** in `src/components/`,
  not inline in `testfit.jsx`. Pass `T` (the active theme object) and data/handlers as props.
- Components must **never import `testfit.jsx`** (no cycles). Data flows down via props;
  shared state goes through a `src/store/` zustand store.
- Pure logic should be **unit-testable** — keep it free of React/DOM and add a test.
- Mirror existing patterns: `ElevationView` and `ZoneLibraryModal` are the reference
  examples for a self-contained extracted component.

## Module map

```
src/
  app/                 App.tsx entry → renders <TestfitTool/>; shadcn ui/ (Tooltip…)
  imports/
    testfit.jsx        TestfitTool — main editor: undo/redo, persistence, plan-canvas SVG,
                       sidebar/inspector/top-bar JSX, pane layout. (largest file, ~5.1k lines)
                       Geometry/interaction state live in stores (destructured to the same
                       local names); the canvas handlers live in useCanvasEvents.js;
                       <TestFit3D> is lazy-loaded (React.lazy + Suspense).
    useCanvasEvents.js hitTest + onDown/onMove/onUp (+ nodeCentroid), extracted from
                       testfit.jsx. Reads geometry/interaction/selection via their stores;
                       receives helper callbacks, UI scalars, refs & tool-config via `ctx`.
    testfit3d.jsx      <TestFit3D> react-three-fiber 3D view (lazy chunk; imports M3D).
                       Demo walls short-circuit Wall3D: ONE continuous translucent red
                       volume + red WallEdges outline, full height/length, in all three
                       styles — doors/windows/casings on a demo wall are NOT rendered
                       (they're being demoed too; solid finished parts inside a ghost
                       wall read as "staying", which is backwards). Demo walls also skip
                       shadows (noAutoShadow + castShadow off). Their translucency is a
                       two-pass union in WallBox: a depth-only prepass (renderOrder 10,
                       colorWrite off) then an UNLIT color pass (renderOrder 11, basic
                       material, depthFunc EqualDepth, depthWrite off) — mitered demo-demo
                       corners overlap in volume, and naive per-box blending stacked the
                       alpha into darker corner pillars; the prepass guarantees exactly one
                       blend per pixel across the whole demo run, and unlit color keeps
                       end-cap lighting from reading as a seam.
    markerMount.js     pure (no three.js): M3D mount config + markerMountYFt — imported by
                       both testfit3d and the 2D ElevationView so 3D stays in its own chunk
    model.js           pure: uid, sn, dst, polyArea/Centroid, pointInPoly, orthoSnap,
                       parseDimInput, migrateProjectData, PROJECT_VERSION, AUTOSAVE_KEY
    geometry.js        pure: wallResizeCursor, applySmartGuides, lineInt, wallMiterPt,
                       revCloudPath, traceOuterBoundary, insetFloorPolygon (clear-inside
                       room outline: floor polygons sit on wall CENTERLINES — all dims/sf
                       in the app are centerline by convention — so this insets each edge
                       that has a wall along it by that wall's half-thickness to get the
                       inside-face outline; drives the "sf clear" readouts on the rect-room
                       draw ghost + the floor-region AND zone inspectors in testfit.jsx via
                       clearInsideSf/wallHalfT, and the selected-ZONE canvas overlay
                       (clearInsideOverlay): a dashed inside-face outline in the zone's
                       color with exact per-edge clear dims — zones are the named "rooms",
                       so selecting one answers "what does a tape measure read"; free-
                       floating zones with no walls on their edges render no overlay)
    *.test.js          Vitest specs for model/geometry
  constants/
    theme.js           THEMES (dark/light), cadCrosshair, WALL_KINDS(_LIGHT),
                       WALL_MATERIALS(_HATCHES), DOOR_TYPE_STYLES, WINDOW_TYPE_STYLES
                       (per-type elevation + 3D material styling; pinned by theme.test.js)
    specs.js           SPEC_COMPONENTS (IT/MEP catalog: normalized {symbol,color,mount,
                       finish?,directional?,product?} — drives plan symbol + elevation glyph
                       + 3D shape; pinned by specs.test.js), SPEC_LAYERS, COMPONENT_FINISHES,
                       FINISH_COLORS (white/black device finish), ACCESS_READER_COST,
                       DOOR/WINDOW option lists, FLOW_PATH_COLORS, PROX_DRAG_TYPES, SNAP_R,
                       LABEL_MAX_W, DEFAULT_PHASES; construction pricing WALL_COST_PER_FT
                       (by kind; existing=$0), DOOR_COST/WINDOW_COST (by type), COLUMN_COST
                       (flat each). Doors/windows/columns carry an `isNew` flag — as-built
                       ($0) unless flagged; the cost memo prices only `isNew` ones (walls
                       carry the same idea in `kind`)
  utils/
    labels.js          wrapLabelLines, labelBounds (label box layout)
    docs.js            pure Docs-stage helpers: SHEET_SIZES, sheetDims/Inches,
                       fitRectToViewport, fitStandardScale (true architectural scales),
                       defaultSlideName, formatSheetNo, per-slide layer visibility
                       (SLIDE_LAYER_DEFS, SLIDE_VIS_PRESETS, DEFAULT_SLIDE_VIS,
                       resolveSlideVis, matchSlidePreset — SLIDE_VIS_PRESETS + matchSlidePreset
                       are reused by the planning-view LAYERS panel too: its preset row (All +
                       the 5 Docs presets) maps the vis shape onto the live layersStore
                       flags via applyLayerPreset in testfit.jsx), and deck ordering
                       (dropSlideList — drag/drop reorder + one-level nesting via
                       slide.parentId; children stay adjacent after their parent in the
                       flat slides array; sanitizeSlideTree repairs bad refs on load)
                       (docs.test.js)
  components/
    icons.jsx          tool-rail SVG icons (Wall/Window/Column…)
    ui.jsx             SliderInput, LabelAnnotation, AlignBtn
    ElevationView.jsx  one elevation pane (own pan/zoom camera + dim/label/revcloud tools);
                       doors/windows/columns flagged `isNew` render a brand "NEW" tag +
                       heavier outline (as-built items read plainly). Dims are scoped to the
                       section cut they're drawn under (dim.cut = cut pos | null): only the
                       active cut's dims render (dimInView), so measurements stay tied to the
                       wall they annotate. migrate (v16) drops legacy untagged dims. A dim
                       endpoint snapped onto a wall/door/window/column/marker corner is
                       "anchored" to it (d.a1/a2 = {id,kind,part}, part being one of 8 named
                       corners/edge-midpoints for a bounded item or "c" for a marker's
                       center — see itemAnchorPoints). resolveDim re-derives anchored
                       endpoints from the CURRENT items list every render (falling back to
                       the dim's stored x/y if the target's gone), so a dimension tracks a
                       moved/resized item instead of freezing at draw-time; snapPts/snapElev
                       carry the same anchor info so the dim tool can capture it on click,
                       and dragging a p1/p2 handle by hand clears that endpoint's anchor
                       (startAnnoDrag) — a manual override detaches, it doesn't keep
                       following the old item. The
                       "<DIR> ELEVATION" title is right-aligned and inline with its row's
                       buttons (SVG `x="100%"` + textAnchor end + dominantBaseline central —
                       resolves against the SVG's own rendered width, so it holds under both
                       the live pane and the CSS-scaled Docs sheet). `readonly` branches the
                       offset: live pane has nothing else top-right, so it sits flush level
                       with the top-left view chip; Docs sheets have the "Edit view"/"Reset"+
                       "Save view" cluster there (top:10, up to 166px wide), so the title
                       instead sits to its left, same row.
    ZoneLibraryModal.jsx  zone catalog editor
    TopBar.jsx         props-only top chrome (wordmark, snapshot switcher, stage dropdown,
                       undo/redo, save/load/new, layout switcher, theme + settings)
    DocsView.jsx       props-only Docs stage (workflow stage 5): deck strip + printable
                       sheet (title block, slide-local notes) + inspector; also exports
                       PrintDeck (the @media print root). Model content arrives via the
                       renderSlideBody render prop built in testfit.jsx — slides LIVE-render
                       the current model (plan via renderPlanCanvas readonly, elevations via
                       ElevationView readonly+fixedRect, 3D live in-editor with a captured
                       JPEG for deck strip + print; "budget"/"ffe" slides render
                       BudgetSheet.jsx / FnESheet.jsx and "title" slides render
                       TitleSheet.jsx — a section-divider heading used to group the child
                       slides nested under it, with a right-hand "In this section" index
                       auto-built from those children (sheet no + name + per-view detail:
                       scale for plan/elevation, budget total, etc. — computed in
                       testfit.jsx's title branch and passed as `contents`); all three are
                       added from the deck-strip "+ Template" menu at the top of the strip).
                       Per-slide `vis` (null=inherit editor)
                       overrides layer visibility: renderPlanCanvas takes the layer flags as
                       shadowing params, so testfit.jsx's slideLayersFor() resolves a slide's
                       vis (incl. the elec/light marker split) into that bundle.
                       Deck strip rows drag to reorder / drop-onto-middle to nest
                       (dropSlideList via docsStore.dropSlide); a parent (section) row gets
                       a collapse chevron that hides its children — persisted per slide via
                       `slide.collapsed` (survives save/load; dropping into a collapsed
                       section auto-expands it). "title" section slides stay top-level:
                       rowZone refuses to nest them. Sheet zoom = fit scale ×
                       userZoom (chip buttons or ctrl/⌘+wheel — native non-passive listener;
                       plain wheel scrolls the zoomed sheet, crop-edit wheel stops
                       propagation so it never double-zooms).
                       Slides are always Vellum (light), regardless of the app's dark/light
                       theme — dark colors would print wrong. Three separate T-shadows make
                       this hold everywhere a slide renders: renderPlanCanvas (testfit.jsx)
                       shadows T/wallKinds to THEMES.light only when interactive:false (the
                       live editable canvas is unaffected); renderSlideBody (testfit.jsx)
                       shadows T unconditionally, since it's Docs/print-only, covering its
                       ElevationView/BudgetSheet/FnESheet/TitleSheet calls; DocsView.jsx
                       defines its own `sheetT = THEMES.light` for the sheet DOM it renders
                       directly (paper background, TitleBlock, notes) while its incoming `T`
                       prop keeps driving the surrounding chrome (deck strip, inspector,
                       floating tool/zoom chips) — so those correctly keep following the
                       theme toggle instead of flashing light every time you open Docs.
                       PrintDeck ignores its `T` prop entirely and always uses THEMES.light.
  store/               zustand stores (view/panes, layers, selection, geometry, interaction,
                       docs: slides + docSettings — project-level like snapshots, excluded
                       from captureModel so snapshot switching never clobbers the deck)
                       geometryStore: persistent plan geometry (nodes/walls/zones/markers/
                       doors/windows/columns/dims/labels/revClouds/flowPaths/floorRegions/
                       guides). interactionStore: transient canvas state (draws/drag/marquee/
                       pan/hover). Both destructured to the same local names in testfit.jsx —
                       steps toward extracting a useCanvasEvents hook.
  data/zone-library.json  default zone catalog
e2e/happy-path.spec.js Playwright shell/draw/elevation tests
e2e/docs.spec.js       Playwright Docs-stage tests (save view → slide, live render, notes)
```

## Refactors in progress / deferred

- **Extract `useCanvasEvents` hook — ✅ DONE** (all 3 stages): (1) geometry → `geometryStore`;
  (2) transient interaction state → `interactionStore`; (3) the four handlers (+ `nodeCentroid`)
  moved verbatim into `useCanvasEvents.js`. The hook reads geometry/interaction/selection via
  their stores and takes the remaining ~77 component bindings (helper callbacks, UI scalars,
  refs, tool-config) via a `ctx` object built where the hook is called (right after `setT`).
  testfit.jsx shrank ~6,860 → ~5,130 lines.
- Extract the chrome JSX into props-only components: **✅ top bar → `TopBar.jsx`** (done).
  Remaining: the **sidebar** (PROJECT/SUMMARY/placed-components/LAYERS) and the **inspector /
  option panel** (the largest, ~1.5k lines; many per-selection `updXxx` callbacks) — each its
  own focused pass. Pattern: props-only component, pass `S`/`T` + data/handlers (store-backed
  state can be read from the stores directly to trim the prop surface).

## Build & test

- Dev: `npm run dev` (Vite, port 5173).
- Build: `npx vite build` (must be clean).
- Unit: `npx vitest run` (model/geometry).
- E2E: `npx playwright test` (boots the app, draws, annotates, checks autosave).
- Persistence: autosaved to `localStorage["testfit-autosave"]`, debounced ~800ms;
  `migrateProjectData` normalizes older blobs. Bump `PROJECT_VERSION` on schema changes
  and extend the migrate test.
