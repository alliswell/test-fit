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
    testfit.jsx        TestfitTool — main editor: all geometry state, undo/redo,
                       persistence, hitTest + onDown/onMove/onUp, plan-canvas SVG,
                       sidebar/inspector/top-bar JSX, pane layout. (largest file)
    testfit3d.jsx      <TestFit3D> react-three-fiber 3D view; markerMountYFt()
    model.js           pure: uid, sn, dst, polyArea/Centroid, pointInPoly, orthoSnap,
                       parseDimInput, migrateProjectData, PROJECT_VERSION, AUTOSAVE_KEY
    geometry.js        pure: wallResizeCursor, applySmartGuides, lineInt, wallMiterPt,
                       revCloudPath, traceOuterBoundary
    *.test.js          Vitest specs for model/geometry
  constants/
    theme.js           THEMES (dark/light), cadCrosshair, WALL_KINDS(_LIGHT),
                       WALL_MATERIALS(_HATCHES), DOOR_TYPE_STYLES, WINDOW_TYPE_STYLES
                       (per-type elevation + 3D material styling; pinned by theme.test.js)
    specs.js           SPEC_COMPONENTS, SPEC_LAYERS, DOOR/WINDOW option lists,
                       FLOW_PATH_COLORS, PROX_DRAG_TYPES, SNAP_R, LABEL_MAX_W, DEFAULT_PHASES
  utils/
    labels.js          wrapLabelLines, labelBounds (label box layout)
  components/
    icons.jsx          tool-rail SVG icons (Wall/Window/Column…)
    ui.jsx             SliderInput, LabelAnnotation, AlignBtn
    ElevationView.jsx  one elevation pane (own pan/zoom camera + dim/label/revcloud tools)
    ZoneLibraryModal.jsx  zone catalog editor
  store/               zustand stores (view/panes, layers, selection)
  data/zone-library.json  default zone catalog
e2e/happy-path.spec.js Playwright shell/draw/elevation tests
```

## Deferred refactors (future passes, intentionally not done yet)

- Extract the canvas event handlers (`hitTest` + `onDown`/`onMove`/`onUp`, ~2,500 lines
  touching 50+ state vars) into a `useCanvasEvents` hook.
- Extract the sidebar, inspector/option panel, and top bar JSX into components. These are
  tightly coupled to main-component state, so they need their own focused pass (likely
  moving geometry state into a store first).

## Build & test

- Dev: `npm run dev` (Vite, port 5173).
- Build: `npx vite build` (must be clean).
- Unit: `npx vitest run` (model/geometry).
- E2E: `npx playwright test` (boots the app, draws, annotates, checks autosave).
- Persistence: autosaved to `localStorage["testfit-autosave"]`, debounced ~800ms;
  `migrateProjectData` normalizes older blobs. Bump `PROJECT_VERSION` on schema changes
  and extend the migrate test.
