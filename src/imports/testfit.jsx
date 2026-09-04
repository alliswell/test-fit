import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { MousePointer2, X, Plus, DoorOpen, Ruler, Box, LayoutDashboard, RotateCcw, RotateCw, Undo2, Redo2, Tag, Settings, ChevronDown, ChevronRight, ChevronLeft, Trash2, GitBranch, Columns2, PanelLeft, PanelLeftClose, PanelTop, Camera, Check, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import ZONE_LIBRARY_DEFAULTS from "../data/zone-library.json";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../app/components/ui/tooltip";
// Lazy-loaded so three.js / r3f / drei (a large bundle) only download when a 3D pane is shown.
const TestFit3D = lazy(() => import("./testfit3d"));
import { uid, sn, dst, ptSeg, polyArea, polyCentroid, pointInPoly, polyInteriorPoint, orthoSnap, isLightComponent, parseDimInput, migrateProjectData, PROJECT_VERSION, AUTOSAVE_KEY, dedupeWalls, splitWallThroughNodes, splitWallAtNode, weldWallCrossings } from "./model";
import { wallResizeCursor, applySmartGuides, lineInt, revCloudPath, insetFloorPolygon, computeWallFootprints, junctionCapPolys, traceOuterBoundary, markerDrawPos, wallSideSign, polyCarryStart, applyPolyCarry, contentBounds, centerViewOn, gridStepFeet, traceRoomLoops, nestedFloorHoles, wallSolidRuns } from "./geometry";
import { defaultMountHeightIn } from "./markerMount";
import { Toaster, toast } from "sonner";
import ShortcutSheet from "../components/ShortcutSheet";
import Minimap from "../components/Minimap";
import { useViewStore } from "../store/viewStore";
import { useLayersStore } from "../store/layersStore";
import { useSelectionStore } from "../store/selectionStore";
import { useGeometryStore } from "../store/geometryStore";
import { useDocsStore, DEFAULT_DOC_SETTINGS } from "../store/docsStore";
import DocsView, { PrintDeck, DeckStrip } from "../components/DocsView";
import BudgetSheet from "../components/BudgetSheet";
import FnESheet from "../components/FnESheet";
import TitleSheet from "../components/TitleSheet";
import Furniture2D from "../components/Furniture2D";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, ZONE_FURNISH_PLAN, layoutZoneFurniture, newFurniture } from "../constants/furniture";
import { sheetDims, sheetInches, sheetBodyDims, fitRectToViewport, fitStandardScale, scaledRectCam, defaultSlideName, viewTitle, resolveSlideVis, SLIDE_VIS_PRESETS, matchSlidePreset } from "../utils/docs";
import { useInteractionStore } from "../store/interactionStore";
import { useHoverStore } from "../store/hoverStore";
import HoverSubscriber from "../components/HoverSubscriber";
import { useCanvasEvents } from "./useCanvasEvents";
// Extracted modules — see CLAUDE.md → "Code structure" for what belongs where.
import { THEMES, cadCrosshair, tierOf, WALL_KINDS, WALL_KINDS_LIGHT, WALL_KINDS_PRINT, WALL_KINDS_MONO, WALL_MATERIALS, WALL_MATERIAL_HATCHES, buildMonoTheme, MONO_DEFAULT_SKIN } from "../constants/theme";
import { SPEC_COMPONENTS, SPEC_LAYERS, DOOR_TYPES, WINDOW_TYPES, FLOW_PATH_COLORS, PROX_DRAG_TYPES, SNAP_R, LABEL_MAX_W, DEFAULT_PHASES, COMPONENT_FINISHES, FINISH_COLORS, FLOOR_MATERIALS, FLOOR_MATERIAL_HEX, FLOOR_MATERIAL_HATCHES, ACCESS_READER_COST, WALL_COST_PER_FT, DOOR_COST, WINDOW_COST, COLUMN_COST, isWallMounted } from "../constants/specs";
import { wrapLabelLines, labelBounds } from "../utils/labels";
import { WallIcon, WindowIcon, ColumnIcon, RectRoomIcon } from "../components/icons";
import MarkerSymbol, { uiColor as uiColorFor } from "../components/MarkerSymbol";
import { DoorSvg, WindowSvg } from "../components/plan/OpeningSymbols";
import { DimLbl, DimString, FONT } from "../components/plan/Dims";
import PlanGridLayer from "../components/plan/PlanGridLayer";
import PlanFloorsLayer from "../components/plan/PlanFloorsLayer";
import PlanWallsLayer from "../components/plan/PlanWallsLayer";
import PlanZonesLayer from "../components/plan/PlanZonesLayer";
import PlanOpeningsLayer from "../components/plan/PlanOpeningsLayer";
import PlanMarkersLayer from "../components/plan/PlanMarkersLayer";
import { buildDxf } from "../utils/dxf";
import { SliderInput, LabelAnnotation, AlignBtn } from "../components/ui";
import ElevationView from "../components/ElevationView";
import TopBar from "../components/TopBar";
import Sidebar from "../components/Sidebar";
import ToolRail from "../components/ToolRail";
import Inspector from "../components/Inspector";
import ToolOptions from "../components/ToolOptions";
import ZoneLibraryModal from "../components/ZoneLibraryModal";

const isWallTool = (t) => t === "wall";
const $ = (n) => "$" + n.toLocaleString();
// Per-mousemove feedback (cursor ghost, proximity ring, smart guides, hovered node) lives in
// hoverStore, which THIS component never subscribes to — only the <HoverSubscriber> islands
// inside the plan SVG do. The setters are stable, so they bind once here.
const { setCursorPos, setGhostPos, setProxHover, setSmartGuides, setHoverNid } = useHoverStore.getState();

