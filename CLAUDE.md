# Test Fit — codebase guide

A React + Vite single-page app for floor-plan test fits: a 2D plan canvas, four
orthographic elevations, a 3D model, IT/MEP markers, zones, a furniture (Furnish) stage,
and a budget rollup.

## Workflow stages (MODES, testfit.jsx)

Six stages, number-keyed 1–6 (shortcuts in the keydown handler; the set is `MODES`, and
the TopBar dropdown iterates it): **1 Build**, **2 IT/MEP**, **3 Zones**, **4 Furnish**
(place & arrange furniture in zones), **5 Budget**, **6 Docs**. Adding/reordering a stage
means: edit `MODES`, the number-key shortcuts, the TopBar title ("Workflow stage (1–N)"),
any "stages 1–N" copy, and the per-mode sidebar/inspector branches keyed on `mode`.

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
                       ISOMETRIC: pane view "iso" renders this same scene through an
                       ORTHOGRAPHIC camera locked to the (±1,1,±1) diagonal — true
                       isometric, so parallel edges stay parallel and the drawing measures.
                       `isoCorner` (ne/se/sw/nw, ISO_CORNERS holds the vectors; plan-north
                       is −z) picks the corner; the ◄ ⟲ ► controls step 90° through
                       ISO_ORDER. IsoCameraRig fits ONCE on the first sized frame (r3f ortho
                       frustum = canvas size in world units, so visible height =
                       size.height / zoom); a corner change then only swings the camera
                       about the CURRENT target — zoom, pan and distance are preserved, so
                       rotating never loses your framing. Re-fit is explicit via the
                       `isoFitNonce` prop (Reset button).
                       The swing is ANIMATED (~0.42s, easeInOutCubic) by a useFrame tween at
                       priority 0 — i.e. after drei's OrbitControls update (priority −1), so
                       the tweened pose is what renders; the pivot is read live each frame so
                       panning mid-swing tracks. It aims at the corner's ABSOLUTE azimuth
                       (not a relative +90°), so clicking again mid-animation re-aims from
                       the current pose and still lands exactly on a corner instead of
                       drifting off-axis. Honors prefers-reduced-motion (snaps instead).
                       cam3d SAVES `zoom` — an orthographic camera's position does NOT set
                       the image scale (only camera.zoom does), so a position-only pose made
                       iso slides silently re-fit to the whole building. IsoCameraRig
                       restores initialCamera (position+target+zoom) when present and only
                       falls back to applyFit() for a fresh view. Orbit rotation is disabled (that's
                       what keeps it isometric); pan/zoom stay, and left-drag pans.
                       CUTAWAY (`hideNearWalls`, eye button — isometric only): the hidden set
                       is geometry.js cutawayHiddenWalls(nodes, walls, camVec) — a NEARNESS
                       (foreground) rule: hide a boundary wall whose MIDPOINT is on the
                       camera's side of the node centroid ((mid − centroid)·camVec > 0). The
                       user chose this over a face-normal test: at a re-entrant/notch corner a
                       wall's OUTWARD face can point away from the camera while the wall itself
                       is still in the foreground occluding the view (the notch door wall), so
                       nearness — not which way the face points — is what drops it. Accepted
                       trade-off: a perpendicular side wall (e.g. a window wall) whose midpoint
                       lands on the near side can drop at some angles even though its face
                       points away. (History: a face-normal test kept the door wall standing;
                       an "orphan sweep" that dropped stranded far walls hid the window wall —
                       both wrong. boundaryOutwardNormals is still used, only to enumerate the
                       BOUNDARY walls — its winding-based normals are correct on concave plans
                       where a centroid normal test would flip a notch wall backwards.) Only
                       boundary walls (traceOuterBoundary) are ever hidden; partitions stay so
                       the cutaway still shows the layout. Junction caps and baseboard plinths
                       that belong solely to hidden walls drop with them, else they float in
                       mid-air. Recomputed on rotate, so the open side follows the corner.
                       Iso slides save/restore the corner via
                       cam3d.isoCorner and render through the 3D slide branch — note
                       IS_3D_VIEW() in testfit.jsx gates data3d prep AND the elevation-vs-3D
                       slide branch, so "iso" must go through it, never the elevation path.
                       FURNITURE: the Furnish stage is 2D-only, so pieces appear in 3D/iso
                       as flat FLOOR DECALS (FurnitureFootprint3D) — the catalog draw(W,D)
                       primitives are rendered to a CanvasTexture (reused verbatim, incl.
                       arcs/curves via Path2D) mapped onto a W×D-ft plane at y=0.08, rotated
                       [0,-angle,0] (the floor-item convention) to match the plan. Gated by
                       `visibleFurniture`; colour = T.furniture (mono tier when mono on),
                       selected → T.selBorder. NOT a mesh — no height/occlusion.
                       WALLS (Pascal-style, reworked): each wall is ONE WallSolid mesh —
                       its mitered footprint quad (scene-level computeWallFootprints memo,
                       shared with the 2D plan) extruded via wallGeo3d.js, with door/window
                       openings CSG-SUBTRACTED (three-bvh-csg) for true reveals. Walls tile
                       gap-free with zero overlap at junctions by construction: no end
                       extensions, no cover-up corner posts. CapSolids extrudes the shared
                       junctionCapPolys wedges at 3+/odd junctions (height = MIN adjacent so
                       they never poke above pony walls; textured material wins).
                       Wedges OVERLAP the walls they fill between — at a perpendicular T the
                       wedge is the whole junction block, sitting INSIDE the through wall
                       (verify: the cap centroid is point-in-poly of that wall's quad).
                       Harmless in 2D (caps are painted behind), but in 3D that was the
                       glitch at 3-wall junctions: coincident coplanar faces z-fighting, plus
                       the cap drawing its own outline inside the wall in mono/print/xray.
                       Caps therefore render with `suppressEdges` (gap filler, not an object)
                       and `sinkBehind` (polygonOffset — the wall wins the depth test
                       deterministically, so the wedge only shows in genuine slivers).
                       JunctionTrim keeps only the detailed-mode baseboard plinth.
                       Outlines (xray ghosts, demo red) come from buildWallEdgeSegments —
                       procedural, because CSG output has T-vertices that break
                       EdgesGeometry (caps use solidEdgesGeometry: position-only weld).
                       Demo walls DO cut their openings (a demoed wall must still show its
                       doors/windows as outlined holes — an uncut red mass erased them), but
                       skip the fixtures themselves (leaf/glass/casing/trim: they're being
                       removed, and solid finished parts inside a ghost wall read as
                       "staying"). They skip shadows (noAutoShadow), and keep the
                       two-pass union in WallSolid: depth-only prepass (renderOrder 10)
                       then UNLIT color at depthFunc EqualDepth (renderOrder 11) so the
                       whole demo run — including overlapping cap wedges — blends exactly
                       once per pixel; unlit keeps end-cap lighting from reading as a seam.
    wallGeo3d.js       three-dependent (only testfit3d imports it — keeps the lazy chunk):
                       footprintToLocal, buildWallSolidGeometry (Shape→Extrude→rotateX,
                       CCW-enforced winding, butterfly-quad fallback, CSG cuts w/ try/catch
                       uncut-prism fallback, applyBoxUVs box-projection at
                       WALL_MATERIAL_TILE_FT scale incl. reveal jambs),
                       buildCapSolidGeometry, buildWallEdgeSegments, solidEdgesGeometry;
                       pinned by wallGeo3d.test.js (three-bvh-csg@0.0.17 exactly — 0.0.18
                       needs three-mesh-bvh 0.9.x which drei 9.x forbids)
    markerMount.js     pure (no three.js): M3D mount config + markerMountYFt — imported by
                       both testfit3d and the 2D ElevationView so 3D stays in its own chunk
    model.js           pure: uid, sn, dst, polyArea/Centroid, pointInPoly, orthoSnap,
                       parseDimInput, migrateProjectData, PROJECT_VERSION, AUTOSAVE_KEY
    geometry.js        pure: wallResizeCursor, applySmartGuides, lineInt, wallMiterPt,
                       revCloudPath, traceOuterBoundary, boundaryOutwardNormals (per-boundary
                       -wall outward normal from the loop winding — winding-based so it holds
                       on concave/L-shaped plans), cutawayHiddenWalls (foreground/nearness
                       test → the 3D isometric cutaway's hidden-wall Set), wallEndMiter +
                       computeWallFootprints + junctionCapPolys (mitered wall footprint
                       quads + junction cap wedges, plan px — SINGLE source of truth for
                       wall shapes, consumed by BOTH the 2D plan render pass and the 3D
                       WallSolid/CapSolids; neighbours match by node id OR 6px endpoint
                       proximity), insetFloorPolygon (clear-inside
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
    theme.js           THEMES (light=Vellum / dark=Blueprint / print=white paper+black
                       ink) + MONO, cadCrosshair, WALL_KINDS(_LIGHT/_PRINT/_MONO), WALL_MATERIALS(_HATCHES),
                       DOOR_TYPE_STYLES, WINDOW_TYPE_STYLES (per-type elevation + 3D material
                       styling; pinned by theme.test.js).
                       PRINT theme (themeMode "print", topbar Light/Dark/Print segmented
                       control): a printer-friendly style spanning all three surfaces at once.
                       2D → THEMES.print + WALL_KINDS_PRINT (grayscale, value+dash not hue).
                       Docs → docsSheetT = print ? THEMES.print : THEMES.light (NEVER dark);
                       threaded to DocsView/PrintDeck as sheetTheme + used by renderSlideBody /
                       renderPlanCanvas's non-interactive branch → pure-white sheets. 3D →
                       style3d "print" (flat near-white walls + black edges everywhere, white
                       bg, no shadows/bloom/textures/HDRI); auto-selected when entering the
                       Print theme (effect in testfit.jsx), reverts to clay on leave, still
                       overridable via the 3D style buttons. Window glazing desaturates to gray
                       in print (WindowSvg, shared by canvas + docs).
                       MONO drawing system (buildMonoTheme + MONO_* tokens): one hue, four
                       FIXED tiers (MONO_TIER_WEIGHT + MONO_RAMP lightness); hierarchy is
                       carried by weight+value, never hue, so the scale reads the same in
                       every view and only the MAPPING changes (MONO_PROFILES). It is its own
                       axis, NOT a themeMode: `monoDraw` toggles it and the app keeps
                       following Light/Dark/Print. The Mono UI is a SPLIT BUTTON in the topbar
                       (TopBar.jsx): the left half toggles `monoDraw`; the chevron opens a
                       popover holding MonoSkinPanel (presets/hue/sat/paper/polarity/tier
                       legend) — it no longer lives in the sidebar. Changing any skin option
                       in the popover auto-enables `monoDraw` so the effect shows. Hence TWO
                       themes in play —
                       `T` = UI chrome, `canvasT` = drawing (mono when on); renderPlanCanvas
                       shadows T/wallKinds with the canvas pair, ElevationView/TestFit3D get
                       canvasT, doc sheets get docsSheetT, and DoorSvg/WindowSvg take a `tt`
                       theme prop because they'd otherwise close over the CHROME theme.
                       tierOf(theme, i) takes the theme explicitly for the same reason.
                       Plan mapping: exterior wall (from traceOuterBoundary) T1 / interior T2 /
                       openings T3 / zones + swing T4, walls poché'd solid in their tier ink
                       (no material hatch — a pattern breaks the one-ink rule); phase survives
                       via dash only. Mono colours are emitted as HEX, never `hsl(...)`: the
                       renderers append 8-digit alpha (`color + "25"`) everywhere and hsl+alpha
                       is invalid CSS that silently renders BLACK.
                       Iso/3D mapping (testfit3d): mono overrides every style3d's paper, grid,
                       floor and wall material — surfaces go unlit paper-tone so no lighting
                       gradient competes, and the EDGES carry the drawing: shell walls T1,
                       partitions T2 (exteriorWallIds, the same boundary trace the cutaway
                       uses), openings T3 (buildWallEdgeSegments returns {shell, openings} as
                       separate geometries precisely so they can differ), door leaf + glass T3
                       via `monoInk`. NOTE: WebGL caps line width at 1px in practice, so tier
                       WEIGHT can't be drawn in 3D — only the ramp's lightness separates tiers
                       there. Real weights would need three.js Line2/fat lines.
                       NOT YET TIERED: ElevationView (also still imports WALL_KINDS directly
                       rather than the themed set).
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
    MarkerSymbol (testfit.jsx, keyed on `symbol`): power/lighting glyphs follow the
                       classic architectural electrical-plan convention (ceiling lights as
                       a filled "sunburst" disc + 8 rays via the shared `sunburst()` helper;
                       switches as a minimal dot + designation letter, no box; outlets as a
                       circle with true duplex/quad receptacle-slot ticks, not a single bar).
                       Reused by `recessed`, `pendant` (sunburst + suspension stem), `switch`,
                       and `outlet` branches — keep new light/switch/outlet symbol variants
                       consistent with this look rather than reverting to filled-shape glyphs.
                       WALL-DEVICE OFFSET: outlets/switches are STORED on the wall centerline
                       (wall snapping, elevation projection, 3D placement and dims all need
                       that) but DRAWN standing off the wall into the room, per the same
                       drafting convention. `marker.side` (+1/-1 along the wall's local +y
                       normal) is captured at placement from the side of the wall the user
                       clicked — so a device on a partition serves the room it was dropped in
                       — and re-derived on drag. geometry.js `markerDrawPos` is the single
                       source of truth: the renderer, the hit test (BOTH the build- and
                       itmep-mode marker branches), the rotate handle, the selected label and
                       the NEW badge all go through it, so the symbol you click is the symbol
                       you see. It is identity for markers with no `side` (placed before the
                       convention) and for components `isWallOffsetComponent` excludes —
                       ceiling outlets, panel, t-stat and racks stay drawn on the wall.
                       SCONCES offset too, and their glyph reads `side` directly: the plate
                       lies along the wall (local +x) and the light throw fans toward local
                       +y*side, so the plan shows the mounting wall AND the room it lights.
                       MOUNT HEIGHT: wall devices (`isWallMounted`, i.e. mount inwall/surface)
                       carry an optional `marker.mountY` in INCHES AFF, set by the inspector
                       slider and defaulting to the industry standard in M3D
                       (`defaultMountHeightIn`: 18" receptacle, 48" switch, 66" sconce, 60"
                       panel/t-stat). markerMountYFt's third arg applies it, so elevation and
                       3D stay in agreement; clearing it reverts to the catalog value.
    furniture.js       Furnish stage (v17) catalog of 2D PARAMETRIC furniture. Pure data +
                       a draw(W, D, wFt, dFt) fn per entry returning primitive shapes (rect/
                       line/circle/ellipse/path) in a LOCAL frame centred at 0,0 (+x width,
                       +y depth; first two args PX, last two FEET) that SCALE with the piece
                       — a sofa grows seat cushions as it widens; TABLES get chairs via
                       tableChairs() (~1 seat per 4' of edge — needs the feet to count, which
                       is why draw() takes them). FURNITURE_CATALOG keyed by type ({type,
                       name,cat,w,d (ft),round?,padFt?,draw}); `padFt` = how far the drawing
                       may spill OUTSIDE the w×d box (chairs) so the 3D decal plane expands
                       to fit — selection box / hit test stay w×d. FURNITURE_CATEGORIES
                       (palette order: seating/tables/desks/storage/misc — NO beds), tableChairs,
                       newFurniture(), furnitureHalfExtents(), pointInFurniture() (rotation-
                       aware; elliptical for round). Also ZONE_FURNISH_PLAN (per zoneLibrary
                       type → placeable pieces; tables carry their own chairs so table-based
                       zones list only the table — never separate chairs) + layoutZoneFurniture
                       (shelf/row pack a plan into a zone's bbox, footprint incl padFt+gap so
                       no overlap, block centred) — these drive the Zones-stage "Furnish this
                       zone" button (testfit.jsx furnishZone: one-time drop of real, arranged,
                       INDEPENDENT pieces tagged fromZone so a repeat click re-furnishes
                       instead of piling up; the user then arranges them in Furnish). Pinned
                       by furniture.test.js. Instances live in geometryStore.furniture as
                       {id,type,x,y,angle,w,d,label,phase,fromZone?} — plain x/y (no per-phase
                       px override). Rendered by Furniture2D.jsx.
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
    Furniture2D.jsx    one placed furniture piece as a top-down parametric symbol (props-
                       only). Draws the base footprint (rect or ellipse) + the catalog
                       draw() details, translated to (x,y) and rotated by angle; takes a `tt`
                       canvas theme (mono-aware, uses the `furniture` token) + optional mono
                       `tier`. Strokes use vectorEffect="non-scaling-stroke" so the LINE
                       WEIGHT stays constant on screen at any zoom (the plan sits in a
                       scale(zoom) group). Selection is driven by the canvas hitTest
                       (pointInFurniture). The Furnish stage (in testfit.jsx) renders, for a
                       selected piece: a ROTATE handle (drag → interactionStore.rotatingFurniture,
                       15° snap; the onMove branch MUST be in useCanvasEvents deps or it reads
                       a stale null — that was a real bug) and 8 SCALE handles (edges+corners →
                       furnitureResize; opposite-edge anchored, snapped to the inch, computed
                       in the piece's rotated (ux,uy) frame). Furniture participates in the
                       same edit machinery as markers/columns — Ctrl+C/V clipboard, alt-drag
                       duplicate, and "/" repeat-distribute (each of those call sites lists
                       furniture explicitly; copies drop `fromZone` so they're independent).
                       Furniture is a lockable/visibility layer ("furniture"). No 3D MESH yet,
                       but the plan FOOTPRINT
                       is shown flat on the floor in 3D/iso (testfit3d FurnitureFootprint3D;
                       its canvas+plane expand by spec.padFt so table chairs aren't clipped) —
                       a future pass could extrude these (the height scale handle waits on that).
    ui.jsx             SliderInput, LabelAnnotation, AlignBtn
    ElevationView.jsx  one elevation pane (own pan/zoom camera + dim/label/revcloud tools);
                       doors/windows/columns flagged `isNew` render a brand "NEW" tag +
                       heavier outline (as-built items read plainly). DEMO walls render a red
                       diagonal hatch (#elev-demo-hatch) + dashed red outline + "DEMO" tag;
                       openings riding a demo wall (found via hostWallOf — they attach by
                       position, not reference) get the same treatment and drop their
                       finished detailing (panels/lites/knob) so they never read as staying.
                       Dims are scoped to the
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
  **Their dependency arrays must list every `ctx` value they read.** A missing one doesn't
  fail loudly — the handler just keeps a stale copy until some *other* dep changes, so the
  bug shows up only on the FIRST interaction after changing a setting and then disappears.
  That's how "pick Wall Sconce, click, get a recessed can" happened (and, earlier, the dead
  furniture rotate handle). 46 such deps were missing across onDown/onMove/onUp — mostly
  tool config (outletType, lightingType, doorType, windowType, wallKind, …), plus
  `markerVisible` on hitTest — which had left hidden IT/MEP components still clickable.
  To re-audit, diff each handler's `ctx` reads against its deps array rather than eyeballing
  it (strip comments first, and note zustand setters are stable so they're not a risk).
  The flip side: **every value passed in `ctx` must itself be stable**, or listing it defeats
  the memoization it was meant to preserve. `setT` is a `useCallback([])` that reads selection
  and flowPaths via `getState()` instead of closing over them, and `isWallTool` lives at
  module scope, precisely so neither hands the handlers a new identity each render.
  testfit.jsx shrank ~6,860 → ~5,130 lines.
- **All pane chrome shares one bottom offset: `CHROME_BOTTOM` (= `GUIDE_RAIL + 4`).** The
  plan pane carries a full-width elevation-guide rail along its bottom edge, so its control
  cluster has to clear it; the 3D pane has no rail and its chrome sat at a bare 12, leaving
  the plan pane's rotation controls visibly floating ~28px higher in a split view. One
  constant now drives the plan cluster, the 3D style switcher, cutaway, ceiling and reset
  buttons (the iso rotate row stacks at `CHROME_BOTTOM + 36`). Anything new anchored to a
  pane's bottom edge should use it rather than a literal.
- **A control that can't act must say why, not silently no-op.** The 3D ceiling toggle is
  inert in two real cases — X-Ray deliberately skips the slab (it would hide the interior
  X-Ray exists to reveal), and an open plan has no closed wall loop for `traceOuterBoundary`
  to build a shape from. It previously stayed fully lit and clickable in both, with only a
  bare native `title="Ceiling"`, so it read as broken. `ceilingInertReason` computes the
  cause once and both copies of the button (split-pane `render3dPane` and the single-pane
  cluster) dim + disable themselves and surface that reason through the same Radix tooltip
  every neighbouring control uses.
- **Minimap is draggable, snapping to whichever of the pane's 4 corners it's dropped
  nearest** (`corner` state lifted to testfit.jsx as `minimapCorner`; `cornerStyle()` in
  Minimap.jsx maps it to CSS left/right + top/bottom). Two SEPARATE drag gestures live in
  the same component: dragging INSIDE the map (`navDragging`) pans the canvas; dragging the
  HEADER (`widgetDragging`) repositions the whole widget. A press that never moves past a
  4px threshold stays an ordinary click — `suppressClickRef` swallows the click a real drag
  would otherwise leave on whatever button the pointer released over (needed because the
  COLLAPSED pill has no non-button surface to grab, so dragging has to start on the button
  itself there; the expanded header instead has a dedicated blank drag-handle strip between
  Map and Fit, which needs no such guard since it has no onClick of its own).
  **`topInset`/`bottomInset` props (both wired to 40 from testfit.jsx) clear two other
  pieces of pane chrome that also dock to a corner**: `topInset` clears the "Plan ▾ 📷" chip
  (PaneChip, `top:8/left:8`, z-index 50 — above the minimap's 12) at top-left; `bottomInset`
  clears the rotate-view button row at bottom-right. Each chrome piece sits on only ONE side
  (chip on the left, rotate row on the right), so the OPPOSITE corner on that same edge never
  needs the inset — `cornerStyle(corner, topInset, bottomInset)` applies each only where it's
  needed. Without either, a minimap dropped into that corner renders BEHIND the other
  control and its drag handle becomes physically unreachable — permanently stuck, since
  there's no other way to grab it from there. If any other pane chrome ever claims a corner
  (bottom-left is still unclaimed), it needs the same treatment.
- **The plan grid coarsens as you zoom out, via `gridStepFeet(zoom)`
  (`geometry.js`)**: 1' pitch at normal/high zoom, 5' below 60%, 10' below 40% — otherwise a
  1' grid zoomed way out is just visual noise, not a scale reference. This is a SEPARATE
  concept from `snapGrid` (the placement snap increment, which gets FINER as you zoom IN —
  1"/3"/1' — and never changes on zoom-out); the two intentionally diverge in both direction
  and purpose. The base-grid `<g>` in the plan canvas render carries the computed step as
  `data-grid-step` for e2e assertions rather than deriving it from pixel spacing. The 3"/1"
  zoom-IN subdivisions index off their own always-1'-pitch `subI/subJ`, not the coarsened
  `startI/startJ` — they only render at zoom >= 1.5, well above where the grid ever coarsens,
  but they'd silently misalign if that ever changed without updating this note.
- **Plan strokes keep a constant on-screen weight at any zoom (`.tf-const-stroke` in
  index.css, wired onto `renderPlanCanvas`'s zoomed `<g>` only when `interactive`).** The
  whole live-editing canvas draws through one `translate(viewOff) scale(zoom)` group, so a
  literal `strokeWidth={1.5}` used to render 4x thicker at 400% zoom and 4x thinner (near
  invisible) at 15% — every wall/dim/grid/symbol stroke scaled with the geometry it belonged
  to. Fixed with `vector-effect: non-scaling-stroke` applied via one CSS rule to every
  descendant of that group, rather than editing ~200 individual `strokeWidth=` call sites —
  the same technique Furniture2D.jsx already used per-element (comment there: "the line
  renders at a CONSTANT screen weight regardless of the canvas zoom"), just applied once
  instead of per-primitive. **Scoped to `interactive` only**: `renderPlanCanvas` is reused
  for Docs/print slides at a fixed, architectural-scale zoom, where line weights SHOULD stay
  proportional to the drawing (real drafting convention) — pinning them there would be wrong.
  A handful of UI/annotation elements (smart guides, drag handles, elevation guide rail) were
  already manually dividing strokeWidth/strokeDasharray by `zoom` to fix this same problem
  for themselves alone — those divisions were removed since the blanket rule now handles it;
  leaving both in place would have double-compensated (rendered too thin). Circle radii on
  those same elements (`r={5 / zoom}`, drag-handle size) were left untouched — vector-effect
  only pins stroke width, not element geometry, so anything that also needs to stay a
  constant SCREEN SIZE (not just a constant stroke) still needs its own `/ zoom` math.
- **Enclosing a room gives it a floor** (`traceRoomLoops` in geometry.js + the auto-floor
  effect in testfit.jsx). `traceOuterBoundary` answers "what is the building's outline";
  `traceRoomLoops` answers "what rooms are there", which needs a full planar FACE traversal —
  an inner partition makes two rooms inside one unchanged outline. Rule: from each unused
  half-edge u→v, the face's next edge leaves v along the neighbour immediately CLOCKWISE from
  u. Interior faces come out positively wound (screen coords, +y down) and each connected
  component's outer face negatively, so **the winding sign drops the outdoors — not "the
  biggest face"**. Area-based rules fail two real cases: several disjoint wall groups have
  several outer faces, and a plan whose only room IS its outline has an outer face of
  identical area. The partition-wall unit test is what pins the sign down; the square test
  can't, since both its faces share a node set and an absolute area.
  **The effect fires on the TRANSITION to enclosed, never on "is currently enclosed"** — that
  is what makes Room → Floor: None stick instead of being undone on the next render. It
  seeds (records, creates nothing) when there's no meaningful before: first run, or any run
  whose predecessor had **zero walls**. That second condition is load-path-agnostic and is
  the one that matters: the app mounts empty and the autosave restore lands a render later,
  so without it every room in a restored building reads as just-enclosed and sprouts a floor.
  `knownRoomsRef` is also reset explicitly by undo/redo/load/New. Rooms are keyed by sorted
  node ids, which churn under welds — the "is this room already covered by a floor?" test
  (via `polyInteriorPoint`, NOT the centroid, which lands outside an L-shaped room) is what
  absorbs that.
- **A room's floor and its zone are linked positionally, by identical outline** — no stored
  id, matching how doors follow walls and floors follow a resize. Both are carried by the
  same `polyCarry` on a room resize, so identical outlines stay identical. The floorRegion
  inspector is the **Room card**: area, floor material (+ None, which deletes the region),
  zone (+ None), label. There is deliberately no Room section on the wall inspector — a
  shared wall borders two rooms and would have to disambiguate.
- **New goes through `applyProjectData`, the same hydrator as file import and autosave
  restore.** It used to re-list every collection by hand, and that list drifted: `furniture`,
  `columns` and `guides` were never added to it, so New left them standing on the canvas and
  read as doing nothing at all. It now loads `migrateProjectData({})` — which returns a fully
  defaulted empty model, panes and deck included — and only resets genuinely NON-model state
  (view offset/zoom, tool drafts, phases, grid toggle, zone library). Anything stored in the
  model belongs in `applyProjectData`; adding a collection there fixes load, snapshot-switch
  and New at once. Never re-enumerate collections in a second place.
- **The grid stops at the floor** — a floor is a finished surface, not a transparency, so the
  grid belongs to the empty paper around it. An SVG `<mask>` (white field, floors punched out
  in black) wraps the whole grid `<g>`. Hiding the Floors layer brings the grid straight back
  with no extra branch, because the mask is built from what actually renders. Masking the GRID
  rather than painting an opaque base under the floor is deliberate: the floor sits above the
  underlay `<image>`, and an opaque base would hide the very thing people trace over.
  Mask and hatch are cut from **one shared `floorPaths` memo** — two path strings that
  disagree by a hair leave the grid showing in the seam.
  **The `<mask>` MUST carry explicit x/y/width/height.** A mask region defaults to
  `-10%,-10%,120%,120%`, and under `maskUnits="userSpaceOnUse"` those percentages resolve
  against the SVG viewport but apply in the ZOOMED model space the grid group lives in — so
  panning past that window put the grid outside the region, where a mask reads as zero, and
  the grid vanished from most of the canvas. Shipped that way once; it is not cosmetic.
  The extent is padded **a full `stepPx`**: lines round outward off `startI`/`endI` and
  overrun `minX..maxX` by up to one step, so a mask cut to the nominal bounds shaves a strip
  off the right and bottom edges.
  The **id encodes that extent** (`grid-floor-mask-<x>_<y>_<w>_<h>`) because the extent varies
  per canvas — live pane, each Docs sheet, each printed page — while the floor paths are
  global. Same extent means an interchangeable mask that's safe to share; a different one
  can't collide. One fixed id would let whichever copy the document holds first govern
  canvases framed differently, and printing renders every slide's sheet alongside the
  on-screen one, so several coexist. Scoping by slide id does NOT work: the selected slide
  renders twice (sheet + printed page) at different extents under one id.
- **A room inside a room is CARVED OUT of the room around it** (`nestedFloorHoles` in
  geometry.js). A floor drawn inside another lies wholly within it, so both hatches painted,
  the outer sf counted a room it doesn't own, and in 3D the two sat coplanar and z-fought.
  The holes are **DERIVED from the current floor set, never stored** — no schema change, no
  migration, and a hole appears, moves and closes on its own as the inner room is added,
  resized or deleted. Storing them would mean keeping a second copy of the inner room's
  outline in sync through every carry, weld and undo.
  Each floor gets its **immediate** children only (parent = the SMALLEST floor containing it).
  Every descendant would break both consumers at three levels of nesting: the area subtracts
  the core twice, and the even-odd rule flips it back to filled. Strictly-larger-only, so two
  floors with identical outlines read as a duplicate rather than holing each other.
  Four consumers, one memo (`floorHoles`) so they can't disagree: the plan `<path>` appends
  each hole as a subpath under `fillRule="evenodd"` (which also lets clicks fall through to
  the inner room's own floor); the Room card's centerline sf subtracts the hole areas; 3D
  passes them to `buildFloorGeo` → `THREE.Shape.holes`; and hitTest returns the **smallest**
  containing floor, since several now hold the same point and first-match-wins was really
  array order.
  Two non-obvious knock-ons. **`clearInsideSf` offsets a hole OUTWARD** — the nested room's
  walls stand in the surrounding room, so they come off its clear area too. That needed a new
  `outward` flag on `insetFloorPolygon`: it normalizes winding by design (there's a test
  pinning that), so passing a reversed ring can't flip the direction. **The auto-floor
  "already floored?" test is area-bounded**: covering the room's interior point stopped being
  proof, because a room built inside another sits under that room's floor — and it was being
  denied a floor entirely. A floor can never extend past the walls of the room it belongs to,
  so one bigger than the room is somebody else's. Point-in-polygon alone can't fix this in
  either direction: a centered inner room contains the outer floor's interior point too.
- **A placed floor is INERT until double-clicked** (`floorEditId` in interactionStore). A
  floor covers its whole room, so it lies under nearly every press inside that room — a plain
  click-drag slid it out of register with the walls, which is easy to do by accident while
  panning and easy to miss afterwards. Now a single click only SELECTS it (Room card, dashed
  outline); a **double-click** unlocks that one floor for moving and vertex editing. The
  second mousedown of the double-click both unlocks and starts the drag (`e.detail >= 2` in
  the `floorRegion` onDown branch, the same idiom the flowPath/vertex branches already use),
  so double-click-and-drag works as one gesture. hitTest gates the vertex/edge handles on
  `floorEditId`, not on selection — otherwise selecting a floor would hand back the very
  handles the lock exists to withhold — and reads it via `useInteractionStore.getState()`,
  matching how it already reads selection, so it stays out of the deps array.
  **Relocking is DERIVED from selection**, not cleared at each exit: one effect in testfit.jsx
  drops `floorEditId` whenever that floor stops being the Build-mode selection, so Esc,
  delete, undo, clicking another object and leaving Build all relock for free. Enumerating
  those exits instead would leave a floor silently draggable the first time someone adds a
  sixth way out. The Room card carries a `room-shape-lock` chip that states which state
  you're in and toggles it — the gesture alone isn't discoverable.
  NOT gated: marquee multi-drag (`selectedIds.length > 1`), which is already a deliberate
  two-step gesture, and the arrow-key nudge.
- **Plan annotation text holds a constant on-screen size as you zoom OUT** (`textZoom` in
  testfit.jsx, `= zoom < 1 ? 1/zoom : 1`, applied to `DimLbl` plus the zone and rect-ghost
  dimension labels). At 40% a 10px dimension renders 4px and is unreadable. Deliberately NOT
  applied at or above 100%: text is already comfortable and growing it in model units would
  crowd the drawing. Standoffs scale with the type or an enlarged label sits on its own wall.
  This is the font-size counterpart to `vector-effect: non-scaling-stroke` — that pins stroke
  width and does nothing for type, and there is no CSS equivalent for font size.
- **The 3D ground is always flat theme paper; the floor material belongs to the floor**
  (`FloorPlane`, testfit3d.jsx). The ground used to be an either/or fallback: when
  `traceOuterBoundary` found no closed loop — the common case while a plan is still being
  drawn — a 500ft quad was rendered wearing the floor material, and a plain planeGeometry's
  UVs span 0..1 over the whole quad, so one wood plank was smeared across the entire world.
  Now the ground plane always renders untextured underneath, and the building footprint draws
  on top of it. Regression-tested by screenshotting the WebGL canvas and decoding it back
  inside the page to sample a corner pixel (saved slides store `image: null` and re-render
  live, so there is no bitmap in localStorage to sample).
- **Docs slide crop editing must never jump the camera on Edit/Save with no changes.**
  The locked (persisted/printed) render snaps to a true architectural scale
  (`slideStdScale`/`fitStandardScale` in utils/docs.js) so the sheet's scale label is honest.
  Editing used to force that snap off entirely (`std = rectEditing ? null : ...`), falling
  back to a raw exact-fit zoom — so opening Edit view zoomed in by whatever gap sat between
  the exact fit and the nearest standard scale, and Saving snapped back, a visible jump even
  when nothing was touched. Fixed by a single `docsSlideZoom(rect, editing)` helper
  (testfit.jsx, in the slide-body renderer) that both the plan and elevation branches now
  share: locked stays snapped as before; editing scales CONTINUOUSLY off the saved rect's
  snapped zoom by how much the live crop has grown/shrunk (`baseZoom * slide.rect.w /
  rect.w`) — smooth while dragging/wheeling (no per-frame re-snap jank) and exactly 1:1 with
  the locked view the instant editing starts or ends unchanged. The elevation branch's
  `fixedZoom` must be this same value (not `undefined`), or `ElevationView` falls back to
  its own internal raw-fit and the drag-to-pan pixel mapping (`dispZoom` in `dragLayer`)
  desyncs from what's actually rendered.
- **Minimap** (`src/components/Minimap.jsx`, bottom-left of the plan pane). A simplified
  overview for navigating a plan bigger than the window: flat blocks for floors/zones,
  single-weight lines for walls, dots for furniture and IT/MEP — recognisable enough to
  navigate by, deliberately not a second copy of the drawing. Click or drag it to re-centre.
  The math is pure and shared with fit-to-view (geometry.js `contentBounds`, `fitTransform`
  — UNIFORM scale, so the overview keeps the model's proportions — `viewportRect`, and
  `centerViewOn`, which is the exact inverse of `viewportRect` so clicking a spot lands it
  mid-canvas). It **hides itself when the whole model already fits on screen**, since a map
  of what you can already see is just noise. The canvas's pixel size comes from a
  ResizeObserver into state, NOT a ref read during render — a ref can't trigger the first
  paint, so the map would stay hidden until some unrelated re-render came along. The
  viewport frame counter-rotates by `canvasRotation`, because the canvas is CSS-rotated
  about its centre.
- **Resizing a room carries its floor and zone.** floorRegions/zones hold NO reference to
  walls or nodes — the rect-room tool writes a floor from the *same scalars* as the wall
  corners, bit-identical at birth, then they drift. So the binding is POSITIONAL: geometry.js
  `polyCarryStart` snapshots polygon vertices sitting on a node about to move (tol
  `pxPerFoot/48` = ¼", a quarter of the finest 1" snap step so deliberately-adjacent vertices
  never fuse), and `applyPolyCarry` shifts them by that node's TOTAL delta. Total, never
  per-frame and never absolute assignment — total-delta keeps a vertex exactly on its node
  across an unbounded drag and never fuses one that merely started nearby. Wired at all four
  node-write sites (node drag — which needed a new `startNode` snapshot; wall drag; multi
  drag; and the arrow nudge in testfit.jsx, or keyboard resize would silently desync).
  Deliberately NOT wired to the alt-drag COPY branch: a copy starts stacked on the original,
  so a carry there would drag the ORIGINAL room's floor away with the duplicate. Guards mirror
  `zoneFurnStart`: locked layer opts out, hidden phase stays put, and polygons already being
  dragged wholesale are excluded so they can't move twice. NOT doing collinear-edge matching —
  it's ambiguous (which vertices, and by how much, given a wall drag is a free 2-D
  translation); the real answer for "floor always matches walls" is a *derived* floor from
  `traceOuterBoundary`, which needs no coupling at all.
- **Adding a name to a dep array can crash the app.** Dep arrays evaluate DURING render, so
  naming a `const` declared further down the component is a TDZ ReferenceError — the build
  passes and the app white-screens. Hit twice this session (`wc` in zoomToSelection, `setT` in
  the keydown effect). Both were stable values that didn't need listing. The e2e smoke test
  ("every stage and view renders clean") is what catches this class; run it after touching
  deps.
- **Moving a zone carries its furniture.** `drag.startFurn` snapshots the enclosed pieces
  (and their start points) in `onDown` via `zoneFurnStart`; `onMove` shifts them by the
  zone's own total delta. Snapshotting matters — recomputing containment mid-drag would
  shed pieces as soon as the zone slid off them. Membership is POSITIONAL
  (`furnitureInZone` in model.js: a piece belongs to the zone its CENTER sits in), not
  `fromZone` provenance, so dragging a piece out of a zone detaches it and dragging one in
  adopts it — matching what the drawing shows. A locked Furniture layer opts out, and
  pieces on a hidden phase stay put rather than moving unseen. Deliberately NOT carried:
  zone RESIZE (the user chose "one-time drop, then yours" — resizing never re-lays-out) and
  alt-drag zone COPY (a copy starts on top of the original, so carrying would rip the
  original's furniture out; it has no `startFurn`, which short-circuits the carry).

- **Selection is mode-scoped**: you can only select items that belong to the current
  mode's tool set. hitTest branches are already mode-gated (build/zone/itmep/furnish),
  but floorRegions + flowPaths ALSO carry per-element `<g onClick>` handlers (a second,
  independent selection path), so those two groups additionally gate their `pointerEvents`
  by `mode === "build"` — otherwise a click lands on the element's own onClick and selects
  it regardless of mode. Zones have NO per-element onClick (hitTest-only, `mode==="zone"`),
  so they need no such guard. When adding a new selectable element with its own click
  handler, mode-gate its pointerEvents the same way or it will leak across modes.
  The MARQUEE is a third selection path and needs the same gating: its per-mode blocks must
  match what that mode's hitTest accepts, element for element. Build's marquee was selecting
  every marker while Build's hitTest takes only `layer === "power"` (electrical + lighting —
  the one layer Build and IT/MEP share), so box-selecting in Build grabbed IT/MEP cameras and
  speakers and let arrow keys drag them. Power markers are deliberately editable in BOTH
  stages; every other spec layer belongs to IT/MEP alone.
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
