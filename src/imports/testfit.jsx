import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { MousePointer2, X, Plus, DoorOpen, Ruler } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../app/components/ui/tooltip";

// Custom wall and window icons
const WallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="8" width="14" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const DemoWallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="8" width="14" height="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" fill="none"/>
    <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2"/>
  </svg>
);

const NewWallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="8" width="14" height="4" stroke="currentColor" strokeWidth="2" fill="none"/>
    <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const WindowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="12" height="12" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const CutoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="3" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="2"/>
    <line x1="13" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="2"/>
    <line x1="7" y1="7" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5"/>
    <line x1="13" y1="7" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5"/>
  </svg>
);

const PonyWallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="9" width="14" height="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="6" y1="12" x2="6" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5"/>
    <line x1="14" y1="12" x2="14" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5"/>
  </svg>
);

const ColumnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="10" cy="10" r="3" fill="currentColor"/>
  </svg>
);

const ZONE_LIBRARY = {
  entry: { name: "Entry", color: "#8B7355", defaultW: 140, defaultH: 100, items: [{ name: "Reception Desk", qty: 1, unitCost: 2400 },{ name: "Bench", qty: 1, unitCost: 800 },{ name: "Coat Rack", qty: 1, unitCost: 350 },{ name: "Signage", qty: 1, unitCost: 600 }] },
  softseating: { name: "Soft Seating", color: "#8B6914", defaultW: 160, defaultH: 120, items: [{ name: "Sofa (3-seat)", qty: 1, unitCost: 2800 },{ name: "Accent Chair", qty: 2, unitCost: 950 },{ name: "Coffee Table", qty: 1, unitCost: 600 },{ name: "Side Table", qty: 1, unitCost: 350 },{ name: "Floor Lamp (warm 2700K)", qty: 2, unitCost: 420 }] },
  cafe: { name: "Café", color: "#8B4513", defaultW: 240, defaultH: 100, items: [{ name: "Bar Top (linear ft)", qty: 8, unitCost: 175 },{ name: "Bar Stool", qty: 6, unitCost: 480 },{ name: "Under-counter Fridge", qty: 1, unitCost: 900 },{ name: "Pendant Light", qty: 3, unitCost: 320 }] },
  kitchen: { name: "Kitchen", color: "#704214", defaultW: 140, defaultH: 100, items: [{ name: "Counter/Cabinets (linear ft)", qty: 6, unitCost: 200 },{ name: "Sink", qty: 1, unitCost: 650 },{ name: "Microwave", qty: 1, unitCost: 280 },{ name: "Coffee Machine", qty: 1, unitCost: 1200 },{ name: "Mini Fridge", qty: 1, unitCost: 500 }] },
  clubroom: { name: "Club Room", color: "#2B4570", defaultW: 160, defaultH: 120, items: [{ name: "Conference Table", qty: 1, unitCost: 2200 },{ name: "Meeting Chair", qty: 8, unitCost: 520 },{ name: "Display/Monitor", qty: 1, unitCost: 1400 },{ name: "Whiteboard", qty: 1, unitCost: 350 }] },
  library: { name: "Library / Heads Down", color: "#2D5F2D", defaultW: 200, defaultH: 140, items: [{ name: "Work Table (communal)", qty: 1, unitCost: 1800 },{ name: "Task Chair", qty: 6, unitCost: 650 },{ name: "Task Lamp", qty: 3, unitCost: 280 },{ name: "Power Strip (under-table)", qty: 2, unitCost: 85 }] },
  outdoor: { name: "Outdoor / Patio", color: "#556B2F", defaultW: 200, defaultH: 160, items: [{ name: "Outdoor Table", qty: 2, unitCost: 1100 },{ name: "Outdoor Chair", qty: 8, unitCost: 380 },{ name: "Planter (large)", qty: 3, unitCost: 250 },{ name: "String Lights (set)", qty: 2, unitCost: 180 }] },
  banquet: { name: "Banquet Seating", color: "#6B3A6B", defaultW: 200, defaultH: 120, items: [{ name: "Banquet Table (8-top)", qty: 2, unitCost: 1400 },{ name: "Banquet Chair", qty: 16, unitCost: 320 },{ name: "Pendant Light", qty: 2, unitCost: 320 }] },
  ops: { name: "Ops Space", color: "#5A5A5A", defaultW: 120, defaultH: 100, items: [{ name: "Work Desk", qty: 2, unitCost: 800 },{ name: "Office Chair", qty: 2, unitCost: 450 },{ name: "File Cabinet", qty: 2, unitCost: 350 },{ name: "Printer Stand", qty: 1, unitCost: 200 }] },
  itcloset: { name: "IT Closet", color: "#3A5A7A", defaultW: 80, defaultH: 80, items: [{ name: "Server Rack", qty: 1, unitCost: 1800 },{ name: "Network Switch", qty: 2, unitCost: 650 },{ name: "Cable Management", qty: 1, unitCost: 300 },{ name: "Cooling Unit", qty: 1, unitCost: 1200 }] },
  restroom: { name: "Restroom", color: "#4A7A9A", defaultW: 100, defaultH: 120, items: [{ name: "Toilet", qty: 2, unitCost: 800 },{ name: "Sink", qty: 2, unitCost: 500 },{ name: "Mirror", qty: 2, unitCost: 200 },{ name: "Accessories", qty: 1, unitCost: 400 }] },
  storage: { name: "Storage Closet", color: "#6A5A4A", defaultW: 80, defaultH: 100, items: [{ name: "Shelving Unit", qty: 3, unitCost: 250 },{ name: "Storage Bins", qty: 10, unitCost: 25 },{ name: "Cleaning Supplies", qty: 1, unitCost: 150 }] },
};

// Component specifications organized by layer category
const SPEC_COMPONENTS = {
  power: {
    duplex_outlet: { name: "Duplex Outlet", symbol: "circle", color: "#50A070", letter: null, unitCost: 350 },
    quad_outlet: { name: "Quad Outlet", symbol: "circle", color: "#E05050", letter: null, unitCost: 420 },
    dedicated_quad: { name: "Dedicated Quad Circuit", symbol: "circle", color: "#4080E0", letter: null, unitCost: 850 },
    ceiling_quad: { name: "Ceiling Quad Outlet", symbol: "crosshair", color: "#E05050", letter: null, unitCost: 380 },
    tstat: { name: "T-Stat", symbol: "circle", color: "#E05050", letter: "T", unitCost: 450 },
    sconce_prewire: { name: "Sconce Prewire", symbol: "circle", color: "#E05050", letter: "S", unitCost: 280 },
    pendent_prewire: { name: "Pendent Prewire", symbol: "circle", color: "#E05050", letter: "P", unitCost: 320 },
    htrack_4: { name: "H-Track 4'", symbol: "rect", color: "#E05050", letter: "H", unitCost: 520 },
    htrack_8: { name: "H-Track 8'", symbol: "rect", color: "#E05050", letter: "H", unitCost: 840 },
    htrack: { name: "H-Track 4'", symbol: "rect", color: "#E05050", letter: "H", unitCost: 520 }, // legacy alias
    outlet_duplex:         { name: "Duplex Outlet (In-Wall)",         symbol: "outlet",         color: "#50C878", letter: "D", unitCost: 320, outletCount: 2, mount: "inwall"  },
    outlet_quad:           { name: "Quad Outlet (In-Wall)",           symbol: "outlet",         color: "#50C878", letter: "Q", unitCost: 480, outletCount: 4, mount: "inwall"  },
    outlet_duplex_surface: { name: "Duplex Outlet (Surface/Conduit)", symbol: "outlet",         color: "#E0A050", letter: "D", unitCost: 420, outletCount: 2, mount: "surface" },
    outlet_quad_surface:   { name: "Quad Outlet (Surface/Conduit)",   symbol: "outlet",         color: "#E0A050", letter: "Q", unitCost: 580, outletCount: 4, mount: "surface" },
    outlet_ceiling:        { name: "Ceiling Quad Outlet",             symbol: "outlet_ceiling", color: "#60B0E0", letter: "Q", unitCost: 420, outletCount: 4, mount: "ceiling" },
    switch_single:         { name: "Single-Pole Switch",              symbol: "switch",         color: "#C8A060", letter: "S", unitCost: 180, mount: "inwall"  },
    switch_double:         { name: "Double-Pole Switch",              symbol: "switch",         color: "#C8A060", letter: "S2", unitCost: 260, mount: "inwall" },
    switch_dimmer:         { name: "Dimmer Switch",                   symbol: "switch",         color: "#C8A060", letter: "DM", unitCost: 320, mount: "inwall" },
    panel_board:           { name: "Panel Board",                     symbol: "panel",          color: "#E05050", letter: "P", unitCost: 2800, mount: "inwall" },
  },
  av: {
    wall_speaker: { name: "Wall Speaker", icon: "🔊", unitCost: 480 },
    subwoofer: { name: "Subwoofer", icon: "📻", unitCost: 650 },
    pendant_speaker: { name: "Pendant Speaker", icon: "🔈", unitCost: 520 },
    speaker_line: { name: "Speaker Line", icon: "📡", unitCost: 380 },
  },
  it: {
    router: { name: "Router", icon: "📶", unitCost: 450 },
    access_point: { name: "Access Point", icon: "📡", unitCost: 380 },
  },
  mep: {
    drain_line: { name: "Drain Line", symbol: "circle", color: "#50A070", letter: "D", unitCost: 380 },
    water_line: { name: "Water Line", symbol: "circle", color: "#5050A0", letter: "W", unitCost: 380 },
  },
  security: {
    white_camera: { name: "White Camera", symbol: "circle", color: "#E8E0D0", letter: "C", unitCost: 450 },
    black_camera: { name: "Black Camera", symbol: "circle", color: "#2A2A26", letter: "C", unitCost: 450 },
    outdoor_camera: { name: "Outdoor Camera", symbol: "circle", color: "#556B2F", letter: "O", unitCost: 650 },
  },
};

const SPEC_LAYERS = { 
  power: { name: "Power / Electrical", color: "#E8C840" }, 
  av: { name: "Speakers / AV", color: "#E06040" }, 
  it: { name: "IT / Network", color: "#4080E0" }, 
  mep: { name: "MEP / Plumbing", color: "#50A070" },
  security: { name: "Security", color: "#9A4A9A" } 
};

// CAD-style crosshair cursor (data URI)
const cadCrosshair = (color) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cline x1='16' y1='0' x2='16' y2='14' stroke='${color}' stroke-width='1'/%3E%3Cline x1='16' y1='18' x2='16' y2='32' stroke='${color}' stroke-width='1'/%3E%3Cline x1='0' y1='16' x2='14' y2='16' stroke='${color}' stroke-width='1'/%3E%3Cline x1='18' y1='16' x2='32' y2='16' stroke='${color}' stroke-width='1'/%3E%3C/svg%3E") 16 16, crosshair`;

const WALL_KINDS = {
  existing: { label: "Existing", color: "#9A9488", dash: null,  thickness: 7   },
  demo:     { label: "Demo",     color: "#E05050", dash: "8 4", thickness: 7   },
  new:      { label: "New",      color: "#50A0E0", dash: null,  thickness: 4.5 },
  pony:     { label: "Pony",     color: "#C8A060", dash: null,  thickness: 3.5, thin: true },
};

const DOOR_WIDTHS = [36, 48, 60];
const DOOR_TYPES = ["Wood", "Glass", "Metal", "Case Opening"];
const WINDOW_WIDTHS = [24, 36, 48, 60];
const WINDOW_TYPES = ["Window", "Cut Opening"];

const WALL_MATERIALS = ["Drywall", "Brick", "CMU / Block", "Glass", "Wood Stud", "Metal Stud", "Concrete", "Plaster", "Other"];
const WALL_MATERIAL_HATCHES = {
  "Drywall":     "mat-drywall",
  "Brick":       "mat-brick",
  "CMU / Block": "mat-cmu",
  "Glass":       "mat-glass",
  "Wood Stud":   "mat-wood-stud",
  "Metal Stud":  "mat-metal-stud",
  "Concrete":    "mat-concrete",
  "Plaster":     "mat-plaster",
  "Other":       "mat-other",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const sn = (v, g) => Math.round(v / g) * g;
const parseDimInput = (str, ppf) => {
  if (!str) return null;
  const s = str.trim();
  let m = s.match(/^(\d+(?:\.\d+)?)'(\d+(?:\.\d+)?)\"?$/);
  if (m) { const px = (parseFloat(m[1]) + parseFloat(m[2]) / 12) * ppf; return px > 0 ? px : null; }
  m = s.match(/^(\d+(?:\.\d+)?)\"$/);
  if (m) { const px = parseFloat(m[1]) / 12 * ppf; return px > 0 ? px : null; }
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) { const px = parseFloat(m[1]) * ppf; return px > 0 ? px : null; }
  return null;
};

// Compute a miter join corner point for two walls meeting at a junction (jx, jy).
// d1/n1/h1 = direction, left-normal, half-thickness for wall 1 (direction pointing away from junction)
// d2/n2/h2 = same for wall 2
// side = +1 for left edge, -1 for right edge
const wallMiterPt = (jx, jy, d1x, d1y, n1x, n1y, h1, d2x, d2y, n2x, n2y, h2, side) => {
  const Px = jx + n1x * h1 * side, Py = jy + n1y * h1 * side;
  const Qx = jx + n2x * h2 * side, Qy = jy + n2y * h2 * side;
  const denom = d1x * d2y - d1y * d2x; // 2D cross product d1 × d2
  if (Math.abs(denom) < 0.001) return { x: Px, y: Py }; // parallel — use simple offset
  const t = ((Qx - Px) * d2y - (Qy - Py) * d2x) / denom;
  const maxDist = Math.max(h1, h2) * 6; // cap extreme miters (very acute angles)
  if (Math.abs(t) > maxDist) return { x: Px, y: Py };
  return { x: Px + d1x * t, y: Py + d1y * t };
};
const dst = (ax, ay, bx, by) => Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
const ptSeg = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1, ls = dx * dx + dy * dy;
  if (ls === 0) return dst(px, py, x1, y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / ls));
  return dst(px, py, x1 + t * dx, y1 + t * dy);
};
const SNAP_R = 12;

// Shoelace formula for polygon area (in px²)
const polyArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a / 2);
};
// Centroid of polygon
const polyCentroid = (pts) => {
  let cx = 0, cy = 0;
  pts.forEach(p => { cx += p.x; cy += p.y; });
  return { x: cx / pts.length, y: cy / pts.length };
};
// Point in polygon (ray casting)
const pointInPoly = (px, py, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};


// ── Theme palettes ─────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg0: "#1A1A18", bg1: "#1E1E1C", bg2: "#242422", bg3: "#2A2A26", border: "#3A3A32",
    text: "#C8C0B0", textBright: "#E8E0D0", textMuted: "#7A7468", textDim: "#5A5448", textFaint: "#4A4A40",
    accent: "#8A8478", accentDim: "#6A6458",
    canvas: "#1A1A18", gridMajor: "#3A3A3220", gridMinor: "#5A544810", gridSub: "#5A5448",
    nodeStroke: "#1A1A18", nodeFill: "#E8E0D0",
    selBg: "#2A2A2660", selBorder: "#3A3A32",
    panelBg: "#1E1E1CF2", panelShadow: "0 8px 24px rgba(0,0,0,0.4)",
    toolbarBg: "#1E1E1CEE", toolbarShadow: "0 8px 24px rgba(0,0,0,0.4)",
    delBg: "#6B2020", delText: "#FFB0B0",
    dimText: "#E8E0D055", wallNode: "#E8E0D0",
    crosshairColor: "%23E8E0D0",
  },
  light: {
    bg0: "#F5F0E8", bg1: "#EDE8DF", bg2: "#E5E0D6", bg3: "#DBD6CC", border: "#C8C0B0",
    text: "#4A4538", textBright: "#2A2520", textMuted: "#8A8478", textDim: "#A09888", textFaint: "#B8B0A0",
    accent: "#6A6458", accentDim: "#9A9488",
    canvas: "#F5F0E8", gridMajor: "#C8C0B020", gridMinor: "#A0988810", gridSub: "#C8C0B0",
    nodeStroke: "#F5F0E8", nodeFill: "#2A2520",
    selBg: "#C8C0B040", selBorder: "#B8B0A0",
    panelBg: "#EDE8DFF2", panelShadow: "0 8px 24px rgba(0,0,0,0.08)",
    toolbarBg: "#EDE8DFEE", toolbarShadow: "0 8px 24px rgba(0,0,0,0.08)",
    delBg: "#E8C0C0", delText: "#8B2020",
    dimText: "#2A252055", wallNode: "#2A2520",
    crosshairColor: "%232A2520",
  }
};

