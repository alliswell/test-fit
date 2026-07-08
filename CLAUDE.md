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
    testfit3d.jsx      <TestFit3D> react-three-fiber 3D view (lazy chunk; imports M3D)
    markerMount.js     pure (no three.js): M3D mount config + markerMountYFt — imported by
                       both testfit3d and the 2D ElevationView so 3D stays in its own chunk
    model.js           pure: uid, sn, dst, polyArea/Centroid, pointInPoly, orthoSnap,
                       parseDimInput, migrateProjectData, PROJECT_VERSION, AUTOSAVE_KEY
    geometry.js        pure: wallResizeCursor, applySmartGuides, lineInt, wallMiterPt,
                       revCloudPath, traceOuterBoundary
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
                       LABEL_MAX_W, DEFAULT_PHASES
  utils/
    labels.js          wrapLabelLines, labelBounds (label box layout)
    docs.js            pure sheet math for the Docs stage: SHEET_SIZES, sheetDims/Inches,
                       fitRectToViewport, defaultSlideName, formatSheetNo (docs.test.js)
  components/
    icons.jsx          tool-rail SVG icons (Wall/Window/Column…)
    ui.jsx             SliderInput, LabelAnnotation, AlignBtn
    ElevationView.jsx  one elevation pane (own pan/zoom camera + dim/label/revcloud tools)
    ZoneLibraryModal.jsx  zone catalog editor
    TopBar.jsx         props-only top chrome (wordmark, snapshot switcher, stage dropdown,
                       undo/redo, save/load/new, layout switcher, theme + settings)
    DocsView.jsx       props-only Docs stage (workflow stage 5): deck strip + printable
                       sheet (title block, slide-local notes) + inspector; also exports
                       PrintDeck (the @media print root). Model content arrives via the
                       renderSlideBody render prop built in testfit.jsx — slides LIVE-render
                       the current model (plan via renderPlanCanvas readonly, elevations via
                       ElevationView readonly+fixedRect, 3D live in-editor with a captured
                       JPEG for deck strip + print).
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