export default function TestfitTool() {
  const [themeMode, setThemeMode] = useState("light"); // "light" Vellum | "dark" Blueprint | "print"
  // MONO — a monochrome DRAWING system: one hue, four fixed tiers, hierarchy carried by
  // line weight + lightness. It is an axis of its own, NOT a UI theme: it restyles the
  // drawing surfaces (plan / elevation / iso / 3D / doc sheets) while the app chrome keeps
  // following Light/Dark/Print. `skin` (hue/sat/paper/polarity) is swappable.
  const [monoDraw, setMonoDraw] = useState(false);
  const [monoSkin, setMonoSkin] = useState(MONO_DEFAULT_SKIN);
  const monoT = useMemo(() => buildMonoTheme(monoSkin), [monoSkin]);
  const T = THEMES[themeMode] || THEMES.light;           // UI chrome
  const canvasT = monoDraw ? monoT : T;                   // everything that draws
  // wallKinds stays the UI set (kind buttons, legend, cost rows keep their phase colours);
  // canvasWallKinds is what the drawing surfaces use.
  const wallKinds = themeMode === "dark" ? WALL_KINDS
    : themeMode === "print" ? WALL_KINDS_PRINT : WALL_KINDS_LIGHT;
  const canvasWallKinds = monoDraw ? WALL_KINDS_MONO : wallKinds;
  // Docs slides are the printable output — NEVER dark. Vellum normally; pure-white Print
  // when the Print theme is active; the mono drawing skin when mono is on.
  const docsSheetT = monoDraw ? monoT : (themeMode === "print" ? THEMES.print : THEMES.light);
  const docsSheetWallKinds = monoDraw ? WALL_KINDS_MONO
    : (themeMode === "print" ? WALL_KINDS_PRINT : WALL_KINDS_LIGHT);
  const [projectName, setProjectName] = useState("New Club");
  // Persistent plan geometry lives in a Zustand store (destructured to the same local
  // names, so every read/write site below is unchanged; setters honor the useState
  // value-or-updater contract). This lets the canvas event handlers read/write geometry
  // via the store instead of through a large prop surface.
  const {
    nodes, setNodes, walls, setWalls, zones, setZones, markers, setMarkers,
    furniture, setFurniture,
    doors, setDoors, windows, setWindows, columns, setColumns, dims, setDims,
    labels, setLabels, revClouds, setRevClouds, flowPaths, setFlowPaths,
    floorRegions, setFloorRegions, guides, setGuides,
  } = useGeometryStore();
  // Transient canvas-interaction state (handler-owned, also read by render) — Zustand store,
  // same local names. Session-only; lets the canvas handlers move into useCanvasEvents.
  const {
    drawChain, setDrawChain, drawRect, setDrawRect, drawDim, setDrawDim, drawPolyZone, setDrawPolyZone,
    drawRevCloud, setDrawRevCloud, drawFlowPath, setDrawFlowPath, drawFloorRegion, setDrawFloorRegion,
    drag, setDrag, resize, setResize, marquee, setMarquee,
    rotatingMarker, setRotatingMarker, rotatingFurniture, setRotatingFurniture, furnitureResize, setFurnitureResize, calibrationLine, setCalibrationLine,
    guideDraft, setGuideDraft, addingLeaderToId, setAddingLeaderToId,
    floorEditId, setFloorEditId,
    panning, setPanning, panSt, setPanSt, spaceHeld, setSpaceHeld,
  } = useInteractionStore();
  // Docs stage: slide deck + sheet settings (project-level artifact, like snapshots).
  const {
    slides, setSlides, docSettings, setDocSettings, activeSlideId, setActiveSlideId,
    addSlide, updateSlide, removeSlide, dropSlide,
  } = useDocsStore();
  const [printing, setPrinting] = useState(false);   // print root mounted while true
  const docsCaptureRef = useRef(null);               // capture() for the docs-editor 3D instance
  const docs3dControlsRef = useRef(null);            // OrbitControls of the docs-editor 3D (separate from panes)
  const pendingPlanFitRef = useRef(null);            // slide rect to frame after "Edit model" returns to the plan
  // "Edit view" on Docs slides: cameras/crops are locked until explicitly unlocked.
  // 3D uses OrbitControls (docsCamEdit gates `enabled`); plan/elevation edit a working
  // copy of the slide's crop rect (docsEditRect) via a pan/wheel overlay — Save persists,
  // Reset reverts, and rendering re-snaps to the nearest true standard scale on save.
  const [docsCamEdit, setDocsCamEdit] = useState(false);
  const [docsEditRect, setDocsEditRect] = useState(null);
  const docsPanRef = useRef(null); // { sx, sy, rect, k } while dragging the crop
  useEffect(() => { setDocsCamEdit(false); setDocsEditRect(null); }, [activeSlideId]); // lock on slide switch
  useEffect(() => {
    const mv = (e) => {
      const p = docsPanRef.current; if (!p || !p.k) return;
      const dx = (e.clientX - p.sx) / p.k, dy = (e.clientY - p.sy) / p.k;
      setDocsEditRect({ ...p.rect, x: p.rect.x - dx, y: p.rect.y - dy });
    };
    const up = () => { docsPanRef.current = null; };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, []);
  const [floorMaterial, setFloorMaterial] = useState("Wood"); // project default floor: Wood | Concrete | Vinyl | Carpet
  const [peekGuides, setPeekGuides] = useState(false); // true while hovering an edge rail → reveal placed guides
  const [hoverGuideId, setHoverGuideId] = useState(null); // guide the cursor is near (reveal it so it's grabbable)
  const [guideScrub, setGuideScrub] = useState(null); // {dir, x, y} cursor plan pos while dragging a guide → drives that elevation's camera
  const [elevViews, setElevViews] = useState({}); // {dir: {uMin,uMax,uCenter}} each elevation's visible extent → drawn as a camera marker on the ruler
  const [cameraPan, setCameraPan] = useState(null); // {dir, u} while dragging the camera marker along a ruler → pans that elevation
  // Per-direction elevation annotations (separate coord space from plan dims/labels).
  // Declared here (before `snapshot`) so it's initialized when snapshot's deps evaluate.
  const [elevAnnotations, setElevAnnotations] = useState({});
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelText, setEditingLabelText] = useState("");
  const [bgImage, setBgImage] = useState(null);
  const [bgOpacity, setBgOpacity] = useState(0.35);
  const [bgScale, setBgScale] = useState(1);
  const [bgOffset, setBgOffset] = useState({ x: 0, y: 0 });
  const [pxPerFoot, setPxPerFoot] = useState(20);

  // ── Zone Library (editable at runtime) ─────────────────────────────
  const [zoneLibrary, setZoneLibrary] = useState(() => {
    try {
      const saved = localStorage.getItem("testfit-zone-library");
      if (saved) {
        const parsed = JSON.parse(saved);
        // v2: defaultW/defaultH are in feet (≤ 50). If any zone has a value > 50
        // it's the old pixel-based library — discard it and use fresh defaults.
        const hasPxValues = Object.values(parsed).some(
          z => z.defaultW > 50 || z.defaultH > 50
        );
        if (!hasPxValues) return parsed;
        localStorage.removeItem("testfit-zone-library");
      }
    } catch {}
    return ZONE_LIBRARY_DEFAULTS;
  });
  useEffect(() => {
    localStorage.setItem("testfit-zone-library", JSON.stringify(zoneLibrary));
  }, [zoneLibrary]);
  const [showSettings, setShowSettings] = useState(false);

  // ── Phases (retired — kept as inert defaults so legacy writes/refs work) ──
  const [phases, setPhases] = useState(DEFAULT_PHASES);
  const [activePhase, setActivePhase] = useState("existing");

  // ── Snapshots (named, independent full-model states) ─────────────────
  // [{ id, name, ts, data }] where data is a full captureModel() of the project.
  const [snapshots, setSnapshots] = useState([]);
  const [activeSnapshotId, setActiveSnapshotId] = useState(null);
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [snapMenuRect, setSnapMenuRect] = useState(null);
  const [showModeMenu, setShowModeMenu] = useState(false); // workflow-stage dropdown (top bar)
  const [modeMenuRect, setModeMenuRect] = useState(null);
  const [renamingSnapId, setRenamingSnapId] = useState(null);
  const [newSnapMode, setNewSnapMode] = useState(false); // inline "save as new" input
  const [snapDraftName, setSnapDraftName] = useState("");
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  // Anchor rect for the Save dropdown — fixed positioning so it escapes the
  // bar's overflow clip (the bar scrolls horizontally on narrow screens).
  const [saveMenuRect, setSaveMenuRect] = useState(null);
  // Collapsible sidebar — start collapsed on narrow screens.
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= 1000));
  useEffect(() => {
    const onResize = () => { if (window.innerWidth < 760) setSidebarOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Undo / Redo ────────────────────────────────────────────────────
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const skipSnapshotRef = useRef(false);
  // Rooms the auto-floor effect has already seen (see "Enclosing a room gives it a floor").
  // null means "the next run is a seed": record what's there, create nothing. Every path that
  // swaps the model wholesale — restore, load, undo, redo, New — resets it, because after one
  // of those EVERY room looks newly-closed and would otherwise sprout a floor.
  const knownRoomsRef = useRef(null);
  // Declared up here, above those call sites, rather than beside the effect that owns it:
  // this file's `const`s are read by callbacks defined earlier in the body, and one declared
  // after its readers is the TDZ crash this codebase keeps re-learning.
  const MAX_HISTORY = 50;
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const snapshot = useCallback(() => {
    if (skipSnapshotRef.current) { skipSnapshotRef.current = false; return; }
    const state = JSON.stringify({ nodes, walls, zones, furniture, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, floorMaterial, elevAnnotations });
    const idx = historyIdxRef.current;
    // Trim any redo states ahead of current
    const hist = historyRef.current.slice(0, idx + 1);
    // Don't push if identical to current
    if (hist.length > 0 && hist[hist.length - 1] === state) return;
    hist.push(state);
    if (hist.length > MAX_HISTORY) hist.shift();
    historyRef.current = hist;
    historyIdxRef.current = hist.length - 1;
    setCanUndo(hist.length > 1);
    setCanRedo(false);
  }, [nodes, walls, zones, furniture, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, floorMaterial, elevAnnotations]);

  // Take snapshot after every meaningful state change (debounced)
  const snapshotTimer = useRef(null);
  useEffect(() => {
    clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(snapshot, 300);
  }, [snapshot]);

  const undo = useCallback(() => {
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    historyIdxRef.current = newIdx;
    const state = JSON.parse(historyRef.current[newIdx]);
    skipSnapshotRef.current = true;
    knownRoomsRef.current = null;   // reseed: every restored room would read as newly-closed
    setNodes(state.nodes); setWalls(state.walls); setZones(state.zones); setFurniture(state.furniture || []);
    setMarkers(state.markers); setDoors(state.doors); setWindows(state.windows);
    setColumns(state.columns || []); setDims(state.dims || []); setLabels(state.labels || []); setRevClouds(state.revClouds || []); setFlowPaths(state.flowPaths || []); setFloorRegions(state.floorRegions || []); if (state.floorMaterial) setFloorMaterial(state.floorMaterial);
    setElevAnnotations(state.elevAnnotations || {});
    setSelectedId(null); setSelType(null); setSelectedIds([]); // else multi-select keeps acting on removed objects
    setCanUndo(newIdx > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const idx = historyIdxRef.current;
    if (idx >= historyRef.current.length - 1) return;
    const newIdx = idx + 1;
    historyIdxRef.current = newIdx;
    const state = JSON.parse(historyRef.current[newIdx]);
    skipSnapshotRef.current = true;
    knownRoomsRef.current = null;   // reseed: every restored room would read as newly-closed
    setNodes(state.nodes); setWalls(state.walls); setZones(state.zones); setFurniture(state.furniture || []);
    setMarkers(state.markers); setDoors(state.doors); setWindows(state.windows);
    setColumns(state.columns || []); setDims(state.dims || []); setLabels(state.labels || []); setRevClouds(state.revClouds || []); setFlowPaths(state.flowPaths || []); setFloorRegions(state.floorRegions || []); if (state.floorMaterial) setFloorMaterial(state.floorMaterial);
    setElevAnnotations(state.elevAnnotations || {});
    setSelectedId(null); setSelType(null); setSelectedIds([]);
    setCanUndo(true);
    setCanRedo(newIdx < historyRef.current.length - 1);
  }, []);

  // tool: select, pan, wall, zone, marker, door, window, column, calibrate
  const [tool, setTool] = useState("select");
  const [activeZoneType, setActiveZoneType] = useState("entry");
  const [activeSpecLayer, setActiveSpecLayer] = useState("power");
  const [activeComponentType, setActiveComponentType] = useState("outlet_duplex");
  const [activeFurnitureType, setActiveFurnitureType] = useState("desk"); // Furnish stage armed piece
  const [markerFinish, setMarkerFinish] = useState("white"); // white/black device finish for finish-capable components
  // Layer visibility + lock state lives in a Zustand store (destructured to the same local
  // names, so every read/write site below is unchanged). `lockedLayers` is the only
  // persisted field; locked items render but can't be hovered, selected, or edited.
  const {
    visibleLayers, setVisibleLayers, visibleBuildElectrical, setVisibleBuildElectrical,
    visibleBuildLighting, setVisibleBuildLighting, visibleZones, setVisibleZones,
    visibleDims, setVisibleDims, visibleLabels, setVisibleLabels,
    visibleRevClouds, setVisibleRevClouds, visibleFlowPaths, setVisibleFlowPaths,
    visibleFloorRegions, setVisibleFloorRegions, visibleFurniture, setVisibleFurniture, visibleITMEP, setVisibleITMEP,
    visibleGuides, setVisibleGuides,
    lockedLayers, setLockedLayers,
  } = useLayersStore();
  const [inspectorOpen, setInspectorOpen] = useState(true); // option panel collapsed/expanded
  // Read locks from the store at call time (getState) so these stay referentially stable
  // (empty deps) — they're invoked inside event handlers / render, always with fresh state,
  // and their stability lets the big event callbacks drop them from their dependency arrays.
  const layerLocked = useCallback((key) => !!useLayersStore.getState().lockedLayers[key], []);
  const markerLocked = useCallback((m) => {
    const ll = useLayersStore.getState().lockedLayers;
    if (ll.itmep) return true;
    if (m.layer === "power") return isLightComponent(m.componentType) ? !!ll.light : !!ll.elec;
    return !!ll[m.layer];
  }, []);
  // Selection state lives in a Zustand store (same local names; reads/writes unchanged).
  const { selectedId, setSelectedId, selType, setSelType, selectedIds, setSelectedIds } = useSelectionStore();
  const [calibrationFeet, setCalibrationFeet] = useState("10");
  const gs = 20;
  const [showGrid, setShowGrid] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [zoneEdge, setZoneEdge] = useState(null); // { id, edge, cursor } for rect-zone edge hover
  // ── View panes ───────────────────────────────────────────────────────
  // panes[0] is always the interactive Plan canvas; aux panes (1..3) each pick
  // a view among 3d / front / back / left / right. 1 / 2 / 4 panes = single /
  // split / quad layout.
  // View/layout state lives in a Zustand store (first slice of the state extraction).
  // Destructured to the same local names the component already uses, so every read/write
  // site below is unchanged; the store setters accept a value-or-updater like useState.
  const { panes, splitPos, splitPosV, setPanes, setSplitPos, setSplitPosV, setLayout, setPaneView } = useViewStore();
  const splitDragRef = useRef(null); // { axis, startPos, containerPx }
  const splitContainerRef = useRef(null); // ref for the flex container holding the panes
  const ELEV_DIRS = ["front", "back", "left", "right"];
  const PANE_VIEW_LABEL = { plan: "Plan", "3d": "3D", iso: "Isometric", front: "Front", back: "Back", left: "Left", right: "Right" };
  // Derived compatibility flags — full-screen 3D is retired (3D lives in aux panes),
  // so existing `view3d`/`splitView` reads keep working: plan is always visible.
  const view3d = false;
  const splitView = panes.length > 1;
  const [ceilingHeight, setCeilingHeight] = useState(108); // 9'-0" in inches
  const controls3dRef = useRef(null);
  const [show3dLabels, setShow3dLabels] = useState(false);
  const [show3dDims,   setShow3dDims]   = useState(false);
  const [show3dCeiling, setShow3dCeiling] = useState(true); // session-only, like the toggles above
  const [style3d, setStyle3d] = useState("clay"); // "clay" | "xray" | "detailed" | "print"
  const [isoCorner, setIsoCorner] = useState("se"); // which corner the Isometric view looks from
  const [isoFitNonce, setIsoFitNonce] = useState(0); // bump → re-fit the isometric (Reset)
  const [isoCutaway, setIsoCutaway] = useState(false); // hide shell walls facing the camera
  // Rotate arrows step 90° around the building. Order must match ISO_ORDER in testfit3d.jsx.
  const rotateIso = (delta) => setIsoCorner(c => {
    const order = ["ne", "se", "sw", "nw"];
    return order[(order.indexOf(c) + delta + order.length) % order.length];
  });
  // The Print theme restyles all three surfaces together, so entering it switches the 3D
  // view to the matching print style; leaving it reverts (only if still on print, so a
  // manual style pick inside Print theme is preserved). The 3D style buttons still let you
  // override per-view.
  useEffect(() => {
    if (themeMode === "print") setStyle3d("print");
    else setStyle3d(s => s === "print" ? "clay" : s);
  }, [themeMode]);
  const [doorWidth, setDoorWidth] = useState(36);
  const [windowWidth, setWindowWidth] = useState(36);
  const [columnSize, setColumnSize] = useState(12); // inches
  const [columnShape, setColumnShape] = useState("circle"); // circle or square
  const [wallMaterial, setWallMaterial] = useState("Drywall");
  const [wallKind, setWallKind] = useState("existing"); // "existing" | "demo" | "new" | "pony"
  const [wallPaintColor, setWallPaintColor] = useState("#E8E0D0");
  const [wallPaintFinish, setWallPaintFinish] = useState("");
  const [wallNotes, setWallNotes] = useState("");
  const [doorFlipped, setDoorFlipped] = useState(false);
  const [doorHingeRight, setDoorHingeRight] = useState(false);
  const [doorType, setDoorType] = useState("Wood");
  const [ponyHeight, setPonyHeight] = useState(42); // inches
  const [ponyDepth, setPonyDepth] = useState(6); // inches
  const [windowType, setWindowType] = useState("Window"); // "Window" or "Cut Opening"
  const [windowHeight, setWindowHeight] = useState(48); // inches
  const [windowSill, setWindowSill] = useState(30); // inches from floor
  const [columnLabel, setColumnLabel] = useState("");
  const [columnNotes, setColumnNotes] = useState("");
  const [zonePaintColor, setZonePaintColor] = useState("#E8E0D0");
  const [zonePaintFinish, setZonePaintFinish] = useState("Eggshell");
  const [zoneNotes, setZoneNotes] = useState("");
  const [markerNotes, setMarkerNotes] = useState("");
  const [outletType, setOutletType] = useState("outlet_duplex");
  const [outletIsNew, setOutletIsNew] = useState(false);
  const [lightingType, setLightingType] = useState("light_can_4");
  const [lightingIsNew, setLightingIsNew] = useState(false);
  const [htrackAngle, setHtrackAngle] = useState(0); // degrees, 0/45/90/135
  const [clipboard, setClipboard] = useState(null); // { walls, nodes, doors, windows, columns, markers, furniture, zones }
  const [pasteOffset, setPasteOffset] = useState(0); // increments each paste
  const [lastCopyInfo, setLastCopyInfo] = useState(null); // { srcItems:[{id,type,x,y}], dx, dy } for "/" repeat-distribute
  const [repeatInput, setRepeatInput] = useState(null); // null = inactive; string = digits typed after "/"
  const [mode, setMode] = useState("build"); // build, zone, itmep, budget, docs
  const activeDocsSlide = slides.find(s => s.id === activeSlideId) || slides[0] || null;
  // 3D scene data is also needed when a Docs 3D slide is open (panes are unmounted there).
  // Isometric renders the same three.js scene, so it needs the 3D data prepped too.
  const IS_3D_VIEW = (v) => v === "3d" || v === "iso";
  const show3d = panes.some(p => IS_3D_VIEW(p.view)) || (mode === "docs" && IS_3D_VIEW(activeDocsSlide?.view));

  // Wall drawing: click-to-place sequential mode
  const [dimInput, setDimInput] = useState("");

  const [viewOff, setViewOff] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  // Proximity hover — preview the nearest hoverable object as cursor approaches.
  // Lights up at PROX_R px, brightens linearly as cursor closes in.

  // Dynamic snap grid: 1" at 300%+, 3" at 150%+, 1' otherwise
  // Hold Alt to place off-grid. Zeroing the step here disables snapping everywhere at
  // once (see sn() in model.js) — grid, not smart guides, which stay useful freehand.
  const [snapOff, setSnapOff] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [minimapOff, setMinimapOff] = useState(false);
  const [minimapCorner, setMinimapCorner] = useState("bl"); // dragged to whichever corner it's dropped nearest
  // The plan canvas's pixel size, tracked in state rather than read off the ref at render
  // time — a ref read can't trigger the first paint, so the minimap would stay hidden until
  // some unrelated re-render happened to come along.
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = cvs.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCanvasSize(prev => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [panes, view3d]);
  const snapGrid = snapOff ? 0 : zoom >= 3 ? pxPerFoot / 12 : zoom >= 1.5 ? pxPerFoot / 4 : pxPerFoot;
  const [canvasRotation, setCanvasRotation] = useState(0); // multiples of 45, −315…315, wraps through 0
  const [canvasRotNoTransition, setCanvasRotNoTransition] = useState(false);
  const cvs = useRef(null);
  const cvsContainer = useRef(null); // unrotated container for hit-testing
  const fRef = useRef(null);
  const loadRef = useRef(null);

  // ── Visibility helpers (phase system retired — see Snapshots) ──────────
  // The cumulative-phase model was replaced by independent named snapshots.
  // These helpers are now phase-agnostic pass-throughs kept so the ~200 call
  // sites keep working; everything is always visible regardless of any legacy
  // `phase` tag still present on older data.
  const effectivePhase = "existing";
  const phaseVisible = useCallback(() => true, []);
  const markerVisible = useMemo(() => {
    return (m) => visibleITMEP; // only the master IT/MEP visibility toggle applies now
  }, [visibleITMEP]);

  // Layer-visibility bundle threaded into renderPlanCanvas (params shadow the same-named
  // component locals) so a Docs slide can override each layer. The live editor passes the
  // real flags; a slide passes its resolved per-slide visibility.
  const liveLayers = {
    showGrid, visibleDims, visibleZones, visibleLabels, visibleRevClouds, visibleFlowPaths,
    visibleFloorRegions, visibleGuides, visibleLayers, visibleBuildElectrical, visibleBuildLighting, markerVisible,
  };
  const ALL_SPEC_LAYERS_ON = { power: true, av: true, it: true, mep: true, security: true };
  // slide.vis === null → inherit the live layers; otherwise resolve to the bundle shape.
  // Power markers split into elec/light; other IT/MEP layers map to their SPEC_LAYERS key.
  const slideLayersFor = (slide) => {
    const rv = resolveSlideVis(slide.vis);
    if (!rv) return liveLayers;
    const mv = (m) => m.layer === "power"
      ? (isLightComponent(m.componentType) ? rv.light : rv.elec)
      : (rv[m.layer] ?? true);
    return {
      showGrid: rv.grid, visibleDims: rv.dims, visibleZones: rv.zones, visibleLabels: rv.labels,
      visibleRevClouds: rv.revClouds, visibleFlowPaths: rv.flowPaths, visibleFloorRegions: rv.floors,
      visibleGuides: rv.guides, visibleLayers: ALL_SPEC_LAYERS_ON,
      visibleBuildElectrical: true, visibleBuildLighting: true, markerVisible: mv,
    };
  };

  // ── Project management ─────────────────────────────────────────────
  // captureModel: the full live model WITHOUT snapshot meta (used as a snapshot's data).
  // Docs slides/docSettings are deliberately EXCLUDED — they're a deck artifact like
  // `snapshots`; including them would clobber the deck on snapshot switch and bloat
  // every snapshot's data blob.
  const captureModel = useCallback(() => ({
    projectName, nodes, walls, zones, furniture, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, guides, floorMaterial,
    elevAnnotations,
    bgOpacity, bgScale, bgOffset, pxPerFoot, showDims, zoneLibrary,
    version: PROJECT_VERSION,
  }), [projectName, nodes, walls, zones, furniture, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, guides, floorMaterial, elevAnnotations, bgOpacity, bgScale, bgOffset, pxPerFoot, showDims, zoneLibrary]);

  // getProjectData: full file payload — model + snapshot library + view layout + deck.
  const getProjectData = useCallback(() => ({
    ...captureModel(), snapshots, activeSnapshotId, panes, splitPos, splitPosV, lockedLayers, slides, docSettings,
  }), [captureModel, snapshots, activeSnapshotId, panes, splitPos, splitPosV, lockedLayers, slides, docSettings]);

  const exportProject = useCallback(() => {
    const data = getProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (projectName || "testfit").replace(/[^a-zA-Z0-9-_ ]/g, "") + ".json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Project exported", { description: a.download });
  }, [getProjectData, projectName]);

  // applyProjectData: the single hydrator. `m` must already be normalized by
  // migrateProjectData(). full=true also restores the snapshot library + view layout
  // (file import / autosave restore); full=false is model-only (snapshot switching).
  const applyProjectData = useCallback((m, full) => {
    setProjectName(m.projectName);
    knownRoomsRef.current = null;   // reseed: a loaded plan keeps exactly the floors it shipped with
    setNodes(m.nodes); setWalls(m.walls); setZones(m.zones); setFurniture(m.furniture || []); setMarkers(m.markers);
    setDoors(m.doors); setWindows(m.windows); setColumns(m.columns); setDims(m.dims);
    setLabels(m.labels); setRevClouds(m.revClouds); setFlowPaths(m.flowPaths); setFloorRegions(m.floorRegions);
    setGuides(m.guides || []);
    setFloorMaterial(m.floorMaterial); setElevAnnotations(m.elevAnnotations);
    setBgOpacity(m.bgOpacity); setBgScale(m.bgScale); setBgOffset(m.bgOffset);
    setPxPerFoot(m.pxPerFoot); setShowDims(m.showDims);
    if (m.zoneLibrary) setZoneLibrary(m.zoneLibrary);
    if (full) {
      setSnapshots(m.snapshots); setActiveSnapshotId(m.activeSnapshotId);
      setPanes(m.panes); setSplitPos(m.splitPos); setSplitPosV(m.splitPosV);
      setLockedLayers(m.lockedLayers);
      setSlides(m.slides || []); setDocSettings(m.docSettings || { ...DEFAULT_DOC_SETTINGS }); setActiveSlideId(null);
      setBgImage(null); setSelectedId(null); setSelType(null);
    }
    historyRef.current = []; historyIdxRef.current = -1;
    setCanUndo(false); setCanRedo(false);
  }, []);

  // loadModel: restore the live model from a snapshot blob (model fields only).
  const loadModel = useCallback((d) => { if (d) applyProjectData(migrateProjectData(d), false); }, [applyProjectData]);

  // ── Crash-safe autosave (localStorage) ───────────────────────────────
  // Restore the last working session on mount, then persist (debounced) on every
  // change. hydratedRef gates the first write so we never overwrite saved work with
  // the initial empty defaults before the restore runs.
  const hydratedRef = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const m = migrateProjectData(JSON.parse(saved));
        // Restore if the blob holds ANY content. This used to check only nodes/walls/zones/
        // markers/snapshots/slides, so a project of just furniture, floors, labels or
        // annotations was silently thrown away on reload.
        const hasContent = ["nodes", "walls", "zones", "markers", "furniture", "doors", "windows",
          "columns", "dims", "labels", "revClouds", "flowPaths", "floorRegions", "guides",
          "snapshots", "slides"].some(k => m[k]?.length);
        if (hasContent) applyProjectData(m, true);
      }
    } catch (e) { console.warn("Autosave restore failed:", e); }
    hydratedRef.current = true;
  }, [applyProjectData]);
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(getProjectData())); }
      catch (e) { /* quota exceeded or non-serializable — autosave is best-effort */ }
    }, 800);
    return () => clearTimeout(t);
  }, [getProjectData]);

  // ── Snapshot operations ──────────────────────────────────────────────
  // Has the live model diverged from the active snapshot's stored data?
  // The active snapshot's serialization is cached (it only changes when the snapshot
  // library does), and the live model is serialized only when there IS an active
  // snapshot to compare against — with none, "dirty" is just "is there anything drawn".
  // Either way the work happens once per actual model change (captureModel's identity
  // only changes when the underlying data does), never on drag/hover re-renders.
  const activeSnapStr = useMemo(() => {
    const snap = activeSnapshotId ? snapshots.find(s => s.id === activeSnapshotId) : null;
    return snap ? JSON.stringify(snap.data) : null;
  }, [activeSnapshotId, snapshots]);
  const liveDirtyMemo = useMemo(() => {
    if (!activeSnapshotId) return (nodes.length || zones.length || markers.length) > 0;
    if (activeSnapStr == null) return true;
    return JSON.stringify(captureModel()) !== activeSnapStr;
  }, [activeSnapshotId, activeSnapStr, captureModel, nodes, zones, markers]);
  const liveDirty = useCallback(() => liveDirtyMemo, [liveDirtyMemo]);

  // Save the current model as a brand-new snapshot and make it active.
  const takeSnapshot = useCallback((name) => {
    const nm = (name || "").trim() || "Snapshot " + (snapshots.length + 1);
    const id = uid();
    setSnapshots(prev => [...prev, { id, name: nm, ts: Date.now(), data: captureModel() }]);
    setActiveSnapshotId(id);
  }, [snapshots, captureModel]);

  // Overwrite an existing snapshot with the current model.
  const updateSnapshot = useCallback((id) => {
    setSnapshots(prev => prev.map(s => s.id === id ? { ...s, ts: Date.now(), data: captureModel() } : s));
    setActiveSnapshotId(id);
  }, [captureModel]);

  // Switch the live model to a snapshot's stored state.
  const switchSnapshot = useCallback((id) => {
    const snap = snapshots.find(s => s.id === id);
    if (!snap) return;
    loadModel(snap.data);
    setActiveSnapshotId(id);
  }, [snapshots, loadModel]);

  const renameSnapshot = useCallback((id, name) => {
    setSnapshots(prev => prev.map(s => s.id === id ? { ...s, name: name.trim() || s.name } : s));
  }, []);

  const deleteSnapshot = useCallback((id) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
    setActiveSnapshotId(cur => cur === id ? null : cur);
  }, []);

  const exportPng = useCallback(() => {
    const svg = cvs.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const W = Math.round(rect.width), H = Math.round(rect.height);
    const scale = 2; // 2× for retina
    const serializer = new XMLSerializer();
    // Inline all styles so the cloned SVG is self-contained
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", W);
    clone.setAttribute("height", H);
    // Embed the monospace font as a data-uri stub so text is crisp
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W * scale; canvas.height = H * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      // Background fill matching current theme
      ctx.fillStyle = themeMode === "dark" ? "#1A1812" : themeMode === "print" ? "#FFFFFF" : "#FAFAF8";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      canvas.toBlob(pngBlob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(pngBlob);
        a.download = (projectName || "testfit").replace(/[^a-zA-Z0-9-_ ]/g, "") + ".png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, "image/png");
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [cvs, projectName, themeMode]);

  const exportPdf = useCallback(() => {
    const svg = cvs.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const W = Math.round(rect.width), H = Math.round(rect.height);
    const serializer = new XMLSerializer();
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", W);
    clone.setAttribute("height", H);
    const svgStr = serializer.serializeToString(clone);
    const bgColor = themeMode === "dark" ? "#1A1812" : themeMode === "print" ? "#FFFFFF" : "#FAFAF8";
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) { alert("Allow pop-ups to export PDF"); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>${projectName || "TestFit"}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:${bgColor}}
@media print{body{margin:0}img{width:100%;height:auto;display:block;page-break-inside:avoid}}</style>
</head><body><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}" style="width:100%;height:auto"/></body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }, [cvs, projectName, themeMode]);

  const importProject = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (typeof d !== "object" || d === null) throw new Error("Invalid project file");
        const m = migrateProjectData(d);
        if (!d.projectName) m.projectName = "Imported";
        applyProjectData(m, true);
      } catch (e) { console.error("Import failed:", e); alert("Failed to import project: " + e.message); }
    };
    reader.readAsText(file);
  }, [applyProjectData]);

  // A new project is just an empty one loaded, so it goes through the SAME hydrator as file
  // import and autosave restore. It used to re-list every collection by hand, and that list
  // drifted: furniture and columns were never added to it, so New left them standing on the
  // canvas and read as doing nothing. Anything stored in the model belongs in
  // applyProjectData; only genuinely non-model state (view, tools, phases) is reset here.
  const newProject = useCallback(() => {
    applyProjectData({ ...migrateProjectData({}), projectName: "New Club" }, true);
    setZoneLibrary(ZONE_LIBRARY_DEFAULTS);
    localStorage.removeItem("testfit-zone-library");
    localStorage.removeItem(AUTOSAVE_KEY);
    setSelectedIds([]); setDrawChain(null); setDrawPolyZone(null); setCursorPos(null);
    setViewOff({ x: 0, y: 0 }); setZoom(1); setShowGrid(true);
    setPhases(DEFAULT_PHASES); setActivePhase("existing");
  }, [applyProjectData]);

  // ── Mono drawing tiers ──────────────────────────────────────────────────
  // Which walls sit on the outer envelope: in the mono PLAN profile those are T1
  // (external wall / structure) and everything else is T2 (internal wall). Derived
  // from the same boundary trace the 3D floor uses, so the two views agree.
  const exteriorWallIds = useMemo(() => {
    const loop = traceOuterBoundary(nodes, walls);
    if (!loop) return new Set();
    const edge = new Set();
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i].id, b = loop[(i + 1) % loop.length].id;
      edge.add(a + "|" + b); edge.add(b + "|" + a);
    }
    return new Set(walls.filter(w => edge.has(w.n1 + "|" + w.n2)).map(w => w.id));
  }, [walls, nodes]);

  // Every point worth framing. Walls used to be the only input, so a project of zones,
  // furniture or markers alone could not be fit to view at all.
  const allFitPoints = useCallback(() => {
    const pts = [];
    const push = (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y }); };
    nodes.forEach(n => push(n.x, n.y));
    furniture.forEach(f => push(f.x, f.y));
    markers.forEach(m => push(m.x, m.y));
    columns.forEach(c => push(c.x, c.y));
    labels.forEach(l => push(l.x, l.y));
    zones.forEach(z => z.points ? z.points.forEach(p => push(p.x, p.y))
      : (push(z.x, z.y), push(z.x + z.w, z.y + z.h)));
    [...floorRegions, ...revClouds, ...flowPaths].forEach(o => o.points?.forEach(p => push(p.x, p.y)));
    return pts;
  }, [nodes, furniture, markers, columns, labels, zones, floorRegions, revClouds, flowPaths]);


  const fitAll = useCallback((ns) => {
    const pts = ns ?? allFitPoints();
    if (!pts.length || !cvs.current) return;
    const r = cvs.current.getBoundingClientRect();
    const pad = 60;
    const xs = pts.map(n => n.x), ys = pts.map(n => n.y);
    const bx = Math.min(...xs), by = Math.min(...ys);
    const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    const z = Math.max(0.15, Math.min((r.width - pad*2) / (bw || 1), (r.height - pad*2) / (bh || 1), 4));
    const cx = bx + bw/2, cy = by + bh/2;
    setZoom(z);
    setViewOff({ x: r.width/2 - cx*z, y: r.height/2 - cy*z });
  }, [allFitPoints]);

  // Frame just the selection — the counterpart to fitting everything.
  const zoomToSelection = useCallback(() => {
    const ids = new Set(selectedIds.length ? selectedIds : selectedId ? [selectedId] : []);
    if (!ids.size) return;
    const pts = [];
    const push = (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y }); };
    const pick = (arr) => arr.filter(o => ids.has(o.id));
    pick(nodes).forEach(n => push(n.x, n.y));
    // A selected wall frames its endpoints. Looked up from `nodes` rather than via wc(),
    // which is declared further down the component and would be a TDZ error here.
    pick(walls).forEach(w => {
      const a = nodes.find(n => n.id === w.n1), b = nodes.find(n => n.id === w.n2);
      if (a) push(a.x, a.y);
      if (b) push(b.x, b.y);
    });
    [...pick(furniture), ...pick(markers), ...pick(columns), ...pick(doors), ...pick(windows), ...pick(labels)]
      .forEach(o => push(o.x, o.y));
    pick(zones).forEach(z => z.points ? z.points.forEach(p => push(p.x, p.y))
      : (push(z.x, z.y), push(z.x + z.w, z.y + z.h)));
    [...pick(floorRegions), ...pick(revClouds), ...pick(flowPaths)].forEach(o => o.points?.forEach(p => push(p.x, p.y)));
    if (pts.length) fitAll(pts);
  }, [selectedIds, selectedId, nodes, walls, furniture, markers, columns, doors, windows, labels, zones, floorRegions, revClouds, flowPaths, fitAll]);

  const ft = useCallback((px) => {
    const v = px / pxPerFoot; const w = Math.floor(v), inc = Math.round((v - w) * 12);
    if (inc === 0) return `${w}'-0"`; if (inc === 12) return `${w + 1}'-0"`;
    return `${w}'-${inc}"`;
  }, [pxPerFoot]);
  const ftN = useCallback((px) => px / pxPerFoot, [pxPerFoot]);
  const inToPx = useCallback((inches) => (inches / 12) * pxPerFoot, [pxPerFoot]);
  // Clear-inside room area: floor polygons sit on wall CENTERLINES, so the labeled sf
  // slightly overstates usable floor. Inset each walled edge by that wall's half-thickness
  // (kind/pony-aware — same formula the wall renderer uses) and measure what's left.
  const wallHalfT = useCallback((w) => (((w.kind === "pony" ? (w.ponyDepth || 6) : (wallKinds[w.kind || "existing"]?.thickness || 5)) / 12) * pxPerFoot) / 2, [wallKinds, pxPerFoot]);
  // Rooms nested inside other rooms: each floor's ring minus the floors carved out of it.
  // Derived, never stored — see nestedFloorHoles. One memo feeds the plan render, both sf
  // readouts and the 3D floor meshes, so they can't disagree about where a floor stops.
  const floorHoles = useMemo(() => nestedFloorHoles(floorRegions.filter(f => phaseVisible(f.phase))),
    [floorRegions, phaseVisible]);
  // Each visible floor's outline as one path, its nested rooms appended as extra subpaths
  // (fillRule evenodd knocks them out). Built once because two things must agree exactly on
  // where a floor stops: the hatch, and the mask that hides the grid underneath it.
  const floorPaths = useMemo(() => {
    const ring = (pts) => "M " + pts.map(p => `${p.x},${p.y}`).join(" L ") + " Z";
    return new Map(floorRegions
      .filter(f => f.points?.length >= 3 && phaseVisible(f.phase))
      .map(f => [f.id, ring(f.points) + (floorHoles.get(f.id) || []).map(h => " " + ring(h)).join("")]));
  }, [floorRegions, floorHoles, phaseVisible]);
  const clearInsideSf = useCallback((pts, holes) => {
    if (!pts || pts.length < 3) return null;
    const inset = insetFloorPolygon(pts, walls, nodes, wallHalfT);
    // A nested room is carved out at its OUTSIDE face: its walls stand in this room, so
    // they come off this room's clear area too — hence the outward offset.
    const cut = (holes || []).reduce((s, h) =>
      s + polyArea(insetFloorPolygon(h, walls, nodes, wallHalfT, 1.5, true)), 0);
    return Math.round((polyArea(inset) - cut) / (pxPerFoot * pxPerFoot));
  }, [walls, nodes, wallHalfT, pxPerFoot]);

  // gn: resolve node position, applying per-phase override if the wall has one
  // gn: resolve a node's position using the cumulative phase stack (same model as resolvePos).
  // Looks from effectivePhase downward for the first override; falls back to base x/y.
  const gn = useCallback((nid) => nodes.find(n => n.id === nid) || null, [nodes]);
  const wc = useCallback((w) => { const a = gn(w.n1), b = gn(w.n2); return (a && b) ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y } : null; }, [gn]);

  // resolvePos: return the effective position (and any other overridden props like angle) for an
  // element, honouring per-phase overrides up to effectivePhase (cumulative stack model).
  // Returns base {x, y} merged with the first matching override found.
  const resolvePos = useCallback((el) => ({ x: el.x, y: el.y }), []);

  // resolvePoints: polygon points pass-through (phase overrides retired)
  const resolvePoints = useCallback((el) => el.points, []);

  // Wall GEOMETRY for the plan (declared after resolvePos — naming a later const in a
  // dependency array is a TDZ crash at render time, see CLAUDE.md) — mitered footprints, opening cuts, per-run corner points
  // and junction cap wedges — computed once per geometry change and handed to
  // PlanWallsLayer, which only resolves style (selection, mono tier, phase colour).
  // Footprints are computed over ALL walls (miters must see hidden-phase neighbours too);
  // phase filtering happens per wall. wallSolidRuns (geometry.js) is the same opening
  // rule the DXF export uses, so the two can't disagree about where a wall is cut.
  const wallGeom = useMemo(() => {
    const fps = computeWallFootprints(walls, nodes, { halfTOf: wallHalfT });
    const openings = [...doors, ...windows].filter(o => phaseVisible(o.phase)).map(o => ({ ...resolvePos(o), width: o.width }));
    const out = [];
    for (const w of walls) {
      if (!phaseVisible(w.phase)) continue;
      const fp = fps.get(w.id); if (!fp) continue;
      const c = fp.c;
      const dx = c.x2 - c.x1, dy = c.y2 - c.y1;
      const { halfT, nx, ny, mN1, mN2 } = fp;
      const { segs } = wallSolidRuns(c, openings, pxPerFoot);
      const hatchId = w.material && WALL_MATERIAL_HATCHES[w.material] ? WALL_MATERIAL_HATCHES[w.material] : ({ demo: "hatch-demo", new: "hatch-new", pony: "hatch-pony" }[w.kind] ?? "hatch-existing");
      const segPts = segs.map(seg => {
        const ax = c.x1 + seg.t0 * dx, ay = c.y1 + seg.t0 * dy;
        const bx = c.x1 + seg.t1 * dx, by = c.y1 + seg.t1 * dy;
        const isFirst = seg.t0 === 0, isLast = seg.t1 === 1;
        const sL = isFirst ? mN1.L : { x: ax + nx * halfT, y: ay + ny * halfT };
        const sR = isFirst ? mN1.R : { x: ax - nx * halfT, y: ay - ny * halfT };
        const eL = isLast ? mN2.L : { x: bx + nx * halfT, y: by + ny * halfT };
        const eR = isLast ? mN2.R : { x: bx - nx * halfT, y: by - ny * halfT };
        return { sL, sR, eL, eR, isFirst, isLast, pts: `${sL.x},${sL.y} ${eL.x},${eL.y} ${eR.x},${eR.y} ${sR.x},${sR.y}` };
      });
      out.push({ w, c, halfT, nx, ny, hatchId, mN1, mN2, segs, segPts });
    }
    // Junction cap wedges: cluster wall ends by junction POSITION (not node id) within the
    // miter's proximity, so caps also close near-miss joins on separate, unsnapped nodes.
    const caps = junctionCapPolys(out.map(d => ({ id: d.w.id, c: d.c, mN1: d.mN1, mN2: d.mN2 })))
      .map((cp, i) => ({ nid: Math.round(cp.x) + "_" + Math.round(cp.y) + "_" + i, wallIds: cp.wallIds, points: cp.pts.map(p => `${p.x},${p.y}`).join(" ") }));
    return { walls: out, caps };
  }, [walls, nodes, wallHalfT, doors, windows, phaseVisible, resolvePos, pxPerFoot]);
  const wl = useCallback((w) => { const c = wc(w); return c ? dst(c.x1, c.y1, c.x2, c.y2) : 0; }, [wc]);
  const wa = useCallback((w) => { const c = wc(w); return c ? (Math.atan2(c.y2 - c.y1, c.x2 - c.x1) * 180) / Math.PI : 0; }, [wc]);
  const findNear = useCallback((x, y, excl) => { let best = null, bd = SNAP_R; for (const n of nodes) { if (excl?.includes(n.id)) continue; const d = dst(x, y, n.x, n.y); if (d < bd) { best = n; bd = d; } } return best; }, [nodes]);
  // Proximity-hover scan — broader radius than findNear (which is for click-snap).
  // Walks wall nodes, markers, columns, doors, windows, dim endpoints, label anchors,
  // and (when their parent is selected) zone / floor region / revcloud / flow path vertices.
  const findProxHover = useCallback((x, y) => {
    const { selType, selectedId } = useSelectionStore.getState(); // event-only fn → not a dep
    const PROX_R = 32;
    let best = null, bd = PROX_R;
    const add = (type, id, px, py, sub) => { const d = dst(x, y, px, py); if (d < bd) { bd = d; best = { type, id, x: px, y: py, dist: d, sub }; } };
    // ── Per-mode element rules — mirrors hitTest selection rules ──
    // build : nodes / columns / doors / windows / power-layer markers
    // zone  : nothing (zones aren't node-like; vertices handled below)
    // itmep : markers (all layers)
    // budget: no elements selectable
    if (mode === "build") {
      for (const n of nodes) add("node", n.id, n.x, n.y);
      for (const c of columns) { if (!phaseVisible(c.phase)) continue; const rp = resolvePos(c); add("column", c.id, rp.x, rp.y); }
      for (const dd of doors) { if (!phaseVisible(dd.phase)) continue; const rp = resolvePos(dd); add("door", dd.id, rp.x, rp.y); }
      for (const w of windows) { if (!phaseVisible(w.phase)) continue; const rp = resolvePos(w); add("window", w.id, rp.x, rp.y); }
      for (const m of markers) { if (m.layer !== "power" || !markerVisible(m) || markerLocked(m)) continue; const rp = resolvePos(m); add("marker", m.id, rp.x, rp.y); }
    } else if (mode === "itmep") {
      for (const m of markers) { if (!markerVisible(m) || markerLocked(m)) continue; const rp = resolvePos(m); add("marker", m.id, rp.x, rp.y); }
    }
    // ── Universal annotations (available in every mode that allows selecting them) ──
    if (!layerLocked("labels")) for (const lbl of labels) { if (!phaseVisible(lbl.phase)) continue;
      add("label", lbl.id, lbl.x, lbl.y);
      if (lbl.lx != null) add("label-tip", lbl.id, lbl.lx, lbl.ly);
    }
    // Selected-polygon vertices — the parent type is already mode-gated by being selectable,
    // and selType only equals these values when the parent is in fact selected.
    if (selType === "zone" && selectedId) {
      const z = zones.find(zz => zz.id === selectedId);
      if (z?.points) { const rp = resolvePoints(z); rp.forEach((p, i) => add("zone-vertex", z.id, p.x, p.y, i)); }
    }
    if (selType === "floorRegion" && selectedId) {
      const fr = floorRegions.find(r => r.id === selectedId);
      if (fr?.points) fr.points.forEach((p, i) => add("floorRegion-vertex", fr.id, p.x, p.y, i));
    }
    if (selType === "revcloud" && selectedId) {
      const rc = revClouds.find(r => r.id === selectedId);
      if (rc?.points) rc.points.forEach((p, i) => add("revcloud-vertex", rc.id, p.x, p.y, i));
    }
    if (selType === "flowPath" && selectedId) {
      const fp = flowPaths.find(r => r.id === selectedId);
      if (fp?.points) fp.points.forEach((p, i) => add("flowPath-vertex", fp.id, p.x, p.y, i));
    }
    return best;
  }, [mode, nodes, markers, columns, doors, windows, labels, zones, floorRegions, revClouds, flowPaths, markerVisible, phaseVisible, resolvePos, resolvePoints, layerLocked, markerLocked]);
  const wallsAt = useCallback((nid) => walls.filter(w => w.n1 === nid || w.n2 === nid), [walls]);

  // Snap an elevation guide's position to the nearest wall node coordinate on its axis
  // ("x" for left/right guides, "y" for front/back) so it lands cleanly on a wall face;
  // else fall back to grid snap.
  const snapGuide = useCallback((pos, axis) => {
    const thresh = SNAP_R * 1.5;
    let best = null, bd = thresh;
    for (const n of nodes) {
      const c = axis === "x" ? n.x : n.y;
      const dd = Math.abs(pos - c);
      if (dd < bd) { best = c; bd = dd; }
    }
    return best != null ? best : sn(pos, snapGrid);
  }, [nodes, snapGrid]);

  // Snap for dimension tool: snaps to any significant point on canvas
  const findDimSnap = useCallback((x, y) => {
    let best = null, bd = SNAP_R * 1.5;
    const check = (px, py, anchorId = null, anchorType = null) => {
      const d = dst(x, y, px, py);
      if (d < bd) { best = { x: px, y: py, anchorId, anchorType }; bd = d; }
    };
    nodes.forEach(n => { const rn = gn(n.id); if (rn) check(rn.x, rn.y, n.id, "node"); });
    walls.forEach(w => { const c = wc(w); if (c) check((c.x1+c.x2)/2, (c.y1+c.y2)/2, w.id, "wall-mid"); });
    doors.forEach(d => check(d.x, d.y));
    windows.forEach(w => check(w.x, w.y));
    columns.forEach(c => check(c.x, c.y));
    markers.forEach(m => check(m.x, m.y));
    zones.forEach(z => { if (z.points) z.points.forEach(pt => check(pt.x, pt.y)); });
    return best;
  }, [nodes, walls, doors, windows, columns, markers, zones, wc, gn]);

  // Snap a point to the nearest wall — returns {x, y, angle, wallId} or null
  const snapToWall = useCallback((px, py, maxDist = 20, excludeWallIds = null) => {
    let best = null, bestD = maxDist;
    for (const w of walls) {
      if (excludeWallIds && excludeWallIds.has(w.id)) continue;
      const c = wc(w);
      if (!c) continue;
      const dx = c.x2 - c.x1, dy = c.y2 - c.y1, ls = dx * dx + dy * dy;
      if (ls === 0) continue;
      const t = Math.max(0, Math.min(1, ((px - c.x1) * dx + (py - c.y1) * dy) / ls));
      const projX = c.x1 + t * dx, projY = c.y1 + t * dy;
      const d = dst(px, py, projX, projY);
      if (d < bestD) {
        bestD = d;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        best = { x: projX, y: projY, angle, wallId: w.id, t };
      }
    }
    return best;
  }, [walls, wc]);


  // After animating to ±360° (visually = 0°), silently snap back to 0 with no transition
  useEffect(() => {
    if (canvasRotation !== 360 && canvasRotation !== -360) return;
    const t = setTimeout(() => {
      setCanvasRotNoTransition(true);
      setCanvasRotation(0);
      // Re-enable transition after one frame so the next click animates normally
      requestAnimationFrame(() => requestAnimationFrame(() => setCanvasRotNoTransition(false)));
    }, 270); // just after the 250ms transition completes
    return () => clearTimeout(t);
  }, [canvasRotation]);
  
  // Pane divider drag — axis "v" drives splitPos (vertical divider), "h" drives splitPosV.
  useEffect(() => {
    const onMove = (e) => {
      const d = splitDragRef.current; if (!d) return;
      const delta = (d.axis === "h" ? e.clientY - d.start : e.clientX - d.start) / d.span;
      const pos = Math.min(0.85, Math.max(0.15, d.startPos + delta));
      (d.axis === "h" ? setSplitPosV : setSplitPos)(pos);
    };
    const onUp = () => { splitDragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // Sync activeComponentType with activeSpecLayer when layer changes
  useEffect(() => {
    if (mode === "itmep" && SPEC_COMPONENTS[activeSpecLayer]) {
      const componentsInLayer = Object.keys(SPEC_COMPONENTS[activeSpecLayer]);
      if (!componentsInLayer.includes(activeComponentType)) {
        setActiveComponentType(componentsInLayer[0]);
      }
    }
  }, [mode, activeSpecLayer, activeComponentType]);

  const s2c = useCallback((cx, cy) => {
    // Use the container div (unaffected by SVG CSS rotation) for stable bounds
    const r = (cvsContainer.current ?? cvs.current)?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    // Un-rotate the cursor around the visual center before applying pan/zoom
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    if (canvasRotation !== 0) {
      const rad = -canvasRotation * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const rdx = dx * cos - dy * sin;
      const rdy = dx * sin + dy * cos;
      dx = rdx; dy = rdy;
    }
    const urx = dx + r.left + r.width / 2;
    const ury = dy + r.top + r.height / 2;
    return { x: (urx - r.left - viewOff.x) / zoom, y: (ury - r.top - viewOff.y) / zoom };
  }, [viewOff, zoom, canvasRotation]);

  // Commit a wall segment in the chain
  // toNodeId (optional): connect the end to this exact node (skips findNear) — used by
  // the rect-room tool to close its loop onto the corner node created in the same tick,
  // which findNear can't see yet (state updates land after the handler).
  const commitWallSegment = useCallback((fromNodeId, fromX, fromY, toX, toY, kind, toNodeId = null) => {
    let n1Id = fromNodeId;
    const newNodes = [];
    if (!n1Id) { const nn = { id: uid(), x: fromX, y: fromY }; newNodes.push(nn); n1Id = nn.id; }
    const nearEnd = toNodeId ? null : findNear(toX, toY, [n1Id]);
    let n2Id = toNodeId ?? (nearEnd ? nearEnd.id : null);
    const isNewEndNode = !n2Id;
    if (!n2Id) { const nn = { id: uid(), x: toX, y: toY }; newNodes.push(nn); n2Id = nn.id; }
    if (n1Id !== n2Id) {
      const w = { id: uid(), n1: n1Id, n2: n2Id, kind, phase: activePhase };
      if (wallMaterial) w.material = wallMaterial;
      if (wallPaintColor !== "#E8E0D0") w.paintColor = wallPaintColor;
      if (wallPaintFinish) w.paintFinish = wallPaintFinish;
      if (wallNotes) w.notes = wallNotes;
      if (kind === "pony") { w.ponyHeight = ponyHeight; w.ponyDepth = ponyDepth; }
      const isNewStartNode = !fromNodeId;

      // One atomic update over nodes + walls: the welds below create junction nodes and
      // split walls together, and setState always sees fresh state — so same-tick call
      // sequences (the rect-room tool commits four sides at once) compose correctly.
      useGeometryStore.setState((s) => {
        let ns = newNodes.length ? [...s.nodes, ...newNodes] : s.nodes;
        let ws = s.walls;
        const byId = Object.fromEntries(ns.map(n => [n.id, n]));
        // T-weld: a NEW endpoint that landed on an existing wall's body splits it there.
        const splitAt = (px, py, nodeId) => {
          for (const ew of ws) {
            const a = byId[ew.n1], b = byId[ew.n2];
            if (!a || !b) continue;
            const edx = b.x - a.x, edy = b.y - a.y, els = edx * edx + edy * edy;
            if (els < 1) continue;
            const t = ((px - a.x) * edx + (py - a.y) * edy) / els;
            if (t < 0.02 || t > 0.98) continue;
            if (dst(px, py, a.x + t * edx, a.y + t * edy) > 4) continue;
            ws = splitWallAtNode(ws, ew.id, nodeId);
            return;
          }
        };
        if (isNewStartNode) splitAt(fromX, fromY, n1Id);
        if (isNewEndNode)   splitAt(toX,   toY,   n2Id);
        // Never create a second wall between the same node pair (would double-render
        // doors in 3D and double-count footage).
        if (ws.some(x => (x.n1 === n1Id && x.n2 === n2Id) || (x.n1 === n2Id && x.n2 === n1Id)))
          return { nodes: ns, walls: ws };
        ws = [...ws, w];
        // X-crossings: drawing across a wall welds a shared junction into both.
        const xed = weldWallCrossings(ns, ws, w.id);
        ns = xed.nodes; ws = xed.walls;
        // Collinear connect / pass-through: split the new wall at nodes it passes over
        // (incl. the crossing nodes just made) and collapse any doubled pieces.
        return { nodes: ns, walls: dedupeWalls(splitWallThroughNodes(ws, ns, w.id)) };
      });
      return { nodeId: n2Id, startNodeId: n1Id, x: nearEnd ? nearEnd.x : toX, y: nearEnd ? nearEnd.y : toY };
    }
    return null;
  }, [findNear, wallMaterial, wallPaintColor, wallPaintFinish, wallNotes, ponyHeight, ponyDepth, activePhase]);

  // A rect room: four welded walls tracing the rectangle, plus the floor that goes with it.
  // Shared by the two-click drag and the typed-size path so both produce identical rooms.
  const commitRectRoom = useCallback((x1, y1, x2, y2, kind) => {
    if (Math.abs(x2 - x1) <= 8 || Math.abs(y2 - y1) <= 8) return false;
    // Trace the loop corner-by-corner; commitWallSegment handles node reuse and wall-body
    // welds per side. The closing side targets the first corner's node id directly — nodes
    // created this tick aren't visible to findNear yet.
    const r1 = commitWallSegment(null, x1, y1, x2, y1, kind);
    const r2 = r1 && commitWallSegment(r1.nodeId, x2, y1, x2, y2, kind);
    const r3 = r2 && commitWallSegment(r2.nodeId, x2, y2, x1, y2, kind);
    if (!r3) return false;
    commitWallSegment(r3.nodeId, x1, y2, x1, y1, kind, r1.startNodeId);
    setFloorRegions(p => [...p, { id: uid(), points: [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], material: floorMaterial || "Wood", label: "", phase: activePhase }]);
    return true;
  }, [commitWallSegment, setFloorRegions, floorMaterial, activePhase]);

  // ─── Enclosing a room gives it a floor ───────────────────────────────────────
  // Fires on the TRANSITION to enclosed, not on "is currently enclosed". That distinction is
  // the whole design: a floor the user deletes (Room card → Floor: None) must stay deleted,
  // and it does, because the room isn't newly-closed on any later render. A standing "every
  // room has a floor" rule would resurrect it on the next keystroke.
  useEffect(() => {
    const rooms = traceRoomLoops(nodes, walls, (pxPerFoot * pxPerFoot) / 4);   // ignore ≤¼ sf slivers
    const keyOf = (r) => r.nodeIds.slice().sort().join("|");
    const prev = knownRoomsRef.current;
    knownRoomsRef.current = { keys: new Set(rooms.map(keyOf)), wallCount: walls.length };
    // Seed (record, create nothing) rather than diff when there's no meaningful "before":
    // the very first run, or any run whose predecessor had no walls at all. That second case
    // is what catches a plan ARRIVING — the app mounts empty and the autosave restore lands a
    // render later, so a whole restored building would otherwise read as just-enclosed. It
    // also covers file loads and undo-back-to-empty without those paths having to know about
    // this effect. Nothing is lost for a user drawing from scratch: you can't close a room in
    // the same tick you place your first wall, and the rect tool brings its own floor.
    if (prev === null || prev.wallCount === 0 || layerLocked("floorRegions")) return;
    const fresh = rooms.filter(r => !prev.keys.has(keyOf(r)));
    if (!fresh.length) return;
    setFloorRegions(p => {
      // Skip any room that already has a floor of its OWN — the rect tool lays one down as it
      // draws, and undo/redo restores floors alongside the walls that re-close their rooms.
      // Covering the room's interior point isn't enough to qualify: a room built inside
      // another room sits under the outer room's floor, and a bare containment test denied it
      // a floor entirely. A floor can never extend past the walls of the room it belongs to,
      // so one bigger than the room is somebody else's — the area bound is what says so.
      const add = fresh.filter(r => {
        const c = polyInteriorPoint(r.points);
        if (!c) return false;
        const roomArea = polyArea(r.points) * 1.05;   // slack for hand-drawn / inset floors
        return !p.some(fr => fr.points?.length >= 3 && polyArea(fr.points) <= roomArea
          && pointInPoly(c.x, c.y, fr.points));
      }).map(r => ({ id: uid(), points: r.points, material: floorMaterial || "Wood", label: "", phase: activePhase }));
      return add.length ? [...p, ...add] : p;   // same ref when nothing's added — no wasted render
    });
  }, [nodes, walls, pxPerFoot, floorMaterial, activePhase, layerLocked, setFloorRegions]);

  // Hit test
  // Resolve a label's leader tip to its live canvas position (follows anchor object when set)
  // Resolves the live x1/y1/x2/y2 of a dim from its stored anchors.
  // Node and wall-mid anchors track their geometry, all others fall back to stored coords.
  const resolveDimEndpoints = useCallback((d) => {
    const ep = (x, y, anchorId, anchorType) => {
      if (!anchorId) return { x, y };
      if (anchorType === "node") { const n = gn(anchorId); return n ? { x: n.x, y: n.y } : { x, y }; }
      if (anchorType === "wall-mid") { const w = walls.find(w => w.id === anchorId); if (w) { const c = wc(w); if (c) return { x: (c.x1+c.x2)/2, y: (c.y1+c.y2)/2 }; } }
      if (anchorType === "column") { const col = columns.find(c => c.id === anchorId); if (col) return resolvePos(col); }
      if (anchorType === "marker") { const m = markers.find(m => m.id === anchorId); if (m) return resolvePos(m); }
      return { x, y };
    };
    const p1 = ep(d.x1, d.y1, d.anchor1Id, d.anchor1Type);
    const p2 = ep(d.x2, d.y2, d.anchor2Id, d.anchor2Type);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  }, [gn, walls, columns, markers, resolvePos, wc]);

  const resolveLeaderTip = useCallback((lbl) => {
    if (lbl.lx == null) return { lx: null, ly: null };
    if (!lbl.anchorId) return { lx: lbl.lx, ly: lbl.ly };
    if (lbl.anchorType === "node") { const n = nodes.find(n => n.id === lbl.anchorId); return n ? { lx: n.x, ly: n.y } : { lx: lbl.lx, ly: lbl.ly }; }
    if (lbl.anchorType === "column") { const c = columns.find(c => c.id === lbl.anchorId); return c ? { lx: c.x, ly: c.y } : { lx: lbl.lx, ly: lbl.ly }; }
    if (lbl.anchorType === "marker") { const m = markers.find(m => m.id === lbl.anchorId); if (m) { const rp = resolvePos(m); return { lx: rp.x, ly: rp.y }; } return { lx: lbl.lx, ly: lbl.ly }; }
    return { lx: lbl.lx, ly: lbl.ly };
  }, [nodes, columns, markers, resolvePos]);

  // Snap a point and identify which object it's anchoring to
  const snapLabelAnchor = useCallback((px, py) => {
    const near = findNear(px, py);
    if (near) return { x: near.x, y: near.y, anchorId: near.id, anchorType: "node" };
    for (const c of columns) { if (dst(px, py, c.x, c.y) < SNAP_R * 1.5) return { x: c.x, y: c.y, anchorId: c.id, anchorType: "column" }; }
    for (const m of markers) { const rp = resolvePos(m); if (dst(px, py, rp.x, rp.y) < SNAP_R * 1.5) return { x: rp.x, y: rp.y, anchorId: m.id, anchorType: "marker" }; }
    for (const rc of revClouds) { for (const pt of rc.points) { if (dst(px, py, pt.x, pt.y) < SNAP_R * 1.5) return { x: pt.x, y: pt.y, anchorId: rc.id, anchorType: "revcloud" }; } }
    const snapPt = findDimSnap(px, py);
    if (snapPt) return { x: snapPt.x, y: snapPt.y, anchorId: null, anchorType: null };
    const ws = snapToWall(px, py, SNAP_R * 2);
    if (ws) return { x: ws.x, y: ws.y, anchorId: null, anchorType: null };
    return { x: px, y: py, anchorId: null, anchorType: null };
  }, [findNear, findDimSnap, snapToWall, columns, markers, resolvePos, revClouds]);


  // Plain SVG of the live plan canvas — the same serialization the PNG/PDF paths use,
  // kept as vectors (the canvas colour is baked in as a background rect; fonts resolve
  // on the reader's machine, with the monospace stack as the fallback).
  const exportSvg = useCallback(() => {
    const svg = cvs.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const W = Math.round(rect.width), H = Math.round(rect.height);
    const NS = "http://www.w3.org/2000/svg";
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", NS);
    clone.setAttribute("width", W); clone.setAttribute("height", H);
    clone.setAttribute("viewBox", `0 0 ${W} ${H}`);
    clone.removeAttribute("style");
    clone.setAttribute("font-family", FONT);
    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("width", W); bg.setAttribute("height", H); bg.setAttribute("fill", canvasT.canvas);
    clone.insertBefore(bg, clone.firstChild);
    const svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
    a.download = (projectName || "testfit").replace(/[^a-zA-Z0-9-_ ]/g, "") + ".svg";
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("SVG exported", { description: a.download });
  }, [projectName, canvasT]);

  // AutoCAD R12 DXF of the plan MODEL (feet, y-up): walls, openings, columns, zones,
  // floors, furniture, IT/MEP and annotations on conventional layers — utils/dxf.js.
  const exportDxf = useCallback(() => {
    const { dxf, counts } = buildDxf(captureModel(), { wallHalfT, zoneLibrary, resolveDim: resolveDimEndpoints });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([dxf], { type: "application/dxf" }));
    a.download = (projectName || "testfit").replace(/[^a-zA-Z0-9-_ ]/g, "") + ".dxf";
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    const n = Object.values(counts).reduce((sum, v) => sum + v, 0);
    toast("DXF exported", { description: `${a.download} · ${n} entities` });
  }, [captureModel, wallHalfT, zoneLibrary, resolveDimEndpoints, projectName]);

  // Smooth zoom centered on cursor
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = 1 - e.deltaY * 0.001;
    // Use unrotated container bounds so zoom pivot is in SVG viewport space
    const r = (cvsContainer.current ?? cvs.current)?.getBoundingClientRect();
    if (!r) return;
    const scx = r.left + r.width / 2, scy = r.top + r.height / 2;
    let dx = e.clientX - scx, dy = e.clientY - scy;
    if (canvasRotation !== 0) {
      const rad = -canvasRotation * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const rdx = dx * cos - dy * sin, rdy = dx * sin + dy * cos;
      dx = rdx; dy = rdy;
    }
    // Position in SVG viewport pixels (same as if no rotation)
    const mx = dx + r.width / 2;
    const my = dy + r.height / 2;
    setZoom(z => {
      const newZ = Math.max(0.15, Math.min(4, z * factor));
      const scale = newZ / z;
      // Adjust viewOff so the point under the cursor stays fixed
      setViewOff(v => ({
        x: mx - scale * (mx - v.x),
        y: my - scale * (my - v.y)
      }));
      return newZ;
    });
  }, [canvasRotation]);

  const cost = useMemo(() => {
    const zc = zones.map(z => {
      const lib = zoneLibrary[z.type]; const t = lib.items.reduce((s, i) => s + i.qty * i.unitCost, 0);
      const sf = z.points ? Math.round(polyArea(z.points) / (pxPerFoot * pxPerFoot)) : Math.round(ftN(z.w) * ftN(z.h));
      return { id: z.id, label: z.label || lib.name, type: z.type, total: t, items: lib.items, sf };
    });
    // Component costs by type + finish (white/black split into separate line items).
    // Key uses "|" (not "_") so it never collides with underscores in componentType.
    const pc = {};
    markers.forEach(p => {
      const compData = SPEC_COMPONENTS[p.layer]?.[p.componentType];
      if (!compData) return; // Skip old markers without componentType
      const key = `${p.layer}|${p.componentType}|${p.finish || ""}`;
      const finName = p.finish ? `${compData.name} (${p.finish[0].toUpperCase() + p.finish.slice(1)})` : compData.name;
      if (!pc[key]) pc[key] = { count: 0, unitCost: compData.unitCost, name: finName, layer: p.layer };
      pc[key].count++;
    });
    // Door-mounted access readers (Openpath) roll up as their own line item.
    const acDoors = doors.filter(d => d.accessControl).length;
    if (acDoors > 0) pc["it|access_reader|"] = { count: acDoors, unitCost: ACCESS_READER_COST, name: "Access Reader", layer: "it" };
    const zt = zc.reduce((s, z) => s + z.total, 0), pt = Object.values(pc).reduce((s, p) => s + p.count * p.unitCost, 0);
    const totalSf = zc.reduce((s, z) => s + z.sf, 0);
    // Wall footage by kind (feet in wl-units → real feet is len already)
    const wallFt = { existing: 0, demo: 0, new: 0, pony: 0 };
    walls.forEach(w => { const len = wl(w); wallFt[w.kind || "existing"] += len; });
    const wallFtFormatted = {};
    Object.entries(wallFt).forEach(([k, v]) => { if (v > 0) wallFtFormatted[k] = { ft: v, label: wallKinds[k].label, color: wallKinds[k].color }; });
    // Construction — priced net-new scope only. Walls carry it in `kind` (existing = $0);
    // doors/windows/columns are as-built unless flagged `isNew`, so only new ones are
    // priced (doors by doorType, windows by type, columns a flat each). NB: wallFt
    // accumulates CANVAS PX (the ft() formatter converts for display), so pricing converts
    // to real feet via ftN first.
    const wallCost = Object.entries(wallFt).filter(([, v]) => v > 0)
      .map(([k, v]) => ({ kind: k, label: wallKinds[k].label, color: wallKinds[k].color, ft: v, unitCost: WALL_COST_PER_FT[k] || 0, cost: Math.round(ftN(v) * (WALL_COST_PER_FT[k] || 0)) }));
    const groupBy = (arr, keyFn, def) => arr.reduce((m, x) => { const k = keyFn(x) || def; m[k] = (m[k] || 0) + 1; return m; }, {});
    const doorCost = Object.entries(groupBy(doors.filter(d => d.isNew), d => d.doorType, "Wood"))
      .map(([type, count]) => ({ type, count, unitCost: DOOR_COST[type] ?? 0, cost: count * (DOOR_COST[type] ?? 0) }));
    const winCost = Object.entries(groupBy(windows.filter(w => w.isNew), w => w.type, "Window"))
      .map(([type, count]) => ({ type, count, unitCost: WINDOW_COST[type] ?? 0, cost: count * (WINDOW_COST[type] ?? 0) }));
    const newCols = columns.filter(c => c.isNew).length;
    const columnCost = { count: newCols, unitCost: COLUMN_COST, cost: newCols * COLUMN_COST };
    const sum = (a) => a.reduce((s, x) => s + x.cost, 0);
    const constructionTotal = sum(wallCost) + sum(doorCost) + sum(winCost) + columnCost.cost;
    const construction = { walls: wallCost, doors: doorCost, windows: winCost, columns: columnCost, total: constructionTotal };
    return { zones: zc, markers: pc, construction, total: zt + pt + constructionTotal, totalSf, wallFt: wallFtFormatted };
  }, [zones, markers, doors, windows, columns, walls, wl, ftN]);

  // Plan size readout for the status bar. `heavy` flags the point where a plan starts to
  // cost real frame time — the same plans the zoom-out level of detail exists for.
  const planLoad = useMemo(() => {
    const elements = nodes.length + walls.length + doors.length + windows.length + columns.length + zones.length + furniture.length + markers.length + labels.length + dims.length + revClouds.length + flowPaths.length + floorRegions.length;
    return { walls: walls.length, elements, heavy: walls.length > 400 || elements > 1500 };
  }, [nodes, walls, doors, windows, columns, zones, furniture, markers, labels, dims, revClouds, flowPaths, floorRegions]);

  const selZone = useMemo(() => selType === "zone" ? zones.find(z => z.id === selectedId) : null, [selType, selectedId, zones]);
  const selMarker = useMemo(() => selType === "marker" ? markers.find(p => p.id === selectedId) : null, [selType, selectedId, markers]);
  const selWall = useMemo(() => selType === "wall" ? walls.find(w => w.id === selectedId) : null, [selType, selectedId, walls]);
  const selNode = useMemo(() => selType === "node" ? gn(selectedId) : null, [selType, selectedId, gn]);
  const selDoor = useMemo(() => selType === "door" ? doors.find(d => d.id === selectedId) : null, [selType, selectedId, doors]);
  const selWindow = useMemo(() => selType === "window" ? windows.find(w => w.id === selectedId) : null, [selType, selectedId, windows]);
  const selColumn = useMemo(() => selType === "column" ? columns.find(c => c.id === selectedId) : null, [selType, selectedId, columns]);
  const selFurniture = useMemo(() => selType === "furniture" ? furniture.find(f => f.id === selectedId) : null, [selType, selectedId, furniture]);
  const selLabel = useMemo(() => (selType === "label" || selType === "label-tip") ? labels.find(l => l.id === selectedId) : null, [selType, selectedId, labels]);
  const selRevCloud = useMemo(() => selType === "revcloud" ? revClouds.find(r => r.id === selectedId) : null, [selType, selectedId, revClouds]);
  // Elevation labels live per-direction under elevAnnotations[dir].labels; ids are unique, so scan all dirs.
  const selElevLabel = useMemo(() => selType === "elevLabel"
    ? Object.values(elevAnnotations).flatMap(a => a?.labels || []).find(l => l.id === selectedId) ?? null
    : null, [selType, selectedId, elevAnnotations]);
  const selElevRevCloud = useMemo(() => selType === "elevRevCloud"
    ? Object.values(elevAnnotations).flatMap(a => a?.revClouds || []).find(r => r.id === selectedId) ?? null
    : null, [selType, selectedId, elevAnnotations]);
  const selFlowPath = useMemo(() => selType === "flowPath" ? flowPaths.find(r => r.id === selectedId) : null, [selType, selectedId, flowPaths]);
  const selFloorRegion = useMemo(() => selType === "floorRegion" ? floorRegions.find(r => r.id === selectedId) : null, [selType, selectedId, floorRegions]);
  const updFloorRegion = (u) => setFloorRegions(p => p.map(r => r.id === selectedId ? { ...r, ...u } : r));
  // Edit mode is unlocked per-floor by a double-click and relocks the moment that floor
  // stops being the selection. Deriving it from selection rather than clearing it at each
  // exit (Esc, delete, undo, another object, leaving Build) means every one of those paths
  // relocks for free — a floor left silently draggable is the bug this whole gate prevents.
  useEffect(() => {
    if (floorEditId && !(mode === "build" && selType === "floorRegion" && selectedId === floorEditId))
      setFloorEditId(null);
  }, [floorEditId, mode, selType, selectedId, setFloorEditId]);
  const updFlowPath = (u) => setFlowPaths(p => p.map(r => r.id === selectedId ? { ...r, ...u } : r));

  // A room's floor and its zone are linked POSITIONALLY — same outline, no stored id —
  // exactly like doors following walls and floors following a resize. Both are carried by
  // the same polyCarry on a room resize, so identical outlines stay identical.
  const samePoly = (a, b) => a?.length === b?.length
    && a.every((p, i) => Math.abs(p.x - b[i].x) < 0.5 && Math.abs(p.y - b[i].y) < 0.5);
  const zoneForFloor = useMemo(() => selFloorRegion
    ? zones.find(z => z.points && samePoly(z.points, selFloorRegion.points)) ?? null
    : null, [selFloorRegion, zones]);
  // Retype the room's zone, or drop it entirely (type === ""). Creating one clones the
  // floor's outline rather than referencing it, so editing either later can't surprise you.
  const setRoomZone = useCallback((type) => {
    if (!selFloorRegion) return;
    setZones(p => {
      const rest = zoneForFloor ? p.filter(z => z.id !== zoneForFloor.id) : p;
      if (!type) return rest;
      const zt = zoneLibrary[type];
      return [...rest, { id: uid(), type, points: selFloorRegion.points.map(pt => ({ ...pt })),
        label: zt?.name || type, notes: "", phase: selFloorRegion.phase }];
    });
  }, [selFloorRegion, zoneForFloor, setZones, zoneLibrary]);

  // Multi-select support
  const multiSelType = useMemo(() => {
    if (selectedIds.length <= 1) return null;
    const ids = new Set(selectedIds);
    const types = new Set();
    walls.forEach(w => { if (ids.has(w.id)) types.add("wall"); });
    zones.forEach(z => { if (ids.has(z.id)) types.add("zone"); });
    markers.forEach(m => { if (ids.has(m.id)) types.add("marker"); });
    doors.forEach(d => { if (ids.has(d.id)) types.add("door"); });
    windows.forEach(w => { if (ids.has(w.id)) types.add("window"); });
    columns.forEach(c => { if (ids.has(c.id)) types.add("column"); });
    furniture.forEach(f => { if (ids.has(f.id)) types.add("furniture"); });
    // Only count nodes if nothing else is selected — nodes are implicit in wall selections
    if (types.size === 0) nodes.forEach(n => { if (ids.has(n.id)) types.add("node"); });
    return types.size === 1 ? [...types][0] : "mixed";
  }, [selectedIds, walls, zones, markers, doors, windows, columns, furniture, nodes]);

  // What the CURRENT stage owns — the same split the marquee and hitTest use, so Select All
  // never reaches across stages (Build owns construction + the shared power layer; IT/MEP
  // owns its component layers; Zones owns zones; Furnish owns furniture).
  const selectableInMode = useCallback(() => {
    if (mode === "build") return [
      ...walls.filter(w => phaseVisible(w.phase)).map(w => ({ id: w.id, type: "wall" })),
      ...doors.filter(d => phaseVisible(d.phase)).map(d => ({ id: d.id, type: "door" })),
      ...windows.filter(w => phaseVisible(w.phase)).map(w => ({ id: w.id, type: "window" })),
      ...columns.filter(c => phaseVisible(c.phase)).map(c => ({ id: c.id, type: "column" })),
      ...markers.filter(m => m.layer === "power" && markerVisible(m) && !markerLocked(m)).map(m => ({ id: m.id, type: "marker" })),
      ...(layerLocked("floorRegions") ? [] : floorRegions.filter(f => phaseVisible(f.phase)).map(f => ({ id: f.id, type: "floorRegion" }))),
    ];
    if (mode === "zone") return layerLocked("zones") ? []
      : zones.filter(z => phaseVisible(z.phase)).map(z => ({ id: z.id, type: "zone" }));
    if (mode === "itmep") return markers.filter(m => markerVisible(m) && !markerLocked(m)).map(m => ({ id: m.id, type: "marker" }));
    if (mode === "furnish") return (!visibleFurniture || layerLocked("furniture")) ? []
      : furniture.filter(f => phaseVisible(f.phase)).map(f => ({ id: f.id, type: "furniture" }));
    return [];
  }, [mode, walls, doors, windows, columns, markers, floorRegions, zones, furniture,
      phaseVisible, markerVisible, markerLocked, layerLocked, visibleFurniture]);

  // Simplified draw data for the minimap. Deliberately coarse — flat blocks for programme
  // and floors, single-weight lines for walls, dots for everything placed. Detail is the
  // canvas's job; this only has to be recognisable enough to navigate by.
  // The ceiling slab is skipped in X-Ray (it would hide the interior X-Ray exists to show)
  // and needs a closed outer wall loop to have any shape. Rather than leave a button that
  // silently does nothing, we disable it and name the reason in its tooltip.
  const ceilingInertReason = useMemo(() => {
    if (style3d === "xray") return "Ceiling isn't drawn in X-Ray";
    if (!traceOuterBoundary(nodes, walls)) return "Ceiling needs a closed run of walls";
    return null;
  }, [style3d, nodes, walls]);

  const minimapData = useMemo(() => {
    const bounds = contentBounds(allFitPoints());
    if (!bounds) return null;
    const areas = [];
    if (visibleFloorRegions) for (const f of floorRegions) {
      if (!f.points?.length || !phaseVisible(f.phase)) continue;
      areas.push({ id: "f" + f.id, points: f.points, fill: (FLOOR_MATERIAL_HEX[f.material] || "#AEABA4") + "44" });
    }
    if (visibleZones) for (const z of zones) {
      if (!phaseVisible(z.phase)) continue;
      const col = zoneLibrary[z.type]?.color || canvasT.accent;
      const pts = z.points || [{ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y }, { x: z.x + z.w, y: z.y + z.h }, { x: z.x, y: z.y + z.h }];
      areas.push({ id: "z" + z.id, points: pts, fill: col + "33", stroke: col + "77" });
    }
    const segments = [];
    for (const w of walls) {
      if (!phaseVisible(w.phase)) continue;
      const a = gn(w.n1), b = gn(w.n2);
      if (!a || !b) continue;
      const kind = w.kind || "existing";
      segments.push({ id: w.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, demo: kind === "demo",
        color: canvasWallKinds[kind]?.color || canvasT.text });
    }
    const dots = [];
    if (visibleFurniture) for (const f of furniture) {
      if (phaseVisible(f.phase)) dots.push({ id: "u" + f.id, x: f.x, y: f.y, color: "#C07840" });
    }
    for (const m of markers) {
      if (!markerVisible(m)) continue;
      dots.push({ id: "m" + m.id, x: m.x, y: m.y, color: SPEC_LAYERS[m.layer]?.color || canvasT.accent });
    }
    return { bounds, areas, segments, dots };
  }, [allFitPoints, floorRegions, zones, walls, furniture, markers, gn, zoneLibrary, canvasT,
      canvasWallKinds, phaseVisible, markerVisible, visibleFloorRegions, visibleZones, visibleFurniture]);


  const multiSelItems = useMemo(() => {
    if (!multiSelType || multiSelType === "mixed" || selectedIds.length <= 1) return [];
    const ids = new Set(selectedIds);
    if (multiSelType === "wall") return walls.filter(w => ids.has(w.id));
    if (multiSelType === "zone") return zones.filter(z => ids.has(z.id));
    if (multiSelType === "marker") return markers.filter(m => ids.has(m.id));
    if (multiSelType === "door") return doors.filter(d => ids.has(d.id));
    if (multiSelType === "window") return windows.filter(w => ids.has(w.id));
    if (multiSelType === "column") return columns.filter(c => ids.has(c.id));
    return [];
  }, [multiSelType, selectedIds, walls, zones, markers, doors, windows, columns]);

  const cv = (items, key) => {
    if (!items.length) return undefined;
    const v = items[0][key];
    return items.every(i => i[key] === v) ? v : undefined;
  };

  const delSel = useCallback(() => {
    // Selection read fresh at event time (delSel is only invoked from the Delete key and
    // the inspector's delete buttons) → kept out of the dep array.
    const { selectedId, selType, selectedIds } = useSelectionStore.getState();
    const nDeleted = selectedIds.length || (selectedId ? 1 : 0);
    if (nDeleted) toast(`Deleted ${nDeleted} item${nDeleted === 1 ? "" : "s"}`, { description: "⌘Z to undo" });
    const pIdx = (id) => phases.findIndex(p => p.id === (id ?? activePhase));
    const activeIdx = pIdx(activePhase);
    const phaseDeleteMarkers = (p, matchFn) => p.reduce((acc, m) => {
      if (!matchFn(m)) { acc.push(m); return acc; }
      if (pIdx(m.phase) >= activeIdx) return acc;
      acc.push({ ...m, deletedAtPhase: activePhase });
      return acc;
    }, []);

    // Delete all selected objects if multiple are selected
    if (selectedIds.length > 0) {
      const idsToDelete = new Set(selectedIds);
      
      // Delete walls and their nodes
      const wallsToDelete = walls.filter(w => idsToDelete.has(w.id));
      const nodesToDelete = nodes.filter(n => idsToDelete.has(n.id));
      
      // Remove walls that are selected or connected to selected nodes
      const nodeIdSet = new Set(nodesToDelete.map(n => n.id));
      const remainingWalls = walls.filter(w => {
        if (idsToDelete.has(w.id)) return false;
        if (nodeIdSet.has(w.n1) || nodeIdSet.has(w.n2)) return false;
        return true;
      });
      
      // Remove nodes that are no longer connected to any walls
      const remainingNodes = nodes.filter(n => {
        if (nodeIdSet.has(n.id)) return false;
        return remainingWalls.some(w => w.n1 === n.id || w.n2 === n.id);
      });
      
      setWalls(remainingWalls);
      setNodes(remainingNodes);
      setDoors(p => p.filter(d => !idsToDelete.has(d.id)));
      setWindows(p => p.filter(w => !idsToDelete.has(w.id)));
      setColumns(p => p.filter(c => !idsToDelete.has(c.id)));
      setFurniture(p => p.filter(f => !idsToDelete.has(f.id)));
      setZones(p => p.filter(z => !idsToDelete.has(z.id)));
      setMarkers(p => phaseDeleteMarkers(p, m => idsToDelete.has(m.id)));
      setDims(p => p.filter(d => !idsToDelete.has(d.id)));
      setLabels(p => p.filter(l => !idsToDelete.has(l.id)));
      setRevClouds(p => p.filter(r => !idsToDelete.has(r.id)));
      setFlowPaths(p => p.filter(r => !idsToDelete.has(r.id)));
      setFloorRegions(p => p.filter(r => !idsToDelete.has(r.id)));
      // Per-direction elevation annotations (dims/labels) — selecting one sets selectedIds,
      // so this multi-delete path must purge them too, or they can't be deleted.
      setElevAnnotations(prev => Object.fromEntries(Object.entries(prev).map(([dir, a]) => [dir, {
        ...a,
        dims:      (a.dims      || []).filter(x => !idsToDelete.has(x.id)),
        labels:    (a.labels    || []).filter(x => !idsToDelete.has(x.id)),
        revClouds: (a.revClouds || []).filter(x => !idsToDelete.has(x.id)),
      }])));

      setSelectedIds([]);
      setSelectedId(null);
      setSelType(null);
    }
    // Single object deletion (legacy path)
    else if (selectedId) {
      if (selType === "wall") { const w = walls.find(ww => ww.id === selectedId); const rem = walls.filter(ww => ww.id !== selectedId); setWalls(rem); if (w) setNodes(prev => prev.filter(n => rem.some(ww => ww.n1 === n.id || ww.n2 === n.id))); }
      else if (selType === "node") { const cids = new Set(wallsAt(selectedId).map(w => w.id)); const rem = walls.filter(w => !cids.has(w.id)); setWalls(rem); setNodes(prev => prev.filter(n => n.id !== selectedId && rem.some(w => w.n1 === n.id || w.n2 === n.id))); }
      else if (selType === "door") setDoors(p => p.filter(d => d.id !== selectedId));
      else if (selType === "window") setWindows(p => p.filter(w => w.id !== selectedId));
      else if (selType === "column") setColumns(p => p.filter(c => c.id !== selectedId));
      else if (selType === "furniture") setFurniture(p => p.filter(f => f.id !== selectedId));
      else if (selType === "dim") setDims(p => p.filter(d => d.id !== selectedId));
      else if (selType === "guide") setGuides(p => p.filter(g => g.id !== selectedId));
      else if (selType === "label" || selType === "label-tip") setLabels(p => p.filter(l => l.id !== selectedId));
      else if (selType === "revcloud") setRevClouds(p => p.filter(r => r.id !== selectedId));
      else if (selType === "flowPath") setFlowPaths(p => p.filter(r => r.id !== selectedId));
      else if (selType === "floorRegion") setFloorRegions(p => p.filter(r => r.id !== selectedId));
      else if (selType === "elevDim" || selType === "elevLabel" || selType === "elevRevCloud") {
        const key = selType === "elevDim" ? "dims" : selType === "elevLabel" ? "labels" : "revClouds";
        setElevAnnotations(prev => Object.fromEntries(Object.entries(prev).map(([dir, a]) => [dir, { ...a, [key]: (a[key] || []).filter(x => x.id !== selectedId) }])));
      }
      else { setZones(p => p.filter(z => z.id !== selectedId)); setMarkers(p => phaseDeleteMarkers(p, m => m.id === selectedId)); }
      setSelectedId(null); setSelType(null); setSelectedIds([]);
    }
  }, [walls, nodes, wallsAt, phases, activePhase]);

  const _ids = () => new Set(selectedIds.length > 1 ? selectedIds : [selectedId].filter(Boolean));
  const updZone = (u) => { const ids = _ids(); setZones(p => p.map(z => ids.has(z.id) ? { ...z, ...u } : z)); };
  const updMarker = (u) => { const ids = _ids(); setMarkers(p => p.map(x => ids.has(x.id) ? { ...x, ...u } : x)); };
  const updWall = (u) => { const ids = _ids(); setWalls(p => p.map(w => ids.has(w.id) ? { ...w, ...u } : w)); };
  const updDoor = (u) => { const ids = _ids(); setDoors(p => p.map(d => ids.has(d.id) ? { ...d, ...u } : d)); };
  const updWindow = (u) => { const ids = _ids(); setWindows(p => p.map(w => ids.has(w.id) ? { ...w, ...u } : w)); };
  const updColumn = (u) => { const ids = _ids(); setColumns(p => p.map(c => ids.has(c.id) ? { ...c, ...u } : c)); };
  const updFurniture = (u) => { const ids = _ids(); setFurniture(p => p.map(f => ids.has(f.id) ? { ...f, ...u } : f)); };

  // "Furnish this zone": drop the zone type's furnish plan, arranged to fit its bounds, as
  // real independent pieces (the user then arranges/edits them). Tagged fromZone so a repeat
  // click re-furnishes (clears this zone's prior drop first) instead of piling up.
  const furnishZone = (zone) => {
    const plan = ZONE_FURNISH_PLAN[zone.type];
    if (!plan?.length) return;
    let bbox;
    if (zone.points) {
      const pts = resolvePoints(zone), xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      bbox = { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    } else bbox = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
    const placed = layoutZoneFurniture(bbox, plan, pxPerFoot).map(p => ({
      ...p, id: uid(), label: "", fromZone: zone.id, phase: activePhase,
    }));
    setFurniture(prev => [...prev.filter(f => f.fromZone !== zone.id), ...placed]);
  };
  // "New construction" toggle shared by the door/window/column inspectors — an unchecked
  // item is part of the as-built plan (priced $0); checking it rolls the item into the budget.
  const newToggle = (on, onToggle, accent = T.brand) => (
    <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginBottom: 8, padding: "7px 9px", background: on ? accent + "18" : T.panelBg, borderRadius: 6, border: "1px solid " + (on ? accent : T.border) }}>
      <input type="checkbox" data-testid="new-construction" checked={on} onChange={e => onToggle(e.target.checked)} style={{ width: 14, height: 14, accentColor: accent, cursor: "pointer" }} />
      <span style={{ fontSize: 10, color: on ? T.textBright : T.textMuted, fontWeight: on ? 600 : 400 }}>New construction <span style={{ color: T.textFaint, fontWeight: 400 }}>· adds to budget</span></span>
    </label>
  );
  const updElevLabel = (u) => setElevAnnotations(prev => Object.fromEntries(Object.entries(prev).map(([dir, a]) =>
    [dir, { ...a, labels: (a?.labels || []).map(l => l.id === selectedId ? { ...l, ...u } : l) }])));
  const updElevRevCloud = (u) => setElevAnnotations(prev => Object.fromEntries(Object.entries(prev).map(([dir, a]) =>
    [dir, { ...a, revClouds: (a?.revClouds || []).map(r => r.id === selectedId ? { ...r, ...u } : r) }])));
  const updLabel = (u) => {
    const ids = _ids();
    setLabels(p => p.map(l => ids.has(l.id) ? { ...l, ...u } : l));
    if (u.color != null) {
      const lbl = labels.find(l => l.id === selectedId);
      if (lbl?.anchorType === "revcloud" && lbl?.anchorId)
        setRevClouds(p => p.map(r => r.id === lbl.anchorId ? { ...r, color: u.color } : r));
    }
  };
  const updRevCloud = (u) => {
    setRevClouds(p => p.map(r => r.id === selectedId ? { ...r, ...u } : r));
    if (u.color != null)
      setLabels(p => p.map(l => l.anchorType === "revcloud" && l.anchorId === selectedId ? { ...l, color: u.color } : l));
  };

  const alignDistribute = useCallback((action) => {
    if (selectedIds.length < 2) return;
    const ids = new Set(selectedIds);
    const phased = activePhase && activePhase !== "existing";

    // Build a resolved bounding-box/centroid record for each selected element
    const makeBox = (el, type) => {
      if (type === "zone") {
        const pts = resolvePoints(el);
        if (!pts || pts.length === 0) return null;
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        return { id: el.id, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, type, el };
      }
      const rp = resolvePos(el);
      return { id: el.id, cx: rp.x, cy: rp.y, type, el };
    };

    const allItems = [];
    const collect = (arr, type) => arr.filter(e => ids.has(e.id)).forEach(e => { const b = makeBox(e, type); if (b) allItems.push(b); });
    collect(columns, "column"); collect(markers, "marker");
    collect(doors, "door"); collect(windows, "window"); collect(zones, "zone");
    collect(furniture, "furniture");
    if (allItems.length < 2) return;

    const xs = allItems.map(i => i.cx), ys = allItems.map(i => i.cy);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    // Compute target cx/cy for each item
    const targets = allItems.map(item => ({ ...item, nx: item.cx, ny: item.cy }));

    if (action === "alignLeft")       targets.forEach(t => { t.nx = minX; });
    else if (action === "alignCenterH") targets.forEach(t => { t.nx = (minX + maxX) / 2; });
    else if (action === "alignRight")  targets.forEach(t => { t.nx = maxX; });
    else if (action === "alignTop")    targets.forEach(t => { t.ny = minY; });
    else if (action === "alignMiddleV") targets.forEach(t => { t.ny = (minY + maxY) / 2; });
    else if (action === "alignBottom") targets.forEach(t => { t.ny = maxY; });
    else if (action === "distributeH" && targets.length >= 2) {
      const sorted = [...targets].sort((a, b) => a.cx - b.cx);
      const step = (maxX - minX) / (sorted.length - 1);
      sorted.forEach((t, i) => { t.nx = minX + i * step; });
    } else if (action === "distributeV" && targets.length >= 2) {
      const sorted = [...targets].sort((a, b) => a.cy - b.cy);
      const step = (maxY - minY) / (sorted.length - 1);
      sorted.forEach((t, i) => { t.ny = minY + i * step; });
    }

    const deltaMap = new Map(targets.map(t => [t.id, { dx: t.nx - t.cx, dy: t.ny - t.cy }]));

    const applyEl = (el, type) => {
      const d = deltaMap.get(el.id);
      if (!d || (d.dx === 0 && d.dy === 0)) return el;
      if (type === "zone") {
        const pts = resolvePoints(el);
        const newPts = pts.map(p => ({ x: p.x + d.dx, y: p.y + d.dy }));
        return phased ? { ...el, px: { ...el.px, [activePhase]: newPts } } : { ...el, points: newPts };
      }
      const rp = resolvePos(el);
      const nx = rp.x + d.dx, ny = rp.y + d.dy;
      if (phased) return { ...el, px: { ...el.px, [activePhase]: { ...(el.px?.[activePhase] ?? {}), x: nx, y: ny } } };
      return { ...el, x: nx, y: ny };
    };

    setColumns(prev => prev.map(c => ids.has(c.id) ? applyEl(c, "column") : c));
    setMarkers(prev => prev.map(m => ids.has(m.id) ? applyEl(m, "marker") : m));
    setDoors(prev => prev.map(d => ids.has(d.id) ? applyEl(d, "door") : d));
    setWindows(prev => prev.map(w => ids.has(w.id) ? applyEl(w, "window") : w));
    setZones(prev => prev.map(z => ids.has(z.id) ? applyEl(z, "zone") : z));
    setFurniture(prev => prev.map(f => ids.has(f.id) ? applyEl(f, "furniture") : f));
  }, [selectedIds, activePhase, columns, markers, doors, windows, zones, furniture, resolvePos, resolvePoints]);

  // Keyboard. The handler closes over this render's values and is parked in a ref; ONE
  // window listener, bound at mount, always calls the latest one. It used to be re-bound
  // through a ~60-entry dependency list that included cursorPos, so the listener was torn
  // down and re-attached on nearly every mouse move. (Reading values through the ref also
  // sidesteps the TDZ trap of naming a later-declared const in a dep array — see CLAUDE.md.)
  const onKeyDownLatest = (e) => {
    const cursorPos = useHoverStore.getState().cursorPos;
      // Alt held = place off-grid. Read from the event so it tracks even mid-drag.
      if (e.altKey) setSnapOff(true);
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      // ── Dimension input mode (wall drawing) ─────────────────────────
      if (isWallTool(tool) && drawChain) {
        const key = e.key;
        if (/^[0-9.'"]$/.test(key)) {
          e.preventDefault();
          setDimInput(prev => prev + key);
          return;
        }
        if (key === "Backspace" && dimInput !== "") {
          e.preventDefault();
          setDimInput(prev => prev.slice(0, -1));
          return;
        }
        if ((key === "Backspace" || key === "u" || key === "U") && dimInput === "") {
          e.preventDefault();
          const hist = drawChain.history || [];
          if (hist.length > 0) {
            undo();
            setDrawChain({ ...hist[hist.length - 1], history: hist.slice(0, -1) });
          } else {
            setDrawChain(null); setCursorPos(null); setDimInput("");
          }
          return;
        }
        if (key === "Enter" && dimInput !== "" && cursorPos) {
          const lockedDist = parseDimInput(dimInput, pxPerFoot);
          if (lockedDist !== null) {
            const angle = Math.atan2(cursorPos.y - drawChain.lastY, cursorPos.x - drawChain.lastX);
            const lx = drawChain.lastX + Math.cos(angle) * lockedDist;
            const ly = drawChain.lastY + Math.sin(angle) * lockedDist;
            const result = commitWallSegment(drawChain.lastNodeId, drawChain.lastX, drawChain.lastY, lx, ly, wallKind);
            setDimInput("");
            if (result) {
              const near = findNear(lx, ly, [drawChain.lastNodeId]);
              if (near) { setDrawChain(null); setCursorPos(null); }
              else { setDrawChain({ lastNodeId: result.nodeId, lastX: result.x, lastY: result.y, history: [...(drawChain.history || []), { lastNodeId: drawChain.lastNodeId, lastX: drawChain.lastX, lastY: drawChain.lastY }] }); }
            }
          }
          return;
        }
        if (key === "Escape" && dimInput !== "") { setDimInput(""); return; }
      }
      // ── Typed room size (rect tool) — "20x30", "20'6\"x30'" ────────────────
      // Same typed-dimension affordance the wall tool has, which is the precision path a
      // test fit actually needs: state the room, don't eyeball the drag.
      if (tool === "rect" && drawRect) {
        const key = e.key;
        if (/^[0-9.'"xX]$/.test(key)) { e.preventDefault(); setDimInput(prev => prev + key); return; }
        if (key === "Backspace" && dimInput !== "") { e.preventDefault(); setDimInput(prev => prev.slice(0, -1)); return; }
        if (key === "Escape" && dimInput !== "") { e.preventDefault(); setDimInput(""); return; }
        if (key === "Enter" && dimInput !== "") {
          e.preventDefault();
          const parts = dimInput.split(/[xX]/);
          const w = parseDimInput(parts[0], pxPerFoot);
          const h = parts.length > 1 ? parseDimInput(parts[1], pxPerFoot) : w;
          if (w !== null && h !== null) {
            // Grow toward the cursor, so the typed room lands where you were dragging.
            const sxDir = cursorPos && cursorPos.x < drawRect.x1 ? -1 : 1;
            const syDir = cursorPos && cursorPos.y < drawRect.y1 ? -1 : 1;
            if (commitRectRoom(drawRect.x1, drawRect.y1, drawRect.x1 + w * sxDir, drawRect.y1 + h * syDir, wallKind)) {
              setDrawRect(null); setCursorPos(null);
            }
          }
          setDimInput("");
          return;
        }
      }
      // ── Repeat-distribute mode ("/" then a number then Enter) ─────────────
      if (repeatInput !== null) {
        e.preventDefault();
        if (/^[0-9]$/.test(e.key)) { setRepeatInput(prev => prev + e.key); return; }
        if (e.key === "Backspace") { setRepeatInput(prev => prev.slice(0, -1)); return; }
        if (e.key === "Enter" && repeatInput !== "" && lastCopyInfo) {
          const n = parseInt(repeatInput, 10);
          if (n >= 1 && (lastCopyInfo.dx !== 0 || lastCopyInfo.dy !== 0)) {
            const { srcItems, dx, dy } = lastCopyInfo;
            const step = 1 / (n + 1);
            const newCols = [], newMks = [], newDrs = [], newWins = [], newZns = [], newFns = [];
            const newIds = [];
            for (let i = 1; i <= n; i++) {
              const frac = i * step;
              srcItems.forEach(item => {
                const nid = uid();
                newIds.push(nid);
                const nx = item.x + dx * frac, ny = item.y + dy * frac;
                if (item.type === "column") { const src = columns.find(c => c.id === item.id); if (src) newCols.push({ ...src, id: nid, px: undefined, x: nx, y: ny }); }
                else if (item.type === "marker") { const src = markers.find(m => m.id === item.id); if (src) newMks.push({ ...src, id: nid, px: undefined, x: nx, y: ny, deletedAtPhase: undefined }); }
                else if (item.type === "furniture") { const src = furniture.find(f => f.id === item.id); if (src) newFns.push({ ...src, id: nid, x: nx, y: ny, fromZone: undefined }); }
                else if (item.type === "door") { const src = doors.find(d => d.id === item.id); if (src) newDrs.push({ ...src, id: nid, px: undefined, x: nx, y: ny }); }
                else if (item.type === "window") { const src = windows.find(w => w.id === item.id); if (src) newWins.push({ ...src, id: nid, px: undefined, x: nx, y: ny }); }
                else if (item.type === "zone") { const src = zones.find(z => z.id === item.id); if (src) { const c = polyCentroid(resolvePoints(src)); const odx = nx - c.x, ody = ny - c.y; newZns.push({ ...src, id: nid, px: undefined, points: resolvePoints(src).map(p => ({ x: p.x + odx, y: p.y + ody })) }); } }
              });
            }
            if (newCols.length) setColumns(p => [...p, ...newCols]);
            if (newMks.length) setMarkers(p => [...p, ...newMks]);
            if (newFns.length) setFurniture(p => [...p, ...newFns]);
            if (newDrs.length) setDoors(p => [...p, ...newDrs]);
            if (newWins.length) setWindows(p => [...p, ...newWins]);
            if (newZns.length) setZones(p => [...p, ...newZns]);
            if (newIds.length) { setSelectedIds(newIds); setSelectedId(newIds[0]); }
          }
          setRepeatInput(null);
          return;
        }
        if (e.key === "Escape") { setRepeatInput(null); return; }
        return;
      }

      const k = e.key.toUpperCase();
      if (e.key === " ") { e.preventDefault(); setSpaceHeld(true); return; }
      if (k === "Z" && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (k === "Y" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); redo(); return; }
      if (k === "Z" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); return; }
      // ── Copy ────────────────────────────────────────────────────────────
      if (k === "C" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const ids = new Set(selectedIds.length > 1 ? selectedIds : selectedId ? [selectedId] : []);
        if (ids.size === 0) return;
        // Collect walls and their nodes
        const copiedWalls = walls.filter(w => ids.has(w.id));
        const wallNodeIds = new Set();
        copiedWalls.forEach(w => { wallNodeIds.add(w.n1); wallNodeIds.add(w.n2); });
        const copiedNodes = nodes.filter(n => wallNodeIds.has(n.id));
        const copiedDoors = doors.filter(d => ids.has(d.id));
        const copiedWindows = windows.filter(w => ids.has(w.id));
        const copiedColumns = columns.filter(c => ids.has(c.id));
        const copiedMarkers = markers.filter(m => ids.has(m.id));
        const copiedFurniture = furniture.filter(f => ids.has(f.id));
        const copiedZones = zones.filter(z => ids.has(z.id));
        setClipboard({ walls: copiedWalls, nodes: copiedNodes, doors: copiedDoors, windows: copiedWindows, columns: copiedColumns, markers: copiedMarkers, furniture: copiedFurniture, zones: copiedZones });
        toast(`Copied ${ids.size} item${ids.size === 1 ? "" : "s"}`);
        setPasteOffset(0);
        return;
      }
      // ── Paste ────────────────────────────────────────────────────────────
      if (k === "V" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!clipboard) return;
        const off = (pasteOffset + 1) * 20;
        setPasteOffset(p => p + 1);
        // Remap node IDs
        const nodeMap = {};
        const newNodes = clipboard.nodes.map(n => { const nid = uid(); nodeMap[n.id] = nid; return { ...n, id: nid, x: n.x + off, y: n.y + off }; });
        const newWalls = clipboard.walls.map(w => ({ ...w, id: uid(), n1: nodeMap[w.n1] ?? w.n1, n2: nodeMap[w.n2] ?? w.n2 }));
        const newDoors = clipboard.doors.map(d => ({ ...d, id: uid(), x: d.x + off, y: d.y + off }));
        const newWindows = clipboard.windows.map(w => ({ ...w, id: uid(), x: w.x + off, y: w.y + off }));
        const newColumns = clipboard.columns.map(c => ({ ...c, id: uid(), x: c.x + off, y: c.y + off }));
        const newMarkers = clipboard.markers.map(m => ({ ...m, id: uid(), x: m.x + off, y: m.y + off, deletedAtPhase: undefined }));
        const newFurniture = (clipboard.furniture || []).map(f => ({ ...f, id: uid(), x: f.x + off, y: f.y + off, fromZone: undefined }));
        const newZones = clipboard.zones.map(z => z.points
          ? { ...z, id: uid(), points: z.points.map(pt => ({ x: pt.x + off, y: pt.y + off })) }
          : { ...z, id: uid(), x: z.x + off, y: z.y + off });
        setNodes(p => [...p, ...newNodes]);
        setWalls(p => [...p, ...newWalls]);
        setDoors(p => [...p, ...newDoors]);
        setWindows(p => [...p, ...newWindows]);
        setColumns(p => [...p, ...newColumns]);
        setMarkers(p => [...p, ...newMarkers]);
        if (newFurniture.length) setFurniture(p => [...p, ...newFurniture]);
        setZones(p => [...p, ...newZones]);
        // Select all pasted objects
        const allNewIds = [...newWalls.map(w => w.id), ...newDoors.map(d => d.id), ...newWindows.map(w => w.id), ...newColumns.map(c => c.id), ...newMarkers.map(m => m.id), ...newFurniture.map(f => f.id), ...newZones.map(z => z.id)];
        if (allNewIds.length === 1) { setSelectedId(allNewIds[0]); setSelType(newWalls.length ? "wall" : newDoors.length ? "door" : newWindows.length ? "window" : newColumns.length ? "column" : newMarkers.length ? "marker" : newFurniture.length ? "furniture" : "zone"); setSelectedIds([]); }
        else if (allNewIds.length > 1) { setSelectedIds(allNewIds); setSelectedId(allNewIds[0]); setSelType(newWalls.length ? "wall" : null); }
        if (allNewIds.length) toast(`Pasted ${allNewIds.length} item${allNewIds.length === 1 ? "" : "s"}`);
        return;
      }
      // Number keys for modes
      if (e.key === "1") { setMode("build");  setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); setShowModeMenu(false); return; }
      if ((e.ctrlKey || e.metaKey) && k === "A") {
        e.preventDefault();
        const all = selectableInMode();
        // ⌘⇧A — "select same type": keep only what matches the current selection's type.
        const same = e.shiftKey && selType ? all.filter(o => o.type === selType) : all;
        if (same.length) {
          setSelectedIds(same.map(o => o.id));
          setSelectedId(same[0].id); setSelType(same[0].type); setT("select");
        }
        return;
      }
      if (e.key === "2") { setMode("itmep");  setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); setShowModeMenu(false); return; }
      if (e.key === "3") { setMode("zone");   setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); setShowModeMenu(false); return; }
      if (e.key === "4") { setMode("furnish"); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); setShowModeMenu(false); return; }
      if (e.key === "5") { setMode("budget"); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); setShowModeMenu(false); return; }
      if (e.key === "6") { setMode("docs");   setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); setShowModeMenu(false); return; }
      // Docs mode has its own lightweight tools inside DocsView — the plan-canvas tool
      // shortcuts don't apply there.
      if (mode === "docs") { /* fall through to Escape / arrows / undo below */ }
      else if (k === "V" || k === "H") { setT(k === "V" ? "select" : "pan"); }
      else if (mode === "build" && { W: "wall", C: "column" }[k]) { setT({ W: "wall", C: "column" }[k]); }
      // R = rect-room tool — but R also flips a selected door's hinge / rotates a selected
      // window or directional marker, so only when nothing R-sensitive is selected.
      else if (mode === "build" && k === "R" && !selDoor && !selWindow && !selMarker) { setT("rect"); }
      else if (mode === "itmep" && k === "E") { setT("outlet"); }
      else if (mode === "itmep" && k === "L") { setT("lighting"); }
      else if (k === "M") { setT("dim"); setDrawDim(null); }
      else if (k === "T") { setT("label"); }
      else if (k === "N") { setT("revcloud"); }
      else if (mode === "build" && k === "K") { setT("flowPath"); }
      else if (mode === "build" && k === "A" && !(e.ctrlKey || e.metaKey)) { setT("floorRegion"); }
      else if (mode === "zone" && k === "Z") { setT("zone"); }
      else if (mode === "itmep" && k === "P") { setT("marker"); }
      if (k === "D" && !e.ctrlKey) setShowDims(d => !d);
      if (k === "G") setShowGrid(g => !g);
      if (k === "R" && ((tool === "outlet" && outletType.startsWith("htrack_")) || (tool === "lighting" && lightingType.startsWith("htrack_")))) { setHtrackAngle(a => (a + 45) % 180); }
      if (k === "R" && selMarker && SPEC_COMPONENTS[selMarker.layer]?.[selMarker.componentType]?.directional) { setMarkers(p => p.map(m => m.id === selMarker.id ? { ...m, angle: (m.angle || 0) + Math.PI / 12 } : m)); }
      if (k === "F" && selDoor) updDoor({ flipped: !selDoor.flipped });
      if (k === "R" && selDoor) updDoor({ hingeRight: !selDoor.hingeRight });
      if (k === "R" && selWindow) updWindow({ angle: (selWindow.angle + 90) % 360 });
      if ((k === "DELETE" || k === "BACKSPACE") && !editingLabelId && (selectedId || selectedIds.length > 0)) { e.preventDefault(); delSel(); }
      // Enter finishes an in-progress flow path (open polyline, >=2 points).
      if (k === "ENTER" && !editingLabelId && drawFlowPath && drawFlowPath.points.length >= 2) {
        e.preventDefault();
        const pts = drawFlowPath.points;
        if (drawFlowPath.editingId) {
          const eid = drawFlowPath.editingId;
          setFlowPaths(prev => prev.map(f => f.id === eid ? { ...f, points: pts } : f));
          setSelectedId(eid); setSelType("flowPath"); setSelectedIds([eid]);
        } else {
          const nid = uid();
          setFlowPaths(prev => [...prev, { id: nid, points: pts, width: 36, color: "#4A90D9", label: "", phase: activePhase }]);
          setSelectedId(nid); setSelType("flowPath"); setSelectedIds([nid]);
        }
        setDrawFlowPath(null);
        setT("select");
        return;
      }
      if (e.key === "?" || (k === "/" && e.shiftKey)) { e.preventDefault(); setShowShortcuts(v => !v); return; }
      if (k === "ESCAPE" && showShortcuts) { setShowShortcuts(false); return; }
      if (k === "ESCAPE") {
        // An in-flight drag/rotate/resize had no escape hatch — you had to finish the gesture
        // and then undo it. Abandoning the interaction comes first, then in-progress draws,
        // then the selection, then the tool itself.
        if (drag || resize || marquee || rotatingMarker || rotatingFurniture || furnitureResize) {
          setDrag(null); setResize(null); setMarquee(null);
          setRotatingMarker(null); setRotatingFurniture(null); setFurnitureResize(null);
          setSmartGuides([]);
        }
        else if (calibrationLine) { setCalibrationLine(null); setCursorPos(null); }
        else if (addingLeaderToId) { setAddingLeaderToId(null); }
        else if (drawRevCloud) { setDrawRevCloud(null); }
        else if (drawFlowPath) { setDrawFlowPath(null); }
        else if (drawFloorRegion) { setDrawFloorRegion(null); }
        else if (drawChain || drawRect || drawPolyZone || drawDim) {
          setDrawChain(null); setDrawRect(null); setDrawPolyZone(null); setCursorPos(null); setDimInput(""); setDrawDim(null);
        } else if (selectedId || selectedIds.length) {
          setSelectedId(null); setSelType(null); setSelectedIds([]);
        } else if (tool !== "select") {
          setT("select"); // nothing left to clear — fall back to the pointer
        }
      }
      // ── Arrow-key nudge ────────────────────────────────────────────
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key) && (selectedId || selectedIds.length > 0)) {
        e.preventDefault();
        const inch = pxPerFoot / 12;
        const step = e.shiftKey ? pxPerFoot : inch; // Shift = 1 ft, plain = 1 in
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp"   ? -step : e.key === "ArrowDown"  ? step : 0;
        const phased = activePhase && activePhase !== "existing";
        const nudgeXY = (obj) => {
          if (phased) { const b = obj.px?.[activePhase] ?? { x: obj.x, y: obj.y }; return { ...obj, px: { ...obj.px, [activePhase]: { x: b.x + dx, y: b.y + dy } } }; }
          return { ...obj, x: obj.x + dx, y: obj.y + dy };
        };
        // Collect all ids — single or multi
        const ids = new Set(selectedIds.length > 0 ? selectedIds : [selectedId]);
        // For wall selection, promote to both endpoint nodes
        const nodeIds = new Set(nodes.filter(n => ids.has(n.id)).map(n => n.id));
        walls.filter(w => ids.has(w.id)).forEach(w => { nodeIds.add(w.n1); nodeIds.add(w.n2); });
        if (nodeIds.size > 0) setNodes(prev => prev.map(n => nodeIds.has(n.id) ? nudgeXY(n) : n));
        // Nudging a wall moves its nodes, so the floor/zone corners sitting on them come
        // along too — the keyboard path has to match the drag path or resizing by arrow key
        // silently desyncs the room. Anything already in the selection is excluded here and
        // nudged below instead, so it moves exactly once.
        const carryStarts = nodeIds.size > 0
          ? nodes.filter(n => nodeIds.has(n.id)).map(n => ({ id: n.id, x: n.x, y: n.y })) : [];
        const carryTol = Math.max(1e-6, pxPerFoot / 48);
        const carryBy = () => ({ dx, dy });
        const zoneCarry = (carryStarts.length && !layerLocked("zones"))
          ? polyCarryStart(zones.filter(z => z.points && phaseVisible(z.phase)), carryStarts, carryTol, ids) : [];
        const floorCarry = (carryStarts.length && !layerLocked("floorRegions"))
          ? polyCarryStart(floorRegions.filter(f => phaseVisible(f.phase)), carryStarts, carryTol, ids) : [];
        setZones(prev => applyPolyCarry(prev, zoneCarry, carryBy).map(z => {
          if (!ids.has(z.id)) return z;
          if (z.points) {
            if (phased) { const b = z.px?.[activePhase] ?? z.points; return { ...z, px: { ...z.px, [activePhase]: b.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) } }; }
            return { ...z, points: z.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
          }
          return nudgeXY(z);
        }));
        setMarkers(prev => prev.map(m => ids.has(m.id) ? nudgeXY(m) : m));
        setFurniture(prev => prev.map(f => ids.has(f.id) ? nudgeXY(f) : f));
        setDoors(prev => prev.map(d => ids.has(d.id) ? nudgeXY(d) : d));
        setWindows(prev => prev.map(w => ids.has(w.id) ? nudgeXY(w) : w));
        setColumns(prev => prev.map(c => ids.has(c.id) ? nudgeXY(c) : c));
        setLabels(prev => prev.map(l => !ids.has(l.id) ? l : { ...l, x: l.x + dx, y: l.y + dy, lx: l.lx != null ? l.lx + dx : null, ly: l.ly != null ? l.ly + dy : null }));
        setRevClouds(prev => prev.map(r => !ids.has(r.id) ? r : { ...r, points: r.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
        setFlowPaths(prev => prev.map(r => !ids.has(r.id) ? r : { ...r, points: r.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
        setFloorRegions(prev => applyPolyCarry(prev, floorCarry, carryBy)
          .map(r => !ids.has(r.id) ? r : { ...r, points: r.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
        return;
      }

      if (e.key === "0" || e.key === "Home") { e.preventDefault(); fitAll(); }
      // Zoom in/out from the keyboard, and frame the selection.
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); setZoom(z => Math.min(4, z * 1.2)); }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") { e.preventDefault(); setZoom(z => Math.max(0.15, z / 1.2)); }
      if (k === "F" && !(e.ctrlKey || e.metaKey) && !selDoor) { e.preventDefault(); zoomToSelection(); }
      if (e.key === "`") { e.preventDefault(); setPanes(prev => prev.length > 1 ? [{ view: "plan" }] : [{ view: "plan" }, { view: "3d" }]); }
      if (e.key === "/" && lastCopyInfo && (lastCopyInfo.dx !== 0 || lastCopyInfo.dy !== 0)) { e.preventDefault(); setRepeatInput(""); return; }
    };
  const onKeyUpLatest = (e) => { if (e.key === " ") setSpaceHeld(false); if (!e.altKey) setSnapOff(false); };
  const keyHandlersRef = useRef(null);
  keyHandlersRef.current = { down: onKeyDownLatest, up: onKeyUpLatest };
  useEffect(() => {
    const down = (e) => keyHandlersRef.current?.down(e);
    const up = (e) => keyHandlersRef.current?.up(e);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const font = "'IBM Plex Mono','SF Mono','Consolas','Monaco',monospace";
  // Condensed architectural display face — wordmark, section headers, big readouts.
  const display = "'Saira Condensed','IBM Plex Sans',system-ui,sans-serif";
  const nodeConns = useMemo(() => { const c = {}; walls.forEach(w => { c[w.n1] = (c[w.n1] || 0) + 1; c[w.n2] = (c[w.n2] || 0) + 1; }); return c; }, [walls]);

  // 3D data — only resolved when 3D or split view is active
  const data3d = useMemo(() => {
    if (!show3d) return null;
    return {
      // dedupeWalls guards 3D against a transient duplicate/overlapping segment (otherwise each
      // wall copy claims a door on it → the door renders twice). Persisted data self-heals via
      // migrateProjectData on load; this keeps the live view correct without a reload.
      walls: dedupeWalls(walls).filter(w => phaseVisible(w.phase)),
      nodes: nodes.map(n => { const r = gn(n.id); return r ? { ...n, x: r.x, y: r.y } : n; }),
      doors: doors.filter(d => phaseVisible(d.phase)).map(d => ({ ...d, ...resolvePos(d) })),
      windows: windows.filter(w => phaseVisible(w.phase)).map(w => ({ ...w, ...resolvePos(w) })),
      columns: columns.filter(c => phaseVisible(c.phase)).map(c => ({ ...c, ...resolvePos(c) })),
      zones: zones.filter(z => phaseVisible(z.phase)).map(z => z.points ? { ...z, points: resolvePoints(z) } : z),
      furniture: visibleFurniture ? furniture.filter(f => phaseVisible(f.phase)) : [],
      markers: markers.filter(m => markerVisible(m)).map(m => ({ ...m, ...resolvePos(m) })),
      floorRegions: visibleFloorRegions ? floorRegions.filter(r => phaseVisible(r.phase)) : [],
    };
  }, [show3d, walls, nodes, doors, windows, columns, zones, furniture, visibleFurniture, markers, floorRegions, visibleFloorRegions, phaseVisible, markerVisible, gn, resolvePos, resolvePoints]);

  // Plan annotation text holds a readable on-screen size as you zoom OUT: the whole canvas
  // draws inside one scale(zoom) group, so at 40% a 10px dimension renders 4px tall and is
  // simply unreadable. Scaling by 1/zoom below 100% cancels that exactly. Deliberately NOT
  // applied at or above 100% — text is already comfortable there, and growing it in model
  // units would crowd the drawing it's annotating. This is the font-size counterpart to
  // vector-effect: non-scaling-stroke, which pins stroke width but does nothing for type.
  const textZoom = zoom < 1 ? 1 / zoom : 1;


  // Maps bright "schematic" colors to readable equivalents in light mode (MarkerSymbol.jsx).
  const uiColor = useCallback((c) => uiColorFor(c, themeMode, T), [themeMode, T]);
  // The chrome theme, captured for leaf symbols rendered INSIDE renderPlanCanvas — where `T`
  // is shadowed by the canvas theme — so their ui* colour tokens keep coming from the chrome.
  const chromeT = T;

  // ── Mode system ─────────────────────────────────────────────────────
  // Selection and flow paths are read from their stores at CALL time rather than closed
  // over, which keeps this stable (empty deps). It matters: setT is a ctx value the canvas
  // handlers list as a dependency, so a fresh identity here would re-create onDown/onMove
  // on every render and defeat their memoization.
  const setT = useCallback((t) => {
    setTool(t); setGhostPos(null); setDrawChain(null); setDrawRect(null); setDrawPolyZone(null); setCursorPos(null); setDimInput(""); setDrawDim(null); setDrawRevCloud(null); setDrawFloorRegion(null); setProxHover(null);
    // Re-entering the flow-path tool with a flow path selected → continue it.
    const { selType: selT, selectedId: selId } = useSelectionStore.getState();
    if (t === "flowPath" && selT === "flowPath" && selId) {
      const fp = useGeometryStore.getState().flowPaths.find(f => f.id === selId);
      if (fp && fp.points.length) { setDrawFlowPath({ points: fp.points.map(p => ({ ...p })), editingId: fp.id }); }
      else setDrawFlowPath(null);
    } else {
      setDrawFlowPath(null);
    }
    if (t !== "select" && t !== "pan") { setSelectedId(null); setSelType(null); setSelectedIds([]); }
  }, [setTool, setGhostPos, setDrawChain, setDrawRect, setDrawPolyZone, setCursorPos, setDimInput, setDrawDim, setDrawRevCloud, setDrawFloorRegion, setProxHover, setDrawFlowPath, setSelectedId, setSelType, setSelectedIds]);

  // Plan-canvas interaction handlers (extracted) — geometry/interaction/selection via
  // their stores; the rest via ctx. See useCanvasEvents.js.
  const { hitTest, onDown, onMove, onUp } = useCanvasEvents({
    activeComponentType, activeFurnitureType, activePhase, activeSpecLayer, activeZoneType, bgImage, bgOffset, canvasRotation, columnLabel, columnNotes, columnShape, columnSize, commitWallSegment, commitRectRoom, cvs, cvsContainer, doorFlipped, doorHingeRight, doorType, doorWidth, findDimSnap, findNear, findProxHover, floorMaterial, gn, htrackAngle, inToPx, isWallTool, lastCopyInfo, layerLocked, lightingIsNew, lightingType, markerFinish, markerLocked, markerNotes, markerVisible, mode, outletIsNew, outletType, phaseVisible, pxPerFoot, resolveDimEndpoints, resolveLeaderTip, resolvePoints, resolvePos, s2c, setBgOffset, setDimInput, setEditingLabelId, setEditingLabelText, setGuideScrub, setHoverGuideId, setLastCopyInfo, setT, setTool, setViewOff, setZoneEdge, snapGrid, snapGuide, snapLabelAnchor, snapToWall, themeMode, tool, viewOff, visibleFurniture, wallKind, wc, windowHeight, windowSill, windowType, windowWidth, zoneEdge, zoneLibrary, zoneNotes, zonePaintColor, zonePaintFinish, zoom,
  });

  // ── Docs stage plumbing ─────────────────────────────────────────────
  // renderSlideBody: the render prop DocsView uses to draw a slide's model content.
  // Slides render the LIVE model at the slide's saved crop — planning edits show up
  // automatically. (renderPlanCanvas is defined later in the component body; this
  // closure only runs at DocsView render time, after initialization.)
  // Largest standard architectural scale the slide's crop can print at — the sheet then
  // renders at EXACTLY that scale, so the title-block note is true on paper.
  const slideStdScale = (slide, w, h) => (slide.view === "3d" || !slide.rect) ? null
    : fitStandardScale(slide.rect, w, h, pxPerFoot);
  const slideAutoScale = (slide) => {
    const body = sheetBodyDims(docSettings);
    return slideStdScale(slide, body.w, body.h)?.label ?? null;
  };
  // Shared "Edit view / Reset / Save view" chrome for slide cameras.
  const camBtnStyle = (accent) => ({ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "1px solid " + (accent ? T.brand : T.border), background: accent ? T.brand + "22" : T.panelBg, color: accent ? T.textBright : T.textMuted, fontFamily: font, fontSize: 10, fontWeight: 600, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow });
  const slideCamControls = ({ editing, onEdit, onReset, onSave }) => (
    <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, display: "flex", gap: 6 }}>
      {!editing
        ? <button data-testid="slide-cam-edit" style={camBtnStyle(false)} onClick={onEdit}>
            <Camera size={11} /> Edit view
          </button>
        : <>
            <button data-testid="slide-cam-reset" style={camBtnStyle(false)} onClick={onReset}>
              <RotateCcw size={11} /> Reset
            </button>
            <button data-testid="slide-cam-save" style={camBtnStyle(true)} onClick={onSave}>
              <Check size={11} /> Save view
            </button>
          </>}
    </div>
  );
  const renderSlideBody = (slide, { width, height, forPrint = false, sheetScale = 1 } = {}) => {
    // Every slide (on-screen preview AND print — both flow through this same function) is
    // the printable output, so it never draws the dark (Blueprint) theme: Vellum normally,
    // pure-white Print when that theme is active. Shadows the outer T for this function.
    const T = docsSheetT;
    // Section divider (no model geometry): a heading that indexes the slides nested under
    // it. The right-hand contents list auto-builds from the section's children (live —
    // includes collapsed ones; collapse only tidies the deck strip, not this sheet).
    if (slide.view === "title") {
      const contents = slides.filter(s => s.parentId === slide.id).map(k => {
        const base = viewTitle(k.view);
        let detail = base;
        if (k.view === "budget") detail = base + " · " + $(cost.total);
        else if (k.view !== "ffe") { const sc = slideAutoScale(k); if (sc) detail = base + " · " + sc; }
        return { sheetNo: slides.indexOf(k) + 1, name: k.title || k.name, detail };
      });
      return <TitleSheet width={width} height={height} title={slide.title || slide.name} subtitle={slide.subtitle}
        contents={contents} T={T} font={font} display={display} />;
    }
    // Data slides (no camera, no layers): budget rollup + FF&E schedule, both live.
    if (slide.view === "budget") {
      return <BudgetSheet width={width} height={height} cost={cost} T={T} font={font} display={display} $={$} ft={ft} />;
    }
    if (slide.view === "ffe") {
      return <FnESheet width={width} height={height} cost={cost} T={T} font={font} display={display} $={$} />;
    }
    // Plan + elevation share the crop-editing model: while editing, a working copy of the
    // slide's rect is panned (drag) and zoomed (wheel); Save persists it and rendering
    // re-snaps to the nearest true standard scale.
    const rectEditing = !forPrint && docsCamEdit && docsEditRect && !IS_3D_VIEW(slide.view);
    // The zoom for a slide's crop. LOCKED render: snapped to a true architectural scale, so
    // the sheet's scale label is honest. EDITING: re-deriving the standard scale from the
    // live, still-being-dragged rect would make the zoom visibly "step" between discrete
    // scales as the user scrolls — so editing instead scales CONTINUOUSLY off the saved
    // rect's standard-scale zoom, by how much the live crop has grown/shrunk. That ratio is
    // exactly 1 the moment editing starts (or right after Save with no change), which is
    // what stops the "opens zoomed in ~2%, saving zooms back out" jump — entering/leaving
    // Edit view now renders the identical camera when nothing was actually changed.
    const docsSlideZoom = (rect, editing) => {
      const std = slideStdScale(slide, width, height);
      if (!editing) return std ? std.zoom : fitRectToViewport(rect, width, height, 8).zoom;
      const baseZoom = std ? std.zoom : fitRectToViewport(slide.rect, width, height, 8).zoom;
      return baseZoom * (slide.rect.w / rect.w);
    };
    const rectControls = () => slideCamControls({
      editing: rectEditing,
      onEdit: () => { setDocsCamEdit(true); setDocsEditRect({ ...slide.rect }); },
      onReset: () => setDocsEditRect({ ...slide.rect }),
      onSave: () => { updateSlide(slide.id, { rect: docsEditRect }); setDocsCamEdit(false); setDocsEditRect(null); },
    });
    const dragLayer = (dispZoom) => (
      <div
        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); docsPanRef.current = { sx: e.clientX, sy: e.clientY, rect: docsEditRect, k: dispZoom * sheetScale }; }}
        onWheel={() => {}}
        onWheelCapture={(e) => {
          e.stopPropagation(); // crop zoom must not also zoom the sheet view
          setDocsEditRect(r => {
            if (!r) return r;
            // Same proportional-to-deltaY factor as the plan canvas's onWheel, so crop-editing
            // a Docs slide feels like the same zoom speed instead of a fixed 10%-per-tick step.
            // A crop shrinks to zoom IN, so it's the inverse of the plan canvas's z * factor —
            // dividing by factor here keeps the two scrolling the same direction at the same rate.
            const factor = 1 - e.deltaY * 0.001;
            const w = Math.max(20, Math.min(200000, r.w / factor));
            const h = r.h * (w / r.w);
            return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
          });
        }}
        style={{ position: "absolute", inset: 0, zIndex: 5, cursor: "grab", background: "transparent" }} />
    );
    if (slide.view === "plan") {
      const rect = rectEditing ? docsEditRect : slide.rect;
      const cam = scaledRectCam(rect, width, height, docsSlideZoom(rect, rectEditing));
      const body = renderPlanCanvas({ zoom: cam.zoom, viewOff: cam.viewOff, width, height, interactive: false, ...slideLayersFor(slide) });
      if (forPrint) return body;
      return (
        <div style={{ width, height, position: "relative", pointerEvents: rectEditing ? "auto" : "none" }}>
          {body}
          {rectEditing && dragLayer(cam.zoom)}
          <div style={{ pointerEvents: "auto" }}>{rectControls()}</div>
        </div>
      );
    }
    if (!IS_3D_VIEW(slide.view)) { // elevation slides (iso renders through the 3D branch)
      // Elevation slide: read-only ElevationView at the saved u/v crop; shows the live
      // elevation annotations + section cut, same as the planning pane.
      const dir = slide.view;
      const cut = guides.find(g => g.dir === dir);
      const rect = rectEditing ? docsEditRect : slide.rect;
      const dispZoom = docsSlideZoom(rect, rectEditing);
      const elevMV = slideLayersFor(slide).markerVisible; // per-slide IT/MEP layer filter
      return (
        <div key={width + "x" + height} style={{ width, height, background: docsSheetT.canvas, position: "relative", pointerEvents: rectEditing ? "auto" : "none" }}>
          <ElevationView dir={dir} nodes={nodes} walls={walls} doors={doors} windows={windows} columns={columns}
            markers={markers.filter(elevMV)}
            ceilingHeight={ceilingHeight} pxPerFoot={pxPerFoot} T={canvasT} ft={ft} tool="select"
            cut={cut ? cut.pos : null} scrub={null} onView={null} panU={null}
            selectedId={null} selType={null} onSelect={() => {}}
            anno={elevAnnotations[dir] || { dims: [], labels: [], revClouds: [] }}
            readonly fixedRect={rect} fixedZoom={dispZoom} />
          {!forPrint && rectEditing && dragLayer(dispZoom)}
          {!forPrint && <div style={{ pointerEvents: "auto" }}>{rectControls()}</div>}
        </div>
      );
    }
    // 3D slide. Print/strip use the captured image; the open Docs slide renders live
    // WebGL (the only mounted 3D — planning panes are unmounted in Docs mode) and stays
    // orbit-able: gesture end persists the new pose AND refreshes the capture.
    const placeholder = (msg) => (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim, fontSize: 11, fontFamily: font, border: "1px dashed " + T.border, textAlign: "center", padding: 12, boxSizing: "border-box" }}>{msg}</div>
    );
    if (forPrint) {
      return slide.image
        ? <img src={slide.image} alt={slide.name} style={{ width, height, objectFit: "contain", display: "block" }} />
        : placeholder("3D view not captured yet — open this slide in Docs first.");
    }
    if (!data3d) return placeholder("Loading 3D…");
    // Camera is LOCKED by default: orbiting only while "Edit view" is active. Save
    // persists the pose + refreshes the deck/print capture; Reset reverts to the saved
    // pose without saving.
    const applyPose = (pose) => {
      const c = docs3dControlsRef.current;
      if (!c || !pose) return;
      c.object.position.set(...pose.position);
      c.target.set(...pose.target);
      if (pose.zoom) { c.object.zoom = pose.zoom; c.object.updateProjectionMatrix(); } // ortho iso
      c.update();
    };
    const saveView = () => {
      const c = docs3dControlsRef.current;
      if (c) {
        const cam3d = { position: c.object.position.toArray(), target: c.target.toArray(), zoom: c.object.zoom, style3d: slide.cam3d?.style3d || "clay", isoCorner: slide.cam3d?.isoCorner ?? null };
        const image = docsCaptureRef.current ? docsCaptureRef.current() : slide.image;
        updateSlide(slide.id, { cam3d, image });
      }
      setDocsCamEdit(false);
    };
    return (
      <div style={{ width, height, position: "relative", pointerEvents: "auto" }}>
        <Suspense fallback={placeholder("Loading 3D…")}>
          <TestFit3D key={slide.id}
            isoCorner={slide.view === "iso" ? (slide.cam3d?.isoCorner || "se") : null}
            walls={data3d.walls} nodes={data3d.nodes} doors={data3d.doors} windows={data3d.windows}
            columns={data3d.columns} zones={data3d.zones} furniture={data3d.furniture} visibleFurniture={visibleFurniture} markers={data3d.markers} dims={dims}
            pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight} T={docsSheetT} themeMode={monoDraw ? "mono" : themeMode}
            controlsRef={docs3dControlsRef} mode={mode} selectedId={null} selType={null}
            show3dLabels={show3dLabels} setShow3dLabels={setShow3dLabels}
            show3dDims={show3dDims} setShow3dDims={setShow3dDims}
            style3d={slide.cam3d?.style3d || "clay"} floorMaterial={floorMaterial} floorRegions={data3d.floorRegions}
            zoneLibrary={zoneLibrary} visibleLayers={visibleLayers}
            visibleBuildElectrical={visibleBuildElectrical} visibleBuildLighting={visibleBuildLighting}
            onSelect={() => {}}
            initialCamera={slide.cam3d} preserveBuffer captureRef={docsCaptureRef}
            controlsEnabled={docsCamEdit}
          />
        </Suspense>
        {!forPrint && slideCamControls({
          editing: docsCamEdit,
          onEdit: () => setDocsCamEdit(true),
          onReset: () => applyPose(slide.cam3d),
          onSave: saveView,
        })}
      </div>
    );
  };
  // Edit model: jump from a slide back into planning, framing the slide's view.
  // Plan restores the exact crop (camera applied once the canvas remounts); elevation/3D
  // open in a split pane and auto-fit (camera restore is best-effort in v1).
  const editModelFromSlide = (slide) => {
    if (slide.view === "budget") { setMode("budget"); setT("select"); return; } // data slide → Budget stage
    if (slide.view === "ffe") { setMode("zone"); setT("select"); return; }      // FF&E comes from zones → Zones stage
    setMode("build"); setT("select");
    if (slide.view === "plan") { setLayout(1); pendingPlanFitRef.current = slide.rect; }
    else { setLayout(2); setPaneView(1, slide.view === "3d" ? "3d" : slide.view); }
  };
  useEffect(() => {
    if (mode === "docs" || !pendingPlanFitRef.current) return;
    const el = cvs.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const cam = fitRectToViewport(pendingPlanFitRef.current, r.width, r.height, 24);
    pendingPlanFitRef.current = null;
    setZoom(cam.zoom); setViewOff(cam.viewOff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Print lifecycle: mount the print root, give it two frames to lay out, open the
  // dialog; unmount when the dialog closes (afterprint).
  useEffect(() => {
    if (!printing) return;
    let cancelled = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) window.print(); }));
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    return () => { cancelled = true; window.removeEventListener("afterprint", done); };
  }, [printing]);

  const MODES = useMemo(() => ({
    build:   { name: "Build",   num: 1, color: "#9A9488",    desc: "Walls, doors, windows, columns" },
    itmep:   { name: "IT/MEP",  num: 2, color: "#4080E0",    desc: "Power, data, mechanical markers" },
    zone:    { name: "Zones",   num: 3, color: "#50A070",    desc: "Program areas & square footage" },
    furnish: { name: "Furnish", num: 4, color: "#C07840",    desc: "Place & arrange furniture in zones" },
    budget:  { name: "Budget",  num: 5, color: T.uiBudget,   desc: "Cost rollup & assumptions" },
    docs:    { name: "Docs",    num: 6, color: "#8E5AA8",    desc: "Presentation sheets & printing" },
  }), [T]);

  // Memoized on its inputs so the sidebar / tool rail (React.memo) keep a stable `S`.
  const S = useMemo(() => ({
    root: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: font, fontSize: 11, background: T.bg0, color: T.text, overflow: "hidden" },
    bar: { display: "flex", alignItems: "center", background: T.bg2, borderBottom: "1px solid " + T.border, boxShadow: "inset 0 -2px 0 " + T.brand + "00", padding: "0 10px 0 0", height: "46px", flexShrink: 0, gap: "6px", overflowX: "auto", overflowY: "hidden" },
    main: { display: "flex", flex: 1, overflow: "hidden" },
    side: { width: sidebarOpen ? "clamp(190px, 18vw, 240px)" : "0px", backgroundColor: T.bg1, backgroundImage: `linear-gradient(${T.gridSub}12 1px, transparent 1px), linear-gradient(90deg, ${T.gridSub}12 1px, transparent 1px)`, backgroundSize: "18px 18px", borderRight: sidebarOpen ? "1px solid " + T.border : "none", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", transition: "width 0.2s cubic-bezier(0.4,0,0.2,1)" },
    body: { flex: 1, overflow: "auto", padding: "12px" },
    cv: { flex: 1, position: "relative", overflow: "hidden", background: canvasT.canvas },
    sb: { position: "absolute", bottom: 0, left: 0, right: 0, background: T.bg1, borderTop: "1px solid " + T.bg3, padding: "4px 12px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: T.textDim, zIndex: 10 },
    btn: (a, c) => ({
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      background: a ? (c || T.border) + "25" : "transparent",
      border: a ? "1.5px solid " + (c || T.border) + "60" : "1.5px solid transparent",
      borderRadius: "5px",
      cursor: "pointer",
      width: "100%",
      textAlign: "left",
      color: a ? T.textBright : T.accent,
      fontSize: "11px",
      fontFamily: "inherit",
      transition: "all 0.12s ease",
      fontWeight: a ? 500 : 400
    }),
    dot: c => ({ width: "10px", height: "10px", borderRadius: "3px", background: c, flexShrink: 0 }),
    lr: { display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", cursor: "pointer" },
    chk: (on, c) => ({
      width: "16px",
      height: "16px",
      borderRadius: "4px",
      border: on ? "2px solid " + c : "2px solid " + T.border,
      background: on ? c + "20" : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "9px",
      color: on ? c : T.border,
      flexShrink: 0,
      cursor: "pointer",
      transition: "all 0.12s ease"
    }),
    det: {
      // Fixed to the viewport's top-right (under the 44px top bar) so the option panel
      // is always in the screen corner, not trapped in the (small, in split/quad) plan pane.
      position: "fixed",
      top: "52px",
      right: "12px",
      width: "clamp(190px, 20vw, 230px)",
      maxHeight: "calc(100vh - 64px)",
      overflow: "auto",
      background: T.panelBg,
      border: "1px solid " + T.border,
      borderRadius: "8px",
      padding: "12px",
      zIndex: 50,
      backdropFilter: "blur(12px)",
      boxShadow: T.panelShadow
    },
    inp: { background: T.bg3, border: "1.5px solid " + T.border, borderRadius: "5px", padding: "6px 10px", color: T.textBright, fontSize: "11px", fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s ease" },
    lbl: { fontSize: "10px", fontFamily: display, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "5px", fontWeight: 600 },
    del: { background: T.delBg, border: "none", borderRadius: "5px", padding: "8px 12px", color: T.delText, fontSize: "10px", fontFamily: "inherit", cursor: "pointer", width: "100%", marginTop: "10px", fontWeight: 500, transition: "all 0.15s ease" },
    cr: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + T.bg3 + "33", fontSize: "10px" },
    ct: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1.5px solid " + T.border, marginTop: "8px", fontWeight: 600, color: T.textBright, fontSize: "13px" },
    sec: { marginBottom: "14px" },
    sh: { fontSize: "12px", fontFamily: display, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: "9px", paddingBottom: "5px", borderBottom: "1px solid " + T.border, fontWeight: 600, display: "flex", alignItems: "center", gap: "7px" },
    smBtn: { padding: "5px 9px", background: "transparent", color: T.accent, border: "1.5px solid " + T.bg3, borderRadius: "5px", cursor: "pointer", fontSize: "10px", fontFamily: "inherit", transition: "all 0.15s ease", fontWeight: 500 },
    bg: { position: "absolute", bottom: "92px", left: "16px", display: "flex", gap: "8px", alignItems: "center", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 12px", zIndex: 10, fontSize: "10px", backdropFilter: "blur(12px)", boxShadow: T.panelShadow },
    toolRail: {
      width: 52,
      flexShrink: 0,
      background: T.bg1,
      borderRight: "1px solid " + T.bg3,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      padding: "8px 0",
      overflowY: "auto",
      overflowX: "hidden",
    },
    toolSepH: { height: 1, width: 28, background: T.border, margin: "4px 0", flexShrink: 0 },
    toolBtn: (a, c) => ({
      width: "44px",
      height: "44px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: a ? (c || T.brand) + "1F" : "transparent",
      border: a ? "1.5px solid " + (c || T.brand) : "1.5px solid transparent",
      borderRadius: "7px",
      cursor: "pointer",
      color: a ? (c || T.brand) : T.accent,
      boxShadow: a ? "0 0 0 3px " + (c || T.brand) + "14, 0 2px 10px " + (c || T.brand) + "24" : "none",
      transition: "all 0.15s ease",
      position: "relative"
    }),
    toolSep: { width: "1px", height: "32px", background: T.border, margin: "0 4px" },
    tbtn: (a, c) => ({
      padding: "6px 12px",
      background: a ? (c || T.border) + "30" : "transparent",
      color: a ? (c || T.textBright) : T.accentDim,
      border: "none",
      borderRadius: "5px",
      cursor: "pointer",
      fontSize: "10px",
      fontFamily: "inherit",
      display: "flex",
      alignItems: "center",
      gap: "5px",
      transition: "all 0.12s ease",
      fontWeight: a ? 500 : 400
    }),
  }), [T, sidebarOpen, canvasT, font, display]);

  const isDrawing = drawChain || drawPolyZone || drawRevCloud || drawFlowPath || drawFloorRegion;

  // Option panel (inspector) — selected-element block vs no-selection tool-settings block.
  const inspSel = !!(selZone || selMarker || selFurniture || selWall || selNode || selDoor || selWindow || selColumn || selLabel || selElevLabel || selRevCloud || selElevRevCloud || selFlowPath || selFloorRegion || selType === "floor" || (selectedIds.length > 1 && multiSelType));
  const inspTool = !selectedId && ((mode === "build" && (isWallTool(tool) || tool === "door" || tool === "window" || tool === "column")) || (mode === "itmep" && (tool === "marker" || tool === "outlet" || tool === "lighting")) || (mode === "zone" && tool === "zone") || (mode === "furnish" && tool === "furniture"));
  const inspectorToggle = (
    <div style={{ position: "sticky", top: -12, zIndex: 2, display: "flex", justifyContent: "flex-end", marginTop: -12, marginBottom: 2, paddingTop: 8, background: T.panelBg }}>
      <button onClick={() => setInspectorOpen(false)} title="Collapse panel"
        style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", cursor: "pointer", color: T.textMuted, padding: 0 }}>
        <ChevronRight size={15} />
      </button>
    </div>
  );

  // Pull a new elevation cut guide from a canvas edge (Figma-style). `dir` is fixed by the
  // edge: bottom=front, top=back, left=left, right=right. Uses window listeners so the drag
  // continues once the cursor leaves the thin rail; commits on release (replacing any
  // existing guide of the same direction), or cancels if released back on the source edge.
  const GUIDE_RAIL = 14;
  // Every pane's floating chrome sits at this offset so the plan and 3D panes line up along
  // the bottom edge. It clears GUIDE_RAIL, the plan pane's full-width elevation-guide strip —
  // the plan cluster used to be pushed to 40 for that, which left it visibly higher than the
  // 3D pane's controls sitting at 12.
  const CHROME_BOTTOM = GUIDE_RAIL + 4;
  // Each elevation pane reports its visible horizontal extent here; change-guarded to avoid
  // redundant re-renders.
  const onElevView = useCallback((dir, v) => {
    setElevViews(prev => {
      const p = prev[dir];
      // Compare v (vertical) too — Docs slide capture uses the full u/v rect, so a
      // vertical-only pan must not be swallowed by the change guard.
      if (p && Math.abs(p.uMin - v.uMin) < 0.5 && Math.abs(p.uMax - v.uMax) < 0.5 && Math.abs((p.vMin ?? 0) - (v.vMin ?? 0)) < 0.5) return prev;
      return { ...prev, [dir]: v };
    });
  }, []);

  // ── Save a pane's current view into the Docs deck ──────────────────────────
  const [savedFlashPane, setSavedFlashPane] = useState(null);
  const saveViewToDocs = useCallback((i) => {
    const view = panes[i]?.view;
    if (!view) return;
    let rect = null, cam3d = null;
    if (view === "plan") {
      const r = cvs.current?.getBoundingClientRect();
      if (!r) return;
      // canvasRotation is deliberately ignored — slides render the plan unrotated.
      rect = { x: -viewOff.x / zoom, y: -viewOff.y / zoom, w: r.width / zoom, h: r.height / zoom };
    } else if (IS_3D_VIEW(view)) {
      const c = controls3dRef.current;
      if (!c) return;
      // isoCorner rides along so the slide restores the same locked isometric.
      // `zoom` matters for the ORTHOGRAPHIC isometric: moving an ortho camera doesn't
      // change the image scale, only camera.zoom does — without it the slide would lose
      // your framing and re-fit to the whole building.
      cam3d = { position: c.object.position.toArray(), target: c.target.toArray(), zoom: c.object.zoom, style3d, isoCorner: view === "iso" ? isoCorner : null };
    } else {
      const v = elevViews[view];
      if (!v) return;
      rect = { x: v.uMin, y: v.vMin ?? -50, w: v.uMax - v.uMin, h: (v.vMax ?? 350) - (v.vMin ?? -50) };
    }
    addSlide({ name: defaultSlideName(view, slides.length), view, rect, cam3d, image: null });
    setSavedFlashPane(i);
    setTimeout(() => setSavedFlashPane(null), 1000);
  }, [panes, viewOff, zoom, style3d, isoCorner, elevViews, slides.length, addSlide]);

  // Drag the camera marker along its ruler to pan that elevation. The cursor's position
  // along the edge → projected-u → the elevation centers there (handled via the panU prop).
  const startCameraPan = useCallback((dir, e) => {
    e.preventDefault(); e.stopPropagation();
    const projU = (p) => dir === "front" ? p.x : dir === "back" ? -p.x : dir === "left" ? p.y : -p.y;
    const apply = (ev) => { const p = s2c(ev.clientX, ev.clientY); setCameraPan({ dir, u: projU(p) }); };
    apply(e);
    const move = (ev) => apply(ev);
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); setCameraPan(null); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [s2c]);

  // Camera markers on the edge rulers: for each elevation currently shown in a pane, draw a
  // bracket of its visible span + a camera glyph at its view center, on the matching edge.
  // Positions map plan coords → screen via viewOff/zoom (assumes canvasRotation 0, like the rails).
  const cameraIndicators = () => {
    const dirs = [...new Set(panes.map(p => p.view))].filter(v => ELEV_DIRS.includes(v));
    const locked = layerLocked("guides"); // locked → markers visible but not draggable
    const out = [];
    for (const dir of dirs) {
      const v = elevViews[dir]; if (!v) continue;
      const horiz = dir === "front" || dir === "back";
      const flip = dir === "back" || dir === "right"; // projected u inverts the plan axis
      const toPlan = (u) => (flip ? -u : u);
      let a = toPlan(v.uMin), b = toPlan(v.uMax); if (a > b) [a, b] = [b, a];
      const c = toPlan(v.uCenter);
      const s = (pc) => (horiz ? viewOff.x : viewOff.y) + pc * zoom; // screen-along-edge in cvsContainer
      const sMin = s(a), sMax = s(b), sC = s(c);
      const col = "#2E8BE6";
      const off = 6;                                  // ruler offset from the edge
      const T_RULER = 3;                              // ruler / viewport thickness
      const side = dir === "front" ? "bottom" : dir === "back" ? "top" : dir === "left" ? "left" : "right";
      // Full-length visible ruler the indicator rides on.
      const rulerStyle = horiz
        ? { position: "absolute", left: 0, right: 0, [side]: off, height: T_RULER, borderRadius: T_RULER / 2 }
        : { position: "absolute", top: 0, bottom: 0, [side]: off, width: T_RULER, borderRadius: T_RULER / 2 };
      // The viewport: a bright segment at the SAME position/thickness as the ruler line, so it
      // reads as the highlighted (visible) span of that ruler.
      const barStyle = horiz
        ? { position: "absolute", left: sMin, width: Math.max(3, sMax - sMin), [side]: off, height: T_RULER, borderRadius: T_RULER / 2 }
        : { position: "absolute", top: sMin, height: Math.max(3, sMax - sMin), [side]: off, width: T_RULER, borderRadius: T_RULER / 2 };
      // Camera glyph centered ON the ruler line (perpendicular center = line center).
      const perp = off + T_RULER / 2;
      const camPos = dir === "front" ? { bottom: perp, transform: "translate(-50%,50%)" }
        : dir === "back" ? { top: perp, transform: "translate(-50%,-50%)" }
        : dir === "left" ? { left: perp, transform: "translate(-50%,-50%)" }
        : { right: perp, transform: "translate(50%,-50%)" };
      const camStyle = horiz ? { position: "absolute", left: sC, ...camPos } : { position: "absolute", top: sC, ...camPos };
      // Cursor reflects the drag axis: along a horizontal ruler you slide left↔right, along a
      // vertical ruler you slide up↕down.
      const moveCursor = horiz ? "ew-resize" : "ns-resize";
      const grab = locked ? {} : { onMouseDown: (e) => startCameraPan(dir, e) };
      out.push(<div key={dir + "-ruler"} style={{ ...rulerStyle, background: col, opacity: 0.28, zIndex: 30, pointerEvents: "none" }} />);
      out.push(<div key={dir + "-bar"} {...grab}
        style={{ ...barStyle, background: col, opacity: 0.9, zIndex: 31, cursor: locked ? "default" : moveCursor, pointerEvents: locked ? "none" : "auto" }} />);
      out.push(
        <div key={dir + "-cam"} title={locked ? `${dir} elevation camera (locked)` : `Drag to pan the ${dir} elevation`} {...grab}
          style={{ ...camStyle, zIndex: 32, cursor: locked ? "default" : moveCursor, pointerEvents: locked ? "none" : "auto", display: "flex", color: col, background: T.panelBg, borderRadius: 4, padding: 1, boxShadow: T.panelShadow }}>
          <Camera size={13} />
        </div>
      );
    }
    return out.length ? <>{out}</> : null;
  };

  const startGuidePull = useCallback((dir, e) => {
    e.preventDefault();
    const axis = (dir === "front" || dir === "back") ? "y" : "x";
    const apply = (ev) => {
      const p = s2c(ev.clientX, ev.clientY);
      setGuideDraft({ dir, pos: snapGuide(axis === "y" ? p.y : p.x, axis) });
      setGuideScrub({ dir, x: p.x, y: p.y }); // cursor pos drives the elevation camera live
      return p;
    };
    const computePos = (ev) => { const p = s2c(ev.clientX, ev.clientY); return snapGuide(axis === "y" ? p.y : p.x, axis); };
    apply(e);
    const move = (ev) => apply(ev);
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setGuideDraft(null); setGuideScrub(null);
      const r = (cvsContainer.current ?? cvs.current)?.getBoundingClientRect();
      const stillOnEdge = r && (
        (dir === "back"  && ev.clientY - r.top    < GUIDE_RAIL) ||
        (dir === "front" && r.bottom - ev.clientY < GUIDE_RAIL) ||
        (dir === "left"  && ev.clientX - r.left   < GUIDE_RAIL) ||
        (dir === "right" && r.right - ev.clientX  < GUIDE_RAIL));
      if (stillOnEdge) return; // never pulled in — no guide created
      const pos = computePos(ev), id = uid();
      setGuides(p => [...p.filter(g => g.dir !== dir), { id, dir, pos }]);
      setSelectedId(id); setSelType("guide");
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [s2c, snapGuide, setSelectedId, setSelType]);

  // The four edge rails, rendered over the plan pane only. Plain render function (invoked
  // as guideRails(), not <GuideRails/>) so it doesn't remount on every parent render.
  const guideRails = () => {
    const base = { position: "absolute", zIndex: 30, background: "transparent" };
    const rails = [
      { dir: "back",  style: { ...base, top: 0, left: 0, right: 0, height: GUIDE_RAIL, cursor: "ns-resize" } },
      { dir: "front", style: { ...base, bottom: 0, left: 0, right: 0, height: GUIDE_RAIL, cursor: "ns-resize" } },
      { dir: "left",  style: { ...base, top: 0, bottom: 0, left: 0, width: GUIDE_RAIL, cursor: "ew-resize" } },
      { dir: "right", style: { ...base, top: 0, bottom: 0, right: 0, width: GUIDE_RAIL, cursor: "ew-resize" } },
    ];
    return <>{rails.map(r => (
      <div key={r.dir} title={`Pull a ${r.dir} elevation guide`} style={r.style}
        onMouseDown={e => startGuidePull(r.dir, e)}
        onMouseEnter={e => { e.currentTarget.style.background = T.accent + "22"; setPeekGuides(true); }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; setPeekGuides(false); }} />
    ))}</>;
  };

  // ── Pane rendering ───────────────────────────────────────────────────
  // isoCorner set → the same scene drawn as a locked orthographic isometric.
  const render3dPane = (isoCorner = null) => (
    <div style={{ width: "100%", height: "100%", position: "relative", background: canvasT.canvas }}>
      {data3d && <Suspense fallback={<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 11, fontFamily: font }}>Loading 3D…</div>}><TestFit3D
        isoCorner={isoCorner} isoFitNonce={isoFitNonce} hideNearWalls={isoCutaway}
        walls={data3d.walls} nodes={data3d.nodes} doors={data3d.doors} windows={data3d.windows}
        columns={data3d.columns} zones={data3d.zones} furniture={data3d.furniture} visibleFurniture={visibleFurniture} markers={data3d.markers} dims={dims}
        pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight} T={canvasT} themeMode={monoDraw ? "mono" : themeMode}
        controlsRef={controls3dRef} mode={mode} selectedId={selectedId} selType={selType}
        show3dLabels={show3dLabels} setShow3dLabels={setShow3dLabels}
        show3dDims={show3dDims} setShow3dDims={setShow3dDims}
        show3dCeiling={show3dCeiling}
        style3d={style3d} floorMaterial={floorMaterial} floorRegions={data3d.floorRegions}
        zoneLibrary={zoneLibrary} visibleLayers={visibleLayers}
        visibleBuildElectrical={visibleBuildElectrical} visibleBuildLighting={visibleBuildLighting}
        onSelect={(id, type) => { setSelectedId(id); setSelType(type); setSelectedIds(id ? [id] : []); }}
      /></Suspense>}
      {/* Isometric rotation — swings 90° around the building per press, keeping the
          current zoom/pan; Reset re-fits. Sits with the other camera controls. */}
      {/* Own row above the cutaway/ceiling buttons — in a split pane the centered style
          switcher would otherwise clip a horizontal cluster this wide. */}
      {isoCorner && (
        <div style={{ position: "absolute", bottom: CHROME_BOTTOM + 36, right: 12, display: "flex", gap: 2, alignItems: "center", background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 3, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, zIndex: 10 }}>
          {[
            ["iso-rot-left", <ChevronLeft key="l" size={14} />, "Rotate left 90°", () => rotateIso(-1)],
            ["iso-fit", <RotateCcw key="r" size={13} />, "Reset view (fit)", () => setIsoFitNonce(n => n + 1)],
            ["iso-rot-right", <ChevronRight key="r2" size={14} />, "Rotate right 90°", () => rotateIso(1)],
          ].map(([id, icon, tip, fn]) => (
            <button key={id} data-testid={id} onClick={fn} title={`${tip} · viewing from ${isoCorner.toUpperCase()}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "5px 7px", borderRadius: 5, border: "none", cursor: "pointer", background: "transparent", color: T.textMuted }}
              onMouseEnter={e => { e.currentTarget.style.background = T.accent + "30"; e.currentTarget.style.color = T.textBright; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; }}>
              {icon}
            </button>
          ))}
        </div>
      )}
      {/* 3D style switcher */}
      <div style={{ position: "absolute", bottom: CHROME_BOTTOM, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 4, backdropFilter: "blur(12px)", zIndex: 10 }}>
        {[["clay", "Clay"], ["xray", "X-Ray"], ["detailed", "Detailed"], ["print", "Print"]].map(([k, label]) => (
          <button key={k} onClick={() => setStyle3d(k)}
            style={{ padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer", background: style3d === k ? T.accent + "40" : "transparent", color: style3d === k ? T.textBright : T.textMuted, fontSize: 10, fontFamily: "inherit", fontWeight: style3d === k ? 600 : 400, outline: style3d === k ? "1px solid " + T.accent : "none" }}>
            {label}
          </button>
        ))}
      </div>
      {/* Cutaway — isometric only: drops the shell walls between you and the interior. */}
      {isoCorner && <button data-testid="iso-cutaway" onClick={() => setIsoCutaway(v => !v)}
        title={isoCutaway ? "Show all walls" : "Hide walls facing the camera (cutaway)"}
        style={{ position: "absolute", bottom: CHROME_BOTTOM, right: 52, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: isoCutaway ? T.accent : T.panelBg, color: isoCutaway ? "#fff" : T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow }}>
        {isoCutaway ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>}
      <Tooltip>
        <TooltipTrigger asChild>
          <button data-testid="pane-ceiling" onClick={() => !ceilingInertReason && setShow3dCeiling(v => !v)}
            aria-label="Ceiling" aria-disabled={!!ceilingInertReason}
            style={{ position: "absolute", bottom: CHROME_BOTTOM, right: isoCorner ? 12 : 52, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: (show3dCeiling && !ceilingInertReason) ? T.accent : T.panelBg, color: ceilingInertReason ? T.textFaint : (show3dCeiling ? "#fff" : T.textMuted), cursor: ceilingInertReason ? "not-allowed" : "pointer", opacity: ceilingInertReason ? 0.5 : 1, backdropFilter: "blur(8px)", boxShadow: T.panelShadow }}>
            <PanelTop size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>{ceilingInertReason || "Ceiling"}</TooltipContent>
      </Tooltip>
      {/* Isometric has its own Reset inside the rotate group — don't show two. */}
      {!isoCorner && <button onClick={() => controls3dRef.current?.reset()} title="Reset camera"
        style={{ position: "absolute", bottom: CHROME_BOTTOM, right: 12, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: T.panelBg, color: T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow }}>
        <RotateCcw size={14} />
      </button>}
    </div>
  );
  const renderAuxPane = (i) => {
    const view = panes[i]?.view;
    if (view === "3d") return render3dPane();
    if (view === "iso") return render3dPane(isoCorner);
    // elevation
    const dir = view;
    const anno = elevAnnotations[dir];
    const placeDim = (d) => setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; const nid = uid(); setSelectedId(nid); setSelType("elevDim"); return { ...prev, [dir]: { ...cur, dims: [...(cur.dims || []), { id: nid, ...d }] } }; });
    // Creates an empty label and returns its id — the elevation opens its inline editor
    // (window.prompt is blocked in embedded browsers, so editing happens in-canvas like the plan).
    const placeLabel = (p) => { const nid = uid(); setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; return { ...prev, [dir]: { ...cur, labels: [...(cur.labels || []), { id: nid, x: p.x, y: p.y, text: p.text || "", lx: p.lx ?? null, ly: p.ly ?? null }] } }; }); setSelectedId(nid); setSelType("elevLabel"); return nid; };
    const deleteLabel = (id) => setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; return { ...prev, [dir]: { ...cur, labels: (cur.labels || []).filter(l => l.id !== id) } }; });
    const updateDim = (id, patch) => setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; return { ...prev, [dir]: { ...cur, dims: (cur.dims || []).map(d => d.id === id ? { ...d, ...patch } : d) } }; });
    const updateLabel = (id, patch) => setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; return { ...prev, [dir]: { ...cur, labels: (cur.labels || []).map(l => l.id === id ? { ...l, ...patch } : l) } }; });
    const placeRevCloud = (points) => { const nid = uid(); setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; return { ...prev, [dir]: { ...cur, revClouds: [...(cur.revClouds || []), { id: nid, points, arcR: 8, label: "", color: "#E05252" }] } }; }); setSelectedId(nid); setSelType("elevRevCloud"); setT("select"); };
    const updateRevCloud = (id, patch) => setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; return { ...prev, [dir]: { ...cur, revClouds: (cur.revClouds || []).map(r => r.id === id ? { ...r, ...patch } : r) } }; });
    const cut = guides.find(g => g.dir === dir);
    const scrub = guideScrub && guideScrub.dir === dir ? { x: guideScrub.x, y: guideScrub.y } : null;
    return <ElevationView dir={dir} nodes={nodes} walls={walls} doors={doors} windows={windows} columns={columns}
      markers={visibleITMEP ? markers : []}
      ceilingHeight={ceilingHeight} pxPerFoot={pxPerFoot} T={canvasT} ft={ft} tool={tool} cut={cut ? cut.pos : null} scrub={scrub}
      onView={onElevView} panU={cameraPan && cameraPan.dir === dir ? cameraPan.u : null}
      selectedId={selectedId} selType={selType}
      onSelect={(id, type) => { setSelectedId(id); setSelType(type); setSelectedIds(id ? [id] : []); }}
      anno={anno} onPlaceDim={placeDim} onPlaceLabel={placeLabel} onUpdateDim={updateDim} onUpdateLabel={updateLabel} onDeleteLabel={deleteLabel}
      onPlaceRevCloud={placeRevCloud} onUpdateRevCloud={updateRevCloud} />;
  };
  // Per-pane view selector chip (top-left of each pane). Plan pane is fixed.
  const PaneChip = ({ i }) => {
    const view = panes[i]?.view;
    const saved = savedFlashPane === i;
    const camBtn = (
      <Tooltip>
        <TooltipTrigger asChild>
          <button data-testid={"save-to-docs-" + i} onClick={() => saveViewToDocs(i)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3px 7px", borderRadius: 6, background: saved ? "#50C87822" : T.panelBg, border: "1px solid " + (saved ? "#50C878" : T.border), color: saved ? "#50C878" : T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)" }}>
            {saved ? <Check size={12} /> : <Camera size={12} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>Save view to Docs</TooltipContent>
      </Tooltip>
    );
    // Multi-pane: pane 0 is locked to Plan so there's always a drawable canvas.
    if (i === 0 && panes.length > 1) return <div style={{ position: "absolute", top: 8, left: 8, zIndex: 50, display: "flex", gap: 5 }}>
      <div style={{ padding: "3px 9px", borderRadius: 6, background: T.panelBg, border: "1px solid " + T.border, color: T.textMuted, fontSize: 10, fontWeight: 600, fontFamily: "inherit", backdropFilter: "blur(8px)" }}>Plan</div>
      {camBtn}
    </div>;
    return <div style={{ position: "absolute", top: 8, left: 8, zIndex: 50, display: "flex", gap: 5 }}>
      <select value={view} onChange={e => setPaneView(i, e.target.value)}
        style={{ padding: "3px 6px", borderRadius: 6, background: T.panelBg, border: "1px solid " + T.border, color: T.textBright, fontSize: 10, fontWeight: 600, fontFamily: "inherit", backdropFilter: "blur(8px)", cursor: "pointer", outline: "none" }}>
        {i === 0 && <option value="plan">Plan</option>}
        <option value="3d">3D</option>
        <option value="iso">Isometric</option>
        {ELEV_DIRS.map(d => <option key={d} value={d}>{PANE_VIEW_LABEL[d]}</option>)}
      </select>
      {camBtn}
    </div>;
  };
  const VDivider = () => (
    <div style={{ width: 5, flexShrink: 0, background: T.border, cursor: "col-resize", zIndex: 15, position: "relative" }}
      onMouseEnter={e => e.currentTarget.style.background = T.accent}
      onMouseLeave={e => e.currentTarget.style.background = T.border}
      onMouseDown={e => { e.preventDefault(); const w = splitContainerRef.current?.getBoundingClientRect().width ?? 800; splitDragRef.current = { axis: "v", start: e.clientX, startPos: splitPos, span: w }; }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", gap: 3, pointerEvents: "none" }}>
        {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: T.textMuted, opacity: 0.5 }} />)}
      </div>
    </div>
  );
  const HDivider = () => (
    <div style={{ height: 5, flexShrink: 0, background: T.border, cursor: "row-resize", zIndex: 15, position: "relative" }}
      onMouseEnter={e => e.currentTarget.style.background = T.accent}
      onMouseLeave={e => e.currentTarget.style.background = T.border}
      onMouseDown={e => { e.preventDefault(); const h = splitContainerRef.current?.getBoundingClientRect().height ?? 600; splitDragRef.current = { axis: "h", start: e.clientY, startPos: splitPosV, span: h }; }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", gap: 3, pointerEvents: "none" }}>
        {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: T.textMuted, opacity: 0.5 }} />)}
      </div>
    </div>
  );

  // ── Plan canvas renderer ────────────────────────────────────────────────────
  // Wraps the (large) plan SVG so it can render twice: the interactive editor
  // canvas AND read-only Docs slides. The destructured `zoom`/`viewOff` params
  // SHADOW the component state of the same names, so the body below serves both
  // callers unchanged. Editor overlays (marquee, ghosts, selection) key off
  // interaction state that is null outside the editor, so readonly renders clean.
  // The layer-visibility params SHADOW the same-named component locals inside the body,
  // so a Docs slide overrides which layers draw. Callers spread liveLayers / slideLayersFor.
  const renderPlanCanvas = ({ zoom, viewOff, width = null, height = null, interactive = true,
    showGrid, visibleDims, visibleZones, visibleLabels, visibleRevClouds, visibleFlowPaths,
    visibleFloorRegions, visibleGuides, visibleLayers, visibleBuildElectrical, visibleBuildLighting, markerVisible,
    T: outerT = canvasT, wallKinds: outerWallKinds = canvasWallKinds }) => {
    // Everything below draws, so it uses the CANVAS theme (Mono when the drawing style is
    // on), never the UI chrome theme. Docs slides + print (interactive:false) always draw
    // light — dark-mode colours would print wrong. Shadows T/wallKinds for this function
    // only; the surrounding app chrome keeps the outer `T`.
    const T = interactive ? outerT : docsSheetT;
    const wallKinds = interactive ? outerWallKinds : docsSheetWallKinds;
    // A floor is a finished surface, not a transparency — the grid belongs to the empty
    // paper around it, so it's masked out wherever a floor is drawn. Hiding the Floors layer
    // brings the grid straight back, since the mask is built from what actually renders.
    const gridMasked = showGrid && visibleFloorRegions && floorPaths.size > 0;
    // Viewport size in CSS px, read once here for the grid and guide layers (a Docs slide
    // passes width/height; the live canvas reads its own box).
    const vpRect = interactive ? cvs.current?.getBoundingClientRect() : null;
    const vw = width ?? (vpRect?.width || 2000), vh = height ?? (vpRect?.height || 1200);
    // Level of detail while zoomed OUT — live canvas only, Docs sheets always draw in full:
    // 1 (below 50%) drops material hatching; 2 (below 30%) also drops dimensions, labels
    // and marker glyphs. Big plans stay fluid where that detail couldn't be read anyway.
    const lod = interactive ? (zoom < 0.3 ? 2 : zoom < 0.5 ? 1 : 0) : 0;
    return (
          <svg ref={interactive ? cvs : undefined} data-testid={interactive ? "plan-canvas" : "docs-slide-canvas"}
            width={interactive ? "100%" : width} height={interactive ? "100%" : height}
            style={interactive
              ? { cursor: (panning || spaceHeld) ? "grabbing" : resize ? ({ n:"ns-resize",s:"ns-resize",e:"ew-resize",w:"ew-resize",ne:"nesw-resize",sw:"nesw-resize",nw:"nwse-resize",se:"nwse-resize" }[resize.edge] || "nwse-resize") : (drag?.type === "zone-edge" && drag.cursor) ? drag.cursor : (drag?.type === "revcloud-edge" && drag.cursor) ? drag.cursor : (drag?.type === "floorRegion-edge" && drag.cursor) ? drag.cursor : zoneEdge ? zoneEdge.cursor : cadCrosshair(T.crosshairColor), userSelect: "none", display: (view3d && !splitView) ? "none" : undefined, transform: canvasRotation ? `rotate(${canvasRotation}deg)` : undefined, transformOrigin: "center", transition: canvasRotNoTransition ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)" }
              : { pointerEvents: "none", display: "block", background: T.canvas }}
            onMouseDown={interactive ? onDown : undefined} onMouseMove={interactive ? onMove : undefined} onMouseUp={interactive ? onUp : undefined} onMouseLeave={interactive ? onUp : undefined} onWheel={interactive ? onWheel : undefined}>
            <defs>
              <filter id="glow-budget" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              {/* === Kind-based fallback hatches (used when no material is set) === */}
              {/* Existing: masonry cross-hatch */}
              <pattern id="hatch-existing" patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="0" x2="8" y2="8" stroke="#9A9488" strokeWidth="0.6" opacity="0.35"/>
                <line x1="8" y1="0" x2="0" y2="8" stroke="#9A9488" strokeWidth="0.6" opacity="0.35"/>
              </pattern>
              {/* Demo: cross-hatch red */}
              <pattern id="hatch-demo" patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="0" x2="8" y2="8" stroke="#E05050" strokeWidth="0.6" opacity="0.35"/>
                <line x1="8" y1="0" x2="0" y2="8" stroke="#E05050" strokeWidth="0.6" opacity="0.35"/>
              </pattern>
              {/* New: single 45° hatch blue */}
              <pattern id="hatch-new" patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="8" x2="8" y2="0" stroke="#50A0E0" strokeWidth="0.6" opacity="0.3"/>
              </pattern>
              {/* Pony: lighter single hatch tan */}
              <pattern id="hatch-pony" patternUnits="userSpaceOnUse" width="6" height="6">
                <line x1="0" y1="6" x2="6" y2="0" stroke={T.uiDoor} strokeWidth="0.5" opacity="0.3"/>
              </pattern>

              {/* === Material-specific hatch patterns === */}
              {/* Drywall: very faint, nearly plain — light stipple */}
              <pattern id="mat-drywall" patternUnits="userSpaceOnUse" width="12" height="12">
                <circle cx="6" cy="6" r="0.5" fill="#9A9488" opacity="0.25"/>
              </pattern>
              {/* Brick: classic 45° parallel lines */}
              <pattern id="mat-brick" patternUnits="userSpaceOnUse" width="6" height="6">
                <line x1="0" y1="6" x2="6" y2="0" stroke="#9A9488" strokeWidth="0.8" opacity="0.45"/>
              </pattern>
              {/* CMU / Concrete Block: double cross-hatch with dots at intersections */}
              <pattern id="mat-cmu" patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="0" x2="8" y2="8" stroke="#9A9488" strokeWidth="0.65" opacity="0.4"/>
                <line x1="8" y1="0" x2="0" y2="8" stroke="#9A9488" strokeWidth="0.65" opacity="0.4"/>
                <circle cx="4" cy="4" r="0.8" fill="#9A9488" opacity="0.4"/>
              </pattern>
              {/* Glass: wide-spaced thin diagonals */}
              <pattern id="mat-glass" patternUnits="userSpaceOnUse" width="14" height="14">
                <line x1="0" y1="14" x2="14" y2="0" stroke="#9A9488" strokeWidth="0.5" opacity="0.35"/>
              </pattern>
              {/* Wood Stud: X diagonals (lumber cross) */}
              <pattern id="mat-wood-stud" patternUnits="userSpaceOnUse" width="20" height="20">
                <line x1="0" y1="0" x2="20" y2="20" stroke="#9A9488" strokeWidth="0.7" opacity="0.4"/>
                <line x1="20" y1="0" x2="0" y2="20" stroke="#9A9488" strokeWidth="0.7" opacity="0.4"/>
              </pattern>
              {/* Metal Stud: paired parallel diagonal lines (double-line grouping) */}
              <pattern id="mat-metal-stud" patternUnits="userSpaceOnUse" width="10" height="10">
                <line x1="0" y1="10" x2="10" y2="0" stroke="#9A9488" strokeWidth="0.7" opacity="0.4"/>
                <line x1="2" y1="10" x2="10" y2="2" stroke="#9A9488" strokeWidth="0.7" opacity="0.4"/>
              </pattern>
              {/* Concrete: tight cross-hatch */}
              <pattern id="mat-concrete" patternUnits="userSpaceOnUse" width="5" height="5">
                <line x1="0" y1="0" x2="5" y2="5" stroke="#9A9488" strokeWidth="0.5" opacity="0.4"/>
                <line x1="5" y1="0" x2="0" y2="5" stroke="#9A9488" strokeWidth="0.5" opacity="0.4"/>
              </pattern>
              {/* Plaster: fine single diagonals */}
              <pattern id="mat-plaster" patternUnits="userSpaceOnUse" width="7" height="7">
                <line x1="0" y1="7" x2="7" y2="0" stroke="#9A9488" strokeWidth="0.5" opacity="0.35"/>
              </pattern>
              {/* Other: alternating diagonal bands (plywood-like) */}
              <pattern id="mat-other" patternUnits="userSpaceOnUse" width="12" height="12">
                <line x1="0" y1="12" x2="12" y2="0" stroke="#9A9488" strokeWidth="0.6" opacity="0.4"/>
                <line x1="-3" y1="12" x2="9" y2="0" stroke="#9A9488" strokeWidth="0.6" opacity="0.4"/>
              </pattern>
              {/* Floor-region material hatches */}
              <pattern id="floor-hatch-wood" patternUnits="userSpaceOnUse" width="20" height="6">
                <rect width="20" height="6" fill="#C8A878" opacity="0.18"/>
                <line x1="0" y1="0" x2="20" y2="0" stroke="#8B6914" strokeWidth="0.5" opacity="0.45"/>
                <line x1="0" y1="3" x2="20" y2="3" stroke="#8B6914" strokeWidth="0.3" opacity="0.25"/>
              </pattern>
              <pattern id="floor-hatch-concrete" patternUnits="userSpaceOnUse" width="8" height="8">
                <rect width="8" height="8" fill="#AEABA4" opacity="0.18"/>
                <circle cx="2" cy="2" r="0.5" fill="#5a5a5a" opacity="0.55"/>
                <circle cx="6" cy="5" r="0.4" fill="#5a5a5a" opacity="0.45"/>
                <circle cx="4" cy="7" r="0.35" fill="#5a5a5a" opacity="0.4"/>
              </pattern>
              <pattern id="floor-hatch-vinyl" patternUnits="userSpaceOnUse" width="12" height="12">
                <rect width="12" height="12" fill="#BFA889" opacity="0.18"/>
                <line x1="0" y1="0" x2="12" y2="0" stroke="#604020" strokeWidth="0.5" opacity="0.5"/>
                <line x1="0" y1="0" x2="0" y2="12" stroke="#604020" strokeWidth="0.5" opacity="0.5"/>
              </pattern>
              <pattern id="floor-hatch-carpet" patternUnits="userSpaceOnUse" width="6" height="6">
                <rect width="6" height="6" fill="#786758" opacity="0.2"/>
                <line x1="0" y1="6" x2="6" y2="0" stroke="#4a3a2a" strokeWidth="0.4" opacity="0.4"/>
              </pattern>
            </defs>
            {/* interactive-only: docs/print rendering reuses this same function at a fixed,
                architectural-scale zoom, where line weights SHOULD scale with the drawing
                (see .tf-const-stroke in index.css) — only live editing wants them pinned. */}
            <g className={interactive ? "tf-const-stroke" : undefined} data-lod={lod} transform={`translate(${viewOff.x},${viewOff.y}) scale(${zoom})`}>
              {showGrid && <PlanGridLayer vw={vw} vh={vh} viewOff={viewOff} zoom={zoom} pxPerFoot={pxPerFoot} T={T} floorPaths={floorPaths} gridMasked={gridMasked} />}
              {bgImage && <image href={bgImage} x={bgOffset.x} y={bgOffset.y} style={{ opacity: bgOpacity, transform: `scale(${bgScale})`, transformOrigin: `${bgOffset.x}px ${bgOffset.y}px` }} preserveAspectRatio="xMidYMid meet" />}

              {/* Floor regions — hatch fill, above bg image / below walls */}
              {visibleFloorRegions && <PlanFloorsLayer floorRegions={floorRegions} floorPaths={floorPaths} T={T} tool={tool} mode={mode} selectedId={selectedId} selType={selType} selectedIds={selectedIds} floorEditId={floorEditId} layerLocked={layerLocked} setSelectedId={setSelectedId} setSelType={setSelType} setSelectedIds={setSelectedIds} />}
              {/* Floor region ghost while drawing */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "floorRegion" && drawFloorRegion && drawFloorRegion.points.length >= 1 && ghostPos && (() => {
                const preview = [...drawFloorRegion.points, ghostPos];
                const closeable = preview.length > 3 && dst(ghostPos.x, ghostPos.y, drawFloorRegion.points[0].x, drawFloorRegion.points[0].y) < SNAP_R * 1.5;
                const d = preview.length >= 3 ? "M " + preview.map(p => `${p.x},${p.y}`).join(" L ") + " Z" : "M " + preview.map(p => `${p.x},${p.y}`).join(" L ");
                return <g style={{ pointerEvents: "none" }}>
                  <path d={d} fill={closeable ? T.accent + "20" : "none"} stroke={T.accent} strokeWidth={1.5} strokeDasharray={preview.length >= 3 ? "none" : "5 3"} opacity={0.7} />
                  {drawFloorRegion.points.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={i === 0 ? 5 : 3} fill={T.accent} opacity={0.8} />)}
                  {ghostPos.snapped && !closeable && <>
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5} fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} />
                  </>}
                  {closeable && <circle cx={drawFloorRegion.points[0].x} cy={drawFloorRegion.points[0].y} r={SNAP_R * 1.5} fill="none" stroke={T.accent} strokeWidth={1} opacity={0.5} strokeDasharray="3 2" />}
                </g>;
              })())}</HoverSubscriber>

              {/* Walls — two-pass render: fills first, then all edge lines on top.
                  This prevents double-hatching at overlaps and keeps edges always visible. */}
              <PlanWallsLayer wallGeom={wallGeom} T={T} wallKinds={wallKinds} exteriorWallIds={exteriorWallIds} selectedId={selectedId} selType={selType} selectedIds={selectedIds} mode={mode} tool={tool} showWallDims={showDims && visibleDims} ft={ft} font={font} textZoom={textZoom} lod={lod} />

              {/* Zones */}
              {visibleZones && <PlanZonesLayer zones={zones} zoneLibrary={zoneLibrary} T={T} selectedId={selectedId} selType={selType} selectedIds={selectedIds} mode={mode} pxPerFoot={pxPerFoot} showZoneDims={showDims && visibleDims} textZoom={textZoom} ft={ft} ftN={ftN} resolvePoints={resolvePoints} phaseVisible={phaseVisible} walls={walls} nodes={nodes} wallHalfT={wallHalfT} font={font} lod={lod} />}

              {/* Drawing previews */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (drawChain && cursorPos && (() => {
                const lockedDist = parseDimInput(dimInput, pxPerFoot);
                const effectiveCursor = lockedDist
                  ? (() => {
                      const angle = Math.atan2(cursorPos.y - drawChain.lastY, cursorPos.x - drawChain.lastX);
                      return { x: drawChain.lastX + Math.cos(angle) * lockedDist, y: drawChain.lastY + Math.sin(angle) * lockedDist, snap: false };
                    })()
                  : cursorPos;
                const pwk = wallKinds[wallKind];
                const pdx = effectiveCursor.x - drawChain.lastX, pdy = effectiveCursor.y - drawChain.lastY;
                const pLen = Math.hypot(pdx, pdy);
                if (pLen < 2) return null;
                const pThicknessIn = wallKind === "pony" ? ponyDepth : (pwk.thickness || 5);
                const pHalfT = (pThicknessIn / 12) * pxPerFoot / 2;
                const pnx = -pdy / pLen, pny = pdx / pLen;
                const ax = drawChain.lastX, ay = drawChain.lastY, bx = effectiveCursor.x, by = effectiveCursor.y;
                const pts = `${ax+pnx*pHalfT},${ay+pny*pHalfT} ${bx+pnx*pHalfT},${by+pny*pHalfT} ${bx-pnx*pHalfT},${by-pny*pHalfT} ${ax-pnx*pHalfT},${ay-pny*pHalfT}`;
                const hId = (wallMaterial && WALL_MATERIAL_HATCHES[wallMaterial]) ? WALL_MATERIAL_HATCHES[wallMaterial] : ({ demo: "hatch-demo", new: "hatch-new", pony: "hatch-pony" }[wallKind] ?? "hatch-existing");
                const segLen = dst(ax, ay, bx, by);
                // Angle arc data
                const curAngle = Math.atan2(by - ay, bx - ax);
                const prevWall = drawChain.lastNodeId ? walls.find(w => w.n1 === drawChain.lastNodeId || w.n2 === drawChain.lastNodeId) : null;
                let prevAngle = 0;
                if (prevWall) { const pc = wc(prevWall); if (pc) { prevAngle = prevWall.n2 === drawChain.lastNodeId ? Math.atan2(pc.y2 - pc.y1, pc.x2 - pc.x1) : Math.atan2(pc.y1 - pc.y2, pc.x1 - pc.x2); } }
                const relDeg = ((curAngle - prevAngle) * 180 / Math.PI + 360) % 360;
                const displayDeg = relDeg > 180 ? 360 - relDeg : relDeg;
                const absAngleDeg = ((curAngle * 180 / Math.PI) + 360) % 360;
                const absDisplay = absAngleDeg > 180 ? absAngleDeg - 360 : absAngleDeg;
                const arcR = 22, sweep = relDeg <= 180 ? 1 : -1;
                const arcX1 = ax + Math.cos(prevAngle) * arcR, arcY1 = ay + Math.sin(prevAngle) * arcR;
                const arcX2 = ax + Math.cos(curAngle) * arcR, arcY2 = ay + Math.sin(curAngle) * arcR;
                const largeArc = displayDeg > 180 ? 1 : 0;
                const lblX = ax + Math.cos((prevAngle + curAngle) / 2) * (arcR + 16);
                const lblY = ay + Math.sin((prevAngle + curAngle) / 2) * (arcR + 16);
                const angleLabel = prevWall ? `${displayDeg.toFixed(1)}°` : `${Math.abs(absDisplay).toFixed(1)}°`;
                const col = pwk.color;
                return <g>
                  <g opacity={0.55} style={{ pointerEvents: "none" }}>
                    <polygon points={pts} fill={`url(#${hId})`} stroke="none" />
                    <line x1={ax+pnx*pHalfT} y1={ay+pny*pHalfT} x2={bx+pnx*pHalfT} y2={by+pny*pHalfT} stroke={col} strokeWidth={1} />
                    <line x1={ax-pnx*pHalfT} y1={ay-pny*pHalfT} x2={bx-pnx*pHalfT} y2={by-pny*pHalfT} stroke={col} strokeWidth={1} />
                    <line x1={ax+pnx*pHalfT} y1={ay+pny*pHalfT} x2={ax-pnx*pHalfT} y2={ay-pny*pHalfT} stroke={col} strokeWidth={1} />
                    <line x1={bx+pnx*pHalfT} y1={by+pny*pHalfT} x2={bx-pnx*pHalfT} y2={by-pny*pHalfT} stroke={col} strokeWidth={1} />
                  </g>
                  {segLen > 10 && <DimLbl textZoom={textZoom} font={font} cx={(ax + bx) / 2} cy={(ay + by) / 2}
                    text={ft(segLen)} angle={(Math.atan2(by - ay, bx - ax) * 180) / Math.PI} off={-18} color={T.nodeFill} />}
                  {segLen > 14 && <g style={{ pointerEvents: "none" }} opacity={0.9}>
                    <line x1={ax} y1={ay} x2={ax + Math.cos(prevAngle) * arcR * 1.3} y2={ay + Math.sin(prevAngle) * arcR * 1.3} stroke={T.textMuted} strokeWidth={0.7} strokeDasharray="3 2" />
                    <path d={`M ${arcX1} ${arcY1} A ${arcR} ${arcR} 0 ${largeArc} ${sweep === 1 ? 1 : 0} ${arcX2} ${arcY2}`} fill="none" stroke={col} strokeWidth={1} />
                    <rect x={lblX - 18} y={lblY - 8} width={36} height={15} rx={4} fill={T.panelBg} stroke={col} strokeWidth={0.8} />
                    <text x={lblX} y={lblY + 1} textAnchor="middle" dominantBaseline="middle" fill={col} fontSize={9} fontFamily={font} fontWeight={600} style={{ pointerEvents: "none" }}>{angleLabel}</text>
                  </g>}
                  <circle cx={ax} cy={ay} r={4} fill={col} />
                  <circle cx={bx} cy={by} r={4} fill={effectiveCursor.snap ? "#50C878" : T.nodeFill} />
                </g>;
              })())}</HoverSubscriber>

              {/* Rect-room ghost — dashed rectangle + W×H dims from first corner to cursor */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "rect" && cursorPos && (() => {
                const col = wallKinds[wallKind].color;
                if (!drawRect) return <circle cx={cursorPos.x} cy={cursorPos.y} r={4} fill={cursorPos.snap ? "#50C878" : col} opacity={0.8} />;
                const x0 = Math.min(drawRect.x1, cursorPos.x), x1r = Math.max(drawRect.x1, cursorPos.x);
                const y0 = Math.min(drawRect.y1, cursorPos.y), y1r = Math.max(drawRect.y1, cursorPos.y);
                const wPx = x1r - x0, hPx = y1r - y0;
                const sf = Math.round((wPx * hPx) / (pxPerFoot * pxPerFoot));
                // The dragged rect is where the wall CENTERLINES go; the clear inside is one
                // wall thickness smaller per axis (half each side), so show both while sizing.
                const tPx = inToPx(wallKind === "pony" ? ponyDepth : (wallKinds[wallKind].thickness || 5));
                const cw = wPx - tPx, ch = hPx - tPx;
                const clearSf = cw > 0 && ch > 0 ? Math.round((cw * ch) / (pxPerFoot * pxPerFoot)) : 0;
                return <g style={{ pointerEvents: "none" }}>
                  <rect x={x0} y={y0} width={wPx} height={hPx} fill={col + "10"} stroke={col} strokeWidth={1.2} strokeDasharray="6 4" />
                  {wPx > 10 && <DimLbl textZoom={textZoom} font={font} cx={(x0 + x1r) / 2} cy={y0} text={ft(wPx)} angle={0} off={-14} color={T.nodeFill} />}
                  {hPx > 10 && <DimLbl textZoom={textZoom} font={font} cx={x0} cy={(y0 + y1r) / 2} text={ft(hPx)} angle={90} off={-14} color={T.nodeFill} />}
                  {wPx > 30 && hPx > 30 && sf > 0 && <>
                    <text x={(x0 + x1r) / 2} y={(y0 + y1r) / 2} textAnchor="middle" dominantBaseline="middle"
                      fill={T.nodeFill} fontSize={14} fontWeight={700} fontFamily="inherit">{sf} sf</text>
                    {clearSf > 0 &&
                      <text x={(x0 + x1r) / 2} y={(y0 + y1r) / 2 + 16} textAnchor="middle" dominantBaseline="middle"
                        fill={T.dimText} fontSize={10 * textZoom} fontWeight={600} fontFamily="inherit">{ft(cw)} × {ft(ch)} · {clearSf} sf clear</text>}
                  </>}
                  <circle cx={drawRect.x1} cy={drawRect.y1} r={4} fill={col} />
                  <circle cx={cursorPos.x} cy={cursorPos.y} r={4} fill={cursorPos.snap ? "#50C878" : T.nodeFill} />
                </g>;
              })())}</HoverSubscriber>

              {/* Nodes */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (mode === "build" && nodes.map(n => {
                const isSel = (selectedId === n.id && selType === "node") || selectedIds.includes(n.id);
                const isHov = hoverNid === n.id;
                const cn = nodeConns[n.id] || 0;
                // Only show nodes when: selected, hovered, or actively drawing a wall chain
                const showNode = isSel || isHov || (drawChain && isWallTool(tool));
                if (!showNode) return null;
                const r = isSel ? 5 : isHov ? 4.5 : cn > 1 ? 3 : 2.5;
                return <g key={n.id}><circle cx={n.x} cy={n.y} r={12} fill="transparent" style={{ cursor: "crosshair" }} />
                  <circle cx={n.x} cy={n.y} r={r} fill={isSel ? T.nodeFill : isHov ? "#50C878" : T.nodeStroke} stroke={isSel ? T.nodeFill : isHov ? "#50C87888" : "transparent"} strokeWidth={isSel ? 1.5 : 1} style={{ pointerEvents: "none" }} />
                  {isHov && !isSel && <circle cx={n.x} cy={n.y} r={r + 5} fill="none" stroke="#50C87833" strokeWidth={1.5} style={{ pointerEvents: "none" }} />}
                </g>;
              }))}</HoverSubscriber>

              {/* Doors, windows & columns */}
              <PlanOpeningsLayer doors={doors} windows={windows} columns={columns} T={T} tool={tool} mode={mode} themeMode={themeMode} pxPerFoot={pxPerFoot} selectedId={selectedId} selType={selType} selectedIds={selectedIds} resolvePos={resolvePos} phaseVisible={phaseVisible} />




              {/* Furniture (Furnish stage) */}
              {visibleFurniture && furniture.map(f => {
                if (!phaseVisible(f.phase)) return null;
                const sel = (selectedId === f.id && selType === "furniture") || selectedIds.includes(f.id);
                const moveCursor = tool === "select" && mode === "furnish" ? "move" : "inherit";
                const editable = sel && selectedIds.length <= 1 && tool === "select" && mode === "furnish";
                const a = f.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
                const ux = [ca, sa], uy = [-sa, ca];               // width axis, depth axis (unit)
                const hw = (f.w * pxPerFoot) / 2, hd = (f.d * pxPerFoot) / 2;

                const rotHandle = editable ? (() => {
                  const R = hd + 22 / zoom;                        // above the top (−depth) edge
                  const hx = f.x - uy[0] * R, hy = f.y - uy[1] * R;
                  return <g onMouseDown={ev => { ev.stopPropagation(); setRotatingFurniture({ id: f.id, cx: f.x, cy: f.y }); }}>
                    <line x1={f.x} y1={f.y} x2={hx} y2={hy} stroke="#C07840" strokeWidth={1.5} strokeDasharray="3 2" style={{ pointerEvents: "none" }} />
                    <circle cx={hx} cy={hy} r={5 / zoom} fill="#C07840" stroke="#fff" strokeWidth={1.5} style={{ cursor: "grab" }} />
                  </g>;
                })() : null;

                // 8 opposite-anchored scale handles (edges + corners), constant screen size.
                const handles = [];
                if (editable) {
                  const S = 8 / zoom;
                  for (const sx of [-1, 0, 1]) for (const sy of [-1, 0, 1]) {
                    if (!sx && !sy) continue;
                    const hx = f.x + sx * hw * ux[0] + sy * hd * uy[0];
                    const hy = f.y + sx * hw * ux[1] + sy * hd * uy[1];
                    const cur = (sx && sy) ? (sx * sy > 0 ? "nwse-resize" : "nesw-resize") : (sx ? "ew-resize" : "ns-resize");
                    handles.push(<rect key={`h${sx}_${sy}`} x={hx - S / 2} y={hy - S / 2} width={S} height={S}
                      fill="#fff" stroke="#C07840" strokeWidth={1.5} style={{ cursor: cur }}
                      onMouseDown={ev => { ev.stopPropagation();
                        setFurnitureResize({ id: f.id, sx, sy, ux, uy,
                          ax: f.x - sx * hw * ux[0] - sy * hd * uy[0], ay: f.y - sx * hw * ux[1] - sy * hd * uy[1] });
                      }} />);
                  }
                }

                return <g key={f.id}>
                  <Furniture2D f={f} pxPerFoot={pxPerFoot} sel={sel} tt={T} tier={monoDraw ? T.tiers?.[3] : null} moveCursor={moveCursor} zoom={zoom} />
                  {rotHandle}
                  {handles}
                </g>;
              })}
              {/* Furniture placement ghost */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "furniture" && ghostPos && !drag && (
                <g style={{ opacity: 0.5, pointerEvents: "none" }}>
                  <Furniture2D f={{ ...newFurniture(activeFurnitureType, ghostPos.x, ghostPos.y, "ghost") }} pxPerFoot={pxPerFoot} tt={T} />
                </g>
              ))}</HoverSubscriber>

              {/* Dimension strings */}
              {visibleDims && lod < 2 && dims.map(d => {
                const sel = selectedId === d.id && selType === "dim";
                const dr = { ...d, ...resolveDimEndpoints(d) };
                return <g key={d.id} style={{ pointerEvents: layerLocked("dims") ? "none" : undefined }} onClick={() => { setSelectedId(d.id); setSelType("dim"); }}><DimString d={dr} sel={sel} T={T} ft={ft} font={font} tool={tool} /></g>;
              })}

              {/* Labels & Callouts */}
              {visibleLabels && lod < 2 && labels.map(lbl => {
                if (!phaseVisible(lbl.phase)) return null;
                const isEditing = editingLabelId === lbl.id;
                const isTipDrag = drag?.type === "label-tip" && drag.id === lbl.id;
                const sel = selectedId === lbl.id && selType === "label";
                const tip = resolveLeaderTip(lbl);
                const lblR = { ...lbl, lx: tip.lx, ly: tip.ly };
                return <g key={lbl.id} style={{ pointerEvents: layerLocked("labels") ? "none" : undefined }}
                  onClick={(e) => {
                    if (e.detail >= 2) {
                      setEditingLabelId(lbl.id); setEditingLabelText(lbl.text);
                    } else if (tool === "select") {
                      setSelectedId(lbl.id); setSelType("label"); setSelectedIds([lbl.id]);
                    }
                  }}>
                  {isEditing
                    ? (lblR.lx != null && <g style={{ pointerEvents: "none" }}>
                        <line x1={lblR.lx} y1={lblR.ly} x2={lblR.x} y2={lblR.y} stroke={lbl.color} strokeWidth={1} opacity={0.85} />
                        <circle cx={lblR.lx} cy={lblR.ly} r={3} fill={lbl.color} opacity={0.85} />
                      </g>)
                    : isTipDrag
                      ? <HoverSubscriber>{({ ghostPos }) => <LabelAnnotation lbl={{ ...lblR, lx: ghostPos?.x ?? lblR.lx, ly: ghostPos?.y ?? lblR.ly }} sel={sel} tool={tool} bg={T.bg2} />}</HoverSubscriber>
                      : <LabelAnnotation lbl={lblR} sel={sel} tool={tool} bg={T.bg2} />}
                </g>;
              })}

              {/* Label tool ghost preview */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "label" && ghostPos && !drag && (
                <g style={{ pointerEvents: "none" }} opacity={0.75}>
                  {ghostPos.snapped && <>
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5}
                      fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} />
                  </>}
                  <text x={ghostPos.x} y={ghostPos.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={12} fill={T.textBright} fontFamily="'Inter', system-ui, sans-serif">Label…</text>
                </g>
              ))}</HoverSubscriber>
              {/* Label callout drag preview */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (drag?.type === "label-place" && ghostPos && (
                <g style={{ pointerEvents: "none" }} opacity={0.6}>
                  <line x1={drag.startX} y1={drag.startY} x2={ghostPos.x} y2={ghostPos.y}
                    stroke={T.textBright} strokeWidth={1} strokeDasharray="4 3" />
                  {/* leader-tip snap indicator */}
                  {drag.snapped
                    ? <><circle cx={drag.startX} cy={drag.startY} r={6} fill={T.accent} fillOpacity={0.25} stroke={T.accent} strokeWidth={1.5} /><circle cx={drag.startX} cy={drag.startY} r={3} fill={T.accent} /></>
                    : <circle cx={drag.startX} cy={drag.startY} r={3} fill={T.textBright} />}
                  {/* text-endpoint snap indicator */}
                  {ghostPos.snapped && <>
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5}
                      fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} />
                  </>}
                  <text x={ghostPos.x} y={ghostPos.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={12} fill={T.textBright} fontFamily="'Inter', system-ui, sans-serif">Label…</text>
                </g>
              ))}</HoverSubscriber>
              {/* Leader tip drag snap indicator */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (drag?.type === "label-tip" && ghostPos && (
                <g style={{ pointerEvents: "none" }} opacity={0.8}>
                  {drag.snapped
                    ? <><circle cx={ghostPos.x} cy={ghostPos.y} r={7} fill={T.accent} fillOpacity={0.2} stroke={T.accent} strokeWidth={1.5} /><circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} /></>
                    : <circle cx={ghostPos.x} cy={ghostPos.y} r={4} fill={T.textBright} opacity={0.6} />}
                </g>
              ))}</HoverSubscriber>

              {/* Revision Clouds */}
              {visibleRevClouds && revClouds.map(rc => {
                if (!phaseVisible(rc.phase)) return null;
                const sel = selectedId === rc.id && selType === "revcloud";
                const d = revCloudPath(rc.points, rc.arcR ?? 8);
                const c = polyCentroid(rc.points);
                return <g key={rc.id} style={{ cursor: tool === "select" ? (sel ? "move" : "pointer") : "inherit", pointerEvents: layerLocked("revClouds") ? "none" : undefined }}
                  onClick={() => { if (tool === "select") { setSelectedId(rc.id); setSelType("revcloud"); setSelectedIds([rc.id]); } }}>
                  {/* Interior hit area — move cursor */}
                  <path d={d} fill="transparent" stroke="none" />
                  {/* Visual fill + stroke */}
                  <path d={d} fill={rc.color + "18"} stroke={rc.color} strokeWidth={sel ? 2 : 1.5}
                    strokeLinejoin="round" strokeLinecap="round" style={{ pointerEvents: "none" }} />
                  {sel && <path d={d} fill="none" stroke={rc.color} strokeWidth={5} opacity={0.15} style={{ pointerEvents: "none" }} />}
                  {/* Per-edge transparent hit lines — each carries its own directional resize cursor */}
                  {sel && rc.points.map((a, ei) => {
                    const b = rc.points[(ei + 1) % rc.points.length];
                    return <line key={ei} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke="transparent" strokeWidth={10} strokeLinecap="round"
                      style={{ cursor: wallResizeCursor(a.x, a.y, b.x, b.y) }} />;
                  })}
                  {rc.label && <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={10} fill={rc.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{rc.label}</text>}
                  {sel && rc.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5}
                    fill={rc.color} stroke={T.nodeFill} strokeWidth={1.5} style={{ cursor: "move" }} />)}
                </g>;
              })}

              {/* Revision Cloud ghost preview while drawing */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "revcloud" && drawRevCloud && drawRevCloud.points.length >= 1 && ghostPos && (() => {
                const preview = [...drawRevCloud.points, ghostPos];
                const closeable = preview.length > 3 &&
                  dst(ghostPos.x, ghostPos.y, drawRevCloud.points[0].x, drawRevCloud.points[0].y) < SNAP_R * 1.5;
                const d = preview.length >= 3 ? revCloudPath(preview, 8)
                  : `M ${preview.map(p => `${p.x},${p.y}`).join(' L ')}`;
                return <g style={{ pointerEvents: "none" }}>
                  <path d={d} fill={closeable ? "#E05252" + "25" : "none"}
                    stroke={closeable ? "#E05252" : T.accent} strokeWidth={1.5}
                    strokeDasharray={preview.length >= 3 ? "none" : "5 3"} opacity={0.7} />
                  {drawRevCloud.points.map((pt, i) =>
                    <circle key={i} cx={pt.x} cy={pt.y} r={i === 0 ? 5 : 3}
                      fill={i === 0 ? T.accent : "#E05252"} opacity={0.8} />)}
                  {/* snap ring at cursor when snapped to a node */}
                  {ghostPos.snapped && !closeable && <>
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5}
                      fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} />
                  </>}
                  {/* close-ring at first point when closeable */}
                  {closeable && <circle cx={drawRevCloud.points[0].x} cy={drawRevCloud.points[0].y}
                    r={SNAP_R * 1.5} fill="none" stroke="#E05252" strokeWidth={1} opacity={0.4} strokeDasharray="3 2" />}
                </g>;
              })())}</HoverSubscriber>
              {/* Snap ring ghost before first revcloud point */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "revcloud" && !drawRevCloud && ghostPos && ghostPos.snapped && (
                <g style={{ pointerEvents: "none" }}>
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5}
                    fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} />
                </g>
              ))}</HoverSubscriber>

              {/* Flow paths — translucent walkway band + dashed centerline */}
              {visibleFlowPaths && flowPaths.map(fp => {
                if (!phaseVisible(fp.phase)) return null;
                if (!fp.points || fp.points.length < 2) return null;
                if (drawFlowPath?.editingId === fp.id) return null; // hidden while being extended (ghost shows it)
                const sel = (selectedId === fp.id && selType === "flowPath") || selectedIds.includes(fp.id);
                const d = "M " + fp.points.map(p => `${p.x},${p.y}`).join(" L ");
                const bandPx = (fp.width / 12) * pxPerFoot;
                const cx = fp.points.reduce((s,p)=>s+p.x,0)/fp.points.length, cy = fp.points.reduce((s,p)=>s+p.y,0)/fp.points.length;
                return <g key={fp.id} style={{ cursor: tool === "select" ? "pointer" : "inherit", pointerEvents: (layerLocked("flowPaths") || mode !== "build") ? "none" : undefined }}
                  onClick={() => { if (tool === "select") { setSelectedId(fp.id); setSelType("flowPath"); setSelectedIds([fp.id]); } }}>
                  <path d={d} fill="none" stroke={fp.color} strokeWidth={bandPx} strokeOpacity={sel ? 0.32 : 0.22}
                    strokeLinecap="round" strokeLinejoin="round" />
                  <path d={d} fill="none" stroke={fp.color} strokeWidth={1.5} strokeDasharray="6 5"
                    strokeOpacity={0.85} strokeLinecap="round" style={{ pointerEvents: "none" }} />
                  {fp.label && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={11}
                    fill={fp.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{fp.label}</text>}
                  {sel && fp.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5}
                    fill={fp.color} stroke={T.nodeFill} strokeWidth={1.5} style={{ cursor: "move" }} />)}
                </g>;
              })}

              {/* Flow path ghost preview while drawing */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "flowPath" && drawFlowPath && drawFlowPath.points.length >= 1 && ghostPos && (() => {
                const preview = [...drawFlowPath.points, ghostPos];
                const d = "M " + preview.map(p => `${p.x},${p.y}`).join(" L ");
                const bandPx = (36 / 12) * pxPerFoot;
                return <g style={{ pointerEvents: "none" }}>
                  <path d={d} fill="none" stroke="#4A90D9" strokeWidth={bandPx} strokeOpacity={0.16}
                    strokeLinecap="round" strokeLinejoin="round" />
                  <path d={d} fill="none" stroke="#4A90D9" strokeWidth={1.5} strokeDasharray="6 5" opacity={0.7} />
                  {drawFlowPath.points.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={i === 0 ? 5 : 3} fill="#4A90D9" opacity={0.85} />)}
                  {ghostPos.snapped && <>
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5} fill="#4A90D9" fillOpacity={0.12} stroke="#4A90D9" strokeWidth={1.5} strokeDasharray="3 2" />
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill="#4A90D9" />
                  </>}
                </g>;
              })())}</HoverSubscriber>
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "flowPath" && !drawFlowPath && ghostPos && ghostPos.snapped && (
                <g style={{ pointerEvents: "none" }}>
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5} fill="#4A90D9" fillOpacity={0.12} stroke="#4A90D9" strokeWidth={1.5} strokeDasharray="3 2" />
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill="#4A90D9" />
                </g>
              ))}</HoverSubscriber>

              {/* Dim tool ghost preview */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "dim" && ghostPos && (() => {
                const color = T.dimText;
                const mx = ghostPos.x, my = ghostPos.y;
                const snapDot = ghostPos.snapped
                  ? <circle cx={mx} cy={my} r={4} fill="none" stroke={color} strokeWidth={1.5} opacity={0.8} />
                  : null;
                if (!drawDim) {
                  return <g style={{ pointerEvents: "none" }}>
                    {snapDot}
                    <circle cx={mx} cy={my} r={2} fill={color} opacity={0.5} />
                  </g>;
                }
                if (!("x2" in drawDim)) {
                  const len = Math.hypot(mx - drawDim.x1, my - drawDim.y1);
                  const label = ft(len);
                  const midX = (drawDim.x1 + mx) / 2, midY = (drawDim.y1 + my) / 2;
                  const ang2 = Math.atan2(my - drawDim.y1, mx - drawDim.x1) * 180 / Math.PI;
                  let ta2 = ang2; if (ta2 > 90) ta2 -= 180; if (ta2 < -90) ta2 += 180;
                  return <g style={{ pointerEvents: "none" }}>
                    <circle cx={drawDim.x1} cy={drawDim.y1} r={3} fill={color} opacity={0.8} />
                    <line x1={drawDim.x1} y1={drawDim.y1} x2={mx} y2={my} stroke={color} strokeWidth={1} strokeDasharray="6 3" opacity={0.6} />
                    {snapDot}
                    <circle cx={mx} cy={my} r={2} fill={color} opacity={0.7} />
                    <text x={midX} y={midY} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={color} fontFamily={font} fontWeight={600}
                      transform={`rotate(${ta2},${midX},${midY})`} opacity={0.8}>{label}</text>
                  </g>;
                }
                const ddx = drawDim.x2 - drawDim.x1, ddy = drawDim.y2 - drawDim.y1;
                const dlen2 = Math.hypot(ddx, ddy);
                if (dlen2 < 1) return null;
                const nnx = -ddy / dlen2, nny = ddx / dlen2;
                const off2 = (mx - drawDim.x1) * nnx + (my - drawDim.y1) * nny;
                const previewDim = { x1: drawDim.x1, y1: drawDim.y1, x2: drawDim.x2, y2: drawDim.y2, offset: off2 };
                return <g style={{ pointerEvents: "none", opacity: 0.7 }}>
                  <DimString d={previewDim} sel={false} T={T} ft={ft} font={font} tool={tool} />
                </g>;
              })())}</HoverSubscriber>

              {/* Smart guides */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (smartGuides.length > 0 && (() => {
                const pad = 40;
                const fs = 9 / zoom;
                const ph = 13 / zoom;
                const pr = 3 / zoom;
                return <g style={{ pointerEvents: "none" }}>
                  {smartGuides.map((g, i) => {
                    const pts = g.points ?? [];
                    if (pts.length < 2) return null;
                    const minPt = pts[0], maxPt = pts[pts.length - 1];

                    if (g.axis === 'v') {
                      return <g key={i}>
                        <line x1={g.pos} y1={minPt - pad} x2={g.pos} y2={maxPt + pad} stroke="#FF40FF" strokeWidth={1} opacity={0.85} />
                        {pts.slice(0, -1).map((from, j) => {
                          const to = pts[j + 1];
                          const dist = to - from;
                          if (dist < 1) return null;
                          const label = ft(dist);
                          const pw = (label.length * 5.5 + 8) / zoom;
                          const my = (from + to) / 2;
                          return <g key={j}>
                            <line x1={g.pos - 4 / zoom} y1={from} x2={g.pos + 4 / zoom} y2={from} stroke="#FF40FF" strokeWidth={1} opacity={0.7} />
                            <line x1={g.pos - 4 / zoom} y1={to}   x2={g.pos + 4 / zoom} y2={to}   stroke="#FF40FF" strokeWidth={1} opacity={0.7} />
                            <rect x={g.pos - pw / 2} y={my - ph / 2} width={pw} height={ph} rx={pr} fill="#FF40FF" opacity={0.92} />
                            <text x={g.pos} y={my + fs * 0.36} textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={600} fontFamily="inherit" letterSpacing="0.02em">{label}</text>
                          </g>;
                        })}
                      </g>;
                    } else {
                      return <g key={i}>
                        <line x1={minPt - pad} y1={g.pos} x2={maxPt + pad} y2={g.pos} stroke="#FF40FF" strokeWidth={1} opacity={0.85} />
                        {pts.slice(0, -1).map((from, j) => {
                          const to = pts[j + 1];
                          const dist = to - from;
                          if (dist < 1) return null;
                          const label = ft(dist);
                          const pw = (label.length * 5.5 + 8) / zoom;
                          const mx = (from + to) / 2;
                          return <g key={j}>
                            <line x1={from} y1={g.pos - 4 / zoom} x2={from} y2={g.pos + 4 / zoom} stroke="#FF40FF" strokeWidth={1} opacity={0.7} />
                            <line x1={to}   y1={g.pos - 4 / zoom} x2={to}   y2={g.pos + 4 / zoom} stroke="#FF40FF" strokeWidth={1} opacity={0.7} />
                            <rect x={mx - pw / 2} y={g.pos - ph / 2} width={pw} height={ph} rx={pr} fill="#FF40FF" opacity={0.92} />
                            <text x={mx} y={g.pos + fs * 0.36} textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={600} fontFamily="inherit" letterSpacing="0.02em">{label}</text>
                          </g>;
                        })}
                      </g>;
                    }
                  })}
                </g>;
              })())}</HoverSubscriber>

              {/* Elevation cut guides (+ live draft while pulling from an edge) */}
              {visibleGuides && (guides.length > 0 || guideDraft) && (() => {
                const minX = -viewOff.x / zoom, maxX = (-viewOff.x + vw) / zoom;
                const minY = -viewOff.y / zoom, maxY = (-viewOff.y + vh) / zoom;
                const fs = 9 / zoom, ph = 14 / zoom, pad = 6 / zoom;
                const renderGuide = (g, draft) => {
                  const horiz = g.dir === "front" || g.dir === "back";
                  const on = !draft && selType === "guide" && selectedId === g.id;
                  // Placed guides fade away when idle; reveal on edge-rail hover, when the
                  // cursor nears the line, or while selected/dragging. The draft is always shown.
                  const active = draft || on || peekGuides
                    || (tool === "select" && hoverGuideId === g.id)
                    || (drag?.type === "guide" && drag.id === g.id);
                  const col = draft ? "#2E8BE6" : (on ? T.accent : "#2E8BE6");
                  const sw = on ? 1.8 : 1.2;
                  const label = g.dir.toUpperCase();
                  const pw = (label.length * 6 + 10) / zoom;
                  const grpStyle = { pointerEvents: "none", opacity: active ? 1 : 0, transition: "opacity 0.18s ease" };
                  if (horiz) {
                    const tx = minX + 8 / zoom;
                    return <g key={draft ? "draft" : g.id} style={grpStyle}>
                      <line x1={minX} y1={g.pos} x2={maxX} y2={g.pos} stroke={col} strokeWidth={sw} strokeDasharray="8 5" opacity={draft ? 0.7 : 0.9} />
                      <rect x={tx} y={g.pos - ph / 2} width={pw} height={ph} rx={pad} fill={col} opacity={0.92} />
                      <text x={tx + pw / 2} y={g.pos + fs * 0.36} textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={700} fontFamily="inherit" letterSpacing="0.04em">{label}</text>
                    </g>;
                  }
                  const ty = minY + 8 / zoom + ph / 2;
                  return <g key={draft ? "draft" : g.id} style={grpStyle}>
                    <line x1={g.pos} y1={minY} x2={g.pos} y2={maxY} stroke={col} strokeWidth={sw} strokeDasharray="8 5" opacity={draft ? 0.7 : 0.9} />
                    <rect x={g.pos - pw / 2} y={ty - ph / 2} width={pw} height={ph} rx={pad} fill={col} opacity={0.92} />
                    <text x={g.pos} y={ty + fs * 0.36} textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={700} fontFamily="inherit" letterSpacing="0.04em">{label}</text>
                  </g>;
                };
                return <>
                  {guides.map(g => renderGuide(g, false))}
                  {guideDraft && renderGuide(guideDraft, true)}
                </>;
              })()}

              {/* Ghosts */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "zone" && ghostPos && (() => { const lib = zoneLibrary[activeZoneType];
                const gw = lib.defaultW * pxPerFoot, gh = lib.defaultH * pxPerFoot; return <g style={{ pointerEvents: "none" }}>
                <rect x={ghostPos.x} y={ghostPos.y} width={gw} height={gh} fill={lib.color + "15"} stroke={lib.color + "55"} strokeWidth={1.5} strokeDasharray="6 3" rx={3} />
                <text x={ghostPos.x + 8} y={ghostPos.y + 16} fill={lib.color + "88"} fontSize={10} fontFamily="inherit" fontWeight={500}>{lib.name}</text>
                <text x={ghostPos.x + gw / 2} y={ghostPos.y + gh / 2 + 4} textAnchor="middle" fill={lib.color + "44"} fontSize={11} fontFamily="inherit" fontWeight={600}>{Math.round(ftN(gw) * ftN(gh))} sf</text>
              </g>; })())}</HoverSubscriber>
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "marker" && ghostPos && (() => { 
                const l = SPEC_LAYERS[activeSpecLayer]; 
                const compData = SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType];
                
                if (compData?.symbol) {
                  const ghostMarker = { x: ghostPos.x, y: ghostPos.y, layer: activeSpecLayer, componentType: activeComponentType };
                  return <g style={{ pointerEvents: "none", opacity: 0.5 }}>
                    <MarkerSymbol marker={ghostMarker} selected={false} T={chromeT} themeMode={themeMode} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
                  </g>;
                }
                
                const icon = compData?.icon || "📍";
                return <g style={{ pointerEvents: "none" }}>
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={9} fill={l.color + "18"} stroke={l.color + "55"} strokeWidth={1.5} strokeDasharray="4 2" />
                  <text x={ghostPos.x} y={ghostPos.y + 4} textAnchor="middle" fontSize={11} fill={l.color + "66"}>{icon}</text>
                </g>; 
              })())}</HoverSubscriber>
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "door" && ghostPos && <g style={{ pointerEvents: "none" }}><DoorSvg d={{ x: ghostPos.x, y: ghostPos.y, angle: ghostPos.angle || 0, width: doorWidth, flipped: false, hingeRight: false, doorType, id: "_g" }} sel={false} T={T} tool={tool} mode={mode} pxPerFoot={pxPerFoot} /></g>)}</HoverSubscriber>
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "window" && ghostPos && <g style={{ pointerEvents: "none" }}><WindowSvg w={{ x: ghostPos.x, y: ghostPos.y, angle: ghostPos.angle || 0, width: windowWidth, type: windowType, id: "_g" }} sel={false} T={T} tool={tool} mode={mode} pxPerFoot={pxPerFoot} themeMode={themeMode} /></g>)}</HoverSubscriber>
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "column" && ghostPos && (() => {
                const r = inToPx(columnSize) / 2;
                return <g style={{ pointerEvents: "none", opacity: 0.5 }}>
                  {columnShape === "circle" ? (
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={r} fill="#9A9488" stroke={T.nodeFill} strokeWidth={1.5} strokeDasharray="4 2" />
                  ) : (
                    <rect x={ghostPos.x - r} y={ghostPos.y - r} width={r * 2} height={r * 2} fill="#9A9488" stroke={T.nodeFill} strokeWidth={1.5} strokeDasharray="4 2" rx={2} />
                  )}
                </g>;
              })())}</HoverSubscriber>

              {/* Outlet ghost */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "outlet" && ghostPos && (() => {
                // Preview the offset too: `side` mirrors what placement will capture, so the
                // ghost stands in the same room the click is about to drop the device in.
                const ghostMarker = { x: ghostPos.x, y: ghostPos.y, layer: "power", componentType: outletType, angle: ghostPos.angle || 0, side: ghostPos.side };
                const compData = SPEC_COMPONENTS.power[outletType];
                return <g style={{ pointerEvents: "none", opacity: 0.5 }}>
                  <MarkerSymbol marker={ghostMarker} selected={false} T={chromeT} themeMode={themeMode} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
                  {ghostPos.snapped && <circle cx={ghostPos.x} cy={ghostPos.y} r={15} fill="none" stroke={compData?.color} strokeWidth={1} strokeDasharray="3 3" />}
                </g>;
              })())}</HoverSubscriber>

              {/* Lighting ghost */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (tool === "lighting" && ghostPos && (() => {
                const ghostMarker = { x: ghostPos.x, y: ghostPos.y, layer: "power", componentType: lightingType, angle: ghostPos.angle || 0, side: ghostPos.side };
                const compData = SPEC_COMPONENTS.power[lightingType];
                return <g style={{ pointerEvents: "none", opacity: 0.5 }}>
                  <MarkerSymbol marker={ghostMarker} selected={false} T={chromeT} themeMode={themeMode} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
                  {ghostPos.snapped && <circle cx={ghostPos.x} cy={ghostPos.y} r={15} fill="none" stroke={compData?.color} strokeWidth={1} strokeDasharray="3 3" />}
                </g>;
              })())}</HoverSubscriber>

              {/* Markers (top) */}
              <PlanMarkersLayer markers={markers} chromeT={chromeT} themeMode={themeMode} tool={tool} mode={mode} pxPerFoot={pxPerFoot} zoom={zoom} selectedId={selectedId} selType={selType} selectedIds={selectedIds} markerVisible={markerVisible} visibleLayers={visibleLayers} visibleBuildElectrical={visibleBuildElectrical} visibleBuildLighting={visibleBuildLighting} resolvePos={resolvePos} setRotatingMarker={setRotatingMarker} lod={lod} />

              {/* Proximity-hover preview ring — fades in as cursor approaches a hoverable */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (proxHover && !marquee && tool === "select" && (!drag || PROX_DRAG_TYPES.has(drag.type)) && (() => {
                const PROX_R = 32;
                const fade = Math.max(0, 1 - proxHover.dist / PROX_R);
                const r = 8 + (1 - fade) * 4;
                return <g style={{ pointerEvents: "none" }}>
                  <circle cx={proxHover.x} cy={proxHover.y} r={r} fill="none" stroke={T.accent} strokeWidth={1.5}
                    opacity={0.2 + fade * 0.55} strokeDasharray="3 3" />
                  <circle cx={proxHover.x} cy={proxHover.y} r={2.5} fill={T.accent} opacity={0.25 + fade * 0.65} />
                </g>;
              })())}</HoverSubscriber>

              {/* Marquee selection box */}
              {marquee && <rect
                x={Math.min(marquee.startX, marquee.endX)} 
                y={Math.min(marquee.startY, marquee.endY)} 
                width={Math.abs(marquee.endX - marquee.startX)} 
                height={Math.abs(marquee.endY - marquee.startY)} 
                fill="rgba(80, 200, 120, 0.1)" 
                stroke="#50C878" 
                strokeWidth={1.5} 
                strokeDasharray="4 2"
                style={{ pointerEvents: "none" }}
              />}

              {/* Calibration line */}
              <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (calibrationLine && calibrationLine.p1 && (
                <g>
                  <line 
                    x1={calibrationLine.p1.x} 
                    y1={calibrationLine.p1.y} 
                    x2={calibrationLine.p2?.x || (cursorPos?.x || calibrationLine.p1.x)} 
                    y2={calibrationLine.p2?.y || (cursorPos?.y || calibrationLine.p1.y)} 
                    stroke={T.uiConduit}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={calibrationLine.p2 ? "0" : "6 4"}
                    style={{ pointerEvents: "none" }}
                  />
                  <circle cx={calibrationLine.p1.x} cy={calibrationLine.p1.y} r={6} fill={T.uiConduit} />
                  {calibrationLine.p2 && <circle cx={calibrationLine.p2.x} cy={calibrationLine.p2.y} r={6} fill={T.uiConduit} />}
                </g>
              ))}</HoverSubscriber>
            </g>
          </svg>
    );
  };

  return (
    <TooltipProvider>
    <div className="tf-app-root" style={S.root}>
      {/* Brief confirmations for actions with no other visible feedback (copy, paste, delete…). */}
      <Toaster position="bottom-center" duration={1800} toastOptions={{ style: {
        background: T.panelBg, border: "1px solid " + T.border, color: T.textBright,
        fontFamily: font, fontSize: 11, backdropFilter: "blur(12px)" } }} />
      {showShortcuts && <ShortcutSheet T={T} S={S} font={font} display={display} onClose={() => setShowShortcuts(false)} />}
      {/* ── Top Mode Bar ──────────────────────────────────────────── */}
      <TopBar $={$} MODES={MODES} S={S} T={T} activeSnapshotId={activeSnapshotId} canRedo={canRedo} canUndo={canUndo} cost={cost} deleteSnapshot={deleteSnapshot} display={display} exportPdf={exportPdf} exportPng={exportPng} exportSvg={exportSvg} exportDxf={exportDxf} exportProject={exportProject} font={font} importProject={importProject} liveDirty={liveDirty} loadRef={loadRef} markers={markers} mode={mode} modeMenuRect={modeMenuRect} newProject={newProject} newSnapMode={newSnapMode} redo={redo} renameSnapshot={renameSnapshot} renamingSnapId={renamingSnapId} saveMenuRect={saveMenuRect} setMode={setMode} setModeMenuRect={setModeMenuRect} setNewSnapMode={setNewSnapMode} setRenamingSnapId={setRenamingSnapId} setSaveMenuRect={setSaveMenuRect} setShowModeMenu={setShowModeMenu} setShowSaveMenu={setShowSaveMenu} setShowSettings={setShowSettings} setShowSnapMenu={setShowSnapMenu} setSidebarOpen={setSidebarOpen} setSnapDraftName={setSnapDraftName} setSnapMenuRect={setSnapMenuRect} setT={setT} setThemeMode={setThemeMode} monoDraw={monoDraw} setMonoDraw={setMonoDraw} monoSkin={monoSkin} setMonoSkin={setMonoSkin} monoTiers={monoT.tiers} showModeMenu={showModeMenu} showSaveMenu={showSaveMenu} showSnapMenu={showSnapMenu} sidebarOpen={sidebarOpen} snapDraftName={snapDraftName} snapMenuRect={snapMenuRect} snapshot={snapshot} snapshots={snapshots} switchSnapshot={switchSnapshot} takeSnapshot={takeSnapshot} themeMode={themeMode} undo={undo} updateSnapshot={updateSnapshot} walls={walls} zones={zones} furnitureCount={furniture.length} panes={panes} setLayout={setLayout} setSelType={setSelType} setSelectedId={setSelectedId} setSelectedIds={setSelectedIds} slidesCount={slides.length} />

      <div style={S.main}>
        <Sidebar $={$} S={S} T={T} activeFurnitureType={activeFurnitureType} activeSlideId={activeSlideId} activeSpecLayer={activeSpecLayer} activeZoneType={activeZoneType} addSlide={addSlide} bgImage={bgImage} bgOpacity={bgOpacity} bgScale={bgScale} calibrationFeet={calibrationFeet} calibrationLine={calibrationLine} columns={columns} cost={cost} dims={dims} docSettings={docSettings} doors={doors} dropSlide={dropSlide} fRef={fRef} floorRegions={floorRegions} flowPaths={flowPaths} font={font} ft={ft} furniture={furniture} guides={guides} labels={labels} layerLocked={layerLocked} lockedLayers={lockedLayers} markers={markers} mode={mode} projectName={projectName} pxPerFoot={pxPerFoot} removeSlide={removeSlide} revClouds={revClouds} selectedId={selectedId} selectedIds={selectedIds} setActiveComponentType={setActiveComponentType} setActiveFurnitureType={setActiveFurnitureType} setActiveSlideId={setActiveSlideId} setActiveSpecLayer={setActiveSpecLayer} setActiveZoneType={setActiveZoneType} setBgImage={setBgImage} setBgOffset={setBgOffset} setBgOpacity={setBgOpacity} setBgScale={setBgScale} setCalibrationFeet={setCalibrationFeet} setCalibrationLine={setCalibrationLine} setLockedLayers={setLockedLayers} setProjectName={setProjectName} setSelType={setSelType} setSelectedId={setSelectedId} setSelectedIds={setSelectedIds} setShowGrid={setShowGrid} setT={setT} setTool={setTool} setVisibleBuildElectrical={setVisibleBuildElectrical} setVisibleBuildLighting={setVisibleBuildLighting} setVisibleDims={setVisibleDims} setVisibleFloorRegions={setVisibleFloorRegions} setVisibleFlowPaths={setVisibleFlowPaths} setVisibleFurniture={setVisibleFurniture} setVisibleGuides={setVisibleGuides} setVisibleITMEP={setVisibleITMEP} setVisibleLabels={setVisibleLabels} setVisibleLayers={setVisibleLayers} setVisibleRevClouds={setVisibleRevClouds} setVisibleZones={setVisibleZones} showGrid={showGrid} slides={slides} tool={tool} uiColor={uiColor} updateSlide={updateSlide} visibleBuildElectrical={visibleBuildElectrical} visibleBuildLighting={visibleBuildLighting} visibleDims={visibleDims} visibleFloorRegions={visibleFloorRegions} visibleFlowPaths={visibleFlowPaths} visibleFurniture={visibleFurniture} visibleGuides={visibleGuides} visibleITMEP={visibleITMEP} visibleLabels={visibleLabels} visibleLayers={visibleLayers} visibleRevClouds={visibleRevClouds} visibleZones={visibleZones} wallKinds={wallKinds} walls={walls} windows={windows} wl={wl} zoneLibrary={zoneLibrary} zones={zones} />

        <ToolRail S={S} T={T} activeComponentType={activeComponentType} activeSpecLayer={activeSpecLayer} bgImage={bgImage} chromeT={chromeT} markerFinish={markerFinish} mode={mode} pxPerFoot={pxPerFoot} setActiveComponentType={setActiveComponentType} setT={setT} themeMode={themeMode} tool={tool} wallKind={wallKind} wallKinds={wallKinds} />

        {/* ── Canvas area — Docs stage swaps the pane workspace for the slide deck ── */}
        {mode === "docs" ? (
          <DocsView T={T} sheetTheme={docsSheetT} font={font} display={display} projectName={projectName}
            slides={slides} docSettings={docSettings} activeSlideId={activeSlideId}
            onUpdateSlide={updateSlide} onUpdateSettings={(p) => setDocSettings(s => ({ ...s, ...p }))}
            onEditModel={editModelFromSlide} renderSlideBody={renderSlideBody}
            onPrint={() => setPrinting(true)} captureRef={docsCaptureRef} autoScaleFor={slideAutoScale} />
        ) : (
        <div ref={splitContainerRef} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* Row 1 (plan + aux pane 1) */}
        <div style={{ display: "flex", minHeight: 0, flex: panes.length === 4 ? "none" : 1, height: panes.length === 4 ? `${splitPosV * 100}%` : undefined }}>
        <div ref={cvsContainer} style={panes.length > 1
          ? { ...S.cv, flex: "none", width: `${splitPos * 100}%` }
          : S.cv}>
          <PaneChip i={0} />
          {/* Elevation guide edge rails — plan canvas active + Select tool, so they don't
              intercept drawing near the canvas edges */}
          {(panes.length > 1 || panes[0].view === "plan") && tool === "select" && visibleGuides && !layerLocked("guides") && guideRails()}
          {/* Camera markers on the edge rulers — where each open elevation is currently looking */}
          {(panes.length > 1 || panes[0].view === "plan") && visibleGuides && cameraIndicators()}
          {/* Single-pane non-plan view: overlay the aux view on top of the dormant plan canvas.
              The chip stays clickable (zIndex 50 > 40) so the user can swap back. */}
          {panes.length === 1 && panes[0].view !== "plan" && (
            <div style={{ position: "absolute", inset: 0, zIndex: 40, background: canvasT.canvas }}>
              {renderAuxPane(0)}
            </div>
          )}
          {/* 2D plan controls — bottom-right */}
          <div style={{ position: "absolute", bottom: CHROME_BOTTOM, right: 12, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 4, maxWidth: "calc(100vw - 24px)" }}>
            {view3d && (<>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setShow3dLabels(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: show3dLabels ? T.accent : T.panelBg, color: show3dLabels ? "#fff" : T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow, userSelect: "none" }}>
                    <Tag size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Zone labels</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setShow3dDims(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: show3dDims ? T.accent : T.panelBg, color: show3dDims ? "#fff" : T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow, userSelect: "none" }}>
                    <Ruler size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Wall dimensions</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => !ceilingInertReason && setShow3dCeiling(v => !v)} aria-disabled={!!ceilingInertReason} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: (show3dCeiling && !ceilingInertReason) ? T.accent : T.panelBg, color: ceilingInertReason ? T.textFaint : (show3dCeiling ? "#fff" : T.textMuted), cursor: ceilingInertReason ? "not-allowed" : "pointer", opacity: ceilingInertReason ? 0.5 : 1, backdropFilter: "blur(8px)", boxShadow: T.panelShadow, userSelect: "none" }}>
                    <PanelTop size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>{ceilingInertReason || "Ceiling"}</TooltipContent>
              </Tooltip>
              <div style={{ width: 1, height: 20, background: T.border, margin: "0 2px" }} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => controls3dRef.current?.reset()} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: T.panelBg, color: T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow, userSelect: "none" }}>
                    <RotateCcw size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Reset camera</TooltipContent>
              </Tooltip>
            </>)}
            {!view3d && <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setCanvasRotation(r => { const n = r - 45; return n < -360 ? 0 : n; })}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: T.panelBg, color: T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow, userSelect: "none" }}>
                    <RotateCcw size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Rotate view −45°</TooltipContent>
              </Tooltip>
              <button onClick={() => setCanvasRotation(0)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 7px", borderRadius: 6, border: "1px solid " + T.border, background: canvasRotation !== 0 ? T.accent + "22" : T.panelBg, color: canvasRotation !== 0 ? T.accent : T.textMuted, cursor: canvasRotation !== 0 ? "pointer" : "default", backdropFilter: "blur(8px)", boxShadow: T.panelShadow, userSelect: "none", fontSize: 10, fontFamily: "inherit", fontWeight: 600, minWidth: 32 }}>
                {canvasRotation !== 0 ? `${canvasRotation}°` : "0°"}
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setCanvasRotation(r => { const n = r + 45; return n > 360 ? 0 : n; })}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: T.panelBg, color: T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow, userSelect: "none" }}>
                    <RotateCw size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Rotate view +45°</TooltipContent>
              </Tooltip>
            </>}
          </div>

          {view3d && !splitView && data3d && (
            <Suspense fallback={<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 11, fontFamily: font }}>Loading 3D…</div>}>
            <TestFit3D
              walls={data3d.walls}
              nodes={data3d.nodes}
              doors={data3d.doors}
              windows={data3d.windows}
              columns={data3d.columns}
              zones={data3d.zones}
              furniture={data3d.furniture}
              visibleFurniture={visibleFurniture}
              markers={data3d.markers}
              dims={dims}
              pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight} T={canvasT} themeMode={monoDraw ? "mono" : themeMode}
              controlsRef={controls3dRef} mode={mode}
              selectedId={selectedId} selType={selType}
              show3dLabels={show3dLabels} setShow3dLabels={setShow3dLabels}
              show3dDims={show3dDims}     setShow3dDims={setShow3dDims}
              show3dCeiling={show3dCeiling}
              style3d={style3d}
              floorMaterial={floorMaterial}
              floorRegions={data3d.floorRegions}
              zoneLibrary={zoneLibrary}
              visibleLayers={visibleLayers}
              visibleBuildElectrical={visibleBuildElectrical}
              visibleBuildLighting={visibleBuildLighting}
              onSelect={(id, type) => { setSelectedId(id); setSelType(type); setSelectedIds(id ? [id] : []); }}
            />
            </Suspense>
          )}

          {/* 3D style switcher — only in full 3D mode (not split; split shows it in the 3D pane) */}
          {view3d && !splitView && (
            <div style={{ position: "absolute", bottom: 112, left: "50%", transform: "translateX(-50%)",
              display: "flex", gap: 4, background: T.panelBg, border: "1px solid " + T.border,
              borderRadius: 8, padding: 4, backdropFilter: "blur(12px)", zIndex: 10 }}>
              {[["clay","Clay"],["xray","X-Ray"],["detailed","Detailed"],["print","Print"]].map(([k, label]) => (
                <button key={k} onClick={() => setStyle3d(k)}
                  style={{ padding: "5px 14px", borderRadius: 5, border: "none", cursor: "pointer",
                    background: style3d === k ? T.accent + "40" : "transparent",
                    color: style3d === k ? T.textBright : T.textMuted,
                    fontSize: 11, fontFamily: "inherit", fontWeight: style3d === k ? 600 : 400,
                    outline: style3d === k ? "1px solid " + T.accent : "none" }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {repeatInput !== null && (
            <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, background: T.panelBg, border: "1px solid " + T.accent + "88", borderRadius: 20, padding: "5px 16px", fontSize: 11, color: T.textBright, fontWeight: 600, zIndex: 25, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, letterSpacing: "0.02em" }}>
              <span style={{ color: T.accent }}>/</span>
              <span style={{ minWidth: 20, textAlign: "center" }}>{repeatInput || "…"}</span>
              <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 400 }}>copies · Enter to place · Esc to cancel</span>
            </div>
          )}

          {drawChain && !view3d && <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 14px", fontSize: "10px", color: MODES[mode].color, zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500 }}>
            Click to place · Double-click to finish · Shift: 45° snap · Type length to lock
          </div>}

          {drawRect && !view3d && <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 14px", fontSize: "10px", color: MODES[mode].color, zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500 }}>
            Click the opposite corner · Type a size to lock it (20x30, 20'6"x30') · Alt: off-grid
          </div>}
          
          <style>{`@keyframes _blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
          <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) => (dimInput !== "" && cursorPos && (
            <div style={{ position: "absolute", pointerEvents: "none", zIndex: 20, whiteSpace: "nowrap",
              left: cursorPos.x * zoom + viewOff.x + 18, top: cursorPos.y * zoom + viewOff.y + 18,
              background: "#1A1814EE", border: "1px solid #C8B98A", borderRadius: 5,
              padding: "3px 9px", fontSize: 12, fontFamily: "'SF Mono','Consolas','Monaco',monospace",
              fontWeight: 600, color: "#C8B98A", boxShadow: "0 2px 8px rgba(0,0,0,.5)" }}>
              {dimInput}
              <span style={{ display: "inline-block", width: 1, height: 12, background: "#C8B98A",
                marginLeft: 2, verticalAlign: "middle", animation: "_blink 1s step-end infinite" }} />
            </div>
          ))}</HoverSubscriber>
          {tool === "calibrate" && (!calibrationLine || !calibrationLine.p2) && <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 14px", fontSize: "10px", color: T.uiConduit, zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500 }}>
            {!calibrationLine ? "Click to set first point" : "Click to set second point"}
          </div>}

          {tool === "label" && !editingLabelId && (
            <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 14px", fontSize: "10px", color: T.textBright, zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500, pointerEvents: "none" }}>
              Click to place · Click + drag for callout with leader line
            </div>
          )}
          {tool === "revcloud" && (
            <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: 6, padding: "6px 14px", fontSize: 10, color: "#E05252", zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500, pointerEvents: "none" }}>
              {!drawRevCloud ? "Click to start revision cloud"
                : drawRevCloud.points.length < 3
                  ? `${drawRevCloud.points.length} point${drawRevCloud.points.length > 1 ? "s" : ""} — need at least 3 to close`
                  : "Click to add points · Click first point to close"}
            </div>
          )}
          {tool === "flowPath" && (
            <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: 6, padding: "6px 14px", fontSize: 10, color: "#4A90D9", zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500, pointerEvents: "none" }}>
              {!drawFlowPath ? "Click to start flow path"
                : `${drawFlowPath.points.length} point${drawFlowPath.points.length > 1 ? "s" : ""} · click to add · Enter or double-click to finish`}
            </div>
          )}
          {tool === "floorRegion" && (
            <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: 6, padding: "6px 14px", fontSize: 10, color: "#7A9E5A", zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500, pointerEvents: "none" }}>
              {!drawFloorRegion ? "Click to start floor region"
                : drawFloorRegion.points.length < 3
                  ? `${drawFloorRegion.points.length} point${drawFloorRegion.points.length > 1 ? "s" : ""} — need at least 3 to close`
                  : "Click to add points · Click first point to close"}
            </div>
          )}
          {addingLeaderToId && (
            <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.accent + "88", borderRadius: "6px", padding: "6px 14px", fontSize: "10px", color: T.accent, zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500, pointerEvents: "none" }}>
              Click any object or point to attach leader · Esc to cancel
            </div>
          )}

          {/* Inline label text editor */}
          {editingLabelId && (() => {
            const lbl = labels.find(l => l.id === editingLabelId);
            if (!lbl) return null;
            const screenX = lbl.x * zoom + viewOff.x;
            const screenY = lbl.y * zoom + viewOff.y;
            const lineCount = wrapLabelLines(editingLabelText, lbl.fontSize).length;
            return <textarea
              autoFocus
              style={{
                position: "absolute",
                left: screenX,
                top: screenY,
                transform: "translate(-50%, -50%)",
                background: T.bg2 + "EE",
                border: "1.5px solid " + T.accent,
                borderRadius: 4,
                color: lbl.color,
                fontSize: Math.max(10, lbl.fontSize * zoom),
                fontWeight: lbl.bold ? 700 : 400,
                fontStyle: lbl.italic ? "italic" : "normal",
                fontFamily: "inherit",
                padding: "4px 8px",
                minWidth: 80,
                maxWidth: LABEL_MAX_W * zoom,
                width: LABEL_MAX_W * zoom,
                resize: "none",
                outline: "none",
                textAlign: "center",
                zIndex: 30,
                lineHeight: 1.4,
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
              rows={lineCount}
              value={editingLabelText}
              onChange={e => setEditingLabelText(e.target.value)}
              onBlur={() => {
                const t = editingLabelText.trim();
                setLabels(p => t
                  ? p.map(l => l.id === editingLabelId ? { ...l, text: t } : l)
                  : p.filter(l => l.id !== editingLabelId || l.text));
                setEditingLabelId(null);
              }}
              onKeyDown={ev => {
                if (ev.key === "Escape") {
                  setLabels(p => p.filter(l => l.id !== editingLabelId || l.text));
                  setEditingLabelId(null);
                } else if (ev.key === "Enter" && !ev.shiftKey) {
                  ev.preventDefault();
                  const t = editingLabelText.trim();
                  setLabels(p => t
                    ? p.map(l => l.id === editingLabelId ? { ...l, text: t } : l)
                    : p.filter(l => l.id !== editingLabelId || l.text));
                  setEditingLabelId(null);
                }
              }}
            />;
          })()}

          {renderPlanCanvas({ zoom, viewOff, interactive: true, ...liveLayers })}

          {/* Overview map — only worth showing once the model outgrows the window. */}
          {(panes.length > 1 || panes[0].view === "plan") && !view3d && minimapData && (() => {
            const cw = canvasSize.w, ch = canvasSize.h;
            const b = minimapData.bounds;
            // Everything already visible? Then the map is noise — hide it until it helps.
            if (!cw || !ch || (b.w * zoom <= cw && b.h * zoom <= ch)) return null;
            return <Minimap {...minimapData} T={canvasT} font={font}
              viewOff={viewOff} zoom={zoom} canvasW={cw} canvasH={ch} canvasRotation={canvasRotation}
              collapsed={minimapOff} onToggle={() => setMinimapOff(v => !v)}
              corner={minimapCorner} onCornerChange={setMinimapCorner}
              topInset={40}    /* clears PaneChip's "Plan ▾ 📷" control, which also docks top-left */
              bottomInset={40} /* clears the rotate-view button row, which also docks bottom-right */
              onFit={() => fitAll()}   /* not {fitAll} — the click event would arrive as its optional points arg */
              onNavigate={(cx, cy) => setViewOff(centerViewOn(cx, cy, zoom, cw, ch))} />;
          })()}

          {/* Collapsed option-panel handle — re-expands the panel */}
          {(inspSel || inspTool) && !inspectorOpen && (
            <button onClick={() => setInspectorOpen(true)} title="Show options panel"
              style={{ position: "fixed", top: 52, right: 12, zIndex: 50, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, cursor: "pointer", color: T.textMuted, backdropFilter: "blur(12px)", boxShadow: T.panelShadow }}>
              <ChevronLeft size={16} />
            </button>
          )}

          <Inspector $={$} S={S} T={T} alignDistribute={alignDistribute} ceilingHeight={ceilingHeight} chromeT={chromeT} clearInsideSf={clearInsideSf} cv={cv} delSel={delSel} floorEditId={floorEditId} floorHoles={floorHoles} floorMaterial={floorMaterial} ft={ft} ftN={ftN} furnishZone={furnishZone} inspSel={inspSel} inspectorOpen={inspectorOpen} inspectorToggle={inspectorToggle} mode={mode} multiSelItems={multiSelItems} multiSelType={multiSelType} newToggle={newToggle} pxPerFoot={pxPerFoot} selColumn={selColumn} selDoor={selDoor} selElevLabel={selElevLabel} selElevRevCloud={selElevRevCloud} selFloorRegion={selFloorRegion} selFlowPath={selFlowPath} selFurniture={selFurniture} selLabel={selLabel} selMarker={selMarker} selNode={selNode} selRevCloud={selRevCloud} selType={selType} selWall={selWall} selWindow={selWindow} selZone={selZone} selectedIds={selectedIds} setAddingLeaderToId={setAddingLeaderToId} setEditingLabelId={setEditingLabelId} setEditingLabelText={setEditingLabelText} setFloorEditId={setFloorEditId} setFloorMaterial={setFloorMaterial} setRoomZone={setRoomZone} themeMode={themeMode} tool={tool} updColumn={updColumn} updDoor={updDoor} updElevLabel={updElevLabel} updElevRevCloud={updElevRevCloud} updFloorRegion={updFloorRegion} updFlowPath={updFlowPath} updFurniture={updFurniture} updLabel={updLabel} updMarker={updMarker} updRevCloud={updRevCloud} updWall={updWall} updWindow={updWindow} updZone={updZone} wallKinds={wallKinds} wallsAt={wallsAt} wl={wl} zoneForFloor={zoneForFloor} zoneLibrary={zoneLibrary} />

          <ToolOptions $={$} S={S} T={T} activeComponentType={activeComponentType} activeSpecLayer={activeSpecLayer} activeZoneType={activeZoneType} chromeT={chromeT} columnLabel={columnLabel} columnNotes={columnNotes} columnShape={columnShape} columnSize={columnSize} doorFlipped={doorFlipped} doorHingeRight={doorHingeRight} doorType={doorType} doorWidth={doorWidth} htrackAngle={htrackAngle} inspTool={inspTool} inspectorOpen={inspectorOpen} inspectorToggle={inspectorToggle} lightingIsNew={lightingIsNew} lightingType={lightingType} markerFinish={markerFinish} markerNotes={markerNotes} mode={mode} outletIsNew={outletIsNew} outletType={outletType} ponyDepth={ponyDepth} ponyHeight={ponyHeight} pxPerFoot={pxPerFoot} setActiveComponentType={setActiveComponentType} setActiveZoneType={setActiveZoneType} setColumnLabel={setColumnLabel} setColumnNotes={setColumnNotes} setColumnShape={setColumnShape} setColumnSize={setColumnSize} setDoorFlipped={setDoorFlipped} setDoorHingeRight={setDoorHingeRight} setDoorType={setDoorType} setDoorWidth={setDoorWidth} setLightingIsNew={setLightingIsNew} setLightingType={setLightingType} setMarkerFinish={setMarkerFinish} setMarkerNotes={setMarkerNotes} setOutletIsNew={setOutletIsNew} setOutletType={setOutletType} setPonyDepth={setPonyDepth} setPonyHeight={setPonyHeight} setT={setT} setWallKind={setWallKind} setWallMaterial={setWallMaterial} setWallNotes={setWallNotes} setWindowHeight={setWindowHeight} setWindowSill={setWindowSill} setWindowType={setWindowType} setWindowWidth={setWindowWidth} setZoneNotes={setZoneNotes} setZonePaintColor={setZonePaintColor} setZonePaintFinish={setZonePaintFinish} themeMode={themeMode} tool={tool} wallKind={wallKind} wallKinds={wallKinds} wallMaterial={wallMaterial} wallNotes={wallNotes} windowHeight={windowHeight} windowSill={windowSill} windowType={windowType} windowWidth={windowWidth} zoneLibrary={zoneLibrary} zoneNotes={zoneNotes} zonePaintColor={zonePaintColor} zonePaintFinish={zonePaintFinish} />

          {bgImage && <div style={S.bg}><span style={{ color: T.textMuted, fontSize: 10, fontWeight: 500 }}>Underlay</span><input type="range" min="0" max="100" value={bgOpacity * 100} onChange={e => setBgOpacity(e.target.value / 100)} style={{ width: 70, accentColor: "#9A9488", height: 4 }} /><span style={{ fontSize: 10, fontWeight: 500 }}>{Math.round(bgOpacity * 100)}%</span></div>}


        </div>

        {panes.length > 1 && <VDivider />}
        {panes.length > 1 && <div style={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden" }}><PaneChip i={1} />{renderAuxPane(1)}</div>}
        </div>{/* end Row 1 */}
        {panes.length === 4 && <HDivider />}
        {panes.length === 4 && (
          <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
            <div style={{ width: `${splitPos * 100}%`, flex: "none", position: "relative", minWidth: 0, overflow: "hidden" }}><PaneChip i={2} />{renderAuxPane(2)}</div>
            <VDivider />
            <div style={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden" }}><PaneChip i={3} />{renderAuxPane(3)}</div>
          </div>
        )}
        </div>
        )}{/* end splitContainerRef / docs swap */}
      </div>

      {/* ── App Status Bar — fixed footer below all panes ───────────── */}
      {(() => {
        const slbl = { fontFamily: display, fontSize: 9, letterSpacing: "0.18em", color: T.textMuted, fontWeight: 600, textTransform: "uppercase" };
        const sval = { fontFamily: font, fontSize: 11, color: T.textBright, fontWeight: 500, letterSpacing: "0.02em" };
        const sdiv = { width: 1, height: 14, background: T.border, flexShrink: 0 };
        return (
        <div data-testid="app-statusbar" style={{ background: T.bg2, borderTop: "1px solid " + T.border, padding: "0 16px", height: 30, display: "flex", alignItems: "center", gap: 14, fontSize: 10, color: T.textDim, flexShrink: 0 }}>
          {/* Context tick — current workflow stage */}
          <span style={{ width: 7, height: 7, borderRadius: 1, background: T.brand, flexShrink: 0 }} />
          <span style={{ ...slbl, color: T.text }}>{mode === "itmep" ? "IT / MEP" : mode}</span>

          {mode === "zone" && (
            <><span style={sdiv} /><span style={{ color: zoneLibrary[activeZoneType]?.color || T.accent, fontSize: 10, fontWeight: 500 }}>
              {zoneLibrary[activeZoneType]?.name || "—"}
            </span></>
          )}
          {mode === "itmep" && activeSpecLayer !== "power" && (
            <><span style={sdiv} /><span style={{ color: SPEC_LAYERS[activeSpecLayer]?.color || T.accent, fontSize: 10, fontWeight: 500 }}>
              {SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType]?.icon} {SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType]?.name}
            </span></>
          )}

          <div style={{ flex: 1 }} />
          {/* Snapping is otherwise invisible — surface it, since Alt turns it off. */}
          <span data-testid="snap-state" style={{ ...slbl, color: snapOff ? T.brand : T.textDim }}>
            {snapOff ? "Snap off" : "Snap " + (snapGrid >= pxPerFoot ? "1'" : snapGrid >= pxPerFoot / 4 ? '3"' : '1"')}
          </span>
          <span style={sdiv} />
          <span style={slbl}>Zoom</span>
          <span style={sval}>{Math.round(zoom * 100)}<span style={{ color: T.textMuted }}>%</span></span>
          <span style={sdiv} />
          {/* Plan size — turns brand-coloured once the plan is big enough that the zoomed-out
              level of detail kicks in, so a slow frame has a visible explanation. */}
          <span data-testid="plan-load" data-heavy={planLoad.heavy ? "true" : undefined}
            title={planLoad.heavy ? "Large plan — hatching, dimensions and labels simplify below 50% zoom so panning stays fluid" : "Walls · elements on the plan"}
            style={{ ...slbl, color: planLoad.heavy ? T.brand : T.textDim }}>
            {planLoad.walls} walls · {planLoad.elements.toLocaleString()} el{planLoad.heavy ? " · large" : ""}
          </span>
          <span style={sdiv} />
          <span style={slbl}>Budget</span>
          <span style={{ ...sval, color: T.uiBudget, fontWeight: 600 }}>{$(cost.total)}</span>
        </div>
        );
      })()}
    </div>

    {/* ── Docs print root — sibling of the app root; @media print swaps them ── */}
    {printing && (() => {
      const inches = sheetInches(docSettings);
      return (<>
        <style>{`
          @media screen { .docs-print-root { display: none; } }
          @media print {
            .tf-app-root { display: none !important; }
            .docs-print-root { display: block; }
            .docs-sheet-page { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: ${inches.w}in ${inches.h}in; margin: 0; }
            body { margin: 0; }
          }
        `}</style>
        <PrintDeck slides={slides} docSettings={docSettings} T={T} sheetTheme={docsSheetT} font={font} display={display}
          projectName={projectName} renderSlideBody={renderSlideBody} autoScaleFor={slideAutoScale} />
      </>);
    })()}

    {/* ── Zone Library Settings Modal ──────────────────────────────── */}
    {showSettings && <ZoneLibraryModal
      zoneLibrary={zoneLibrary}
      setZoneLibrary={setZoneLibrary}
      onReset={() => { setZoneLibrary(ZONE_LIBRARY_DEFAULTS); localStorage.removeItem("testfit-zone-library"); }}
      onClose={() => setShowSettings(false)}
      T={T}
    />}

    </TooltipProvider>
  );
}