export default function TestfitTool() {
  const [themeMode, setThemeMode] = useState("dark");
  const T = THEMES[themeMode];
  const [projectName, setProjectName] = useState("New Club");
  const [nodes, setNodes] = useState([]);
  const [walls, setWalls] = useState([]); // {id, n1, n2, kind:"existing"|"demo"|"new"}
  const [zones, setZones] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [doors, setDoors] = useState([]); // {id, x, y, angle, width, flipped}
  const [windows, setWindows] = useState([]); // {id, x, y, angle, width}
  const [columns, setColumns] = useState([]); // {id, x, y, size, shape:"circle"|"square"}
  const [bgImage, setBgImage] = useState(null);
  const [bgOpacity, setBgOpacity] = useState(0.35);
  const [bgScale, setBgScale] = useState(1);
  const [bgOffset, setBgOffset] = useState({ x: 0, y: 0 });
  const [pxPerFoot, setPxPerFoot] = useState(20);

  // ── Undo / Redo ────────────────────────────────────────────────────
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const skipSnapshotRef = useRef(false);
  const MAX_HISTORY = 50;

  const snapshot = useCallback(() => {
    if (skipSnapshotRef.current) { skipSnapshotRef.current = false; return; }
    const state = JSON.stringify({ nodes, walls, zones, markers, doors, windows, columns });
    const idx = historyIdxRef.current;
    // Trim any redo states ahead of current
    const hist = historyRef.current.slice(0, idx + 1);
    // Don't push if identical to current
    if (hist.length > 0 && hist[hist.length - 1] === state) return;
    hist.push(state);
    if (hist.length > MAX_HISTORY) hist.shift();
    historyRef.current = hist;
    historyIdxRef.current = hist.length - 1;
  }, [nodes, walls, zones, markers, doors, windows, columns]);

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
    setNodes(state.nodes); setWalls(state.walls); setZones(state.zones);
    setMarkers(state.markers); setDoors(state.doors); setWindows(state.windows);
    setColumns(state.columns || []);
    setSelectedId(null); setSelType(null);
  }, []);

  const redo = useCallback(() => {
    const idx = historyIdxRef.current;
    if (idx >= historyRef.current.length - 1) return;
    const newIdx = idx + 1;
    historyIdxRef.current = newIdx;
    const state = JSON.parse(historyRef.current[newIdx]);
    skipSnapshotRef.current = true;
    setNodes(state.nodes); setWalls(state.walls); setZones(state.zones);
    setMarkers(state.markers); setDoors(state.doors); setWindows(state.windows);
    setColumns(state.columns || []);
    setSelectedId(null); setSelType(null);
  }, []);

  // tool: select, pan, wall, wall_demo, wall_new, zone, marker, door, window, calibrate
  const [tool, setTool] = useState("select");
  const [activeZoneType, setActiveZoneType] = useState("entry");
  const [activeSpecLayer, setActiveSpecLayer] = useState("power");
  const [activeComponentType, setActiveComponentType] = useState("duplex_outlet");
  const [visibleLayers, setVisibleLayers] = useState({ power: true, av: true, it: true, mep: true, security: true });
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selType, setSelType] = useState(null);
  const [marquee, setMarquee] = useState(null); // { startX, startY, endX, endY }
  const [calibrationLine, setCalibrationLine] = useState(null); // { p1: {x, y}, p2: {x, y} }
  const [calibrationFeet, setCalibrationFeet] = useState("10");
  const gs = 20;
  const [showGrid, setShowGrid] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [doorWidth, setDoorWidth] = useState(36);
  const [windowWidth, setWindowWidth] = useState(36);
  const [columnSize, setColumnSize] = useState(12); // inches
  const [columnShape, setColumnShape] = useState("circle"); // circle or square
  const [wallMaterial, setWallMaterial] = useState("Drywall");
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
  const [clipboard, setClipboard] = useState(null); // { walls, nodes, doors, windows, columns, markers, zones }
  const [pasteOffset, setPasteOffset] = useState(0); // increments each paste
  const [dims, setDims] = useState([]); // [{id, x1, y1, x2, y2, offset}]
  const [drawDim, setDrawDim] = useState(null); // null | {x1,y1} | {x1,y1,x2,y2}
  const [mode, setMode] = useState("build"); // build, zone, itmep, budget

  // Wall drawing: click-to-place sequential mode
  const [drawChain, setDrawChain] = useState(null);
  const [cursorPos, setCursorPos] = useState(null);
  const [dimInput, setDimInput] = useState("");

  // Polygon zone drawing: click-to-place points
  const [drawPolyZone, setDrawPolyZone] = useState(null); // { points: [{x,y}], type: zoneType }

  const [drag, setDrag] = useState(null);
  const [resize, setResize] = useState(null);
  const [panning, setPanning] = useState(false);
  const [panSt, setPanSt] = useState(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [viewOff, setViewOff] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hoverNid, setHoverNid] = useState(null);
  const [ghostPos, setGhostPos] = useState(null);

  // Dynamic snap grid: quarter-foot at 200%+ zoom, full foot otherwise
  const snapGrid = zoom >= 2 ? pxPerFoot / 4 : pxPerFoot;
  const cvs = useRef(null);
  const fRef = useRef(null);
  const loadRef = useRef(null);

  // ── Project management ─────────────────────────────────────────────
  const getProjectData = useCallback(() => ({
    projectName, nodes, walls, zones, markers, doors, windows, columns, dims,
    bgOpacity, bgScale, bgOffset, pxPerFoot, showDims,
    version: "testfit-v7",
  }), [projectName, nodes, walls, zones, markers, doors, windows, columns, dims, bgOpacity, bgScale, bgOffset, pxPerFoot, showDims]);

  const exportProject = useCallback(() => {
    const data = getProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (projectName || "testfit").replace(/[^a-zA-Z0-9-_ ]/g, "") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }, [getProjectData, projectName]);

  const importProject = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (typeof d !== "object" || d === null) throw new Error("Invalid project file");
        const arr = (v) => Array.isArray(v) ? v : [];
        setProjectName(d.projectName || "Imported");
        setNodes(arr(d.nodes)); setWalls(arr(d.walls)); setZones(arr(d.zones));
        setMarkers(arr(d.markers)); setDoors(arr(d.doors));
        const migratedCutouts = arr(d.cutouts).map(c => ({ ...c, type: "Cut Opening" }));
        setWindows([...arr(d.windows), ...migratedCutouts]);
        setColumns(arr(d.columns)); setDims(arr(d.dims));
        setBgOpacity(d.bgOpacity ?? 0.35); setBgScale(d.bgScale ?? 1);
        setBgOffset(d.bgOffset ?? { x: 0, y: 0 });
        if (d.pxPerFoot) setPxPerFoot(d.pxPerFoot);
        if (d.showDims !== undefined) setShowDims(d.showDims);
        setBgImage(null);
        setSelectedId(null); setSelType(null);
        historyRef.current = []; historyIdxRef.current = -1;
      } catch (e) { console.error("Import failed:", e); alert("Failed to import project: " + e.message); }
    };
    reader.readAsText(file);
  }, []);

  const newProject = useCallback(() => {
    setProjectName("New Club"); setNodes([]); setWalls([]); setZones([]);
    setMarkers([]); setDoors([]); setWindows([]); setDims([]);
    setBgImage(null); setBgOpacity(0.35); setBgScale(1); setBgOffset({ x: 0, y: 0 });
    setPxPerFoot(20); setShowDims(true); setShowGrid(true);
    setSelectedId(null); setSelType(null); setDrawChain(null); setDrawPolyZone(null); setCursorPos(null);
    setViewOff({ x: 0, y: 0 }); setZoom(1);
    historyRef.current = []; historyIdxRef.current = -1;
  }, []);

  const fitAll = useCallback((ns = nodes) => {
    if (!ns.length || !cvs.current) return;
    const r = cvs.current.getBoundingClientRect();
    const pad = 60;
    const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    const bx = Math.min(...xs), by = Math.min(...ys);
    const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    const z = Math.max(0.15, Math.min((r.width - pad*2) / (bw || 1), (r.height - pad*2) / (bh || 1), 4));
    const cx = bx + bw/2, cy = by + bh/2;
    setZoom(z);
    setViewOff({ x: r.width/2 - cx*z, y: r.height/2 - cy*z });
  }, [nodes]);

  const ft = useCallback((px) => {
    const v = px / pxPerFoot; const w = Math.floor(v), inc = Math.round((v - w) * 12);
    if (inc === 0) return `${w}'-0"`; if (inc === 12) return `${w + 1}'-0"`;
    return `${w}'-${inc}"`;
  }, [pxPerFoot]);
  const ftN = useCallback((px) => px / pxPerFoot, [pxPerFoot]);
  const inToPx = useCallback((inches) => (inches / 12) * pxPerFoot, [pxPerFoot]);

  const gn = useCallback((nid) => nodes.find(n => n.id === nid), [nodes]);
  const wc = useCallback((w) => { const a = gn(w.n1), b = gn(w.n2); return (a && b) ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y } : null; }, [gn]);
  const wl = useCallback((w) => { const c = wc(w); return c ? dst(c.x1, c.y1, c.x2, c.y2) : 0; }, [wc]);
  const wa = useCallback((w) => { const c = wc(w); return c ? (Math.atan2(c.y2 - c.y1, c.x2 - c.x1) * 180) / Math.PI : 0; }, [wc]);
  const findNear = useCallback((x, y, excl) => { let best = null, bd = SNAP_R; for (const n of nodes) { if (excl?.includes(n.id)) continue; const d = dst(x, y, n.x, n.y); if (d < bd) { best = n; bd = d; } } return best; }, [nodes]);
  const wallsAt = useCallback((nid) => walls.filter(w => w.n1 === nid || w.n2 === nid), [walls]);

  // Snap for dimension tool: snaps to any significant point on canvas
  const findDimSnap = useCallback((x, y) => {
    let best = null, bd = SNAP_R * 1.5; // slightly larger snap radius
    const check = (px, py) => { const d = dst(x, y, px, py); if (d < bd) { best = { x: px, y: py }; bd = d; } };
    nodes.forEach(n => check(n.x, n.y));
    walls.forEach(w => { const c = wc(w); if (c) check((c.x1+c.x2)/2, (c.y1+c.y2)/2); }); // wall midpoints
    doors.forEach(d => check(d.x, d.y));
    windows.forEach(w => check(w.x, w.y));
    columns.forEach(c => check(c.x, c.y));
    markers.forEach(m => check(m.x, m.y));
    zones.forEach(z => { if (z.points) z.points.forEach(pt => check(pt.x, pt.y)); });
    return best;
  }, [nodes, walls, doors, windows, columns, markers, zones, wc]);

  // Snap a point to the nearest wall — returns {x, y, angle, wallId} or null
  const snapToWall = useCallback((px, py, maxDist = 20) => {
    let best = null, bestD = maxDist;
    for (const w of walls) {
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
        best = { x: projX, y: projY, angle, wallId: w.id };
      }
    }
    return best;
  }, [walls, wc]);

  const wallKindForTool = (t) => t === "wall_demo" ? "demo" : t === "wall_new" ? "new" : t === "wall_pony" ? "pony" : "existing";
  const isWallTool = (t) => t === "wall" || t === "wall_demo" || t === "wall_new" || t === "wall_pony";

  // Save/Load
  const save = useCallback(async () => {
    const payload = JSON.stringify({ projectName, nodes, walls, zones, markers, doors, windows, columns, dims, bgOpacity, bgScale, bgOffset, pxPerFoot, showDims });
    try {
      if (window.storage) { await window.storage.set("testfit:v4", payload); }
      else { localStorage.setItem("testfit:v4", payload); }
    } catch (e) { console.warn("Auto-save failed:", e); }
  }, [projectName, nodes, walls, zones, markers, doors, windows, columns, dims, bgOpacity, bgScale, bgOffset, pxPerFoot, showDims]);
  const load = useCallback(async () => {
    try {
      let raw = null;
      if (window.storage) { const r = await window.storage.get("testfit:v4"); raw = r?.value ?? null; }
      else { raw = localStorage.getItem("testfit:v4"); }
      if (raw) {
        const d = JSON.parse(raw);
        const migratedCutouts = (d.cutouts || []).map(c => ({ ...c, type: "Cut Opening" }));
        const loadedNodes = d.nodes || [];
        setProjectName(d.projectName || "New Club"); setNodes(loadedNodes); setWalls(d.walls || []); setZones(d.zones || []); setMarkers(d.markers || []); setDoors(d.doors || []); setWindows([...(d.windows || []), ...migratedCutouts]); setColumns(d.columns || []); setDims(d.dims || []); setBgOpacity(d.bgOpacity ?? 0.35); setBgScale(d.bgScale ?? 1); setBgOffset(d.bgOffset ?? { x: 0, y: 0 }); if (d.pxPerFoot) setPxPerFoot(d.pxPerFoot); if (d.showDims !== undefined) setShowDims(d.showDims);
        if (loadedNodes.length) setTimeout(() => fitAll(loadedNodes), 50);
      }
    } catch (e) { console.warn("Auto-load failed:", e); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(save, 800); return () => clearTimeout(t); }, [save]);
  
  // Sync activeComponentType with activeSpecLayer when layer changes
  useEffect(() => {
    if (mode === "itmep" && SPEC_COMPONENTS[activeSpecLayer]) {
      const componentsInLayer = Object.keys(SPEC_COMPONENTS[activeSpecLayer]);
      if (!componentsInLayer.includes(activeComponentType)) {
        setActiveComponentType(componentsInLayer[0]);
      }
    }
  }, [mode, activeSpecLayer, activeComponentType]);

  const s2c = useCallback((cx, cy) => { const r = cvs.current?.getBoundingClientRect(); if (!r) return { x: 0, y: 0 }; return { x: (cx - r.left - viewOff.x) / zoom, y: (cy - r.top - viewOff.y) / zoom }; }, [viewOff, zoom]);

  // Commit a wall segment in the chain
  const commitWallSegment = useCallback((fromNodeId, fromX, fromY, toX, toY, kind) => {
    let n1Id = fromNodeId;
    const newNodes = [];
    if (!n1Id) { const nn = { id: uid(), x: fromX, y: fromY }; newNodes.push(nn); n1Id = nn.id; }
    const nearEnd = findNear(toX, toY, [n1Id]);
    let n2Id = nearEnd ? nearEnd.id : null;
    const isNewEndNode = !n2Id;
    if (!n2Id) { const nn = { id: uid(), x: toX, y: toY }; newNodes.push(nn); n2Id = nn.id; }
    if (n1Id !== n2Id) {
      if (newNodes.length) setNodes(prev => [...prev, ...newNodes]);
      const w = { id: uid(), n1: n1Id, n2: n2Id, kind };
      if (wallMaterial) w.material = wallMaterial;
      if (wallPaintColor !== "#E8E0D0") w.paintColor = wallPaintColor;
      if (wallPaintFinish) w.paintFinish = wallPaintFinish;
      if (wallNotes) w.notes = wallNotes;
      if (kind === "pony") { w.ponyHeight = ponyHeight; w.ponyDepth = ponyDepth; }

      // Helper: if a point is on a wall body (not at its endpoints), split that wall at nodeId.
      const splitWallAt = (px, py, nodeId, wallList) => {
        for (let i = 0; i < wallList.length; i++) {
          const ew = wallList[i];
          const ec = wc(ew);
          if (!ec) continue;
          const edx = ec.x2 - ec.x1, edy = ec.y2 - ec.y1, els = edx*edx + edy*edy;
          if (els < 1) continue;
          const t = ((px - ec.x1)*edx + (py - ec.y1)*edy) / els;
          if (t < 0.02 || t > 0.98) continue;
          const projX = ec.x1 + t*edx, projY = ec.y1 + t*edy;
          if (dst(px, py, projX, projY) > 4) continue;
          // Split: replace ew at index i with two halves
          const a = { ...ew, id: uid(), n2: nodeId };
          const b = { ...ew, id: uid(), n1: nodeId };
          return [...wallList.slice(0, i), a, b, ...wallList.slice(i + 1)];
        }
        return null; // no split
      };

      // Check if start or end nodes (when newly created) land on an existing wall body.
      const isNewStartNode = !fromNodeId;
      if (isNewEndNode || isNewStartNode) {
        setWalls(prev => {
          let list = prev;
          if (isNewStartNode) { const r = splitWallAt(fromX, fromY, n1Id, list); if (r) list = r; }
          if (isNewEndNode)   { const r = splitWallAt(toX,   toY,   n2Id, list); if (r) list = r; }
          return [...list, w];
        });
      } else {
        setWalls(prev => [...prev, w]);
      }
      return { nodeId: n2Id, x: nearEnd ? nearEnd.x : toX, y: nearEnd ? nearEnd.y : toY };
    }
    return null;
  }, [findNear, wc, wallMaterial, wallPaintColor, wallPaintFinish, wallNotes, ponyHeight, ponyDepth]);

  // Hit test
  const hitTest = useCallback((pos) => {
    // Dim strings are always selectable in any mode
    for (let i = dims.length - 1; i >= 0; i--) {
      const d = dims[i];
      const dx2 = d.x2 - d.x1, dy2 = d.y2 - d.y1, dlen = Math.hypot(dx2, dy2);
      if (dlen < 1) continue;
      const nx = -dy2 / dlen, ny = dx2 / dlen;
      const dlx1 = d.x1 + nx * d.offset, dly1 = d.y1 + ny * d.offset;
      const dlx2 = d.x2 + nx * d.offset, dly2 = d.y2 + ny * d.offset;
      if (ptSeg(pos.x, pos.y, dlx1, dly1, dlx2, dly2) < 8) return { type: "dim", id: d.id };
    }
    // Filter hits based on current mode
    if (mode === "build") {
      // In BUILD mode, only allow building objects
      for (const n of nodes) if (dst(pos.x, pos.y, n.x, n.y) < 10) return { type: "node", id: n.id };
      for (let i = columns.length - 1; i >= 0; i--) { const col = columns[i]; const r = inToPx(col.size) / 2; if (dst(pos.x, pos.y, col.x, col.y) < r + 4) return { type: "column", id: col.id }; }
      for (let i = markers.length - 1; i >= 0; i--) { const p = markers[i]; if (p.layer === "power" && (p.componentType?.startsWith("outlet_") || p.componentType?.startsWith("switch_") || p.componentType === "panel_board") && dst(pos.x, pos.y, p.x, p.y) < 14) return { type: "marker", id: p.id }; }
      for (let i = doors.length - 1; i >= 0; i--) { const d = doors[i]; if (dst(pos.x, pos.y, d.x, d.y) < inToPx(d.width) / 2 + 4) return { type: "door", id: d.id }; }
      for (let i = windows.length - 1; i >= 0; i--) { const w = windows[i]; if (dst(pos.x, pos.y, w.x, w.y) < inToPx(w.width) / 2 + 4) return { type: "window", id: w.id }; }
      for (let i = walls.length - 1; i >= 0; i--) { const w = walls[i], c = wc(w); if (c && ptSeg(pos.x, pos.y, c.x1, c.y1, c.x2, c.y2) < 10) return { type: "wall", id: w.id }; }
    } else if (mode === "zone") {
      // In ZONE mode — check zone vertices first, then edges, then zone bodies
      for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i];
        if (z.points && (selectedId === z.id || selectedIds.includes(z.id))) {
          for (let vi = 0; vi < z.points.length; vi++) {
            if (dst(pos.x, pos.y, z.points[vi].x, z.points[vi].y) < 10) return { type: "zone-vertex", id: z.id, vertexIndex: vi };
          }
        }
      }
      // Check zone edges for dragging
      for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i];
        if (z.points && (selectedId === z.id || selectedIds.includes(z.id))) {
          for (let ei = 0; ei < z.points.length; ei++) {
            const ej = (ei + 1) % z.points.length;
            if (ptSeg(pos.x, pos.y, z.points[ei].x, z.points[ei].y, z.points[ej].x, z.points[ej].y) < 8) return { type: "zone-edge", id: z.id, edgeIndex: ei };
          }
        }
      }
      for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i];
        if (z.points) { if (pointInPoly(pos.x, pos.y, z.points)) return { type: "zone", id: z.id }; }
        else { if (pos.x >= z.x && pos.x <= z.x + z.w && pos.y >= z.y && pos.y <= z.y + z.h) return { type: "zone", id: z.id }; }
      }
    } else if (mode === "itmep") {
      // In IT/MEP mode, only allow markers
      for (let i = markers.length - 1; i >= 0; i--) { const p = markers[i]; if (dst(pos.x, pos.y, p.x, p.y) < 14) return { type: "marker", id: p.id }; }
    }
    return null;
  }, [mode, nodes, walls, zones, markers, doors, windows, columns, dims, wc, inToPx, selectedId, selectedIds]);

  const onDown = useCallback((e) => {
    // Pan with middle click or spacebar held
    if (e.button === 1 || (e.button === 0 && (tool === "pan" || spaceHeld))) {
      setPanning(true); setPanSt({ x: e.clientX - viewOff.x, y: e.clientY - viewOff.y }); return;
    }
    const pos = s2c(e.clientX, e.clientY);
    let sx = sn(pos.x, snapGrid), sy = sn(pos.y, snapGrid);

    // Wall tools: click-to-place chain
    if (isWallTool(tool)) {
      // Double-click finishes the chain
      if (e.detail === 2 && drawChain) {
        setDrawChain(null); setCursorPos(null); setDimInput(""); return;
      }
      if (e.shiftKey && drawChain) {
        const dx = sx - drawChain.lastX, dy = sy - drawChain.lastY;
        const angle = Math.atan2(dy, dx);
        const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.hypot(dx, dy);
        sx = sn(drawChain.lastX + Math.cos(snapped) * dist, snapGrid);
        sy = sn(drawChain.lastY + Math.sin(snapped) * dist, snapGrid);
      }
      const near = findNear(sx, sy, drawChain?.lastNodeId ? [drawChain.lastNodeId] : []);
      // If no nearby node, snap to wall body if cursor is close
      const wallSnap = !near ? snapToWall(sx, sy, SNAP_R) : null;
      const tx = near ? near.x : wallSnap ? wallSnap.x : sx;
      const ty = near ? near.y : wallSnap ? wallSnap.y : sy;

      if (!drawChain) {
        // First click: start chain — also snap to wall body for start point
        const startNode = findNear(sx, sy);
        const startWallSnap = !startNode ? snapToWall(sx, sy, SNAP_R) : null;
        setDrawChain({ lastNodeId: startNode?.id || null, lastX: startNode?.x ?? (startWallSnap?.x ?? sx), lastY: startNode?.y ?? (startWallSnap?.y ?? sy) });
      } else {
        // Subsequent click: commit segment and continue
        if (dst(drawChain.lastX, drawChain.lastY, tx, ty) > 8) {
          const result = commitWallSegment(drawChain.lastNodeId, drawChain.lastX, drawChain.lastY, tx, ty, wallKindForTool(tool));
          if (result) {
            // If we connected to an existing node, finish the chain and switch to select
            if (near) {
              setDrawChain(null);
              setCursorPos(null);
              setDimInput("");
              setT("select");
            } else {
              setDrawChain({ lastNodeId: result.nodeId, lastX: result.x, lastY: result.y });
            }
          }
        }
      }
      return;
    }
    if (tool === "zone") {
      const zt = ZONE_LIBRARY[activeZoneType]; const nid = uid();
      const pts = [{ x: sx, y: sy }, { x: sx + zt.defaultW, y: sy }, { x: sx + zt.defaultW, y: sy + zt.defaultH }, { x: sx, y: sy + zt.defaultH }];
      setZones(p => [...p, { id: nid, type: activeZoneType, points: pts, label: zt.name, notes: zoneNotes, paintColor: zonePaintColor, paintFinish: zonePaintFinish }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("zone"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "marker") {
      const nid = uid();
      const compData = SPEC_COMPONENTS[activeSpecLayer][activeComponentType];
      setMarkers(p => [...p, { id: nid, layer: activeSpecLayer, componentType: activeComponentType, x: sx, y: sy, label: compData.name, notes: markerNotes }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("marker"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "door") {
      const nid = uid();
      const snap = snapToWall(pos.x, pos.y);
      const dx = snap ? snap.x : sx, dy = snap ? snap.y : sy, da = snap ? snap.angle : 0;
      setDoors(p => [...p, { id: nid, x: dx, y: dy, angle: da, width: doorWidth, flipped: doorFlipped, hingeRight: doorHingeRight, doorType }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("door"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "window") {
      const nid = uid();
      const snap = snapToWall(pos.x, pos.y);
      const wx = snap ? snap.x : sx, wy = snap ? snap.y : sy, wa2 = snap ? snap.angle : 0;
      setWindows(p => [...p, { id: nid, x: wx, y: wy, angle: wa2, width: windowWidth, height: windowHeight, sill: windowSill, type: windowType }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("window"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "column") {
      const nid = uid();
      setColumns(p => [...p, { id: nid, x: sx, y: sy, size: columnSize, shape: columnShape, label: columnLabel, notes: columnNotes }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("column"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "outlet") {
      const nid = uid();
      const isCeiling = outletType === "outlet_ceiling";
      const wallSnap = !isCeiling; // outlets, switches, and panel all snap to walls
      const snap = wallSnap ? snapToWall(pos.x, pos.y, Infinity) : null;
      const ox = snap ? snap.x : sx, oy = snap ? snap.y : sy;
      const angleRad = snap ? (snap.angle * Math.PI / 180) : 0;
      setMarkers(p => [...p, { id: nid, layer: "power", componentType: outletType, x: ox, y: oy, angle: angleRad, label: SPEC_COMPONENTS.power[outletType].name, notes: "" }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("marker"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "dim") {
      const snap = findDimSnap(pos.x, pos.y);
      const px = snap ? snap.x : sx, py = snap ? snap.y : sy;
      if (!drawDim) {
        setDrawDim({ x1: px, y1: py });
      } else if (!("x2" in drawDim)) {
        if (Math.hypot(px - drawDim.x1, py - drawDim.y1) < 4) return;
        setDrawDim({ ...drawDim, x2: px, y2: py });
      } else {
        const ddx = drawDim.x2 - drawDim.x1, ddy = drawDim.y2 - drawDim.y1;
        const dlen = Math.hypot(ddx, ddy);
        if (dlen < 1) { setDrawDim(null); return; }
        const nnx = -ddy / dlen, nny = ddx / dlen;
        const off = (pos.x - drawDim.x1) * nnx + (pos.y - drawDim.y1) * nny;
        setDims(prev => [...prev, { id: uid(), x1: drawDim.x1, y1: drawDim.y1, x2: drawDim.x2, y2: drawDim.y2, offset: off }]);
        if (e.shiftKey) { setDrawDim(null); } // Shift: keep drawing more dims from fresh start
        else { setDrawDim(null); setT("select"); }
      }
      return;
    }
    if (tool === "calibrate") {
      if (!calibrationLine) {
        // First click: set p1
        setCalibrationLine({ p1: { x: pos.x, y: pos.y }, p2: null });
      } else if (calibrationLine.p1 && !calibrationLine.p2) {
        // Second click: set p2
        setCalibrationLine({ ...calibrationLine, p2: { x: pos.x, y: pos.y } });
        setT("select"); // Switch back to select after drawing line
      }
      return;
    }
    if (tool === "select") {
      const hit = hitTest(pos);
      
      // Shift+Click: toggle object in/out of selection
      if (hit && e.shiftKey && !e.altKey) {
        const isSelected = selectedIds.includes(hit.id);
        if (isSelected) {
          setSelectedIds(prev => prev.filter(id => id !== hit.id));
          if (selectedId === hit.id) {
            const remaining = selectedIds.filter(id => id !== hit.id);
            setSelectedId(remaining[0] || null);
            if (remaining.length > 0) {
              const rid = remaining[0];
              const rType = nodes.find(n => n.id === rid) ? "node" : walls.find(w => w.id === rid) ? "wall" : zones.find(z => z.id === rid) ? "zone" : markers.find(m => m.id === rid) ? "marker" : doors.find(d => d.id === rid) ? "door" : windows.find(w => w.id === rid) ? "window" : columns.find(c => c.id === rid) ? "column" : null;
              setSelType(rType);
            } else { setSelType(null); }
          }
        } else {
          setSelectedIds(prev => [...prev, hit.id]);
          setSelectedId(hit.id);
          setSelType(hit.type);
        }
        return;
      }
      
      if (hit && e.altKey) {
        // Option+Click: duplicate the hit object
        const nid = uid();
        if (hit.type === "zone") {
          const src = zones.find(z => z.id === hit.id);
          if (src) {
            const dup = src.points
              ? { ...src, id: nid, points: src.points.map(p => ({ ...p })) }
              : { ...src, id: nid };
            setZones(p => [...p, dup]);
            if (src.points) {
              const c = polyCentroid(src.points);
              setSelectedId(nid); setSelType("zone"); setDrag({ type: "zone", id: nid, ox: pos.x - c.x, oy: pos.y - c.y, lastX: sn(c.x, snapGrid), lastY: sn(c.y, snapGrid) });
            } else {
              setSelectedId(nid); setSelType("zone"); setDrag({ type: "zone", id: nid, ox: pos.x - src.x, oy: pos.y - src.y });
            }
          }
        } else if (hit.type === "door") {
          const src = doors.find(d => d.id === hit.id);
          if (src) { setDoors(p => [...p, { ...src, id: nid }]); setSelectedId(nid); setSelType("door"); setDrag({ type: "door", id: nid, ox: pos.x - src.x, oy: pos.y - src.y }); }
        } else if (hit.type === "window") {
          const src = windows.find(w => w.id === hit.id);
          if (src) { setWindows(p => [...p, { ...src, id: nid }]); setSelectedId(nid); setSelType("window"); setDrag({ type: "window", id: nid, ox: pos.x - src.x, oy: pos.y - src.y }); }
        } else if (hit.type === "column") {
          const src = columns.find(c => c.id === hit.id);
          if (src) { setColumns(p => [...p, { ...src, id: nid }]); setSelectedId(nid); setSelType("column"); setDrag({ type: "column", id: nid, ox: pos.x - src.x, oy: pos.y - src.y }); }
        } else if (hit.type === "marker") {
          const src = markers.find(m => m.id === hit.id);
          if (src) { setMarkers(p => [...p, { ...src, id: nid }]); setSelectedId(nid); setSelType("marker"); setDrag({ type: "marker", id: nid, ox: pos.x - src.x, oy: pos.y - src.y }); }
        }
        return;
      }
      if (hit) {
        // Check if we're dragging multiple objects
        const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(hit.id);
        
        if (isMultiDrag) {
          // Multi-object drag: capture initial positions of all selected objects
          const initialPositions = [];
          selectedIds.forEach(id => {
            const node = nodes.find(n => n.id === id);
            if (node) {
              initialPositions.push({ id, type: "node", x: node.x, y: node.y });
              return;
            }
            const zone = zones.find(z => z.id === id);
            if (zone) {
              if (zone.points) {
                const c = polyCentroid(zone.points);
                initialPositions.push({ id, type: "zone", centroid: c, points: zone.points.map(p => ({ ...p })) });
              } else {
                initialPositions.push({ id, type: "zone", x: zone.x, y: zone.y });
              }
              return;
            }
            const marker = markers.find(m => m.id === id);
            if (marker) {
              initialPositions.push({ id, type: "marker", x: marker.x, y: marker.y });
              return;
            }
            const door = doors.find(d => d.id === id);
            if (door) {
              initialPositions.push({ id, type: "door", x: door.x, y: door.y });
              return;
            }
            const window = windows.find(w => w.id === id);
            if (window) {
              initialPositions.push({ id, type: "window", x: window.x, y: window.y });
              return;
            }
            const column = columns.find(c => c.id === id);
            if (column) {
              initialPositions.push({ id, type: "column", x: column.x, y: column.y });
            }
          });
          
          setDrag({ type: "multi", objects: initialPositions, startX: pos.x, startY: pos.y, lastX: pos.x, lastY: pos.y });
          setSelectedId(hit.id); setSelType(hit.type);
        } else {
          // Clear multi-selection when clicking on a single object (unless shift is held)
          if (!e.shiftKey) {
            setSelectedIds([hit.id]);
          }
          setSelectedId(hit.id); setSelType(hit.type);
          if (hit.type === "node") {
            if (e.detail === 2) {
              // Double-click node: merge two walls by removing this node
              const connWalls = walls.filter(w => w.n1 === hit.id || w.n2 === hit.id);
              if (connWalls.length === 2) {
                const [w1, w2] = connWalls;
                // Find the two outer nodes (not the one being removed)
                const outerN1 = w1.n1 === hit.id ? w1.n2 : w1.n1;
                const outerN2 = w2.n1 === hit.id ? w2.n2 : w2.n1;
                // Keep w1, update it to span outerN1→outerN2, remove w2 and the node
                setWalls(p => p.filter(w => w.id !== w2.id).map(w => w.id === w1.id ? { ...w, n1: outerN1, n2: outerN2 } : w));
                setNodes(p => p.filter(n => n.id !== hit.id));
                setSelectedId(w1.id); setSelType("wall");
              }
            } else {
              // Find doors/windows on walls connected to this node, with parametric position
              const nodeAttached = [];
              walls.forEach(w => {
                if (w.n1 !== hit.id && w.n2 !== hit.id) return;
                const c = wc(w);
                if (!c) return;
                const isN1 = w.n1 === hit.id;
                [...doors, ...windows].forEach(item => {
                  if (ptSeg(item.x, item.y, c.x1, c.y1, c.x2, c.y2) < 8) {
                    const wdx = c.x2 - c.x1, wdy = c.y2 - c.y1, wlen2 = wdx * wdx + wdy * wdy;
                    const t = wlen2 > 0 ? ((item.x - c.x1) * wdx + (item.y - c.y1) * wdy) / wlen2 : 0;
                    if (!nodeAttached.some(a => a.id === item.id)) {
                      nodeAttached.push({ id: item.id, wallId: w.id, isN1, t, isDoor: doors.some(d => d.id === item.id) });
                    }
                  }
                });
              });
              setDrag({ type: "node", id: hit.id, nodeAttached });
            }
          }
          else if (hit.type === "wall") {
          if (e.detail === 2) {
            // Double-click wall: split wall by inserting a new node at click point
            const w = walls.find(ww => ww.id === hit.id), c = wc(w);
            if (c) {
              // Project click onto wall segment to get exact position
              const wdx = c.x2 - c.x1, wdy = c.y2 - c.y1, wlen2 = wdx * wdx + wdy * wdy;
              const t = wlen2 > 0 ? Math.max(0.05, Math.min(0.95, ((pos.x - c.x1) * wdx + (pos.y - c.y1) * wdy) / wlen2)) : 0.5;
              const newX = sn(c.x1 + t * wdx, snapGrid), newY = sn(c.y1 + t * wdy, snapGrid);
              const newNodeId = uid(), newWallId = uid();
              // Create new node at the split point
              setNodes(p => [...p, { id: newNodeId, x: newX, y: newY }]);
              // Original wall keeps n1→newNode, new wall goes newNode→n2
              const origN2 = w.n2;
              setWalls(p => [...p.map(ww => ww.id === w.id ? { ...ww, n2: newNodeId } : ww), { id: newWallId, n1: newNodeId, n2: origN2, kind: w.kind }]);
              setSelectedId(newNodeId); setSelType("node");
            }
          } else {
            const w = walls.find(ww => ww.id === hit.id), c = wc(w);
            if (c) {
              const n1 = gn(w.n1), n2 = gn(w.n2);
              if (n1 && n2) {
                // Find doors/windows attached to this wall
                const attachedItems = [];
                [...doors, ...windows].forEach(item => {
                  if (ptSeg(item.x, item.y, c.x1, c.y1, c.x2, c.y2) < 8) {
                    attachedItems.push({ id: item.id, x: item.x, y: item.y, isDoor: doors.some(d => d.id === item.id) });
                  }
                });
                setDrag({ type: "wall", id: hit.id, ox: pos.x, oy: pos.y, n1x: n1.x, n1y: n1.y, n2x: n2.x, n2y: n2.y, attached: attachedItems });
              }
            }
          }
        }
        else if (hit.type === "zone-vertex") {
          const z = zones.find(zz => zz.id === hit.id);
          if (z && z.points) {
            if (e.detail === 2 && z.points.length > 3) {
              // Double-click vertex: remove it (keep at least 3 points)
              setZones(p => p.map(zz => zz.id === hit.id ? { ...zz, points: zz.points.filter((_, i) => i !== hit.vertexIndex) } : zz));
            } else if (e.detail < 2) {
              const vt = z.points[hit.vertexIndex];
              setDrag({ type: "zone-vertex", id: hit.id, vertexIndex: hit.vertexIndex, ox: pos.x - vt.x, oy: pos.y - vt.y });
            }
          }
        }
        else if (hit.type === "zone-edge") {
          const z = zones.find(zz => zz.id === hit.id);
          if (z && z.points) {
            if (e.detail === 2) {
              // Double-click on edge: insert a vertex
              const ei = hit.edgeIndex, ej = (ei + 1) % z.points.length;
              const newPt = { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) };
              const newPoints = [...z.points];
              newPoints.splice(ej, 0, newPt);
              setZones(p => p.map(zz => zz.id === hit.id ? { ...zz, points: newPoints } : zz));
            } else {
              const ei = hit.edgeIndex, ej = (ei + 1) % z.points.length;
              const p1 = z.points[ei], p2 = z.points[ej];
              const edx = p2.x - p1.x, edy = p2.y - p1.y;
              const elen = Math.hypot(edx, edy) || 1;
              setDrag({ type: "zone-edge", id: hit.id, edgeIndex: ei, ox: pos.x, oy: pos.y, p1x: p1.x, p1y: p1.y, p2x: p2.x, p2y: p2.y, nx: -edy / elen, ny: edx / elen });
            }
          }
        }
        else if (hit.type === "zone") {
          const z = zones.find(zz => zz.id === hit.id);
          if (!z) { /* zone deleted between hit test and drag */ }
          else if (e.detail === 2 && z.points) {
            // Double-click on zone: add a vertex on nearest edge
            let bestDist = Infinity, bestIdx = -1;
            for (let i = 0; i < z.points.length; i++) {
              const j = (i + 1) % z.points.length;
              const d = ptSeg(pos.x, pos.y, z.points[i].x, z.points[i].y, z.points[j].x, z.points[j].y);
              if (d < bestDist) { bestDist = d; bestIdx = j; }
            }
            if (bestDist < 15) {
              const newPt = { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) };
              const newPoints = [...z.points];
              newPoints.splice(bestIdx, 0, newPt);
              setZones(p => p.map(zz => zz.id === hit.id ? { ...zz, points: newPoints } : zz));
            }
          }
          else if (z.points) {
            const c = polyCentroid(z.points);
            setDrag({ type: "zone", id: hit.id, ox: pos.x - c.x, oy: pos.y - c.y, lastX: sn(pos.x - (pos.x - c.x), snapGrid), lastY: sn(pos.y - (pos.y - c.y), snapGrid) });
          } else {
            setDrag({ type: "zone", id: hit.id, ox: pos.x - z.x, oy: pos.y - z.y });
          }
        }
          else if (hit.type === "marker") { const p = markers.find(pp => pp.id === hit.id); if (p) setDrag({ type: "marker", id: hit.id, ox: pos.x - p.x, oy: pos.y - p.y }); }
          else if (hit.type === "door") { const d = doors.find(dd => dd.id === hit.id); if (d) setDrag({ type: "door", id: hit.id, ox: pos.x - d.x, oy: pos.y - d.y }); }
          else if (hit.type === "window") { const w = windows.find(ww => ww.id === hit.id); if (w) setDrag({ type: "window", id: hit.id, ox: pos.x - w.x, oy: pos.y - w.y }); }
          else if (hit.type === "column") { const c = columns.find(cc => cc.id === hit.id); if (c) setDrag({ type: "column", id: hit.id, ox: pos.x - c.x, oy: pos.y - c.y }); }
          else if (hit.type === "dim") { setDrag({ type: "dim", id: hit.id }); }
        }
      } else {
        // No hit — Alt+drag moves underlay image, otherwise start marquee selection
        if (e.altKey && bgImage) {
          setDrag({ type: "underlay", ox: pos.x - bgOffset.x, oy: pos.y - bgOffset.y });
        } else {
          // Start marquee selection
          setMarquee({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
          if (!e.shiftKey) {
            setSelectedId(null); setSelType(null); setSelectedIds([]);
          }
        }
      }
    }
  }, [tool, activeZoneType, activeSpecLayer, s2c, findNear, findDimSnap, hitTest, walls, wc, zones, markers, doors, windows, columns, viewOff, drawChain, commitWallSegment, spaceHeld, doorWidth, windowWidth, columnSize, columnShape, snapToWall, snapGrid, activeComponentType, selectedIds, bgImage, bgOffset, gn, calibrationLine, drawDim, dims, nodes, pxPerFoot]);

  const onMove = useCallback((e) => {
    if (panning && panSt) { setViewOff({ x: e.clientX - panSt.x, y: e.clientY - panSt.y }); return; }
    const pos = s2c(e.clientX, e.clientY);
    let sx = sn(pos.x, snapGrid), sy = sn(pos.y, snapGrid);

    // Wall chain: track cursor for preview
    if (isWallTool(tool)) {
      if (e.shiftKey && drawChain) {
        const dx = sx - drawChain.lastX, dy = sy - drawChain.lastY;
        const angle = Math.atan2(dy, dx);
        const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.hypot(dx, dy);
        sx = sn(drawChain.lastX + Math.cos(snapped) * dist, snapGrid);
        sy = sn(drawChain.lastY + Math.sin(snapped) * dist, snapGrid);
      }
      const near = findNear(sx, sy, drawChain?.lastNodeId ? [drawChain.lastNodeId] : []);
      const wallSnap2 = !near ? snapToWall(sx, sy, SNAP_R) : null;
      const cpx = near ? near.x : wallSnap2 ? wallSnap2.x : sx;
      const cpy = near ? near.y : wallSnap2 ? wallSnap2.y : sy;
      setCursorPos({ x: cpx, y: cpy, snap: !!(near || wallSnap2) });
      setHoverNid(near ? near.id : null);
      return;
    }

    // Calibration line: track cursor for preview
    if (tool === "calibrate" && calibrationLine && calibrationLine.p1 && !calibrationLine.p2) {
      setCursorPos({ x: pos.x, y: pos.y });
      return;
    }

    // Update marquee selection while dragging
    if (marquee) {
      setMarquee(prev => ({ ...prev, endX: pos.x, endY: pos.y }));
      return;
    }

    if (tool === "select" && !drag) { const near = findNear(pos.x, pos.y); setHoverNid(near ? near.id : null); }
    if (tool === "dim") { const dsnap = findDimSnap(pos.x, pos.y); setGhostPos(dsnap ? { x: dsnap.x, y: dsnap.y, snapped: true } : { x: pos.x, y: pos.y, snapped: false }); }
    if (tool === "zone" || tool === "marker" || tool === "column") { setGhostPos({ x: sx, y: sy }); }
    if (tool === "door" || tool === "window") {
      const snap = snapToWall(pos.x, pos.y);
      if (snap) setGhostPos({ x: snap.x, y: snap.y, angle: snap.angle, snapped: true });
      else setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
    }
    if (tool === "outlet") {
      if (outletType === "outlet_ceiling") {
        setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
      } else {
        // all wall-mounted types (outlets, switches, panel) snap to walls
        const snap = snapToWall(pos.x, pos.y, Infinity);
        if (snap) setGhostPos({ x: snap.x, y: snap.y, angle: snap.angle * Math.PI / 180, snapped: true });
        else setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
      }
    }

    if (drag) {
      if (drag.type === "multi") {
        // Multi-object drag
        const dx = sn(pos.x, snapGrid) - sn(drag.lastX, snapGrid);
        const dy = sn(pos.y, snapGrid) - sn(drag.lastY, snapGrid);
        
        if (dx || dy) {
          drag.objects.forEach(obj => {
            if (obj.type === "node") {
              setNodes(prev => prev.map(n => n.id === obj.id ? { ...n, x: n.x + dx, y: n.y + dy } : n));
            } else if (obj.type === "zone") {
              if (obj.points) {
                setZones(p => p.map(z => z.id === obj.id ? { ...z, points: z.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) } : z));
              } else {
                setZones(p => p.map(z => z.id === obj.id ? { ...z, x: z.x + dx, y: z.y + dy } : z));
              }
            } else if (obj.type === "marker") {
              setMarkers(p => p.map(m => m.id === obj.id ? { ...m, x: m.x + dx, y: m.y + dy } : m));
            } else if (obj.type === "door") {
              setDoors(p => p.map(d => d.id === obj.id ? { ...d, x: d.x + dx, y: d.y + dy } : d));
            } else if (obj.type === "window") {
              setWindows(p => p.map(w => w.id === obj.id ? { ...w, x: w.x + dx, y: w.y + dy } : w));
            } else if (obj.type === "column") {
              setColumns(p => p.map(c => c.id === obj.id ? { ...c, x: c.x + dx, y: c.y + dy } : c));
            }
          });
          setDrag(d => ({ ...d, lastX: pos.x, lastY: pos.y }));
        }
      } else if (drag.type === "node") {
        const near = findNear(sx, sy, [drag.id]);
        const newNodeX = near ? near.x : sx, newNodeY = near ? near.y : sy;
        setNodes(prev => prev.map(n => n.id === drag.id ? { ...n, x: newNodeX, y: newNodeY } : n));
        setHoverNid(near ? near.id : null);
        // Reposition attached doors/windows along their walls
        if (drag.nodeAttached?.length) {
          drag.nodeAttached.forEach(att => {
            const w = walls.find(ww => ww.id === att.wallId);
            if (!w) return;
            // Get the current wall endpoints (the dragged node has new position)
            const a = w.n1 === drag.id ? { x: newNodeX, y: newNodeY } : gn(w.n1);
            const b = w.n2 === drag.id ? { x: newNodeX, y: newNodeY } : gn(w.n2);
            if (!a || !b) return;
            const nx = a.x + att.t * (b.x - a.x), ny = a.y + att.t * (b.y - a.y);
            const newAngle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
            if (att.isDoor) setDoors(p => p.map(d => d.id === att.id ? { ...d, x: nx, y: ny, angle: newAngle } : d));
            else setWindows(p => p.map(ww => ww.id === att.id ? { ...ww, x: nx, y: ny, angle: newAngle } : ww));
          });
        }
      } else if (drag.type === "wall") {
        const w = walls.find(ww => ww.id === drag.id);
        if (w) {
          const dx = pos.x - drag.ox;
          const dy = pos.y - drag.oy;
          const n1NewX = sn(drag.n1x + dx, snapGrid);
          const n1NewY = sn(drag.n1y + dy, snapGrid);
          const n2NewX = sn(drag.n2x + dx, snapGrid);
          const n2NewY = sn(drag.n2y + dy, snapGrid);
          // Actual snapped delta for attached items
          const sdx = n1NewX - drag.n1x, sdy = n1NewY - drag.n1y;
          setNodes(prev => prev.map(n => {
            if (n.id === w.n1) return { ...n, x: n1NewX, y: n1NewY };
            if (n.id === w.n2) return { ...n, x: n2NewX, y: n2NewY };
            return n;
          }));
          // Move attached doors/windows
          if (drag.attached?.length) {
            drag.attached.forEach(item => {
              if (item.isDoor) setDoors(p => p.map(d => d.id === item.id ? { ...d, x: item.x + sdx, y: item.y + sdy } : d));
              else setWindows(p => p.map(ww => ww.id === item.id ? { ...ww, x: item.x + sdx, y: item.y + sdy } : ww));
            });
          }
        }
      } else if (drag.type === "zone-edge") {
        const dx = pos.x - drag.ox, dy = pos.y - drag.oy;
        // Project movement onto edge normal for perpendicular drag
        const proj = dx * drag.nx + dy * drag.ny;
        const mx = sn(drag.nx * proj, snapGrid), my = sn(drag.ny * proj, snapGrid);
        const ei = drag.edgeIndex;
        setZones(p => p.map(zz => {
          if (zz.id !== drag.id) return zz;
          const ej = (ei + 1) % zz.points.length;
          return { ...zz, points: zz.points.map((pt, i) => {
            if (i === ei) return { x: drag.p1x + mx, y: drag.p1y + my };
            if (i === ej) return { x: drag.p2x + mx, y: drag.p2y + my };
            return pt;
          }) };
        }));
      } else if (drag.type === "zone-vertex") {
        const newX = sn(pos.x - drag.ox, snapGrid), newY = sn(pos.y - drag.oy, snapGrid);
        setZones(p => p.map(zz => zz.id === drag.id ? { ...zz, points: zz.points.map((pt, i) => i === drag.vertexIndex ? { x: newX, y: newY } : pt) } : zz));
      } else if (drag.type === "zone") {
        const z = zones.find(zz => zz.id === drag.id);
        if (z?.points) {
          const dx = sn(pos.x - drag.ox, snapGrid) - drag.lastX;
          const dy = sn(pos.y - drag.oy, snapGrid) - drag.lastY;
          if (dx || dy) {
            setZones(p => p.map(zz => zz.id === drag.id ? { ...zz, points: zz.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) } : zz));
            setDrag(d => ({ ...d, lastX: d.lastX + dx, lastY: d.lastY + dy }));
          }
        } else {
          setZones(p => p.map(zz => zz.id === drag.id ? { ...zz, x: sn(pos.x - drag.ox, snapGrid), y: sn(pos.y - drag.oy, snapGrid) } : zz));
        }
      }
      else if (drag.type === "marker") {
        const dragMarker = markers.find(x => x.id === drag.id);
        const ct = dragMarker?.componentType;
        const isWallOutlet = dragMarker?.layer === "power" && ct && ct !== "outlet_ceiling" &&
          (ct.startsWith("outlet_") || ct.startsWith("switch_") || ct === "panel_board");
        if (isWallOutlet) {
          const snap = snapToWall(pos.x, pos.y, Infinity);
          if (snap) setMarkers(p => p.map(x => x.id === drag.id ? { ...x, x: snap.x, y: snap.y, angle: snap.angle * Math.PI / 180 } : x));
        } else {
          setMarkers(p => p.map(x => x.id === drag.id ? { ...x, x: sn(pos.x - drag.ox, snapGrid), y: sn(pos.y - drag.oy, snapGrid) } : x));
        }
      }
      else if (drag.type === "door") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const snap = snapToWall(pos.x - drag.ox, pos.y - drag.oy);
        if (snap) setDoors(p => p.map(d => d.id === drag.id ? { ...d, x: snap.x, y: snap.y, angle: snap.angle } : d));
        else setDoors(p => p.map(d => d.id === drag.id ? { ...d, x: rawX, y: rawY } : d));
      }
      else if (drag.type === "window") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const snap = snapToWall(pos.x - drag.ox, pos.y - drag.oy);
        if (snap) setWindows(p => p.map(w => w.id === drag.id ? { ...w, x: snap.x, y: snap.y, angle: snap.angle } : w));
        else setWindows(p => p.map(w => w.id === drag.id ? { ...w, x: rawX, y: rawY } : w));
      }
      else if (drag.type === "column") { setColumns(p => p.map(c => c.id === drag.id ? { ...c, x: sn(pos.x - drag.ox, snapGrid), y: sn(pos.y - drag.oy, snapGrid) } : c)); }
      else if (drag.type === "dim") {
        // Dragging the dim line adjusts offset (perpendicular distance from p1-p2 line)
        const dim = dims.find(x => x.id === drag.id);
        if (dim) {
          const ddx = dim.x2 - dim.x1, ddy = dim.y2 - dim.y1, dlen = Math.hypot(ddx, ddy);
          if (dlen > 0) {
            const nnx = -ddy / dlen, nny = ddx / dlen;
            const newOff = (pos.x - dim.x1) * nnx + (pos.y - dim.y1) * nny;
            setDims(p => p.map(x => x.id === drag.id ? { ...x, offset: newOff } : x));
          }
        }
      }
      else if (drag.type === "underlay") {
        setBgOffset({ x: pos.x - drag.ox, y: pos.y - drag.oy });
      }
      return;
    }
    if (resize) setZones(p => p.map(z => z.id !== resize.id ? z : { ...z, w: Math.max(40, sn(pos.x - z.x, snapGrid)), h: Math.max(40, sn(pos.y - z.y, snapGrid)) }));
  }, [panning, panSt, drawChain, drag, resize, s2c, findNear, findDimSnap, walls, wc, tool, snapToWall, snapGrid, marquee, calibrationLine, dims, drawDim]);

  const onUp = useCallback((e) => {
    // Finish marquee selection
    if (marquee) {
      const minX = Math.min(marquee.startX, marquee.endX);
      const maxX = Math.max(marquee.startX, marquee.endX);
      const minY = Math.min(marquee.startY, marquee.endY);
      const maxY = Math.max(marquee.startY, marquee.endY);
      
      const selected = [];
      
      // Check nodes
      if (mode === "build") {
        nodes.forEach(n => {
          if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
            selected.push({ id: n.id, type: "node" });
          }
        });
        // Add walls whose both endpoints are inside the marquee
        walls.forEach(w => {
          const c = wc(w); if (!c) return;
          const n1 = nodes.find(n => n.id === w.n1), n2 = nodes.find(n => n.id === w.n2);
          if (n1 && n2 &&
              n1.x >= minX && n1.x <= maxX && n1.y >= minY && n1.y <= maxY &&
              n2.x >= minX && n2.x <= maxX && n2.y >= minY && n2.y <= maxY) {
            selected.push({ id: w.id, type: "wall" });
          }
        });
        doors.forEach(d => {
          if (d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY) {
            selected.push({ id: d.id, type: "door" });
          }
        });
        windows.forEach(w => {
          if (w.x >= minX && w.x <= maxX && w.y >= minY && w.y <= maxY) {
            selected.push({ id: w.id, type: "window" });
          }
        });
        columns.forEach(c => {
          if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
            selected.push({ id: c.id, type: "column" });
          }
        });
      } else if (mode === "zone") {
        zones.forEach(z => {
          const zx = z.points ? polyCentroid(z.points).x : z.x + z.w / 2;
          const zy = z.points ? polyCentroid(z.points).y : z.y + z.h / 2;
          if (zx >= minX && zx <= maxX && zy >= minY && zy <= maxY) {
            selected.push({ id: z.id, type: "zone" });
          }
        });
      } else if (mode === "itmep") {
        markers.forEach(m => {
          if (m.x >= minX && m.x <= maxX && m.y >= minY && m.y <= maxY) {
            selected.push({ id: m.id, type: "marker" });
          }
        });
      }
      
      if (e.shiftKey) {
        // Add to existing selection
        const newIds = [...selectedIds];
        selected.forEach(s => {
          if (!newIds.includes(s.id)) newIds.push(s.id);
        });
        setSelectedIds(newIds);
        if (newIds.length > 0 && !selectedId) {
          setSelectedId(newIds[0]);
          setSelType(selected[0]?.type || null);
        }
      } else {
        // Replace selection
        setSelectedIds(selected.map(s => s.id));
        if (selected.length > 0) {
          setSelectedId(selected[0].id);
          setSelType(selected[0].type);
        }
      }
      
      setMarquee(null);
      return;
    }
    
    if (drag?.type === "node" && hoverNid && hoverNid !== drag.id) {
      const src = drag.id, tgt = hoverNid;
      setWalls(prev => prev.map(w => ({ ...w, n1: w.n1 === src ? tgt : w.n1, n2: w.n2 === src ? tgt : w.n2 })).filter(w => w.n1 !== w.n2));
      setNodes(prev => prev.filter(n => n.id !== src));
      setSelectedId(tgt); setSelType("node");
    }
    // No re-clipping on zone drag/vertex drag end — user controls shape manually
    setDrag(null); setResize(null); setPanning(false); setPanSt(null); setHoverNid(null);
  }, [drag, resize, hoverNid, marquee, selectedIds, selectedId, mode, nodes, walls, doors, windows, zones, markers]);

  // Smooth zoom centered on cursor
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = 1 - e.deltaY * 0.001;
    const r = cvs.current?.getBoundingClientRect();
    if (!r) return;
    // Cursor position relative to the SVG element
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
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
  }, []);

  const cost = useMemo(() => {
    const zc = zones.map(z => {
      const lib = ZONE_LIBRARY[z.type]; const t = lib.items.reduce((s, i) => s + i.qty * i.unitCost, 0);
      const sf = z.points ? Math.round(polyArea(z.points) / (pxPerFoot * pxPerFoot)) : Math.round(ftN(z.w) * ftN(z.h));
      return { id: z.id, label: z.label || lib.name, type: z.type, total: t, items: lib.items, sf };
    });
    // Component costs by type
    const pc = {}; 
    markers.forEach(p => { 
      const key = `${p.layer}_${p.componentType}`;
      const compData = SPEC_COMPONENTS[p.layer]?.[p.componentType];
      if (!compData) return; // Skip old markers without componentType
      if (!pc[key]) pc[key] = { count: 0, unitCost: compData.unitCost, name: compData.name, layer: p.layer };
      pc[key].count++;
    });
    const zt = zc.reduce((s, z) => s + z.total, 0), pt = Object.values(pc).reduce((s, p) => s + p.count * p.unitCost, 0);
    const totalSf = zc.reduce((s, z) => s + z.sf, 0);
    // Wall footage by kind
    const wallFt = { existing: 0, demo: 0, new: 0, pony: 0 };
    walls.forEach(w => { const len = wl(w); wallFt[w.kind || "existing"] += len; });
    const wallFtFormatted = {};
    Object.entries(wallFt).forEach(([k, v]) => { if (v > 0) wallFtFormatted[k] = { ft: v, label: WALL_KINDS[k].label, color: WALL_KINDS[k].color }; });
    return { zones: zc, markers: pc, total: zt + pt, totalSf, wallFt: wallFtFormatted };
  }, [zones, markers, walls, wl, ftN]);

  const selZone = useMemo(() => selType === "zone" ? zones.find(z => z.id === selectedId) : null, [selType, selectedId, zones]);
  const selMarker = useMemo(() => selType === "marker" ? markers.find(p => p.id === selectedId) : null, [selType, selectedId, markers]);
  const selWall = useMemo(() => selType === "wall" ? walls.find(w => w.id === selectedId) : null, [selType, selectedId, walls]);
  const selNode = useMemo(() => selType === "node" ? gn(selectedId) : null, [selType, selectedId, gn]);
  const selDoor = useMemo(() => selType === "door" ? doors.find(d => d.id === selectedId) : null, [selType, selectedId, doors]);
  const selWindow = useMemo(() => selType === "window" ? windows.find(w => w.id === selectedId) : null, [selType, selectedId, windows]);
  const selColumn = useMemo(() => selType === "column" ? columns.find(c => c.id === selectedId) : null, [selType, selectedId, columns]);

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
    // Only count nodes if nothing else is selected — nodes are implicit in wall selections
    if (types.size === 0) nodes.forEach(n => { if (ids.has(n.id)) types.add("node"); });
    return types.size === 1 ? [...types][0] : "mixed";
  }, [selectedIds, walls, zones, markers, doors, windows, columns, nodes]);

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
      setZones(p => p.filter(z => !idsToDelete.has(z.id)));
      setMarkers(p => p.filter(m => !idsToDelete.has(m.id)));
      setDims(p => p.filter(d => !idsToDelete.has(d.id)));
      
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
      else if (selType === "dim") setDims(p => p.filter(d => d.id !== selectedId));
      else { setZones(p => p.filter(z => z.id !== selectedId)); setMarkers(p => p.filter(x => x.id !== selectedId)); }
      setSelectedId(null); setSelType(null);
    }
  }, [selectedId, selectedIds, selType, walls, nodes, wallsAt]);

  const _ids = () => new Set(selectedIds.length > 1 ? selectedIds : [selectedId].filter(Boolean));
  const updZone = (u) => { const ids = _ids(); setZones(p => p.map(z => ids.has(z.id) ? { ...z, ...u } : z)); };
  const updMarker = (u) => { const ids = _ids(); setMarkers(p => p.map(x => ids.has(x.id) ? { ...x, ...u } : x)); };
  const updWall = (u) => { const ids = _ids(); setWalls(p => p.map(w => ids.has(w.id) ? { ...w, ...u } : w)); };
  const updDoor = (u) => { const ids = _ids(); setDoors(p => p.map(d => ids.has(d.id) ? { ...d, ...u } : d)); };
  const updWindow = (u) => { const ids = _ids(); setWindows(p => p.map(w => ids.has(w.id) ? { ...w, ...u } : w)); };
  const updColumn = (u) => { const ids = _ids(); setColumns(p => p.map(c => ids.has(c.id) ? { ...c, ...u } : c)); };

  // Keyboard
  useEffect(() => {
    const down = (e) => {
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
        if (key === "Enter" && dimInput !== "" && cursorPos) {
          const lockedDist = parseDimInput(dimInput, pxPerFoot);
          if (lockedDist !== null) {
            const angle = Math.atan2(cursorPos.y - drawChain.lastY, cursorPos.x - drawChain.lastX);
            const lx = drawChain.lastX + Math.cos(angle) * lockedDist;
            const ly = drawChain.lastY + Math.sin(angle) * lockedDist;
            const result = commitWallSegment(drawChain.lastNodeId, drawChain.lastX, drawChain.lastY, lx, ly, wallKindForTool(tool));
            setDimInput("");
            if (result) {
              const near = findNear(lx, ly, [drawChain.lastNodeId]);
              if (near) { setDrawChain(null); setCursorPos(null); setT("select"); }
              else { setDrawChain({ lastNodeId: result.nodeId, lastX: result.x, lastY: result.y }); }
            }
          }
          return;
        }
        if (key === "Escape" && dimInput !== "") { setDimInput(""); return; }
      }
      const k = e.key.toUpperCase();
      if (e.key === " ") { e.preventDefault(); setSpaceHeld(true); return; }
      if (k === "Z" && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); redo(); return; }
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
        const copiedZones = zones.filter(z => ids.has(z.id));
        setClipboard({ walls: copiedWalls, nodes: copiedNodes, doors: copiedDoors, windows: copiedWindows, columns: copiedColumns, markers: copiedMarkers, zones: copiedZones });
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
        const newMarkers = clipboard.markers.map(m => ({ ...m, id: uid(), x: m.x + off, y: m.y + off }));
        const newZones = clipboard.zones.map(z => z.points
          ? { ...z, id: uid(), points: z.points.map(pt => ({ x: pt.x + off, y: pt.y + off })) }
          : { ...z, id: uid(), x: z.x + off, y: z.y + off });
        setNodes(p => [...p, ...newNodes]);
        setWalls(p => [...p, ...newWalls]);
        setDoors(p => [...p, ...newDoors]);
        setWindows(p => [...p, ...newWindows]);
        setColumns(p => [...p, ...newColumns]);
        setMarkers(p => [...p, ...newMarkers]);
        setZones(p => [...p, ...newZones]);
        // Select all pasted objects
        const allNewIds = [...newWalls.map(w => w.id), ...newDoors.map(d => d.id), ...newWindows.map(w => w.id), ...newColumns.map(c => c.id), ...newMarkers.map(m => m.id), ...newZones.map(z => z.id)];
        if (allNewIds.length === 1) { setSelectedId(allNewIds[0]); setSelType(newWalls.length ? "wall" : newDoors.length ? "door" : newWindows.length ? "window" : newColumns.length ? "column" : newMarkers.length ? "marker" : "zone"); setSelectedIds([]); }
        else if (allNewIds.length > 1) { setSelectedIds(allNewIds); setSelectedId(allNewIds[0]); setSelType(newWalls.length ? "wall" : null); }
        return;
      }
      // Number keys for modes
      if (e.key === "1") { setMode("build"); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); return; }
      if (e.key === "2") { setMode("zone"); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); return; }
      if (e.key === "3") { setMode("itmep"); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); return; }
      if (e.key === "4") { setMode("budget"); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); return; }
      if (k === "V" || k === "H") { setT(k === "V" ? "select" : "pan"); }
      else if (mode === "build" && { W: "wall", C: "column" }[k]) { setT({ W: "wall", C: "column" }[k]); }
      else if (mode === "build" && k === "E") { setT("outlet"); }
      else if (k === "M") { setT("dim"); setDrawDim(null); }
      else if (mode === "zone" && k === "Z") { setT("zone"); }
      else if (mode === "itmep" && k === "P") { setT("marker"); }
      if (k === "D" && !e.ctrlKey) setShowDims(d => !d);
      if (k === "G") setShowGrid(g => !g);
      if (k === "F" && selDoor) updDoor({ flipped: !selDoor.flipped });
      if (k === "R" && selDoor) updDoor({ hingeRight: !selDoor.hingeRight });
      if (k === "R" && selWindow) updWindow({ angle: (selWindow.angle + 90) % 360 });
      if ((k === "DELETE" || k === "BACKSPACE") && (selectedId || selectedIds.length > 0)) { e.preventDefault(); delSel(); }
      if (k === "ESCAPE") { setSelectedId(null); setSelType(null); setDrawChain(null); setDrawPolyZone(null); setCursorPos(null); setDimInput(""); setDrawDim(null); }
      if (e.key === "0" || e.key === "Home") { e.preventDefault(); fitAll(); }
    };
    const up = (e) => { if (e.key === " ") setSpaceHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [selectedId, selectedIds, selType, delSel, selDoor, selWindow, undo, redo, fitAll, dimInput, cursorPos, drawChain, pxPerFoot, commitWallSegment, tool, findNear, walls, nodes, doors, windows, columns, markers, zones, clipboard, pasteOffset]);

  const $ = (n) => "$" + n.toLocaleString();
  const font = "'SF Mono','Consolas','Monaco',monospace";
  const nodeConns = useMemo(() => { const c = {}; walls.forEach(w => { c[w.n1] = (c[w.n1] || 0) + 1; c[w.n2] = (c[w.n2] || 0) + 1; }); return c; }, [walls]);
  const nodeWallsMap = useMemo(() => { const m = {}; walls.forEach(w => { if (!m[w.n1]) m[w.n1] = []; if (!m[w.n2]) m[w.n2] = []; m[w.n1].push(w); m[w.n2].push(w); }); return m; }, [walls]);

  const DimLbl = ({ cx, cy, text, angle, off = -14, color = T.dimText }) => {
    let a = angle; if (a > 90) a -= 180; if (a < -90) a += 180;
    const r = (angle * Math.PI) / 180, ox = -Math.sin(r) * off, oy = Math.cos(r) * off;
    return <text x={cx + ox} y={cy + oy} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={10}
      fontFamily={font} fontWeight={500} transform={`rotate(${a},${cx + ox},${cy + oy})`} style={{ pointerEvents: "none" }}>{text}</text>;
  };
  const WallDim = ({ w, hi }) => {
    const c = wc(w); if (!c) return null;
    const len = dst(c.x1, c.y1, c.x2, c.y2); if (len < 20) return null;
    const mid = { x: (c.x1 + c.x2) / 2, y: (c.y1 + c.y2) / 2 };
    const ang = (Math.atan2(c.y2 - c.y1, c.x2 - c.x1) * 180) / Math.PI;
    const r = (ang * Math.PI) / 180, tk = 6, px = -Math.sin(r), py = Math.cos(r);
    const col = hi ? "#E8E0D0CC" : "#E8E0D044";
    return <g style={{ pointerEvents: "none" }}>
      <line x1={c.x1 + px * tk} y1={c.y1 + py * tk} x2={c.x1 - px * tk} y2={c.y1 - py * tk} stroke={col} strokeWidth={0.8} />
      <line x1={c.x2 + px * tk} y1={c.y2 + py * tk} x2={c.x2 - px * tk} y2={c.y2 - py * tk} stroke={col} strokeWidth={0.8} />
      <line x1={c.x1 + px * tk} y1={c.y1 + py * tk} x2={c.x2 + px * tk} y2={c.y2 + py * tk} stroke={col} strokeWidth={0.5} strokeDasharray="3 2" />
      <DimLbl cx={mid.x} cy={mid.y} text={ft(len)} angle={ang} color={hi ? T.nodeFill : T.dimText} />
    </g>;
  };

  // Permanent dimension string
  const DimString = ({ d, sel }) => {
    const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
    const len = Math.hypot(dx, dy);
    if (len < 2) return null;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux; // perpendicular (left of p1→p2)
    const off = d.offset;
    const sign = off >= 0 ? 1 : -1;
    const absOff = Math.abs(off);
    // Dim line
    const dlx1 = d.x1 + nx * off, dly1 = d.y1 + ny * off;
    const dlx2 = d.x2 + nx * off, dly2 = d.y2 + ny * off;
    // Extension lines: gap from anchor, overshoot past dim line
    const gap = 4, overshoot = 6;
    const ext1s = { x: d.x1 + nx * sign * gap, y: d.y1 + ny * sign * gap };
    const ext1e = { x: d.x1 + nx * sign * (absOff + overshoot), y: d.y1 + ny * sign * (absOff + overshoot) };
    const ext2s = { x: d.x2 + nx * sign * gap, y: d.y2 + ny * sign * gap };
    const ext2e = { x: d.x2 + nx * sign * (absOff + overshoot), y: d.y2 + ny * sign * (absOff + overshoot) };
    // Diagonal ticks at dim line endpoints (45° between dim direction and perpendicular)
    const tk = 5;
    const diagX = (ux + nx * sign) / Math.SQRT2, diagY = (uy + ny * sign) / Math.SQRT2;
    // Label
    const mid = { x: (dlx1 + dlx2) / 2, y: (dly1 + dly2) / 2 };
    const label = ft(len);
    let ang = Math.atan2(dly2 - dly1, dlx2 - dlx1) * 180 / Math.PI;
    if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const textW = label.length * 5.5 + 6, textH = 11;
    const color = sel ? T.nodeFill : T.dimText;
    const sw = sel ? 1.2 : 0.75;
    return <g style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
      {/* Transparent hit area along dim line */}
      <line x1={dlx1} y1={dly1} x2={dlx2} y2={dly2} stroke="transparent" strokeWidth={10} />
      {/* Extension lines */}
      <line x1={ext1s.x} y1={ext1s.y} x2={ext1e.x} y2={ext1e.y} stroke={color} strokeWidth={sw} style={{ pointerEvents: "none" }} />
      <line x1={ext2s.x} y1={ext2s.y} x2={ext2e.x} y2={ext2e.y} stroke={color} strokeWidth={sw} style={{ pointerEvents: "none" }} />
      {/* Dim line */}
      <line x1={dlx1} y1={dly1} x2={dlx2} y2={dly2} stroke={color} strokeWidth={sw} style={{ pointerEvents: "none" }} />
      {/* Diagonal ticks */}
      <line x1={dlx1 - diagX * tk} y1={dly1 - diagY * tk} x2={dlx1 + diagX * tk} y2={dly1 + diagY * tk} stroke={color} strokeWidth={sw + 0.25} style={{ pointerEvents: "none" }} />
      <line x1={dlx2 - diagX * tk} y1={dly2 - diagY * tk} x2={dlx2 + diagX * tk} y2={dly2 + diagY * tk} stroke={color} strokeWidth={sw + 0.25} style={{ pointerEvents: "none" }} />
      {/* Text with canvas background */}
      <rect x={mid.x - textW / 2} y={mid.y - textH / 2} width={textW} height={textH} fill={T.canvas}
        transform={`rotate(${ang},${mid.x},${mid.y})`} style={{ pointerEvents: "none" }} />
      <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle" fontSize={9}
        fill={color} fontFamily={font} fontWeight={600}
        transform={`rotate(${ang},${mid.x},${mid.y})`} style={{ pointerEvents: "none" }}>{label}</text>
      {sel && <>
        <circle cx={d.x1} cy={d.y1} r={3} fill={color} style={{ pointerEvents: "none" }} />
        <circle cx={d.x2} cy={d.y2} r={3} fill={color} style={{ pointerEvents: "none" }} />
      </>}
    </g>;
  };

  // Door SVG: arc swing + line
  const DoorSvg = ({ d, sel }) => {
    const wpx = inToPx(d.width);
    const wallRad = (d.angle * Math.PI) / 180;
    // Wall direction unit vector
    const wdx = Math.cos(wallRad), wdy = Math.sin(wallRad);
    // Perpendicular (into room / out of room)
    const pdx = -wdy, pdy = wdx;
    // Hinge side: left or right edge of opening
    const hingeSide = d.hingeRight ? 1 : -1;
    const hx = d.x + wdx * (wpx / 2) * hingeSide;
    const hy = d.y + wdy * (wpx / 2) * hingeSide;
    // Swing direction: in or out (perpendicular to wall)
    const swingDir = d.flipped ? -1 : 1;
    // Door leaf end point (swings perpendicular from hinge)
    const ex = hx + pdx * wpx * swingDir;
    const ey = hy + pdy * wpx * swingDir;
    // Arc: from wall-flush position to open position
    // Wall-flush end (opposite side of opening from hinge)
    const fx = hx - wdx * wpx * hingeSide;
    const fy = hy - wdy * wpx * hingeSide;
    // Determine arc sweep
    const cross = (fx - hx) * (ey - hy) - (fy - hy) * (ex - hx);
    const sweep = cross > 0 ? 1 : 0;
    const isCaseOpening = d.doorType === "Case Opening";
    return <g style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
      <circle cx={d.x} cy={d.y} r={wpx / 2 + 8} fill="transparent" />
      {isCaseOpening ? <>
        <line x1={d.x - wdx * wpx / 2} y1={d.y - wdy * wpx / 2} x2={d.x + wdx * wpx / 2} y2={d.y + wdy * wpx / 2} stroke={sel ? T.nodeFill : "#C8A06080"} strokeWidth={2} strokeDasharray="4 3" />
        <circle cx={d.x - wdx * wpx / 2} cy={d.y - wdy * wpx / 2} r={2.5} fill={sel ? T.nodeFill : "#C8A060"} />
        <circle cx={d.x + wdx * wpx / 2} cy={d.y + wdy * wpx / 2} r={2.5} fill={sel ? T.nodeFill : "#C8A060"} />
      </> : <>
        <line x1={hx} y1={hy} x2={ex} y2={ey} stroke={sel ? T.nodeFill : "#C8A060"} strokeWidth={2} />
        <path d={`M ${fx} ${fy} A ${wpx} ${wpx} 0 0 ${sweep} ${ex} ${ey}`}
          fill="none" stroke={sel ? T.nodeFill : "#C8A06088"} strokeWidth={1} strokeDasharray="4 2" />
        <circle cx={hx} cy={hy} r={3} fill={sel ? T.nodeFill : "#C8A060"} />
      </>}
    </g>;
  };

  // Window SVG: double line with gap (or dashed line for Cut Opening)
  const WindowSvg = ({ w, sel }) => {
    const wpx = inToPx(w.width);
    const rad = (w.angle * Math.PI) / 180;
    const dx = Math.cos(rad) * wpx / 2, dy = Math.sin(rad) * wpx / 2;
    if (w.type === "Cut Opening") {
      const col = sel ? T.nodeFill : "#A09068";
      // Normal perpendicular to opening direction (for wall thickness)
      const nx = -Math.sin(rad) * 3, ny = Math.cos(rad) * 3;
      // Jamb hatch length along the opening direction
      const jx = Math.cos(rad) * 4, jy = Math.sin(rad) * 4;
      return <g style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
        <line x1={w.x - dx} y1={w.y - dy} x2={w.x + dx} y2={w.y + dy} stroke="transparent" strokeWidth={12} />
        {/* Top and bottom lines of opening rectangle */}
        <line x1={w.x - dx + nx} y1={w.y - dy + ny} x2={w.x + dx + nx} y2={w.y + dy + ny} stroke={col} strokeWidth={1.5} />
        <line x1={w.x - dx - nx} y1={w.y - dy - ny} x2={w.x + dx - nx} y2={w.y + dy - ny} stroke={col} strokeWidth={1.5} />
        {/* Left jamb end caps + diagonal hatch */}
        <line x1={w.x - dx + nx} y1={w.y - dy + ny} x2={w.x - dx - nx} y2={w.y - dy - ny} stroke={col} strokeWidth={1.5} />
        <line x1={w.x - dx - nx} y1={w.y - dy - ny} x2={w.x - dx + nx + jx} y2={w.y - dy + ny + jy} stroke={col} strokeWidth={1} />
        {/* Right jamb end caps + diagonal hatch */}
        <line x1={w.x + dx + nx} y1={w.y + dy + ny} x2={w.x + dx - nx} y2={w.y + dy - ny} stroke={col} strokeWidth={1.5} />
        <line x1={w.x + dx + nx} y1={w.y + dy + ny} x2={w.x + dx - nx - jx} y2={w.y + dy - ny - jy} stroke={col} strokeWidth={1} />
      </g>;
    }
    const nx = -Math.sin(rad) * 3, ny = Math.cos(rad) * 3;
    return <g style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
      <line x1={w.x - dx} y1={w.y - dy} x2={w.x + dx} y2={w.y + dy} stroke="transparent" strokeWidth={12} />
      <line x1={w.x - dx + nx} y1={w.y - dy + ny} x2={w.x + dx + nx} y2={w.y + dy + ny} stroke={sel ? T.nodeFill : "#60A0C8"} strokeWidth={1.5} />
      <line x1={w.x - dx - nx} y1={w.y - dy - ny} x2={w.x + dx - nx} y2={w.y + dy - ny} stroke={sel ? T.nodeFill : "#60A0C8"} strokeWidth={1.5} />
      <line x1={w.x - dx} y1={w.y - dy} x2={w.x + dx} y2={w.y + dy} stroke={sel ? "#E8E0D088" : "#60A0C844"} strokeWidth={6} />
    </g>;
  };

  // Marker Symbol SVG: custom symbols for IT/MEP markers
  const MarkerSymbol = ({ marker, selected }) => {
    const compData = SPEC_COMPONENTS[marker.layer]?.[marker.componentType];
    if (!compData) return null;
    
    const { symbol, color, letter } = compData;
    const r = selected ? 11 : 9;
    const strokeW = selected ? 2.5 : 1.5;
    
    if (symbol === "circle") {
      return <g>
        <circle cx={marker.x} cy={marker.y} r={r} fill={color} stroke={color} strokeWidth={strokeW} />
        {letter && <text x={marker.x} y={marker.y + 4} textAnchor="middle" fontSize={10} fill="#FFFFFF" fontWeight="bold" style={{ pointerEvents: "none" }}>{letter}</text>}
      </g>;
    } else if (symbol === "crosshair") {
      return <g>
        <circle cx={marker.x} cy={marker.y} r={r} fill="none" stroke={color} strokeWidth={strokeW} />
        <line x1={marker.x - r} y1={marker.y} x2={marker.x + r} y2={marker.y} stroke={color} strokeWidth={strokeW} />
        <line x1={marker.x} y1={marker.y - r} x2={marker.x} y2={marker.y + r} stroke={color} strokeWidth={strokeW} />
      </g>;
    } else if (symbol === "rect") {
      // H-track: render at actual scale (4ft or 8ft long)
      const isHtrack = marker.componentType === "htrack_4" || marker.componentType === "htrack_8" || marker.componentType === "htrack";
      if (isHtrack) {
        const ftLen = marker.componentType === "htrack_8" ? 8 : 4;
        const trackLen = ftLen * pxPerFoot;
        const trackW = pxPerFoot * 0.25; // ~3" wide
        const angle = marker.angle || 0;
        const hw = trackLen / 2;
        const hh = trackW / 2;
        // Rectangle centered at origin, then rotated
        return <g transform={`translate(${marker.x},${marker.y}) rotate(${angle * 180 / Math.PI})`}>
          <rect x={-hw} y={-hh} width={trackLen} height={trackW}
                fill={color + "22"} stroke={color} strokeWidth={selected ? 2 : 1.5} rx={1} />
          {/* tick marks every foot */}
          {Array.from({ length: ftLen - 1 }, (_, i) => {
            const tx = -hw + (i + 1) * pxPerFoot;
            return <line key={i} x1={tx} y1={-hh} x2={tx} y2={hh} stroke={color} strokeWidth={0.75} opacity={0.6} />;
          })}
          <text x={0} y={4} textAnchor="middle" fontSize={9} fill={color} fontWeight="bold"
                style={{ pointerEvents: "none" }}>{ftLen}'</text>
        </g>;
      }
      return <g>
        <rect x={marker.x - r * 1.2} y={marker.y - r * 0.6} width={r * 2.4} height={r * 1.2} fill="none" stroke={color} strokeWidth={strokeW} rx={1} />
        {letter && <text x={marker.x} y={marker.y + 4} textAnchor="middle" fontSize={10} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>{letter}</text>}
      </g>;
    }
    if (symbol === "outlet") {
      const angleDeg = (marker.angle || 0) * 180 / Math.PI;
      const isSurface = compData.mount === "surface";
      const isQuad = compData.outletCount === 4;
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
        <circle cx={0} cy={0} r={r + 6} fill="transparent" />
        {isSurface && <rect x={-(r+4)} y={-(r+4)} width={(r+4)*2} height={(r+4)*2} fill="none" stroke={color} strokeWidth={1} strokeDasharray="3 2" rx={2} style={{ pointerEvents: "none" }} />}
        <circle cx={0} cy={0} r={r} fill={color + "18"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
        <line x1={-r} y1={0} x2={r} y2={0} stroke={color} strokeWidth={2} style={{ pointerEvents: "none" }} />
        <text x={0} y={-2} textAnchor="middle" fontSize={selected ? 8 : 7} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>{isQuad ? "Q" : "D"}</text>
      </g>;
    }
    if (symbol === "outlet_ceiling") {
      return <g style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
        <circle cx={marker.x} cy={marker.y} r={r + 6} fill="transparent" />
        <circle cx={marker.x} cy={marker.y} r={r} fill="none" stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
        <line x1={marker.x - r} y1={marker.y} x2={marker.x + r} y2={marker.y} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
        <line x1={marker.x} y1={marker.y - r} x2={marker.x} y2={marker.y + r} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
        <circle cx={marker.x} cy={marker.y} r={3} fill={color} style={{ pointerEvents: "none" }} />
      </g>;
    }
    if (symbol === "switch") {
      const angleDeg = (marker.angle || 0) * 180 / Math.PI;
      const lbl = compData?.letter || "S";
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
        <circle cx={0} cy={0} r={r + 6} fill="transparent" />
        {/* Square body */}
        <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={color + "18"} stroke={color} strokeWidth={strokeW} rx={2} style={{ pointerEvents: "none" }} />
        {/* Diagonal toggle line */}
        <line x1={-r * 0.5} y1={r * 0.5} x2={r * 0.5} y2={-r * 0.8} stroke={color} strokeWidth={2} style={{ pointerEvents: "none" }} />
        <circle cx={r * 0.5} cy={-r * 0.8} r={2} fill={color} style={{ pointerEvents: "none" }} />
        <text x={0} y={r + 9} textAnchor="middle" fontSize={selected ? 8 : 7} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>{lbl}</text>
      </g>;
    }
    if (symbol === "panel") {
      const angleDeg = (marker.angle || 0) * 180 / Math.PI;
      const pw = r * 2.2, ph = r * 3;
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
        <rect x={-(pw / 2) - 4} y={-(ph / 2) - 4} width={pw + 8} height={ph + 8} fill="transparent" />
        {/* Panel body */}
        <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} fill={color + "18"} stroke={color} strokeWidth={selected ? 2 : 1.5} rx={2} style={{ pointerEvents: "none" }} />
        {/* Breaker rows */}
        {[-.55, -.18, .18, .55].map((yf, i) => (
          <rect key={i} x={-pw * 0.3} y={ph * yf / 2 - 2} width={pw * 0.6} height={4} fill={color + "55"} rx={1} style={{ pointerEvents: "none" }} />
        ))}
        <text x={0} y={ph / 2 + 9} textAnchor="middle" fontSize={selected ? 8 : 7} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>PANEL</text>
      </g>;
    }
    return null;
  };

  // ── Mode system ─────────────────────────────────────────────────────
  const setT = (t) => { setTool(t); setGhostPos(null); setDrawChain(null); setDrawPolyZone(null); setCursorPos(null); setDimInput(""); setDrawDim(null); if (t !== "select" && t !== "pan") { setSelectedId(null); setSelType(null); setSelectedIds([]); } };

  const MODES = {
    build: { label: "1 · Build", color: "#9A9488" },
    zone: { label: "2 · Zone", color: "#50A070" },
    itmep: { label: "3 · IT / MEP", color: "#4080E0" },
    budget: { label: "4 · Budget", color: "#E8C840" },
  };

  const S = {
    root: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: font, fontSize: 11, background: T.bg0, color: T.text, overflow: "hidden" },
    bar: { display: "flex", alignItems: "center", background: T.bg2, borderBottom: "1px solid " + T.border, padding: "0 16px", height: "48px", flexShrink: 0, gap: "8px" },
    mbtn: (a, c) => ({
      padding: "8px 20px",
      background: a ? c + "20" : "transparent",
      color: a ? T.textBright : T.textMuted,
      border: a ? "2px solid " + c + "60" : "2px solid transparent",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "11px",
      fontFamily: "inherit",
      letterSpacing: "0.04em",
      fontWeight: a ? 600 : 500,
      transition: "all 0.15s ease"
    }),
    main: { display: "flex", flex: 1, overflow: "hidden" },
    side: { width: "280px", background: T.bg1, borderRight: "1px solid " + T.bg3, display: "flex", flexDirection: "column", flexShrink: 0 },
    body: { flex: 1, overflow: "auto", padding: "16px" },
    cv: { flex: 1, position: "relative", overflow: "hidden", background: T.canvas },
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
      position: "absolute",
      top: "16px",
      right: "16px",
      width: "260px",
      maxHeight: "calc(100vh - 140px)",
      overflow: "auto",
      background: T.panelBg,
      border: "1px solid " + T.border,
      borderRadius: "8px",
      padding: "16px",
      zIndex: 10,
      backdropFilter: "blur(12px)",
      boxShadow: T.panelShadow
    },
    inp: { background: T.bg3, border: "1.5px solid " + T.border, borderRadius: "5px", padding: "6px 10px", color: T.textBright, fontSize: "11px", fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s ease" },
    lbl: { fontSize: "9px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px", fontWeight: 600 },
    del: { background: T.delBg, border: "none", borderRadius: "5px", padding: "8px 12px", color: T.delText, fontSize: "10px", fontFamily: "inherit", cursor: "pointer", width: "100%", marginTop: "10px", fontWeight: 500, transition: "all 0.15s ease" },
    cr: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + T.bg3 + "33", fontSize: "10px" },
    ct: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1.5px solid " + T.border, marginTop: "8px", fontWeight: 600, color: T.textBright, fontSize: "13px" },
    sec: { marginBottom: "20px" },
    sh: { fontSize: "10px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", fontWeight: 600 },
    smBtn: { padding: "6px 12px", background: "transparent", color: T.accent, border: "1.5px solid " + T.bg3, borderRadius: "5px", cursor: "pointer", fontSize: "10px", fontFamily: "inherit", transition: "all 0.15s ease", fontWeight: 500 },
    bg: { position: "absolute", bottom: "56px", left: "16px", display: "flex", gap: "8px", alignItems: "center", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 12px", zIndex: 10, fontSize: "10px", backdropFilter: "blur(12px)", boxShadow: T.panelShadow },
    floatingToolbar: {
      position: "absolute",
      left: "50%",
      bottom: "70px",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "row",
      gap: "6px",
      background: T.toolbarBg,
      border: "1px solid " + T.border,
      borderRadius: "12px",
      padding: "10px 14px",
      zIndex: 100,
      backdropFilter: "blur(16px)",
      boxShadow: T.toolbarShadow
    },
    toolBtn: (a, c) => ({
      width: "44px",
      height: "44px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: a ? (c || T.border) + "40" : "transparent",
      border: a ? "2px solid " + (c || T.textBright) + "80" : "2px solid transparent",
      borderRadius: "8px",
      cursor: "pointer",
      color: a ? (c || T.textBright) : T.accent,
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
  };

  const isDrawing = drawChain || drawPolyZone;

  return (
    <TooltipProvider>
    <div style={S.root}>
      {/* ── Top Mode Bar ──────────────────────────────────────────── */}
      <div style={S.bar}>
        {Object.entries(MODES).map(([k, m]) => <button key={k} style={S.mbtn(mode === k, m.color)} onClick={() => { setMode(k); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); }}>{m.label}</button>)}
        <div style={{ flex: 1 }} />
        <button style={S.smBtn} onClick={() => setShowDims(d => !d)}>{showDims ? "Dims ✓" : "Dims"}</button>
        <button style={S.smBtn} onClick={() => setShowGrid(g => !g)}>{showGrid ? "Grid ✓" : "Grid"}</button>
        <button style={S.smBtn} onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")}>{themeMode === "dark" ? "Light" : "Dark"}</button>
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 6px" }} />
        <button style={S.smBtn} onClick={exportProject}>Save</button>
        <button style={S.smBtn} onClick={() => loadRef.current?.click()}>Load</button>
        <button style={S.smBtn} onClick={() => { if (walls.length || zones.length || markers.length) { if (confirm("New project?")) newProject(); } else newProject(); }}>New</button>
        <input ref={loadRef} type="file" accept=".json" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = ""; }} />
      </div>

      <div style={S.main}>
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div style={S.side}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid " + T.bg3, background: T.bg0 }}>
            <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 600 }}>Project</div>
            <input style={{ background: "none", border: "none", color: T.textBright, fontSize: 14, fontFamily: "inherit", fontWeight: 600, width: "100%", outline: "none" }} value={projectName} onChange={e => setProjectName(e.target.value)} />
          </div>
          <div style={S.body}>

            {/* ── BUILD ─────────────────────────────────────────── */}
            {mode === "build" && <>
              <div style={S.sec}>
                <div style={S.sh}>Reference Image</div>
                <button onClick={() => fRef.current?.click()} style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: bgImage ? T.textBright : T.textMuted, fontSize: 10, fontWeight: 500 }}>
                  {bgImage ? "Replace Image" : "Upload Floorplan"}
                </button>
                <input ref={fRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setBgImage(ev.target.result); r.readAsDataURL(f); } }} />
                {bgImage && <>
                  <div style={{ marginTop: 10 }}><div style={S.lbl}>Opacity</div><input type="range" min="0" max="100" value={bgOpacity * 100} onChange={e => setBgOpacity(e.target.value / 100)} style={{ width: "100%", accentColor: "#9A9488", height: 4 }} /></div>
                  <div style={{ marginTop: 8 }}><div style={S.lbl}>Scale</div><input type="range" min="20" max="300" value={bgScale * 100} onChange={e => setBgScale(e.target.value / 100)} style={{ width: "100%", accentColor: "#9A9488", height: 4 }} /></div>
                  <div style={{ fontSize: 9, color: T.textDim, marginTop: 6, fontStyle: "italic" }}>Alt + drag to reposition</div>
                </>}
              </div>
              {bgImage && calibrationLine && calibrationLine.p1 && calibrationLine.p2 && (
                <div style={S.sec}>
                  <div style={S.sh}>Calibrate Scale</div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={S.lbl}>Known Distance (feet)</div>
                    <input 
                      style={S.inp} 
                      type="number" 
                      value={calibrationFeet} 
                      onChange={e => setCalibrationFeet(e.target.value)} 
                      placeholder="10"
                      step="0.5"
                    />
                  </div>
                  <button 
                    style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: "#E0A050", fontSize: 10, fontWeight: 500, marginBottom: 6 }}
                    onClick={() => {
                      const feet = parseFloat(calibrationFeet);
                      if (feet > 0 && calibrationLine.p1 && calibrationLine.p2) {
                        const pixelDist = Math.sqrt(
                          Math.pow(calibrationLine.p2.x - calibrationLine.p1.x, 2) + 
                          Math.pow(calibrationLine.p2.y - calibrationLine.p1.y, 2)
                        );
                        const targetPixels = feet * pxPerFoot;
                        const newScale = targetPixels / pixelDist;
                        setBgScale(prevScale => prevScale * newScale);
                        setCalibrationLine(null);
                        setT("select");
                      }
                    }}
                  >
                    Apply Calibration
                  </button>
                  <button 
                    style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.textMuted, fontSize: 10, fontWeight: 500 }}
                    onClick={() => setCalibrationLine(null)}
                  >
                    Clear Line
                  </button>
                </div>
              )}
              <div style={S.sec}>
                <div style={S.sh}>Drawing Scale</div>
                <select value={pxPerFoot} onChange={e => setPxPerFoot(Number(e.target.value))} style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }}>
                  <option value={10}>1 grid = 2'</option><option value={20}>1 grid = 1'</option><option value={40}>1 grid = 6"</option>
                </select>
              </div>
              <div style={S.sec}>
                <div style={S.sh}>Summary</div>
                {Object.entries(cost.wallFt).map(([k, v]) => <div key={k} style={S.cr}><span style={{ color: v.color, fontWeight: 500 }}>{v.label}</span><span style={{ fontWeight: 500 }}>{ft(v.ft)}</span></div>)}
                {Object.keys(cost.wallFt).length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>No walls yet</div>}
                <div style={{ ...S.cr, color: T.accent, borderBottom: "none" }}><span>Doors</span><span>{doors.length}</span></div>
                <div style={{ ...S.cr, color: T.accent, borderBottom: "none" }}><span>Windows</span><span>{windows.length}</span></div>
                <div style={{ ...S.cr, color: T.accent, borderBottom: "none", paddingBottom: 0 }}><span>Columns</span><span>{columns.length}</span></div>
              </div>
            </>}

            {/* ── ZONE ────��──────────────────────────────────────── */}
            {mode === "zone" && <>
              <div style={S.sec}>
                <div style={S.sh}>Zone Types</div>
              </div>
              <div style={S.sec}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Object.entries(ZONE_LIBRARY).map(([k, z]) => <button key={k} style={S.btn(activeZoneType === k, z.color)}
                    onClick={() => { setActiveZoneType(k); if (tool !== "zone") setT("zone"); }}>
                    <span style={S.dot(z.color)} />{z.name}
                  </button>)}
                </div>
              </div>
              <div style={S.sec}>
                <div style={S.sh}>Placed Zones ({zones.length})</div>
                {zones.length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>No zones placed yet</div>}
                {zones.map(z => <div key={z.id} style={{ padding: "6px 10px", background: selectedId === z.id ? T.selBg : "transparent", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 10, marginBottom: 3, border: selectedId === z.id ? "1.5px solid " + T.selBorder : "1.5px solid transparent", transition: "all 0.12s ease" }}
                  onClick={() => { setSelectedId(z.id); setSelType("zone"); setT("select"); }}>
                  <span style={S.dot(ZONE_LIBRARY[z.type].color)} />
                  <span style={{ flex: 1, fontWeight: selectedId === z.id ? 500 : 400 }}>{z.label}</span>
                  <span style={{ color: T.accentDim, fontSize: 9 }}>{z.points ? Math.round(polyArea(z.points) / (pxPerFoot * pxPerFoot)) + " sf" : ft(z.w) + "×" + ft(z.h)}</span>
                </div>)}
                {cost.totalSf > 0 && <div style={{ ...S.cr, fontWeight: 600, marginTop: 8, borderTop: "1.5px solid " + T.selBorder, paddingTop: 8, borderBottom: "none" }}><span>Total Area</span><span>{cost.totalSf} sf</span></div>}
              </div>
            </>}

            {/* ── IT / MEP ───────────────────────────────────────── */}
            {mode === "itmep" && <>
              <div style={S.sec}>
                <div style={S.sh}>Component Layers</div>
                {Object.entries(SPEC_LAYERS).map(([k, l]) => <div key={k} style={{ 
                  ...S.lr, 
                  background: activeSpecLayer === k ? l.color + "20" : "transparent",
                  border: activeSpecLayer === k ? "2px solid " + l.color + "60" : "2px solid transparent",
                  borderRadius: "6px",
                  padding: "8px 6px",
                  margin: "2px 0",
                  transition: "all 0.15s ease"
                }} onClick={() => { setActiveSpecLayer(k); const firstComp = Object.keys(SPEC_COMPONENTS[k])[0]; setActiveComponentType(firstComp); setT("marker"); }}>
                  <div style={S.chk(visibleLayers[k], l.color)} onClick={e => { e.stopPropagation(); setVisibleLayers(v => ({ ...v, [k]: !v[k] })); }}>{visibleLayers[k] && "✓"}</div>
                  <span style={{ color: activeSpecLayer === k ? T.textBright : T.accent, flex: 1, fontWeight: activeSpecLayer === k ? 600 : 400 }}>{l.name}</span>
                  <span style={{ color: activeSpecLayer === k ? l.color : T.accentDim, fontSize: 10, fontWeight: 500 }}>{markers.filter(p => p.layer === k).length}</span>
                </div>)}
              </div>
              <div style={S.sec}>
                <div style={S.sh}>Placed Components ({markers.length})</div>
                {markers.length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>No components placed yet</div>}
                {Object.entries(SPEC_LAYERS).map(([layerKey, layer]) => {
                  const layerMarkers = markers.filter(m => m.layer === layerKey);
                  if (layerMarkers.length === 0) return null;
                  // Group markers by componentType
                  const groups = {};
                  layerMarkers.forEach(m => {
                    if (!groups[m.componentType]) groups[m.componentType] = [];
                    groups[m.componentType].push(m);
                  });
                  return <div key={layerKey} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: layer.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 600 }}>{layer.name}</div>
                    {Object.entries(groups).map(([compType, groupMarkers]) => {
                      const compData = SPEC_COMPONENTS[layerKey]?.[compType];
                      const groupIds = groupMarkers.map(m => m.id);
                      const isGroupSelected = groupIds.some(id => selectedId === id || selectedIds.includes(id));
                      return <div key={compType} style={{ padding: "4px 8px", background: isGroupSelected ? T.selBg : "transparent", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 10, marginBottom: 2, border: isGroupSelected ? "1.5px solid " + T.selBorder : "1.5px solid transparent", transition: "all 0.12s ease" }}
                        onClick={() => { setSelectedId(null); setSelType(null); setSelectedIds(groupIds); setTool("select"); }}>
                        {compData?.symbol ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                            {compData.symbol === "circle" && <circle cx="8" cy="8" r="6" fill={compData.letter ? "none" : compData.color} stroke={compData.color} strokeWidth="2" />}
                            {compData.symbol === "crosshair" && <><circle cx="8" cy="8" r="6" fill="none" stroke={compData.color} strokeWidth="2" /><line x1="2" y1="8" x2="14" y2="8" stroke={compData.color} strokeWidth="2" /><line x1="8" y1="2" x2="8" y2="14" stroke={compData.color} strokeWidth="2" /></>}
                            {compData.symbol === "rect" && <rect x="2" y="5" width="12" height="6" fill="none" stroke={compData.color} strokeWidth="2" rx="1" />}
                            {compData.letter && <text x="8" y="11" textAnchor="middle" fontSize="9" fill={compData.letter ? compData.color : "#FFF"} fontWeight="bold">{compData.letter}</text>}
                          </svg>
                        ) : (
                          <span style={{ fontSize: 11 }}>{compData?.icon || "📍"}</span>
                        )}
                        <span style={{ flex: 1, fontWeight: isGroupSelected ? 500 : 400 }}>{compData?.name || compType}</span>
                        {groupMarkers.length > 1 && <span style={{ color: layer.color, fontSize: 9, fontWeight: 600, background: layer.color + "18", padding: "1px 5px", borderRadius: 8 }}>{groupMarkers.length}</span>}
                      </div>;
                    })}
                  </div>;
                })}
              </div>
            </>}

            {/* ── BUDGET ─────────────────────────────────────────── */}
            {mode === "budget" && <>
              <div style={S.sec}>
                <div style={S.sh}>Cost Breakdown</div>
                {Object.entries(cost.wallFt).map(([k, v]) => {
                  const matchingWalls = walls.filter(w => (w.kind || "existing") === k);
                  const isSelected = matchingWalls.length > 0 && matchingWalls.every(w => selectedIds.includes(w.id));
                  return <div key={k} style={{ ...S.cr, cursor: "pointer", transition: "all 0.12s ease", background: isSelected ? T.selBg : "transparent" }}
                    onClick={() => {
                      const wallIds = matchingWalls.map(w => w.id);
                      setSelectedIds(wallIds);
                      if (wallIds.length > 0) {
                        setSelectedId(wallIds[0]);
                        setSelType("wall");
                      }
                    }}
                  >
                    <span style={{ color: v.color, fontWeight: 500 }}>{v.label} wall</span><span style={{ fontWeight: 500 }}>{ft(v.ft)}</span>
                  </div>;
                })}
                {cost.zones.map(z => <div key={z.id} style={{ ...S.cr, cursor: "pointer", transition: "all 0.12s ease", background: selectedId === z.id ? T.selBg : "transparent" }}
                  onClick={() => {
                    setSelectedId(z.id);
                    setSelType("zone");
                    setSelectedIds([z.id]);
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={S.dot(ZONE_LIBRARY[z.type].color)} />{z.label}</span>
                  <span style={{ fontWeight: 500 }}>{$(z.total)}</span>
                </div>)}
                {Object.entries(cost.markers).map(([k, p]) => {
                  const [layer, componentType] = k.split('_');
                  const matchingMarkers = markers.filter(m => m.layer === layer && m.componentType === componentType);
                  const isSelected = matchingMarkers.length > 0 && matchingMarkers.every(m => selectedIds.includes(m.id));
                  return <div key={k} style={{ ...S.cr, cursor: "pointer", transition: "all 0.12s ease", background: isSelected ? T.selBg : "transparent" }}
                    onClick={() => {
                      const markerIds = matchingMarkers.map(m => m.id);
                      setSelectedIds(markerIds);
                      if (markerIds.length > 0) {
                        setSelectedId(markerIds[0]);
                        setSelType("marker");
                      }
                    }}
                  >
                    <span>{p.count}× {p.name}</span><span style={{ fontWeight: 500 }}>{$(p.count * p.unitCost)}</span>
                  </div>;
                })}
                {cost.totalSf > 0 && <div style={S.cr}><span>Total area</span><span style={{ fontWeight: 500 }}>{cost.totalSf} sf</span></div>}
                <div style={S.ct}><span>Total Estimate</span><span>{$(cost.total)}</span></div>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: "#E8C840", background: "#2A2A26", marginTop: 10, fontSize: 10, fontWeight: 500 }}
                  onClick={() => {
                    const lines = [`${projectName} — Testfit Summary`, ""];
                    if (Object.keys(cost.wallFt).length) {
                      lines.push("WALLS");
                      Object.entries(cost.wallFt).forEach(([k, v]) => lines.push(`  ${v.label}: ${ft(v.ft)}`));
                      // Wall details
                      const wallsWithInfo = walls.filter(w => w.material || w.paintFinish || w.notes);
                      if (wallsWithInfo.length) {
                        lines.push("  —");
                        wallsWithInfo.forEach(w => {
                          const wk = WALL_KINDS[w.kind || "existing"];
                          const parts = [`${wk.label} · ${ft(wl(w))}`];
                          if (w.material) parts.push(w.material);
                          if (w.paintFinish) parts.push(`Paint: ${w.paintFinish}`);
                          if (w.notes) parts.push(`(${w.notes})`);
                          lines.push(`  ${parts.join(" · ")}`);
                        });
                      }
                      lines.push("");
                    }
                    if (cost.zones.length) {
                      lines.push("ZONES");
                      cost.zones.forEach(z => lines.push(`  ${z.label} — ${z.sf} sf — ${$(z.total)}`));
                      lines.push(`  Total: ${cost.totalSf} sf`);
                      lines.push("");
                    }
                    const markerEntries = Object.entries(cost.markers);
                    if (markerEntries.length) {
                      lines.push("MARKERS");
                      markerEntries.forEach(([k, p]) => lines.push(`  ${p.count}× ${p.name} — ${$(p.count * p.unitCost)}`));
                      lines.push("");
                    }
                    if (doors.length) lines.push(`DOORS: ${doors.length}`);
                    if (windows.length) lines.push(`WINDOWS: ${windows.length}`);
                    lines.push(""); lines.push(`TOTAL ESTIMATE: ${$(cost.total)}`);
                    
                    // Fallback clipboard copy with error handling
                    const text = lines.join("\n");
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(text).catch(() => {
                        // Fallback: create a temporary textarea
                        const textarea = document.createElement("textarea");
                        textarea.value = text;
                        textarea.style.position = "fixed";
                        textarea.style.opacity = "0";
                        document.body.appendChild(textarea);
                        textarea.select();
                        try {
                          document.execCommand("copy");
                        } catch (err) {
                          console.error("Copy failed:", err);
                        }
                        document.body.removeChild(textarea);
                      });
                    } else {
                      // Fallback for browsers without clipboard API
                      const textarea = document.createElement("textarea");
                      textarea.value = text;
                      textarea.style.position = "fixed";
                      textarea.style.opacity = "0";
                      document.body.appendChild(textarea);
                      textarea.select();
                      try {
                        document.execCommand("copy");
                      } catch (err) {
                        console.error("Copy failed:", err);
                      }
                      document.body.removeChild(textarea);
                    }
                  }}>Copy Summary to Clipboard</button>
              </div>
            </>}
          </div>
        </div>

        {/* ── Canvas ──────────────────────────────────────────────── */}
        <div style={S.cv}>
          {drawChain && <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 14px", fontSize: "10px", color: MODES[mode].color, zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500 }}>
            Click points · Double-click to finish · Shift: H/V · Type length to lock
          </div>}
          
          <style>{`@keyframes _blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
          {dimInput !== "" && cursorPos && (
            <div style={{ position: "absolute", pointerEvents: "none", zIndex: 20, whiteSpace: "nowrap",
              left: cursorPos.x * zoom + viewOff.x + 18, top: cursorPos.y * zoom + viewOff.y + 18,
              background: "#1A1814EE", border: "1px solid #C8B98A", borderRadius: 5,
              padding: "3px 9px", fontSize: 12, fontFamily: "'SF Mono','Consolas','Monaco',monospace",
              fontWeight: 600, color: "#C8B98A", boxShadow: "0 2px 8px rgba(0,0,0,.5)" }}>
              {dimInput}
              <span style={{ display: "inline-block", width: 1, height: 12, background: "#C8B98A",
                marginLeft: 2, verticalAlign: "middle", animation: "_blink 1s step-end infinite" }} />
            </div>
          )}
          {tool === "calibrate" && (!calibrationLine || !calibrationLine.p2) && <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 14px", fontSize: "10px", color: "#E0A050", zIndex: 10, backdropFilter: "blur(12px)", boxShadow: T.panelShadow, fontWeight: 500 }}>
            {!calibrationLine ? "Click to set first point" : "Click to set second point"}
          </div>}

          <svg ref={cvs} width="100%" height="100%"
            style={{ cursor: (panning || spaceHeld) ? "grab" : isWallTool(tool) ? cadCrosshair(T.crosshairColor) : (tool === "zone" || tool === "marker" || tool === "door" || tool === "window" || tool === "column" || tool === "calibrate" || tool === "dim" || tool === "outlet") ? cadCrosshair(T.crosshairColor) : "default", userSelect: "none" }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel}>
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
                <line x1="0" y1="0" x2="8" y2="8" stroke="#9A9488" strokeWidth="0.6" opacity="0.7"/>
                <line x1="8" y1="0" x2="0" y2="8" stroke="#9A9488" strokeWidth="0.6" opacity="0.7"/>
              </pattern>
              {/* Demo: cross-hatch red */}
              <pattern id="hatch-demo" patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="0" x2="8" y2="8" stroke="#E05050" strokeWidth="0.6" opacity="0.5"/>
                <line x1="8" y1="0" x2="0" y2="8" stroke="#E05050" strokeWidth="0.6" opacity="0.5"/>
              </pattern>
              {/* New: single 45° hatch blue */}
              <pattern id="hatch-new" patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="8" x2="8" y2="0" stroke="#50A0E0" strokeWidth="0.6" opacity="0.5"/>
              </pattern>
              {/* Pony: lighter single hatch tan */}
              <pattern id="hatch-pony" patternUnits="userSpaceOnUse" width="6" height="6">
                <line x1="0" y1="6" x2="6" y2="0" stroke="#C8A060" strokeWidth="0.5" opacity="0.5"/>
              </pattern>

              {/* === Material-specific hatch patterns === */}
              {/* Drywall: very faint, nearly plain — light stipple */}
              <pattern id="mat-drywall" patternUnits="userSpaceOnUse" width="12" height="12">
                <circle cx="6" cy="6" r="0.5" fill="#9A9488" opacity="0.35"/>
              </pattern>
              {/* Brick: classic 45° parallel lines */}
              <pattern id="mat-brick" patternUnits="userSpaceOnUse" width="6" height="6">
                <line x1="0" y1="6" x2="6" y2="0" stroke="#9A9488" strokeWidth="0.8" opacity="0.75"/>
              </pattern>
              {/* CMU / Concrete Block: double cross-hatch with dots at intersections */}
              <pattern id="mat-cmu" patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="0" x2="8" y2="8" stroke="#9A9488" strokeWidth="0.65" opacity="0.7"/>
                <line x1="8" y1="0" x2="0" y2="8" stroke="#9A9488" strokeWidth="0.65" opacity="0.7"/>
                <circle cx="4" cy="4" r="0.8" fill="#9A9488" opacity="0.6"/>
              </pattern>
              {/* Glass: wide-spaced thin diagonals */}
              <pattern id="mat-glass" patternUnits="userSpaceOnUse" width="14" height="14">
                <line x1="0" y1="14" x2="14" y2="0" stroke="#9A9488" strokeWidth="0.5" opacity="0.45"/>
              </pattern>
              {/* Wood Stud: X diagonals (lumber cross) */}
              <pattern id="mat-wood-stud" patternUnits="userSpaceOnUse" width="20" height="20">
                <line x1="0" y1="0" x2="20" y2="20" stroke="#9A9488" strokeWidth="0.7" opacity="0.65"/>
                <line x1="20" y1="0" x2="0" y2="20" stroke="#9A9488" strokeWidth="0.7" opacity="0.65"/>
              </pattern>
              {/* Metal Stud: paired parallel diagonal lines (double-line grouping) */}
              <pattern id="mat-metal-stud" patternUnits="userSpaceOnUse" width="10" height="10">
                <line x1="0" y1="10" x2="10" y2="0" stroke="#9A9488" strokeWidth="0.7" opacity="0.7"/>
                <line x1="2" y1="10" x2="10" y2="2" stroke="#9A9488" strokeWidth="0.7" opacity="0.7"/>
              </pattern>
              {/* Concrete: tight cross-hatch */}
              <pattern id="mat-concrete" patternUnits="userSpaceOnUse" width="5" height="5">
                <line x1="0" y1="0" x2="5" y2="5" stroke="#9A9488" strokeWidth="0.5" opacity="0.55"/>
                <line x1="5" y1="0" x2="0" y2="5" stroke="#9A9488" strokeWidth="0.5" opacity="0.55"/>
              </pattern>
              {/* Plaster: fine single diagonals */}
              <pattern id="mat-plaster" patternUnits="userSpaceOnUse" width="7" height="7">
                <line x1="0" y1="7" x2="7" y2="0" stroke="#9A9488" strokeWidth="0.5" opacity="0.5"/>
              </pattern>
              {/* Other: alternating diagonal bands (plywood-like) */}
              <pattern id="mat-other" patternUnits="userSpaceOnUse" width="12" height="12">
                <line x1="0" y1="12" x2="12" y2="0" stroke="#9A9488" strokeWidth="0.6" opacity="0.55"/>
                <line x1="-3" y1="12" x2="9" y2="0" stroke="#9A9488" strokeWidth="0.6" opacity="0.55"/>
              </pattern>
            </defs>
            <g transform={`translate(${viewOff.x},${viewOff.y}) scale(${zoom})`}>
              {showGrid && (() => {
                // Clamp grid to visible viewport for performance
                const rect = cvs.current?.getBoundingClientRect();
                const vw = rect?.width || 2000, vh = rect?.height || 1200;
                const pad = pxPerFoot * 2;
                const minX = -viewOff.x / zoom - pad, maxX = (-viewOff.x + vw) / zoom + pad;
                const minY = -viewOff.y / zoom - pad, maxY = (-viewOff.y + vh) / zoom + pad;
                const startI = Math.floor(minX / pxPerFoot), endI = Math.ceil(maxX / pxPerFoot);
                const startJ = Math.floor(minY / pxPerFoot), endJ = Math.ceil(maxY / pxPerFoot);

                return <>
                  {/* 1-foot base grid lines */}
                  <g opacity={0.25}>
                    {Array.from({ length: endI - startI + 1 }, (_, i) => {
                      const pos = (startI + i) * pxPerFoot;
                      const isTenFoot = Math.abs(pos % (pxPerFoot * 10)) < 0.1;
                      return <line key={"v1f" + (startI + i)} x1={pos} y1={minY} x2={pos} y2={maxY}
                        stroke={isTenFoot ? T.gridSub : T.accentDim} strokeWidth={isTenFoot ? 1.2 : 0.6} />;
                    })}
                    {Array.from({ length: endJ - startJ + 1 }, (_, i) => {
                      const pos = (startJ + i) * pxPerFoot;
                      const isTenFoot = Math.abs(pos % (pxPerFoot * 10)) < 0.1;
                      return <line key={"h1f" + (startJ + i)} x1={minX} y1={pos} x2={maxX} y2={pos}
                        stroke={isTenFoot ? T.gridSub : T.accentDim} strokeWidth={isTenFoot ? 1.2 : 0.6} />;
                    })}
                  </g>

                  {/* Quarter-foot subdivisions when zoomed in 200% or more */}
                  {zoom >= 2 && <g opacity={0.15}>
                    {Array.from({ length: (endI - startI) * 4 + 1 }, (_, i) => {
                      const pos = (startI * 4 + i) * (pxPerFoot / 4);
                      if (Math.abs(pos % pxPerFoot) < 0.1) return null;
                      return <line key={"vi" + (startI * 4 + i)} x1={pos} y1={minY} x2={pos} y2={maxY}
                        stroke={T.gridSub} strokeWidth={0.4} />;
                    })}
                    {Array.from({ length: (endJ - startJ) * 4 + 1 }, (_, i) => {
                      const pos = (startJ * 4 + i) * (pxPerFoot / 4);
                      if (Math.abs(pos % pxPerFoot) < 0.1) return null;
                      return <line key={"hi" + (startJ * 4 + i)} x1={minX} y1={pos} x2={maxX} y2={pos}
                        stroke={T.gridSub} strokeWidth={0.4} />;
                    })}
                  </g>}
                </>;
              })()}
              {bgImage && <image href={bgImage} x={bgOffset.x} y={bgOffset.y} style={{ opacity: bgOpacity, transform: `scale(${bgScale})`, transformOrigin: `${bgOffset.x}px ${bgOffset.y}px` }} preserveAspectRatio="xMidYMid meet" />}

              {/* Walls — two-pass render: fills first, then all edge lines on top.
                  This prevents double-hatching at overlaps and keeps edges always visible. */}
              {(() => {
                // Helper: compute miter corners per-side at an endpoint
                const getMiterSides = (w, c, nx, ny, halfT, nid, dirX, dirY) => {
                  const jx = nid === w.n1 ? c.x1 : c.x2, jy = nid === w.n1 ? c.y1 : c.y2;
                  const others = (nodeWallsMap[nid] || []).filter(ow => ow.id !== w.id);
                  const myAngle = Math.atan2(dirY, dirX);
                  const norm = a => ((a - myAngle) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
                  const info = others.map(ow => {
                    const oc = wc(ow); if (!oc) return null;
                    const odx = ow.n1 === nid ? oc.x2 - oc.x1 : oc.x1 - oc.x2;
                    const ody = ow.n1 === nid ? oc.y2 - oc.y1 : oc.y1 - oc.y2;
                    const olen = Math.hypot(odx, ody) || 1;
                    const oux = odx/olen, ouy = ody/olen;
                    const owk = WALL_KINDS[ow.kind || "existing"];
                    const oTI = ow.kind === "pony" ? (ow.ponyDepth || 6) : (owk.thickness || 5);
                    const oHalfT = (oTI / 12) * pxPerFoot / 2;
                    return { oux, ouy, onx: -ouy, ony: oux, oHalfT, na: norm(Math.atan2(ouy, oux)) };
                  }).filter(Boolean);
                  const lN = info.filter(o => o.na > 0.02 && o.na < Math.PI - 0.02).sort((a,b) => a.na - b.na)[0];
                  const rN = info.filter(o => o.na > Math.PI + 0.02).sort((a,b) => b.na - a.na)[0];
                  return {
                    L: lN ? wallMiterPt(jx,jy,dirX,dirY,nx,ny,halfT,lN.oux,lN.ouy,lN.onx,lN.ony,lN.oHalfT, 1) : {x:jx+nx*halfT, y:jy+ny*halfT},
                    R: rN ? wallMiterPt(jx,jy,dirX,dirY,nx,ny,halfT,rN.oux,rN.ouy,rN.onx,rN.ony,rN.oHalfT,-1) : {x:jx-nx*halfT, y:jy-ny*halfT},
                    openL: !lN, openR: !rN,
                  };
                };

                // Compute geometry for all walls once
                const wallData = walls.map(w => {
                  const c = wc(w); if (!c) return null;
                  const sel = (selectedId === w.id && selType === "wall") || selectedIds.includes(w.id);
                  const wk = WALL_KINDS[w.kind || "existing"];
                  const wLen = dst(c.x1, c.y1, c.x2, c.y2); if (wLen < 1) return null;
                  const dx = c.x2 - c.x1, dy = c.y2 - c.y1;
                  const wallThicknessIn = w.kind === "pony" ? (w.ponyDepth || 6) : (wk.thickness || 5);
                  const halfT = (wallThicknessIn / 12) * pxPerFoot / 2;
                  const nx = -dy / wLen, ny = dx / wLen;
                  const ux = dx / wLen, uy = dy / wLen;
                  const cuts = []; [...doors, ...windows].forEach(item => { const projT = ((item.x - c.x1) * dx + (item.y - c.y1) * dy) / (wLen * wLen); if (projT < -0.05 || projT > 1.05) return; const projX = c.x1 + projT * dx, projY = c.y1 + projT * dy; if (dst(item.x, item.y, projX, projY) > 8) return; const halfW = inToPx(item.width) / 2 / wLen; cuts.push({ t0: Math.max(0, projT - halfW), t1: Math.min(1, projT + halfW) }); });
                  cuts.sort((a,b) => a.t0 - b.t0); const merged = []; cuts.forEach(cu => { if (merged.length && cu.t0 <= merged[merged.length-1].t1) merged[merged.length-1].t1 = Math.max(merged[merged.length-1].t1, cu.t1); else merged.push({...cu}); });
                  const segs = []; let tS = 0; merged.forEach(cu => { if (cu.t0 > tS) segs.push({t0:tS,t1:cu.t0}); tS = cu.t1; }); if (tS < 1) segs.push({t0:tS,t1:1});
                  const hatchId = w.material && WALL_MATERIAL_HATCHES[w.material] ? WALL_MATERIAL_HATCHES[w.material] : ({demo:"hatch-demo",new:"hatch-new",pony:"hatch-pony"}[w.kind] ?? "hatch-existing");
                  const edgeColor = sel ? T.nodeFill : wk.color;
                  const edgeW = sel ? 1.5 : 1;
                  const mN1 = getMiterSides(w, c, nx, ny, halfT, w.n1,  ux,  uy);
                  const mN2 = getMiterSides(w, c, nx, ny, halfT, w.n2, -ux, -uy);
                  // Pre-compute segment corner points
                  const segPts = segs.map(seg => {
                    const ax = c.x1 + seg.t0 * dx, ay = c.y1 + seg.t0 * dy;
                    const bx = c.x1 + seg.t1 * dx, by = c.y1 + seg.t1 * dy;
                    const isFirst = seg.t0 === 0, isLast = seg.t1 === 1;
                    const sL = isFirst ? mN1.L : {x: ax+nx*halfT, y: ay+ny*halfT};
                    const sR = isFirst ? mN1.R : {x: ax-nx*halfT, y: ay-ny*halfT};
                    const eL = isLast  ? mN2.L : {x: bx+nx*halfT, y: by+ny*halfT};
                    const eR = isLast  ? mN2.R : {x: bx-nx*halfT, y: by-ny*halfT};
                    return { sL, sR, eL, eR, isFirst, isLast, pts: `${sL.x},${sL.y} ${eL.x},${eL.y} ${eR.x},${eR.y} ${sR.x},${sR.y}` };
                  });
                  return { w, c, wk, sel, halfT, nx, ny, dx, dy, hatchId, edgeColor, edgeW, mN1, mN2, segs, segPts, glowEffect: mode === "budget" && sel };
                }).filter(Boolean);

                // Sort fills: walls with more open ends (terminators) first, through-walls last.
                // This ensures through-walls always overwrite terminators' hatch at overlaps.
                const openCount = d => (d.mN1.openL?1:0)+(d.mN1.openR?1:0)+(d.mN2.openL?1:0)+(d.mN2.openR?1:0);
                const fillOrder = [...wallData].sort((a, b) => openCount(b) - openCount(a));

                return <>
                  {/* Pass 1: fills — solid background eraser + hatch. Through-walls render last so their hatch wins at T/X overlaps. */}
                  {fillOrder.map(({ w, wk, sel, hatchId, edgeColor, segPts, glowEffect }) =>
                    <g key={"f"+w.id} style={{ pointerEvents: "none" }} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                      {segPts.map((sp, i) => <g key={i}>
                        <polygon points={sp.pts} fill={T.canvas} stroke="none" />
                        <polygon points={sp.pts} fill={sel ? edgeColor + "22" : `url(#${hatchId})`} stroke="none" />
                      </g>)}
                    </g>
                  )}
                  {/* Pass 2: edge lines + hit-detection + dims — always on top of all fills */}
                  {wallData.map(({ w, c, wk, sel, halfT, edgeColor, edgeW, mN1, mN2, segPts, glowEffect }) =>
                    <g key={"s"+w.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="transparent" strokeWidth={halfT * 2 + 6} style={{ cursor: tool === "select" ? "move" : "inherit" }} />
                      {segPts.map((sp, i) => <g key={i} style={{ pointerEvents: "none" }}>
                        <line x1={sp.sL.x} y1={sp.sL.y} x2={sp.eL.x} y2={sp.eL.y} stroke={edgeColor} strokeWidth={edgeW} strokeDasharray={sel ? null : wk.dash} />
                        <line x1={sp.sR.x} y1={sp.sR.y} x2={sp.eR.x} y2={sp.eR.y} stroke={edgeColor} strokeWidth={edgeW} strokeDasharray={sel ? null : wk.dash} />
                        {sp.isFirst && mN1.openL && mN1.openR && <line x1={sp.sL.x} y1={sp.sL.y} x2={sp.sR.x} y2={sp.sR.y} stroke={edgeColor} strokeWidth={edgeW} />}
                        {sp.isLast  && mN2.openL && mN2.openR && <line x1={sp.eL.x} y1={sp.eL.y} x2={sp.eR.x} y2={sp.eR.y} stroke={edgeColor} strokeWidth={edgeW} />}
                      </g>)}
                      {showDims && <WallDim w={w} hi={sel} />}
                    </g>
                  )}
                </>;
              })()}

              {/* Zones */}
              {zones.map(z => { const lib = ZONE_LIBRARY[z.type], sel = (selectedId === z.id && selType === "zone") || selectedIds.includes(z.id);
                const glowEffect = mode === "budget" && sel;
                if (z.points) { const pts = z.points.map(p => `${p.x},${p.y}`).join(" "); const c = polyCentroid(z.points); const sf = Math.round(polyArea(z.points) / (pxPerFoot * pxPerFoot));
                  return <g key={z.id} filter={glowEffect ? "url(#glow-budget)" : undefined}><polygon points={pts} fill={lib.color + "25"} stroke={sel ? T.nodeFill : lib.color + "88"} strokeWidth={sel ? 2 : 1} strokeDasharray={sel ? "none" : "4 2"} strokeLinejoin="round" />
                    <text x={c.x} y={c.y - 4} textAnchor="middle" fill={lib.color + "CC"} fontSize={10} fontFamily="inherit" fontWeight={500} style={{ pointerEvents: "none" }}>{z.label}</text>
                    {showDims && <text x={c.x} y={c.y + 10} textAnchor="middle" fill={lib.color + "44"} fontSize={11} fontFamily="inherit" fontWeight={600} style={{ pointerEvents: "none" }}>{sf} sf</text>}
                    {sel && z.points.map((p, i) => { const j = (i + 1) % z.points.length; const p2 = z.points[j]; return <line key={"e" + i} x1={p.x} y1={p.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={14} style={{ cursor: "move" }} />; })}
                    {sel && z.points.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={7} fill={lib.color} stroke={T.nodeFill} strokeWidth={2} style={{ cursor: "move" }} /><circle cx={p.x} cy={p.y} r={3} fill={T.nodeFill} style={{ cursor: "move", pointerEvents: "none" }} /></g>)}
                  </g>; }
                return <g key={z.id} filter={glowEffect ? "url(#glow-budget)" : undefined}><rect x={z.x} y={z.y} width={z.w} height={z.h} fill={lib.color + "25"} stroke={sel ? T.nodeFill : lib.color + "88"} strokeWidth={sel ? 2 : 1} strokeDasharray={sel ? "none" : "4 2"} rx={3} />
                  <text x={z.x + 8} y={z.y + 16} fill={lib.color + "CC"} fontSize={10} fontFamily="inherit" fontWeight={500} style={{ pointerEvents: "none" }}>{z.label}</text>
                  {showDims && <><text x={z.x + z.w / 2} y={z.y + z.h + 14} textAnchor="middle" fill={T.dimText} fontSize={9} fontFamily="inherit" style={{ pointerEvents: "none" }}>{ft(z.w)}</text>
                    <text x={z.x + z.w + 14} y={z.y + z.h / 2} textAnchor="middle" dominantBaseline="middle" fill={T.dimText} fontSize={9} fontFamily="inherit" transform={`rotate(90,${z.x + z.w + 14},${z.y + z.h / 2})`} style={{ pointerEvents: "none" }}>{ft(z.h)}</text>
                    <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 4} textAnchor="middle" fill={lib.color + "44"} fontSize={11} fontFamily="inherit" fontWeight={600} style={{ pointerEvents: "none" }}>{Math.round(ftN(z.w) * ftN(z.h))} sf</text></>}
                  {sel && <rect x={z.x + z.w - 8} y={z.y + z.h - 8} width={8} height={8} fill={T.nodeFill} rx={1} cursor="se-resize" onMouseDown={e => { e.stopPropagation(); setResize({ id: z.id }); }} />}
                </g>;
              })}

              {/* Drawing previews */}
              {drawChain && cursorPos && (() => {
                const lockedDist = parseDimInput(dimInput, pxPerFoot);
                const effectiveCursor = lockedDist
                  ? (() => {
                      const angle = Math.atan2(cursorPos.y - drawChain.lastY, cursorPos.x - drawChain.lastX);
                      return { x: drawChain.lastX + Math.cos(angle) * lockedDist, y: drawChain.lastY + Math.sin(angle) * lockedDist, snap: false };
                    })()
                  : cursorPos;
                const pwk = WALL_KINDS[wallKindForTool(tool)];
                const pdx = effectiveCursor.x - drawChain.lastX, pdy = effectiveCursor.y - drawChain.lastY;
                const pLen = Math.hypot(pdx, pdy);
                if (pLen < 2) return null;
                const pThicknessIn = wallKindForTool(tool) === "pony" ? ponyDepth : (pwk.thickness || 5);
                const pHalfT = (pThicknessIn / 12) * pxPerFoot / 2;
                const pnx = -pdy / pLen, pny = pdx / pLen;
                const ax = drawChain.lastX, ay = drawChain.lastY, bx = effectiveCursor.x, by = effectiveCursor.y;
                const pts = `${ax+pnx*pHalfT},${ay+pny*pHalfT} ${bx+pnx*pHalfT},${by+pny*pHalfT} ${bx-pnx*pHalfT},${by-pny*pHalfT} ${ax-pnx*pHalfT},${ay-pny*pHalfT}`;
                const hId = { demo: "hatch-demo", new: "hatch-new", pony: "hatch-pony" }[wallKindForTool(tool)] ?? "hatch-existing";
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
                  {segLen > 10 && <DimLbl cx={(ax + bx) / 2} cy={(ay + by) / 2}
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
              })()}

              {/* Nodes */}
              {mode === "build" && nodes.map(n => { 
                const isSel = (selectedId === n.id && selType === "node") || selectedIds.includes(n.id); 
                const isHov = hoverNid === n.id; 
                const cn = nodeConns[n.id] || 0; 
                const r = isSel ? 7 : isHov ? 6 : cn > 1 ? 5 : 4;
                const showNode = isSel || isHov || (isWallTool(tool) || tool === "select");
                if (!showNode) return null;
                return <g key={n.id}><circle cx={n.x} cy={n.y} r={12} fill="transparent" style={{ cursor: "crosshair" }} />
                  <circle cx={n.x} cy={n.y} r={r} fill={isSel ? T.nodeFill : isHov ? "#50C878" : T.nodeStroke} stroke={isSel ? T.nodeFill : isHov ? "#50C878" : "#9A9488"} strokeWidth={isSel ? 2 : 1.5} style={{ pointerEvents: "none" }} />
                  {isHov && !isSel && <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke="#50C87844" strokeWidth={2} style={{ pointerEvents: "none" }} />}
                </g>;
              })}

              {/* Doors & Windows */}
              {doors.map(d => {
                const sel = (selectedId === d.id && selType === "door") || selectedIds.includes(d.id);
                const glowEffect = mode === "budget" && sel;
                return <g key={d.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                  <DoorSvg d={d} sel={sel} />
                </g>;
              })}
              {windows.map(w => {
                const sel = (selectedId === w.id && selType === "window") || selectedIds.includes(w.id);
                const glowEffect = mode === "budget" && sel;
                return <g key={w.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                  <WindowSvg w={w} sel={sel} />
                </g>;
              })}

              {/* Columns */}
              {columns.map(col => {
                const sel = (selectedId === col.id && selType === "column") || selectedIds.includes(col.id);
                const r = inToPx(col.size) / 2;
                const glowEffect = mode === "budget" && sel;
                return <g key={col.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                  {col.shape === "circle" ? (
                    <>
                      <circle cx={col.x} cy={col.y} r={r + 8} fill="transparent" style={{ cursor: tool === "select" ? "move" : "inherit" }} />
                      <circle cx={col.x} cy={col.y} r={r} fill={sel ? "#9A9488" : T.nodeStroke} stroke={sel ? T.nodeFill : "#9A9488"} strokeWidth={sel ? 2.5 : 1.5} style={{ pointerEvents: "none" }} />
                    </>
                  ) : (
                    <>
                      <rect x={col.x - r - 8} y={col.y - r - 8} width={(r + 8) * 2} height={(r + 8) * 2} fill="transparent" style={{ cursor: tool === "select" ? "move" : "inherit" }} />
                      <rect x={col.x - r} y={col.y - r} width={r * 2} height={r * 2} fill={sel ? "#9A9488" : T.nodeStroke} stroke={sel ? T.nodeFill : "#9A9488"} strokeWidth={sel ? 2.5 : 1.5} rx={2} style={{ pointerEvents: "none" }} />
                    </>
                  )}
                </g>;
              })}

              {/* Dimension strings */}
              {showDims && dims.map(d => {
                const sel = selectedId === d.id && selType === "dim";
                return <g key={d.id} onClick={() => { setSelectedId(d.id); setSelType("dim"); }}><DimString d={d} sel={sel} /></g>;
              })}

              {/* Dim tool ghost preview */}
              {tool === "dim" && ghostPos && (() => {
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
                  <DimString d={previewDim} sel={false} />
                </g>;
              })()}

              {/* Ghosts */}
              {tool === "zone" && ghostPos && (() => { const lib = ZONE_LIBRARY[activeZoneType];
                const gw = lib.defaultW, gh = lib.defaultH; return <g style={{ pointerEvents: "none" }}>
                <rect x={ghostPos.x} y={ghostPos.y} width={gw} height={gh} fill={lib.color + "15"} stroke={lib.color + "55"} strokeWidth={1.5} strokeDasharray="6 3" rx={3} />
                <text x={ghostPos.x + 8} y={ghostPos.y + 16} fill={lib.color + "88"} fontSize={10} fontFamily="inherit" fontWeight={500}>{lib.name}</text>
                <text x={ghostPos.x + gw / 2} y={ghostPos.y + gh / 2 + 4} textAnchor="middle" fill={lib.color + "44"} fontSize={11} fontFamily="inherit" fontWeight={600}>{Math.round(ftN(gw) * ftN(gh))} sf</text>
              </g>; })()}
              {tool === "marker" && ghostPos && (() => { 
                const l = SPEC_LAYERS[activeSpecLayer]; 
                const compData = SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType];
                
                if (compData?.symbol) {
                  const ghostMarker = { x: ghostPos.x, y: ghostPos.y, layer: activeSpecLayer, componentType: activeComponentType };
                  return <g style={{ pointerEvents: "none", opacity: 0.5 }}>
                    <MarkerSymbol marker={ghostMarker} selected={false} />
                  </g>;
                }
                
                const icon = compData?.icon || "📍";
                return <g style={{ pointerEvents: "none" }}>
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={9} fill={l.color + "18"} stroke={l.color + "55"} strokeWidth={1.5} strokeDasharray="4 2" />
                  <text x={ghostPos.x} y={ghostPos.y + 4} textAnchor="middle" fontSize={11} fill={l.color + "66"}>{icon}</text>
                </g>; 
              })()}
              {tool === "door" && ghostPos && <g style={{ pointerEvents: "none" }}><DoorSvg d={{ x: ghostPos.x, y: ghostPos.y, angle: ghostPos.angle || 0, width: doorWidth, flipped: false, hingeRight: false, doorType, id: "_g" }} sel={false} /></g>}
              {tool === "window" && ghostPos && <g style={{ pointerEvents: "none" }}><WindowSvg w={{ x: ghostPos.x, y: ghostPos.y, angle: ghostPos.angle || 0, width: windowWidth, type: windowType, id: "_g" }} sel={false} /></g>}
              {tool === "column" && ghostPos && (() => {
                const r = inToPx(columnSize) / 2;
                return <g style={{ pointerEvents: "none", opacity: 0.5 }}>
                  {columnShape === "circle" ? (
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={r} fill="#9A9488" stroke={T.nodeFill} strokeWidth={1.5} strokeDasharray="4 2" />
                  ) : (
                    <rect x={ghostPos.x - r} y={ghostPos.y - r} width={r * 2} height={r * 2} fill="#9A9488" stroke={T.nodeFill} strokeWidth={1.5} strokeDasharray="4 2" rx={2} />
                  )}
                </g>;
              })()}

              {/* Outlet ghost */}
              {tool === "outlet" && ghostPos && (() => {
                const ghostMarker = { x: ghostPos.x, y: ghostPos.y, layer: "power", componentType: outletType, angle: ghostPos.angle || 0 };
                const compData = SPEC_COMPONENTS.power[outletType];
                return <g style={{ pointerEvents: "none", opacity: 0.5 }}>
                  <MarkerSymbol marker={ghostMarker} selected={false} />
                  {ghostPos.snapped && <circle cx={ghostPos.x} cy={ghostPos.y} r={15} fill="none" stroke={compData?.color} strokeWidth={1} strokeDasharray="3 3" />}
                </g>;
              })()}

              {/* Markers (top) */}
              {markers.map(p => {
                const l = SPEC_LAYERS[p.layer]; 
                const ct = p.componentType;
                const isOutletInBuild = mode === "build" && p.layer === "power" &&
                  (ct?.startsWith("outlet_") || ct?.startsWith("switch_") || ct === "panel_board");
                if (!l || (!visibleLayers[p.layer] && mode !== "budget" && !isOutletInBuild)) return null; 
                const compData = SPEC_COMPONENTS[p.layer]?.[p.componentType];
                const sel = (selectedId === p.id && selType === "marker") || selectedIds.includes(p.id);
                const glowEffect = (mode === "budget" || mode === "itmep") && sel;
                
                // Use custom symbol if available, otherwise use icon
                if (compData?.symbol) {
                  return <g key={p.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                    <MarkerSymbol marker={p} selected={sel} />
                    {sel && <text x={p.x} y={p.y + 24} textAnchor="middle" fontSize={9} fill={compData.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{p.label}</text>}
                  </g>;
                }
                
                // Fallback to icon rendering
                const icon = compData?.icon || "📍";
                return <g key={p.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                  <circle cx={p.x} cy={p.y} r={sel ? 11 : 9} fill={l.color + "30"} stroke={l.color} strokeWidth={sel ? 2.5 : 1.5} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill={l.color} style={{ pointerEvents: "none" }}>{icon}</text>
                  {sel && <text x={p.x} y={p.y + 24} textAnchor="middle" fontSize={9} fill={l.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{p.label}</text>}
                </g>; 
              })}

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
              {calibrationLine && calibrationLine.p1 && (
                <g>
                  <line 
                    x1={calibrationLine.p1.x} 
                    y1={calibrationLine.p1.y} 
                    x2={calibrationLine.p2?.x || (cursorPos?.x || calibrationLine.p1.x)} 
                    y2={calibrationLine.p2?.y || (cursorPos?.y || calibrationLine.p1.y)} 
                    stroke="#E0A050" 
                    strokeWidth={3} 
                    strokeLinecap="round"
                    strokeDasharray={calibrationLine.p2 ? "0" : "6 4"}
                    style={{ pointerEvents: "none" }}
                  />
                  <circle cx={calibrationLine.p1.x} cy={calibrationLine.p1.y} r={6} fill="#E0A050" />
                  {calibrationLine.p2 && <circle cx={calibrationLine.p2.x} cy={calibrationLine.p2.y} r={6} fill="#E0A050" />}
                </g>
              )}
            </g>
          </svg>

          {/* Detail panel */}
          {(selZone || selMarker || selWall || selNode || selDoor || selWindow || selColumn || (selectedIds.length > 1 && multiSelType)) && <div style={S.det}>
            {selectedIds.length <= 1 && selNode && <><div style={{ fontSize: 11, color: T.textBright, marginBottom: 6, fontWeight: 600 }}>Node · {wallsAt(selNode.id).length} walls</div><button style={S.del} onClick={delSel}>Delete Node + Walls</button></>}
            {selectedIds.length <= 1 && selWall && (() => { const wk = WALL_KINDS[selWall.kind || "existing"]; return <>
              <div style={{ fontSize: 12, color: wk.color, marginBottom: 10, fontWeight: 600 }}>{wk.label} Wall · {ft(wl(selWall))}</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {Object.entries(WALL_KINDS).map(([k, v]) => <button key={k} style={{ padding: "6px 10px", background: (selWall.kind || "existing") === k ? v.color + "40" : "transparent", color: (selWall.kind || "existing") === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                  onClick={() => updWall({ kind: k })}>{v.label}</button>)}
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Material</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                  {WALL_MATERIALS.map(value => {
                    const isSel = (selWall.material || "Drywall") === value;
                    const patId = WALL_MATERIAL_HATCHES[value];
                    return <button key={value} onClick={() => updWall({ material: value })}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 4px", background: isSel ? T.border + "60" : "transparent", border: "1.5px solid " + (isSel ? T.accent : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="32" height="14" style={{ display: "block", borderRadius: 2, overflow: "hidden" }}>
                        <defs>
                          <clipPath id={"mc-" + value.replace(/\s|\/|\*/g, "")}><rect width="32" height="14"/></clipPath>
                        </defs>
                        <rect width="32" height="14" fill={T.bg2}/>
                        {patId && <rect width="32" height="14" fill={`url(#${patId})`} clipPath={`url(#mc-${value.replace(/\s|\/|\*/g, "")})`}/>}
                        <rect width="32" height="14" fill="none" stroke={isSel ? T.accent : T.border} strokeWidth="1"/>
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? T.textBright : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{value}</span>
                    </button>;
                  })}
                </div>
              </div>
              {(selWall.kind === "pony") && <>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min="12" max="60" value={selWall.ponyHeight || 42} onChange={e => updWall({ ponyHeight: parseInt(e.target.value) })} style={{ flex: 1, accentColor: "#C8A060", height: 4 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{selWall.ponyHeight || 42}"</span>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Depth (inches)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min="3" max="12" value={selWall.ponyDepth || 6} onChange={e => updWall({ ponyDepth: parseInt(e.target.value) })} style={{ flex: 1, accentColor: "#C8A060", height: 4 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{selWall.ponyDepth || 6}"</span>
                  </div>
                </div>
              </>}
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 72, resize: "vertical" }} value={selWall.notes || ""} onChange={e => updWall({ notes: e.target.value })} placeholder="Load-bearing, plumbing chase..." /></div>
            </>; })()}
            {selectedIds.length <= 1 && selDoor && <>
              <div style={{ fontSize: 12, color: "#C8A060", marginBottom: 10, fontWeight: 600 }}>{selDoor.doorType || "Wood"} Door · {selDoor.width}"</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {DOOR_TYPES.map(t => <button key={t} style={{ padding: "6px 10px", background: (selDoor.doorType || "Wood") === t ? T.border + "60" : "transparent", color: (selDoor.doorType || "Wood") === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => updDoor({ doorType: t })}>{t}</button>)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {DOOR_WIDTHS.map(w => <button key={w} style={{ padding: "6px 10px", background: selDoor.width === w ? T.border + "60" : "transparent", color: selDoor.width === w ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                  onClick={() => updDoor({ width: w })}>{w}"</button>)}
              </div>
              {(selDoor.doorType || "Wood") !== "Case Opening" && <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: "#C8A060", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ flipped: !selDoor.flipped })}>In/Out (F)</button>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: "#C8A060", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ hingeRight: !selDoor.hingeRight })}>Hinge (R)</button>
              </div>}
              <button style={S.del} onClick={delSel}>Delete</button>
            </>}
            {selectedIds.length <= 1 && selWindow && (() => { const isCut = selWindow.type === "Cut Opening"; const accent = isCut ? "#A09068" : "#60A0C8"; return <>
              <div style={{ fontSize: 12, color: accent, marginBottom: 10, fontWeight: 600 }}>{selWindow.type || "Window"} · {selWindow.width}"</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {WINDOW_TYPES.map(t => <button key={t} style={{ padding: "6px 10px", background: (selWindow.type || "Window") === t ? T.border + "60" : "transparent", color: (selWindow.type || "Window") === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => updWindow({ type: t })}>{t}</button>)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {WINDOW_WIDTHS.map(w => <button key={w} style={{ padding: "6px 10px", background: selWindow.width === w ? T.border + "60" : "transparent", color: selWindow.width === w ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                  onClick={() => updWindow({ width: w })}>{w}"</button>)}
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min="12" max="96" value={selWindow.height || 48} onChange={e => updWindow({ height: parseInt(e.target.value) })} style={{ flex: 1, accentColor: accent, height: 4 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{selWindow.height || 48}"</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Sill Height (inches)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min="0" max="60" value={selWindow.sill ?? 30} onChange={e => updWindow({ sill: parseInt(e.target.value) })} style={{ flex: 1, accentColor: accent, height: 4 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{selWindow.sill ?? 30}"</span>
                </div>
              </div>
              <button style={S.del} onClick={delSel}>Delete</button>
            </>; })()}
            {selectedIds.length <= 1 && selColumn && <>
              <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>Column · {selColumn.size}"</div>
              <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Shape</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: selColumn.shape === "circle" ? T.textBright : T.textMuted, background: selColumn.shape === "circle" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "circle" })}>● Circle</button>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: selColumn.shape === "square" ? T.textBright : T.textMuted, background: selColumn.shape === "square" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "square" })}>■ Square</button>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Size (inches)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min="6" max="36" value={selColumn.size} onChange={e => updColumn({ size: parseInt(e.target.value) })} style={{ flex: 1, accentColor: "#9A9488", height: 4 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{selColumn.size}"</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selColumn.label || ""} onChange={e => updColumn({ label: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={selColumn.notes || ""} onChange={e => updColumn({ notes: e.target.value })} /></div>
              <button style={S.del} onClick={delSel}>Delete Column</button>
            </>}
            {selectedIds.length <= 1 && selZone && (() => { const sf = selZone.points ? Math.round(polyArea(selZone.points) / (pxPerFoot * pxPerFoot)) : Math.round(ftN(selZone.w) * ftN(selZone.h)); return <>
              <div style={{ fontSize: 12, marginBottom: 10, fontWeight: 600, color: ZONE_LIBRARY[selZone.type].color }}>{ZONE_LIBRARY[selZone.type].name} · {sf} sf</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={selZone.type}
                  onChange={e => { const newType = e.target.value; const lib = ZONE_LIBRARY[newType]; updZone({ type: newType, label: selZone.label === ZONE_LIBRARY[selZone.type].name ? lib.name : selZone.label }); }}>
                  {Object.entries(ZONE_LIBRARY).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selZone.label} onChange={e => updZone({ label: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={selZone.notes} onChange={e => updZone({ notes: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Paint</div><div style={{ display: "flex", gap: 6 }}>
                <input type="color" value={selZone.paintColor} onChange={e => updZone({ paintColor: e.target.value })} style={{ width: 28, height: 28, border: "1.5px solid " + T.border, background: "none", cursor: "pointer", borderRadius: 5 }} />
                <input style={{ ...S.inp, flex: 1 }} value={selZone.paintFinish} onChange={e => updZone({ paintFinish: e.target.value })} placeholder="Finish" />
              </div></div>
              <div style={{ fontSize: 10, color: "#8A8478", marginBottom: 6 }}>Est: {$(ZONE_LIBRARY[selZone.type].items.reduce((s, i) => s + i.qty * i.unitCost, 0))}</div>
              <button style={S.del} onClick={delSel}>Delete Zone</button>
            </>; })()}
            {selectedIds.length <= 1 && selMarker && (() => {
              const compData = SPEC_COMPONENTS[selMarker.layer]?.[selMarker.componentType];
              const layerData = SPEC_LAYERS[selMarker.layer];
              return <>
                <div style={{ fontSize: 12, marginBottom: 10, fontWeight: 600, color: layerData?.color || "#9A9488", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{compData?.icon || "📍"}</span>
                  <span>{compData?.name || "Component"}</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Layer</div>
                  <div style={{ fontSize: 10, color: "#9A9488", padding: "6px 0" }}>{layerData?.name}</div>
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selMarker.label} onChange={e => updMarker({ label: e.target.value })} /></div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={selMarker.notes || ""} onChange={e => updMarker({ notes: e.target.value })} /></div>
                <div style={{ fontSize: 10, color: "#8A8478", marginBottom: 6 }}>Est: {$(compData?.unitCost || 0)}</div>
                <button style={S.del} onClick={delSel}>Delete Component</button>
              </>;
            })()}
            {/* Multi-select panels */}
            {selectedIds.length > 1 && multiSelType === "wall" && (() => {
              const items = multiSelItems;
              const kind = cv(items, "kind") || "existing";
              const wk = WALL_KINDS[kind];
              return <>
                <div style={{ fontSize: 12, color: wk?.color || "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Walls Selected</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {Object.entries(WALL_KINDS).map(([k, v]) => <button key={k} style={{ padding: "6px 10px", background: kind === k ? v.color + "40" : "transparent", color: kind === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => updWall({ kind: k })}>{v.label}</button>)}
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Material</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                    {WALL_MATERIALS.map(value => {
                      const isSel = (cv(items, "material") ?? "Drywall") === value;
                      const patId = WALL_MATERIAL_HATCHES[value];
                      return <button key={value} onClick={() => updWall({ material: value })}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 4px", background: isSel ? T.border + "60" : "transparent", border: "1.5px solid " + (isSel ? T.accent : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>
                        <svg width="32" height="14" style={{ display: "block", borderRadius: 2, overflow: "hidden" }}>
                          <rect width="32" height="14" fill={T.bg2}/>
                          {patId && <rect width="32" height="14" fill={`url(#${patId})`}/>}
                          <rect width="32" height="14" fill="none" stroke={isSel ? T.accent : T.border} strokeWidth="1"/>
                        </svg>
                        <span style={{ fontSize: 8, color: isSel ? T.textBright : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{value}</span>
                      </button>;
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 72, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updWall({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Walls</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "door" && (() => {
              const items = multiSelItems;
              const w = cv(items, "width");
              return <>
                <div style={{ fontSize: 12, color: "#C8A060", marginBottom: 10, fontWeight: 600 }}>{items.length} Doors Selected</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {DOOR_WIDTHS.map(dw => <button key={dw} style={{ padding: "6px 10px", background: w === dw ? T.border + "60" : "transparent", color: w === dw ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => updDoor({ width: dw })}>{dw}"</button>)}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: "#C8A060", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ flipped: !items[0]?.flipped })}>In/Out (F)</button>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: "#C8A060", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ hingeRight: !items[0]?.hingeRight })}>Hinge (R)</button>
                </div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Doors</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "window" && (() => {
              const items = multiSelItems;
              const w = cv(items, "width");
              return <>
                <div style={{ fontSize: 12, color: "#60A0C8", marginBottom: 10, fontWeight: 600 }}>{items.length} Windows Selected</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {WINDOW_WIDTHS.map(ww => <button key={ww} style={{ padding: "6px 10px", background: w === ww ? T.border + "60" : "transparent", color: w === ww ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => updWindow({ width: ww })}>{ww}"</button>)}
                </div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Windows</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "column" && (() => {
              const items = multiSelItems;
              const shape = cv(items, "shape");
              const size = cv(items, "size");
              return <>
                <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Columns Selected</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Shape</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: shape === "circle" ? T.textBright : T.textMuted, background: shape === "circle" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "circle" })}>● Circle</button>
                    <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: shape === "square" ? T.textBright : T.textMuted, background: shape === "square" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "square" })}>■ Square</button>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Size (inches)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min="6" max="36" value={size ?? 12} onChange={e => updColumn({ size: parseInt(e.target.value) })} style={{ flex: 1, accentColor: "#9A9488", height: 4 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{size !== undefined ? size + '"' : "Mixed"}</span>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={cv(items, "label") ?? ""} onChange={e => updColumn({ label: e.target.value })} placeholder={cv(items, "label") === undefined ? "Mixed" : ""} /></div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updColumn({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Columns</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "zone" && (() => {
              const items = multiSelItems;
              const type = cv(items, "type");
              return <>
                <div style={{ fontSize: 12, color: type ? ZONE_LIBRARY[type]?.color : "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Zones Selected</div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                  <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={type ?? ""}
                    onChange={e => { const nt = e.target.value; const lib = ZONE_LIBRARY[nt]; updZone({ type: nt, label: lib.name }); }}>
                    {!type && <option value="">Mixed</option>}
                    {Object.entries(ZONE_LIBRARY).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updZone({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Paint</div><div style={{ display: "flex", gap: 6 }}>
                  <input type="color" value={cv(items, "paintColor") ?? "#E8E0D0"} onChange={e => updZone({ paintColor: e.target.value })} style={{ width: 28, height: 28, border: "1.5px solid " + T.border, background: "none", cursor: "pointer", borderRadius: 5 }} />
                  <input style={{ ...S.inp, flex: 1 }} value={cv(items, "paintFinish") ?? ""} onChange={e => updZone({ paintFinish: e.target.value })} placeholder={cv(items, "paintFinish") === undefined ? "Mixed" : "Finish"} />
                </div></div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Zones</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "marker" && (() => {
              const items = multiSelItems;
              return <>
                <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Components Selected</div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updMarker({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Components</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "mixed" && <>
              <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>{selectedIds.length} Items Selected (Mixed Types)</div>
              <button style={S.del} onClick={delSel}>Delete {selectedIds.length} Items</button>
            </>}
          </div>}

          {/* Tool options panel — shown when a placement tool is active */}
          {!selectedId && ((mode === "build" && (isWallTool(tool) || tool === "door" || tool === "window" || tool === "column" || tool === "outlet")) || (mode === "zone" && tool === "zone") || (mode === "itmep" && tool === "marker")) && <div style={S.det}>

            {mode === "build" && isWallTool(tool) && (() => { const wk = WALL_KINDS[wallKindForTool(tool)]; return <>
              <div style={{ fontSize: 12, color: wk.color, marginBottom: 10, fontWeight: 600 }}>{wk.label} Wall</div>
              <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Type</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {Object.entries(WALL_KINDS).map(([k, v]) => <button key={k} style={{ padding: "6px 10px", background: wallKindForTool(tool) === k ? v.color + "40" : "transparent", color: wallKindForTool(tool) === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => setT(k === "demo" ? "wall_demo" : k === "new" ? "wall_new" : k === "pony" ? "wall_pony" : "wall")}>{v.label}</button>)}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Material</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                  {WALL_MATERIALS.map(value => {
                    const isSel = wallMaterial === value;
                    const patId = WALL_MATERIAL_HATCHES[value];
                    return <button key={value} onClick={() => setWallMaterial(value)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 4px", background: isSel ? T.border + "60" : "transparent", border: "1.5px solid " + (isSel ? T.accent : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="32" height="14" style={{ display: "block", borderRadius: 2, overflow: "hidden" }}>
                        <rect width="32" height="14" fill={T.bg2}/>
                        {patId && <rect width="32" height="14" fill={`url(#${patId})`}/>}
                        <rect width="32" height="14" fill="none" stroke={isSel ? T.accent : T.border} strokeWidth="1"/>
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? T.textBright : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{value}</span>
                    </button>;
                  })}
                </div>
              </div>
              {wallKindForTool(tool) === "pony" && <>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min="12" max="60" value={ponyHeight} onChange={e => setPonyHeight(parseInt(e.target.value))} style={{ flex: 1, accentColor: "#C8A060", height: 4 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{ponyHeight}"</span>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Depth (inches)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min="3" max="12" value={ponyDepth} onChange={e => setPonyDepth(parseInt(e.target.value))} style={{ flex: 1, accentColor: "#C8A060", height: 4 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{ponyDepth}"</span>
                  </div>
                </div>
              </>}
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={wallNotes} onChange={e => setWallNotes(e.target.value)} placeholder="Load-bearing, plumbing chase..." /></div>
              <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click points to draw · Double-click to finish</div>
            </>; })()}
            {mode === "build" && tool === "door" && <>
              <div style={{ fontSize: 12, color: "#C8A060", marginBottom: 10, fontWeight: 600 }}>{doorType} Door · {doorWidth}"</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {DOOR_TYPES.map(t => <button key={t} style={{ padding: "6px 10px", background: doorType === t ? T.border + "60" : "transparent", color: doorType === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => setDoorType(t)}>{t}</button>)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {DOOR_WIDTHS.map(w => <button key={w} style={{ padding: "6px 10px", background: doorWidth === w ? T.border + "60" : "transparent", color: doorWidth === w ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                  onClick={() => setDoorWidth(w)}>{w}"</button>)}
              </div>
              {doorType !== "Case Opening" && <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: "#C8A060", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setDoorFlipped(f => !f)}>In/Out {doorFlipped ? "✓" : ""}</button>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: "#C8A060", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setDoorHingeRight(h => !h)}>Hinge {doorHingeRight ? "R" : "L"}</button>
              </div>}
              <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
            </>}
            {mode === "build" && tool === "window" && (() => { const isCut = windowType === "Cut Opening"; const accent = isCut ? "#A09068" : "#60A0C8"; return <>
              <div style={{ fontSize: 12, color: accent, marginBottom: 10, fontWeight: 600 }}>{windowType} · {windowWidth}"</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {WINDOW_TYPES.map(t => <button key={t} style={{ padding: "6px 10px", background: windowType === t ? T.border + "60" : "transparent", color: windowType === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => setWindowType(t)}>{t}</button>)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {WINDOW_WIDTHS.map(w => <button key={w} style={{ padding: "6px 10px", background: windowWidth === w ? T.border + "60" : "transparent", color: windowWidth === w ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                  onClick={() => setWindowWidth(w)}>{w}"</button>)}
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min="12" max="96" value={windowHeight} onChange={e => setWindowHeight(parseInt(e.target.value))} style={{ flex: 1, accentColor: accent, height: 4 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{windowHeight}"</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Sill Height (inches)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min="0" max="60" value={windowSill} onChange={e => setWindowSill(parseInt(e.target.value))} style={{ flex: 1, accentColor: accent, height: 4 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{windowSill}"</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
            </>; })()}
            {mode === "build" && tool === "column" && <>
              <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>Column · {columnSize}"</div>
              <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Shape</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: columnShape === "circle" ? T.textBright : T.textMuted, background: columnShape === "circle" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setColumnShape("circle")}>● Circle</button>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: columnShape === "square" ? T.textBright : T.textMuted, background: columnShape === "square" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setColumnShape("square")}>■ Square</button>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Size (inches)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min="6" max="36" value={columnSize} onChange={e => setColumnSize(parseInt(e.target.value))} style={{ flex: 1, accentColor: "#9A9488", height: 4 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.textBright, minWidth: "32px" }}>{columnSize}"</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={columnLabel} onChange={e => setColumnLabel(e.target.value)} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={columnNotes} onChange={e => setColumnNotes(e.target.value)} /></div>
              <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
            </>}
            {mode === "build" && tool === "outlet" && (() => {
              const active = SPEC_COMPONENTS.power[outletType];
              const isSwitch = outletType.startsWith("switch_");
              const isPanel = outletType === "panel_board";
              const sectionColor = isPanel ? "#E05050" : isSwitch ? "#C8A060" : (active?.color || "#50C878");

              const OUTLET_OPTS = [
                { key: "outlet_duplex",         label: "Duplex\nIn-Wall",    color: "#50C878" },
                { key: "outlet_quad",           label: "Quad\nIn-Wall",      color: "#50C878" },
                { key: "outlet_duplex_surface", label: "Duplex\nConduit",    color: "#E0A050" },
                { key: "outlet_quad_surface",   label: "Quad\nConduit",      color: "#E0A050" },
                { key: "outlet_ceiling",        label: "Ceiling\nQuad",      color: "#60B0E0" },
              ];
              const SWITCH_OPTS = [
                { key: "switch_single",  label: "Single\nPole",  color: "#C8A060" },
                { key: "switch_double",  label: "Double\nPole",  color: "#C8A060" },
                { key: "switch_dimmer", label: "Dimmer",        color: "#C8A060" },
              ];

              return <>
                <div style={{ fontSize: 12, color: sectionColor, marginBottom: 10, fontWeight: 600 }}>Electrical · {active?.name}</div>

                {/* Outlets section */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Outlets</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 14 }}>
                  {OUTLET_OPTS.map(({ key: oKey, label, color }) => {
                    const isSel = outletType === oKey;
                    const isQuad = oKey.includes("quad");
                    const isSurf = oKey.includes("surface");
                    const isCeil = oKey === "outlet_ceiling";
                    return <button key={oKey} onClick={() => setOutletType(oKey)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        {isSurf && <rect x="2" y="2" width="24" height="24" rx="2" stroke={color} strokeWidth="1" strokeDasharray="3 2" />}
                        {isCeil ? <>
                          <circle cx="14" cy="14" r="9" stroke={color} strokeWidth="1.5" />
                          <line x1="5" y1="14" x2="23" y2="14" stroke={color} strokeWidth="1.5" />
                          <line x1="14" y1="5" x2="14" y2="23" stroke={color} strokeWidth="1.5" />
                          <circle cx="14" cy="14" r="3" fill={color} />
                        </> : <>
                          <circle cx="14" cy="14" r="9" stroke={color} strokeWidth="1.5" />
                          <line x1="5" y1="14" x2="23" y2="14" stroke={color} strokeWidth="2" />
                          <text x="14" y="12" textAnchor="middle" fontSize="7" fill={color} fontWeight="bold">{isQuad ? "Q" : "D"}</text>
                        </>}
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? color : T.textMuted, textAlign: "center", lineHeight: 1.3, whiteSpace: "pre-line" }}>{label}</span>
                    </button>;
                  })}
                </div>

                {/* Switches section */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Switches</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
                  {SWITCH_OPTS.map(({ key: oKey, label, color }) => {
                    const isSel = outletType === oKey;
                    return <button key={oKey} onClick={() => setOutletType(oKey)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect x="5" y="5" width="18" height="18" rx="2" fill={color + "18"} stroke={color} strokeWidth="1.5" />
                        <line x1="9" y1="19" x2="17" y2="8" stroke={color} strokeWidth="2" />
                        <circle cx="17" cy="8" r="2.5" fill={color} />
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? color : T.textMuted, textAlign: "center", lineHeight: 1.3, whiteSpace: "pre-line" }}>{label}</span>
                    </button>;
                  })}
                </div>

                {/* Panel Board section */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Panel</div>
                <div style={{ marginBottom: 14 }}>
                  {(() => {
                    const isSel = outletType === "panel_board";
                    const pcolor = "#E05050";
                    return <button onClick={() => setOutletType("panel_board")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", width: "100%", background: isSel ? pcolor + "22" : "transparent", border: "1.5px solid " + (isSel ? pcolor : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                        <rect x="3" y="2" width="22" height="32" rx="2" fill={pcolor + "18"} stroke={pcolor} strokeWidth="1.5" />
                        {[6, 12, 18, 24].map(y => <rect key={y} x="9" y={y - 2} width="10" height="4" rx="1" fill={pcolor + "55"} />)}
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? pcolor : T.textMuted, textAlign: "center", lineHeight: 1.3 }}>Panel Board</span>
                    </button>;
                  })()}
                </div>

                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>Est. {$(active?.unitCost || 0)}{outletType.startsWith("outlet_") ? " / outlet" : ""}</div>
                <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
                {outletType !== "outlet_ceiling" && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Snaps to nearest wall</div>}
              </>;
            })()}
            {mode === "zone" && tool === "zone" && (() => { const zt = ZONE_LIBRARY[activeZoneType]; return <>
              <div style={{ fontSize: 12, color: zt.color, marginBottom: 10, fontWeight: 600 }}>{zt.name}</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={activeZoneType}
                  onChange={e => setActiveZoneType(e.target.value)}>
                  {Object.entries(ZONE_LIBRARY).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={zoneNotes} onChange={e => setZoneNotes(e.target.value)} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Paint</div><div style={{ display: "flex", gap: 6 }}>
                <input type="color" value={zonePaintColor} onChange={e => setZonePaintColor(e.target.value)} style={{ width: 28, height: 28, border: "1.5px solid " + T.border, background: "none", cursor: "pointer", borderRadius: 5 }} />
                <input style={{ ...S.inp, flex: 1 }} value={zonePaintFinish} onChange={e => setZonePaintFinish(e.target.value)} placeholder="Finish" />
              </div></div>
              <div style={{ fontSize: 10, color: "#8A8478", marginBottom: 6 }}>Est: {$(zt.items.reduce((s, i) => s + i.qty * i.unitCost, 0))}</div>
              <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
            </>; })()}
            {mode === "itmep" && tool === "marker" && (() => {
              const compData = SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType];
              const layerData = SPEC_LAYERS[activeSpecLayer];
              return <>
                <div style={{ fontSize: 12, color: layerData?.color || "#9A9488", marginBottom: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{compData?.icon || "📍"}</span>
                  <span>{compData?.name || "Component"}</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Layer</div>
                  <div style={{ fontSize: 10, color: "#9A9488", padding: "6px 0" }}>{layerData?.name}</div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Component</div>
                  <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={activeComponentType}
                    onChange={e => setActiveComponentType(e.target.value)}>
                    {Object.entries(SPEC_COMPONENTS[activeSpecLayer] || {}).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={markerNotes} onChange={e => setMarkerNotes(e.target.value)} /></div>
                <div style={{ fontSize: 10, color: "#8A8478", marginBottom: 6 }}>Est: {$(compData?.unitCost || 0)}</div>
                <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
              </>;
            })()}
          </div>}

          {bgImage && <div style={S.bg}><span style={{ color: T.textMuted, fontSize: 10, fontWeight: 500 }}>Underlay</span><input type="range" min="0" max="100" value={bgOpacity * 100} onChange={e => setBgOpacity(e.target.value / 100)} style={{ width: 70, accentColor: "#9A9488", height: 4 }} /><span style={{ fontSize: 10, fontWeight: 500 }}>{Math.round(bgOpacity * 100)}%</span></div>}

          {/* ── Floating Toolbar ────────────────────────────────────── */}
          {mode === "build" && (
            <div style={S.floatingToolbar}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    style={S.toolBtn(tool === "select")} 
                    onClick={() => setT("select")}
                  >
                    <MousePointer2 size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Select (V)</TooltipContent>
              </Tooltip>
              
              <div style={S.toolSep} />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    style={S.toolBtn(tool === "wall", "#9A9488")} 
                    onClick={() => setT("wall")}
                  >
                    <WallIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Existing Wall (W)</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    style={S.toolBtn(tool === "wall_demo", "#E05050")} 
                    onClick={() => setT("wall_demo")}
                  >
                    <DemoWallIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Demo Wall</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    style={S.toolBtn(tool === "wall_new", "#50A0E0")} 
                    onClick={() => setT("wall_new")}
                  >
                    <NewWallIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>New Wall</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    style={S.toolBtn(tool === "wall_pony", "#C8A060")}
                    onClick={() => setT("wall_pony")}
                  >
                    <PonyWallIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Pony Wall</TooltipContent>
              </Tooltip>

              <div style={S.toolSep} />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    style={S.toolBtn(tool === "door")}
                    onClick={() => setT("door")}
                  >
                    <DoorOpen size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Door</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    style={S.toolBtn(tool === "window")} 
                    onClick={() => setT("window")}
                  >
                    <WindowIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Window</TooltipContent>
              </Tooltip>

              <div style={S.toolSep} />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    style={S.toolBtn(tool === "column")}
                    onClick={() => setT("column")}
                  >
                    <ColumnIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Column (C)</TooltipContent>
              </Tooltip>

              <div style={S.toolSep} />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "outlet", "#50C878")} onClick={() => setT("outlet")}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="7" stroke="#50C878" strokeWidth="1.5" />
                      <line x1="3" y1="10" x2="17" y2="10" stroke="#50C878" strokeWidth="2" />
                      <text x="10" y="9" textAnchor="middle" fontSize="5.5" fill="#50C878" fontWeight="bold">D</text>
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Outlet (E)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "dim", T.dimText)} onClick={() => setT("dim")}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <line x1="3" y1="10" x2="17" y2="10" stroke={T.dimText} strokeWidth="1" />
                      <line x1="3" y1="6" x2="3" y2="14" stroke={T.dimText} strokeWidth="1.5" />
                      <line x1="17" y1="6" x2="17" y2="14" stroke={T.dimText} strokeWidth="1.5" />
                      <line x1="3" y1="7" x2="5.5" y2="10" stroke={T.dimText} strokeWidth="1" />
                      <line x1="3" y1="13" x2="5.5" y2="10" stroke={T.dimText} strokeWidth="1" />
                      <line x1="17" y1="7" x2="14.5" y2="10" stroke={T.dimText} strokeWidth="1" />
                      <line x1="17" y1="13" x2="14.5" y2="10" stroke={T.dimText} strokeWidth="1" />
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Dimension (M)</TooltipContent>
              </Tooltip>

              {bgImage && (<>
                <div style={S.toolSep} />
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "calibrate", "#E0A050")} 
                      onClick={() => setT("calibrate")}
                    >
                      <Ruler size={20} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Calibrate Scale</TooltipContent>
                </Tooltip>
              </>)}
            </div>
          )}


          {/* ── IT/MEP Toolbar ──────────────────────────────────��──────── */}
          {mode === "itmep" && (
            <div style={S.floatingToolbar}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    style={S.toolBtn(tool === "select")} 
                    onClick={() => setT("select")}
                  >
                    <MousePointer2 size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Select (V)</TooltipContent>
              </Tooltip>
              
              <div style={S.toolSep} />
              
              {/* Power components */}
              {activeSpecLayer === "power" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "duplex_outlet", SPEC_LAYERS.power.color)} 
                      onClick={() => { setActiveComponentType("duplex_outlet"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="#50A070" /></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Duplex Outlet</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "quad_outlet", SPEC_LAYERS.power.color)} 
                      onClick={() => { setActiveComponentType("quad_outlet"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="#E05050" /></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Quad Outlet</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "dedicated_quad", SPEC_LAYERS.power.color)} 
                      onClick={() => { setActiveComponentType("dedicated_quad"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="#4080E0" /></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Dedicated Quad Circuit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "ceiling_quad", SPEC_LAYERS.power.color)} 
                      onClick={() => { setActiveComponentType("ceiling_quad"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#E05050" strokeWidth="2" /><line x1="3" y1="10" x2="17" y2="10" stroke="#E05050" strokeWidth="2" /><line x1="10" y1="3" x2="10" y2="17" stroke="#E05050" strokeWidth="2" /></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Ceiling Quad Outlet</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "tstat", SPEC_LAYERS.power.color)} 
                      onClick={() => { setActiveComponentType("tstat"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#E05050" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#E05050" fontWeight="bold">T</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>T-Stat</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "sconce_prewire", SPEC_LAYERS.power.color)} 
                      onClick={() => { setActiveComponentType("sconce_prewire"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#E05050" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#E05050" fontWeight="bold">S</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Sconce Prewire</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "pendent_prewire", SPEC_LAYERS.power.color)} 
                      onClick={() => { setActiveComponentType("pendent_prewire"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#E05050" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#E05050" fontWeight="bold">P</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Pendent Prewire</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      style={S.toolBtn(tool === "marker" && activeComponentType === "htrack_4", SPEC_LAYERS.power.color)}
                      onClick={() => { setActiveComponentType("htrack_4"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="6" width="16" height="8" fill="none" stroke="#E05050" strokeWidth="2" rx="1" /><text x="10" y="13" textAnchor="middle" fontSize="8" fill="#E05050" fontWeight="bold">4'</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>H-Track 4'</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      style={S.toolBtn(tool === "marker" && activeComponentType === "htrack_8", SPEC_LAYERS.power.color)}
                      onClick={() => { setActiveComponentType("htrack_8"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="6" width="16" height="8" fill="none" stroke="#E05050" strokeWidth="2" rx="1" /><text x="10" y="13" textAnchor="middle" fontSize="8" fill="#E05050" fontWeight="bold">8'</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>H-Track 8'</TooltipContent>
                </Tooltip>
              </>}
              
              {/* AV components */}
              {activeSpecLayer === "av" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "wall_speaker", SPEC_LAYERS.av.color)} 
                      onClick={() => { setActiveComponentType("wall_speaker"); setT("marker"); }}
                    >
                      <span style={{ fontSize: 16 }}>🔊</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Wall Speaker</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "subwoofer", SPEC_LAYERS.av.color)} 
                      onClick={() => { setActiveComponentType("subwoofer"); setT("marker"); }}
                    >
                      <span style={{ fontSize: 16 }}>📻</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Subwoofer</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "pendant_speaker", SPEC_LAYERS.av.color)} 
                      onClick={() => { setActiveComponentType("pendant_speaker"); setT("marker"); }}
                    >
                      <span style={{ fontSize: 16 }}>🔈</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Pendant Speaker</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "speaker_line", SPEC_LAYERS.av.color)} 
                      onClick={() => { setActiveComponentType("speaker_line"); setT("marker"); }}
                    >
                      <span style={{ fontSize: 16 }}>📡</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Speaker Line</TooltipContent>
                </Tooltip>
              </>}
              
              {/* IT components */}
              {activeSpecLayer === "it" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "router", SPEC_LAYERS.it.color)} 
                      onClick={() => { setActiveComponentType("router"); setT("marker"); }}
                    >
                      <span style={{ fontSize: 16 }}>📶</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Router</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "access_point", SPEC_LAYERS.it.color)} 
                      onClick={() => { setActiveComponentType("access_point"); setT("marker"); }}
                    >
                      <span style={{ fontSize: 16 }}>📡</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Access Point</TooltipContent>
                </Tooltip>
              </>}
              
              {/* MEP components */}
              {activeSpecLayer === "mep" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "drain_line", SPEC_LAYERS.mep.color)} 
                      onClick={() => { setActiveComponentType("drain_line"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#50A070" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#50A070" fontWeight="bold">D</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Drain Line</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "water_line", SPEC_LAYERS.mep.color)} 
                      onClick={() => { setActiveComponentType("water_line"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#5050A0" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#5050A0" fontWeight="bold">W</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Water Line</TooltipContent>
                </Tooltip>
              </>}
              
              {/* Security components */}
              {activeSpecLayer === "security" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "white_camera", SPEC_LAYERS.security.color)} 
                      onClick={() => { setActiveComponentType("white_camera"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#E8E0D0" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#E8E0D0" fontWeight="bold">C</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>White Camera</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "black_camera", SPEC_LAYERS.security.color)} 
                      onClick={() => { setActiveComponentType("black_camera"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#2A2A26" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#2A2A26" fontWeight="bold">C</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Black Camera</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      style={S.toolBtn(tool === "marker" && activeComponentType === "outdoor_camera", SPEC_LAYERS.security.color)} 
                      onClick={() => { setActiveComponentType("outdoor_camera"); setT("marker"); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#556B2F" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#556B2F" fontWeight="bold">O</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Outdoor Camera</TooltipContent>
                </Tooltip>
              </>}
            </div>
          )}

          {/* ── Bottom Status Bar ────────────────────────────────────── */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#242422", borderTop: "1px solid #3A3A32", padding: "6px 16px", display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: "#5A5448", zIndex: 10 }}>
            {mode === "zone" && (
              <span style={{ color: ZONE_LIBRARY[activeZoneType]?.color || "#5A5448", fontSize: 10, fontWeight: 500 }}>
                {ZONE_LIBRARY[activeZoneType]?.name || "—"}
              </span>
            )}
            
            {mode === "itmep" && (
              <span style={{ color: SPEC_LAYERS[activeSpecLayer]?.color || "#5A5448", fontSize: 10, fontWeight: 500 }}>
                {SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType]?.icon} {SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType]?.name}
              </span>
            )}
            
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: T.textMuted }}>{Math.round(zoom * 100)}%</span>
            <div style={{ width: 1, height: 18, background: "#3A3A32" }} />
            <span style={{ color: "#E8C840", fontWeight: 600, fontSize: 11 }}>{$(cost.total)}</span>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
