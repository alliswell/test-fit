import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { MousePointer2, X, Plus, DoorOpen, Ruler, Box, LayoutDashboard, RotateCcw, RotateCw, Undo2, Redo2, Tag, Settings, ChevronDown, ChevronRight, Trash2, GitBranch, Columns2, PanelLeft, PanelLeftClose } from "lucide-react";
import ZONE_LIBRARY_DEFAULTS from "../data/zone-library.json";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../app/components/ui/tooltip";
import TestFit3D from "./testfit3d";

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

// Zone library defaults are defined in src/data/zone-library.json.
// The active library lives in component state (zoneLibrary) so it can be
// edited at runtime and persisted per-project.
const ZONE_LIBRARY = ZONE_LIBRARY_DEFAULTS; // legacy alias — component code uses zoneLibrary state

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
    panel_board:           { name: "Electrical Panel",                symbol: "panel",          color: "#E05050", letter: "P", unitCost: 2800, mount: "inwall" },
    // Lighting
    light_can_4:    { name: "4\" Recessed Can",    symbol: "recessed",   color: "#E8D070", letter: null, unitCost: 280, size: 4,  mount: "ceiling" },
    light_can_6:    { name: "6\" Recessed Can",    symbol: "recessed",   color: "#E8D070", letter: null, unitCost: 340, size: 6,  mount: "ceiling" },
    light_pendant:  { name: "Pendant Light",        symbol: "pendant",    color: "#E8D070", letter: "P",  unitCost: 450,           mount: "ceiling" },
    light_linear_2: { name: "Linear Fixture 2'",    symbol: "linear_lt",  color: "#E8D070", letter: null, unitCost: 320, ftLen: 2, mount: "ceiling" },
    light_linear_4: { name: "Linear Fixture 4'",    symbol: "linear_lt",  color: "#E8D070", letter: null, unitCost: 480, ftLen: 4, mount: "ceiling" },
    light_sconce:   { name: "Wall Sconce",          symbol: "sconce",     color: "#E8D070", letter: "W",  unitCost: 380,           mount: "inwall"  },
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

// Pick bidirectional resize cursor based on wall angle
const wallResizeCursor = (x1, y1, x2, y2) => {
  const a = (Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI % 180 + 180) % 180;
  if (a < 22.5 || a >= 157.5) return "ns-resize";
  if (a < 67.5)  return "nesw-resize";
  if (a < 112.5) return "ew-resize";
  return "nwse-resize";
};

// CAD-style crosshair cursor (data URI)
const cadCrosshair = (color) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cline x1='16' y1='0' x2='16' y2='14' stroke='${color}' stroke-width='1'/%3E%3Cline x1='16' y1='18' x2='16' y2='32' stroke='${color}' stroke-width='1'/%3E%3Cline x1='0' y1='16' x2='14' y2='16' stroke='${color}' stroke-width='1'/%3E%3Cline x1='18' y1='16' x2='32' y2='16' stroke='${color}' stroke-width='1'/%3E%3C/svg%3E") 16 16, crosshair`;

const WALL_KINDS = {
  existing: { label: "Existing", color: "#9A9488", dash: null,  thickness: 7   },
  demo:     { label: "Demo",     color: "#E05050", dash: "8 4", thickness: 7   },
  new:      { label: "New",      color: "#50A0E0", dash: null,  thickness: 7   },
  pony:     { label: "Pony",     color: "#C8A060", dash: null,  thickness: 4,   thin: true },
};
// Darker wall colors for light-mode rendering — high contrast on the pale canvas.
const WALL_KINDS_LIGHT = {
  existing: { label: "Existing", color: "#3A352A", dash: null,  thickness: 7   },
  demo:     { label: "Demo",     color: "#B83838", dash: "8 4", thickness: 7   },
  new:      { label: "New",      color: "#1F5FA8", dash: null,  thickness: 7   },
  pony:     { label: "Pony",     color: "#86601E", dash: null,  thickness: 4,   thin: true },
};

// Slider + inline number input — replaces both button grids and static range+span combos
function SliderInput({ value, min, max, step = 1, onChange, accent = "#9A9488", textColor = "#E8E0D0", bgColor = "#2A2826", borderColor = "#3A3830", unit = '"', disabled = false }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value ?? ""));
  useEffect(() => { if (!editing) setRaw(String(value ?? "")); }, [value, editing]);
  const commit = () => {
    const v = Math.min(max, Math.max(min, parseInt(raw) || min));
    onChange(v);
    setEditing(false);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="range" min={min} max={max} step={step} value={value ?? min} disabled={disabled}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{ flex: 1, accentColor: accent, height: 4, cursor: "pointer", opacity: disabled ? 0.4 : 1 }} />
      {editing ? (
        <input type="number" min={min} max={max} value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setRaw(String(value ?? "")); } }}
          autoFocus
          style={{ width: 44, fontSize: 12, fontWeight: 600, color: textColor, background: bgColor, border: "1px solid " + borderColor, borderRadius: 4, padding: "2px 4px", textAlign: "center", fontFamily: "inherit" }}
        />
      ) : (
        <span onClick={() => { if (!disabled) { setRaw(String(value ?? "")); setEditing(true); } }}
          title={disabled ? undefined : "Click to type exact value"}
          style={{ fontSize: 12, fontWeight: 600, color: disabled ? borderColor : textColor, minWidth: "36px", textAlign: "right", cursor: disabled ? "default" : "text", borderBottom: disabled ? "none" : "1px dashed " + borderColor, paddingBottom: 1 }}
        >{disabled ? "—" : (value ?? "—")}{disabled ? "" : unit}</span>
      )}
    </div>
  );
}

const DOOR_WIDTHS = [36, 48, 60];
const DOOR_TYPES = ["Wood", "Glass", "Metal", "Case Opening"];
const DOOR_HEIGHT_IN = 84; // 7'-0" standard door height (matches 3D DOOR_HEIGHT_FT)
const WINDOW_WIDTHS = [24, 36, 48, 60];
const WINDOW_TYPES = ["Window", "Cut Opening"];

const FLOW_PATH_COLORS = ["#4A90D9", "#2BB3A3", "#E0A030", "#9B6BD6"]; // blue, teal, amber, violet

// Drag types where proximity-hover preview should stay live (so nearby snap
// targets light up as the user drags a face/edge/vertex/element near them).
const PROX_DRAG_TYPES = new Set([
  "node", "marker", "door", "window", "column",
  "zone", "zone-vertex", "zone-edge",
  "revcloud", "revcloud-vertex", "revcloud-edge",
  "floorRegion", "floorRegion-vertex", "floorRegion-edge",
  "flowPath", "flowPath-vertex",
]);

const WALL_MATERIALS = ["Drywall", "Brick", "CMU / Block", "Concrete", "Plaster", "Other"];
const WALL_MATERIAL_HATCHES = {
  "Drywall":     "mat-drywall",
  "Brick":       "mat-brick",
  "CMU / Block": "mat-cmu",
  "Concrete":    "mat-concrete",
  "Plaster":     "mat-plaster",
  "Other":       "mat-other",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const sn = (v, g) => Math.round(v / g) * g;

// Smart guide snapping — returns snapped {x,y} and guide lines to draw
const GUIDE_THRESH = 7; // canvas px; ~4" at default scale
function applySmartGuides(x, y, targets) {
  let sx = x, sy = y;
  const guides = [];
  let bestDX = GUIDE_THRESH + 1, bestDY = GUIDE_THRESH + 1;
  let vSnapX = null, hSnapY = null;

  // Find the closest snap on each axis
  for (const t of targets) {
    const dx = Math.abs(t.x - x), dy = Math.abs(t.y - y);
    if (dx < bestDX) { bestDX = dx; vSnapX = t.x; sx = t.x; }
    if (dy < bestDY) { bestDY = dy; hSnapY = t.y; sy = t.y; }
  }

  // Vertical guide (shared x): only when within snap threshold
  if (vSnapX !== null && bestDX <= GUIDE_THRESH) {
    const aligned = targets.filter(t => Math.abs(t.x - vSnapX) <= GUIDE_THRESH);
    const pts = [...new Set([...aligned.map(t => t.y), y])].sort((a, b) => a - b);
    guides.push({ axis: 'v', pos: vSnapX, points: pts });
  }

  // Horizontal guide (shared y): only when within snap threshold
  if (hSnapY !== null && bestDY <= GUIDE_THRESH) {
    const aligned = targets.filter(t => Math.abs(t.y - hSnapY) <= GUIDE_THRESH);
    const pts = [...new Set([...aligned.map(t => t.x), x])].sort((a, b) => a - b);
    guides.push({ axis: 'h', pos: hSnapY, points: pts });
  }

  return { x: sx, y: sy, guides };
}
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
// 2D line–line intersection: point P moving in direction pd meets point Q moving in direction qd.
// Returns the intersection, falling back to P when parallel or |t| exceeds cap.
const lineInt = (px, py, pdx, pdy, qx, qy, qdx, qdy, cap) => {
  const den = pdx * qdy - pdy * qdx;
  if (Math.abs(den) < 0.001) return { x: px, y: py };
  const t = ((qx - px) * qdy - (qy - py) * qdx) / den;
  if (cap != null && Math.abs(t) > cap) return { x: px, y: py };
  return { x: px + pdx * t, y: py + pdy * t };
};
const wallMiterPt = (jx, jy, d1x, d1y, n1x, n1y, h1, d2x, d2y, n2x, n2y, h2, side) => {
  const Px = jx + n1x * h1 * side, Py = jy + n1y * h1 * side;
  const Qx = jx + n2x * h2 * side, Qy = jy + n2y * h2 * side;
  return lineInt(Px, Py, d1x, d1y, Qx, Qy, d2x, d2y, Math.max(h1, h2) * 6);
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
    // UI accent colors (sidebar/panel text — distinct from canvas marker colors)
    uiLighting: "#E8D070", uiElec: "#50C878", uiDoor: "#C8A060",
    uiSwitch: "#C8A060", uiBudget: "#E8C840", uiPanel: "#E05050",
    uiConduit: "#E0A050", uiPrewire: "#C87840",
  },
  light: {
    bg0: "#EEE7DC", bg1: "#E7DFD3", bg2: "#DDD5C8", bg3: "#D3CBBE", border: "#BDB5A5",
    text: "#3A342C", textBright: "#1C1810", textMuted: "#7A7268", textDim: "#9A9285", textFaint: "#B0A898",
    accent: "#5A5248", accentDim: "#8A8278",
    canvas: "#EEE7DC", gridMajor: "#BDB5A520", gridMinor: "#9A928510", gridSub: "#BDB5A5",
    nodeStroke: "#EEE7DC", nodeFill: "#1C1810",
    selBg: "#BDB5A540", selBorder: "#A89E8E",
    panelBg: "#E7DFD3F5", panelShadow: "0 8px 24px rgba(0,0,0,0.10)",
    toolbarBg: "#E7DFD3F0", toolbarShadow: "0 8px 24px rgba(0,0,0,0.10)",
    delBg: "#DEB8B8", delText: "#7A1A1A",
    dimText: "#1C181055", wallNode: "#1C1810",
    crosshairColor: "%231C1810",
    // UI accent colors — darkened for legibility on warm light background
    uiLighting: "#7A6010", uiElec: "#1A6E3A", uiDoor: "#7A5518",
    uiSwitch: "#7A5518", uiBudget: "#8A6A10", uiPanel: "#B02020",
    uiConduit: "#8A5A10", uiPrewire: "#7A4818",
  }
};

const DEFAULT_PHASES = [
  { id: "existing", name: "Existing", color: "#9A9488", visible: true },
  { id: "phase1",   name: "v0",       color: "#4A7EC0", visible: true },
  { id: "phase2",   name: "v1",       color: "#4A9060", visible: true },
  { id: "phase3",   name: "v2",       color: "#9060B0", visible: true },
  { id: "phase4",   name: "v3",       color: "#B06040", visible: true },
];

// Shared label bounding box — single source of truth for both rendering and hit-testing
const LABEL_MAX_W = 160;
function wrapLabelLines(text, fontSize) {
  const charW = fontSize * 0.6;
  const maxChars = Math.max(1, Math.floor((LABEL_MAX_W - 16) / charW));
  const result = [];
  for (const rawLine of (text || "").split("\n")) {
    if (!rawLine) { result.push(""); continue; }
    const words = rawLine.split(" ");
    let cur = "";
    for (const word of words) {
      const next = cur ? cur + " " + word : word;
      if (next.length <= maxChars || !cur) { cur = next; }
      else { result.push(cur); cur = word; }
    }
    if (cur) result.push(cur);
  }
  return result.length ? result : [""];
}
function labelBounds(lbl) {
  const lineH = Math.round(lbl.fontSize * 1.4);
  const lines = wrapLabelLines(lbl.text, lbl.fontSize);
  const charW = lbl.fontSize * 0.6;
  const w = Math.min(Math.max(...lines.map(l => l.length * charW), 20) + 16, LABEL_MAX_W);
  const h = lines.length * lineH + 8;
  return { w: Math.max(w, 36), h: Math.max(h, lbl.fontSize + 8), lines, lineH };
}

// Stable sub-components for the Align & Distribute panel (hoisted to avoid remounting on every render)
function LabelAnnotation({ lbl, sel, tool, bg }) {
  const labelFont = "'Inter', 'SF Pro', system-ui, sans-serif";
  const fontW = lbl.bold ? 700 : 400;
  const fontStyle = lbl.italic ? "italic" : "normal";
  const { w: approxW, h: approxH, lines, lineH } = labelBounds(lbl);
  const color = lbl.color;
  const firstLineY = lbl.y - ((lines.length - 1) * lineH) / 2;
  return <g style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
    {lbl.lx != null && <>
      <line x1={lbl.lx} y1={lbl.ly} x2={lbl.x} y2={lbl.y}
        stroke={color} strokeWidth={sel ? 1.5 : 1} opacity={0.85} style={{ pointerEvents: "none" }} />
      <circle cx={lbl.lx} cy={lbl.ly} r={3} fill={color} opacity={0.85} style={{ pointerEvents: "none" }} />
    </>}
    <rect x={lbl.x - approxW / 2} y={lbl.y - approxH / 2} width={approxW} height={approxH}
      fill={bg} fillOpacity={0.9} stroke={color} strokeWidth={sel ? 1.5 : 1} strokeOpacity={0.75} rx={3} />
    {sel && <rect x={lbl.x - approxW / 2 - 4} y={lbl.y - approxH / 2 - 4}
      width={approxW + 8} height={approxH + 8} fill="none"
      stroke={color} strokeWidth={1} strokeDasharray="4 3" rx={4} opacity={0.5} style={{ pointerEvents: "none" }} />}
    {lbl.text
      ? lines.map((line, i) => (
          <text key={i} x={lbl.x} y={firstLineY + i * lineH} textAnchor="middle" dominantBaseline="middle"
            fontSize={lbl.fontSize} fontWeight={fontW} fontStyle={fontStyle}
            fill={color} fontFamily={labelFont} style={{ pointerEvents: "none" }}>{line || " "}</text>
        ))
      : <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={lbl.fontSize} fill={color} opacity={0.35} fontFamily={labelFont} style={{ pointerEvents: "none" }}>Label…</text>}
  </g>;
}

function AlignBtn({ action, label, tip, onAction, border, accent, textMuted, textBright }) {
  const base = { flex: 1, padding: "5px 0", background: "transparent", border: "1.5px solid " + border, borderRadius: 5, cursor: "pointer", color: textMuted, fontSize: 10, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s ease" };
  return (
    <button style={base} title={tip} onClick={() => onAction(action)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = textBright; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textMuted; }}>
      {label}
    </button>
  );
}

function revCloudPath(points, arcR) {
  if (points.length < 3) return "";
  let signed = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    signed += (points[j].x - points[i].x) * (points[j].y + points[i].y);
  }
  const sweep = signed < 0 ? 1 : 0;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.001) continue;
    const count = Math.max(1, Math.round(len / (arcR * 2)));
    const sx = (b.x - a.x) / count, sy = (b.y - a.y) / count;
    for (let j = 0; j < count; j++) {
      const ex = a.x + sx * (j + 1), ey = a.y + sy * (j + 1);
      d += ` A ${arcR} ${arcR} 0 0 ${sweep} ${ex} ${ey}`;
    }
  }
  return d + " Z";
}

// ─── 2D Elevation view ──────────────────────────────────────────────────────
// Orthographic side projection of the model along one cardinal axis. Read-only
// (view + annotate); geometry editing stays in plan/3D. Each instance owns its
// own pan/zoom camera.
function ElevationView({ dir, nodes, walls, doors, windows, columns, ceilingHeight, pxPerFoot, T,
  selectedId, selType, onSelect, ft, tool, anno, onPlaceDim, onPlaceLabel, onUpdateDim, onUpdateLabel }) {
  const svgRef = useRef(null);
  const [cam, setCam] = useState(null); // { tx, ty, z } — null until first auto-fit
  const panRef = useRef(null);
  const dimDraftRef = useRef(null);
  const [dimDraft, setDimDraft] = useState(null); // elevation-space {x1,y1,x2,y2?}

  // Project a plan point (x,y) to elevation horizontal u + depth d (for painter sort).
  const proj = useCallback((x, y) => {
    switch (dir) {
      case "back":  return { u: -x, d: -y };
      case "left":  return { u: y, d: -x };
      case "right": return { u: -y, d: x };
      default:      return { u: x, d: y }; // front
    }
  }, [dir]);
  const vAt = useCallback((heightIn) => -(heightIn / 12) * pxPerFoot, [pxPerFoot]); // up = negative
  const ceilV = vAt(ceilingHeight);

  const nodeMap = useMemo(() => { const m = new Map(); for (const n of nodes) m.set(n.id, n); return m; }, [nodes]);

  // Build projected, depth-sorted draw list.
  const items = useMemo(() => {
    const out = [];
    let dMin = Infinity, dMax = -Infinity; // building front-to-back depth extent (this view)
    for (const w of walls) {
      const a = nodeMap.get(w.n1), b = nodeMap.get(w.n2); if (!a || !b) continue;
      const pa = proj(a.x, a.y), pb = proj(b.x, b.y);
      dMin = Math.min(dMin, pa.d, pb.d); dMax = Math.max(dMax, pa.d, pb.d);
      const u1 = Math.min(pa.u, pb.u), u2 = Math.max(pa.u, pb.u);
      if (u2 - u1 < 0.5) continue; // wall is edge-on to this elevation — skip sliver
      const wk = WALL_KINDS[w.kind || "existing"];
      const topIn = w.kind === "pony" ? (w.ponyHeight || 42) : (w.ceilingHeight ?? ceilingHeight);
      out.push({ kind: "wall", id: w.id, u1, u2, top: vAt(topIn), d: (pa.d + pb.d) / 2,
        color: wk.color, dash: wk.dash, demo: w.kind === "demo" });
    }
    // Hidden-surface rule: an elevation only shows openings on the near half of the
    // building (the face the viewer sees). Far-wall openings are hidden behind the
    // near wall, so Front and Back (and Left/Right) show distinct, non-mirrored faces.
    const midD = (dMin + dMax) / 2;
    const cull = (dMax - dMin) > pxPerFoot; // only when there's real depth between faces
    const opening = (arr, type) => {
      for (const it of arr) {
        // Project the opening's two ends ALONG its host wall (angle in degrees) so it
        // stays on that wall's plane — full width when the wall faces the viewer,
        // collapsing to edge-on (skipped) when the wall is perpendicular to the view.
        const rad = ((it.angle || 0) * Math.PI) / 180;
        const half = ((it.width || 36) / 12) * pxPerFoot / 2;
        const e1 = proj(it.x - Math.cos(rad) * half, it.y - Math.sin(rad) * half);
        const e2 = proj(it.x + Math.cos(rad) * half, it.y + Math.sin(rad) * half);
        if (Math.abs(e2.u - e1.u) < 1) continue; // edge-on to this elevation — its wall isn't shown here
        const d = (e1.d + e2.d) / 2;
        if (cull && d < midD - 0.5) continue; // on the far face — hidden behind the near wall
        out.push({ kind: type, id: it.id, u1: Math.min(e1.u, e2.u), u2: Math.max(e1.u, e2.u), d, item: it });
      }
    };
    opening(doors, "door");
    opening(windows, "window");
    for (const c of columns) {
      const p = proj(c.x, c.y);
      const halfW = ((c.size || 12) / 12) * pxPerFoot / 2;
      out.push({ kind: "column", id: c.id, u1: p.u - halfW, u2: p.u + halfW, d: p.d, top: ceilV });
    }
    return out.sort((m, n) => m.d - n.d); // far → near
  }, [walls, doors, windows, columns, nodeMap, proj, vAt, ceilingHeight, ceilV, pxPerFoot]);

  // Content bounds (pre-camera) for auto-fit.
  const bounds = useMemo(() => {
    let uMin = Infinity, uMax = -Infinity;
    for (const it of items) { uMin = Math.min(uMin, it.u1); uMax = Math.max(uMax, it.u2); }
    if (!isFinite(uMin)) { uMin = -100; uMax = 100; }
    return { uMin, uMax, vTop: ceilV, vBot: 0 };
  }, [items, ceilV]);

  // Auto-fit camera once we know the pane size (and refit when direction changes).
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const m = 48;
      const cw = (bounds.uMax - bounds.uMin) || 200, ch = (bounds.vBot - bounds.vTop) || 200;
      const z = Math.min((r.width - 2 * m) / cw, (r.height - 2 * m) / ch, 4);
      const cx = (bounds.uMin + bounds.uMax) / 2, cy = (bounds.vTop + bounds.vBot) / 2;
      setCam({ z, tx: r.width / 2 - cx * z, ty: r.height / 2 - cy * z });
    };
    fit();
  }, [dir, bounds.uMin, bounds.uMax, bounds.vTop, bounds.vBot]);

  const cm = cam || { tx: 0, ty: 0, z: 1 };
  // screen <-> elevation conversions
  const toScreen = (u, v) => ({ x: u * cm.z + cm.tx, y: v * cm.z + cm.ty });
  const toElev = (sx, sy) => ({ x: (sx - cm.tx) / cm.z, y: (sy - cm.ty) / cm.z });
  const svgPt = (e) => { const r = svgRef.current.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; };

  const onWheel = (e) => {
    e.preventDefault();
    const { sx, sy } = svgPt(e);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setCam(c => { const cc = c || cm; const z2 = Math.min(10, Math.max(0.05, cc.z * factor));
      const ux = (sx - cc.tx) / cc.z, uy = (sy - cc.ty) / cc.z;
      return { z: z2, tx: sx - ux * z2, ty: sy - uy * z2 }; });
  };

  const onBgDown = (e) => {
    const { sx, sy } = svgPt(e);
    if (tool === "dim" || tool === "label") {
      const p = toElev(sx, sy);
      if (tool === "label") { onPlaceLabel?.(p); return; }
      // dim: 2-click
      if (!dimDraftRef.current) { dimDraftRef.current = { x1: p.x, y1: p.y }; setDimDraft({ x1: p.x, y1: p.y }); }
      else { const d = { ...dimDraftRef.current, x2: p.x, y2: p.y }; dimDraftRef.current = null; setDimDraft(null); onPlaceDim?.(d); }
      return;
    }
    // pan
    panRef.current = { startX: e.clientX, startY: e.clientY, tx: cm.tx, ty: cm.ty };
    const move = (ev) => setCam(c => ({ ...(c || cm), tx: panRef.current.tx + (ev.clientX - panRef.current.startX), ty: panRef.current.ty + (ev.clientY - panRef.current.startY) }));
    const up = () => { panRef.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  const sel = (id, type) => (e) => { e.stopPropagation(); onSelect?.(id, type); };
  const isSel = (id, type) => selectedId === id && selType === type;

  // Drag an existing annotation (elevation space). part: "p1"/"p2"/"line" for dims, "move" for labels.
  const startAnnoDrag = (kind, id, part, e) => {
    if (tool !== "select") return; // dim/label tools place new ones; only Select drags
    e.stopPropagation();
    onSelect?.(id, kind === "dim" ? "elevDim" : "elevLabel");
    const s0 = svgPt(e), e0 = toElev(s0.sx, s0.sy);
    const src = kind === "dim" ? (anno?.dims || []).find(x => x.id === id) : (anno?.labels || []).find(x => x.id === id);
    if (!src) return;
    const move = (ev) => {
      const p = svgPt(ev), cur = toElev(p.sx, p.sy);
      const dx = cur.x - e0.x, dy = cur.y - e0.y;
      if (kind === "label") { onUpdateLabel?.(id, { x: src.x + dx, y: src.y + dy }); return; }
      if (part === "p1") onUpdateDim?.(id, { x1: src.x1 + dx, y1: src.y1 + dy });
      else if (part === "p2") onUpdateDim?.(id, { x2: src.x2 + dx, y2: src.y2 + dy });
      else onUpdateDim?.(id, { x1: src.x1 + dx, y1: src.y1 + dy, x2: src.x2 + dx, y2: src.y2 + dy });
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  // Datum lines in screen space (full pane width)
  const floorY = toScreen(0, 0).y, ceilY = toScreen(0, ceilV).y;
  const annoDims = anno?.dims || [], annoLabels = anno?.labels || [];

  return (
    <svg ref={svgRef} width="100%" height="100%" onMouseDown={onBgDown} onWheel={onWheel}
      style={{ display: "block", background: T.canvas, cursor: (tool === "dim" || tool === "label") ? "crosshair" : "grab" }}>
      {/* Floor + ceiling datum lines */}
      <line x1={0} y1={floorY} x2="100%" y2={floorY} stroke={T.textMuted} strokeWidth={1} opacity={0.6} />
      <line x1={0} y1={ceilY} x2="100%" y2={ceilY} stroke={T.textMuted} strokeWidth={0.75} strokeDasharray="5 4" opacity={0.4} />
      <text x={6} y={floorY - 4} fontSize={9} fill={T.textMuted} fontFamily="inherit">FIN. FLOOR 0'-0"</text>
      <text x={6} y={ceilY - 4} fontSize={9} fill={T.textMuted} fontFamily="inherit">CEILING {ft((ceilingHeight / 12) * pxPerFoot)}</text>

      {items.map((it, i) => {
        if (it.kind === "wall") {
          const a = toScreen(it.u1, 0), b = toScreen(it.u2, it.top);
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(a.y - b.y);
          const on = isSel(it.id, "wall");
          return <rect key={"w" + it.id + i} x={x} y={y} width={w} height={h}
            fill={it.demo ? "none" : it.color + "55"} stroke={on ? T.accent : it.color}
            strokeWidth={on ? 2 : 1} strokeDasharray={it.dash || "none"}
            onClick={sel(it.id, "wall")} style={{ cursor: "pointer" }} />;
        }
        if (it.kind === "window") {
          const sill = it.item.sill ?? 30, hgt = it.item.height ?? 48;
          const a = toScreen(it.u1, vAt(sill)), b = toScreen(it.u2, vAt(sill + hgt));
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(a.y - b.y);
          const on = isSel(it.id, "window");
          return <g key={"win" + it.id + i} onClick={sel(it.id, "window")} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width={w} height={h} fill={"#7FB4D6" + "33"} stroke={on ? T.accent : "#60A0C8"} strokeWidth={on ? 2 : 1.2} />
            <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={"#60A0C8"} strokeWidth={0.6} opacity={0.6} />
          </g>;
        }
        if (it.kind === "door") {
          const a = toScreen(it.u1, 0), b = toScreen(it.u2, vAt(DOOR_HEIGHT_IN));
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(a.y - b.y);
          const on = isSel(it.id, "door");
          return <rect key={"d" + it.id + i} x={x} y={y} width={w} height={h}
            fill={"#A9885F" + "33"} stroke={on ? T.accent : "#A9885F"} strokeWidth={on ? 2 : 1.2}
            onClick={sel(it.id, "door")} style={{ cursor: "pointer" }} />;
        }
        // column
        const a = toScreen(it.u1, 0), b = toScreen(it.u2, it.top);
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(a.y - b.y);
        const on = isSel(it.id, "column");
        return <rect key={"c" + it.id + i} x={x} y={y} width={w} height={h}
          fill={T.nodeStroke + "66"} stroke={on ? T.accent : "#9A9488"} strokeWidth={on ? 2 : 1}
          onClick={sel(it.id, "column")} style={{ cursor: "pointer" }} />;
      })}

      {/* Annotations (elevation space) — selectable + draggable with the Select tool */}
      {annoDims.map(d => {
        const p1 = toScreen(d.x1, d.y1), p2 = toScreen(d.x2, d.y2);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const lenIn = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) / pxPerFoot * 12;
        const on = isSel(d.id, "elevDim");
        const interactive = tool === "select";
        return <g key={d.id}>
          {/* wide transparent hit line — select + drag whole dim */}
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={12}
            onMouseDown={e => startAnnoDrag("dim", d.id, "line", e)}
            style={{ cursor: interactive ? "move" : "inherit", pointerEvents: interactive ? "stroke" : "none" }} />
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={on ? T.accent : T.dimText} strokeWidth={on ? 1.6 : 1} style={{ pointerEvents: "none" }} />
          <text x={mid.x} y={mid.y - 4} textAnchor="middle" fontSize={10} fill={on ? T.accent : T.dimText} fontFamily="inherit" style={{ pointerEvents: "none" }}>{ft((lenIn / 12) * pxPerFoot)}</text>
          {on && interactive && [["p1", p1], ["p2", p2]].map(([part, p]) => (
            <circle key={part} cx={p.x} cy={p.y} r={5} fill={T.accent} stroke={T.nodeFill} strokeWidth={1.5}
              onMouseDown={e => startAnnoDrag("dim", d.id, part, e)} style={{ cursor: "move" }} />
          ))}
        </g>;
      })}
      {annoLabels.map(l => {
        const p = toScreen(l.x, l.y);
        const on = isSel(l.id, "elevLabel");
        const interactive = tool === "select";
        return <text key={l.id} x={p.x} y={p.y} fontSize={11} fill={on ? T.accent : T.textBright} fontFamily="inherit"
          onMouseDown={e => startAnnoDrag("label", l.id, "move", e)}
          style={{ cursor: interactive ? "move" : "inherit", pointerEvents: interactive ? "auto" : "none" }}>{l.text || "Label"}</text>;
      })}
      {dimDraft && (() => { const p = toScreen(dimDraft.x1, dimDraft.y1); return <circle cx={p.x} cy={p.y} r={3} fill={T.accent} />; })()}

      <text x={6} y={16} fontSize={10} fontWeight={700} fill={T.textMuted} fontFamily="inherit" style={{ letterSpacing: "0.08em" }}>{dir.toUpperCase()} ELEVATION</text>
    </svg>
  );
}

export default function TestfitTool() {
  const [themeMode, setThemeMode] = useState("light");
  const T = THEMES[themeMode];
  const wallKinds = themeMode === "light" ? WALL_KINDS_LIGHT : WALL_KINDS;
  const [projectName, setProjectName] = useState("New Club");
  const [nodes, setNodes] = useState([]);
  const [walls, setWalls] = useState([]); // {id, n1, n2, kind:"existing"|"demo"|"new"}
  const [zones, setZones] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [doors, setDoors] = useState([]); // {id, x, y, angle, width, flipped}
  const [windows, setWindows] = useState([]); // {id, x, y, angle, width}
  const [columns, setColumns] = useState([]); // {id, x, y, size, shape:"circle"|"square"}
  const [dims, setDims] = useState([]); // [{id, x1, y1, x2, y2, offset}]
  const [labels, setLabels] = useState([]); // [{id, x, y, text, fontSize, bold, italic, color, phase, lx, ly, anchorId, anchorType}]
  const [revClouds, setRevClouds] = useState([]); // [{id, points:[{x,y}], arcR:8, label:"", color:"#E05252", phase}]
  const [drawRevCloud, setDrawRevCloud] = useState(null); // null | {points:[{x,y}]}
  const [flowPaths, setFlowPaths] = useState([]); // [{id, points:[{x,y,anchorId?}], width, color, phase, label?}]
  const [drawFlowPath, setDrawFlowPath] = useState(null); // null | { points:[{x,y}] }
  const [floorMaterial, setFloorMaterial] = useState("Wood"); // project default floor: Wood | Concrete | Vinyl | Carpet
  const [floorRegions, setFloorRegions] = useState([]); // [{id, points:[{x,y}], material, phase, label?}]
  // Per-direction elevation annotations (separate coord space from plan dims/labels).
  // Declared here (before `snapshot`) so it's initialized when snapshot's deps evaluate.
  const [elevAnnotations, setElevAnnotations] = useState({});
  const [drawFloorRegion, setDrawFloorRegion] = useState(null); // null | { points:[{x,y}] }
  const FLOOR_MATERIALS = ["Wood", "Concrete", "Vinyl", "Carpet"];
  const FLOOR_MATERIAL_HEX = { "Wood": "#C8A878", "Concrete": "#AEABA4", "Vinyl": "#BFA889", "Carpet": "#786758" };
  const FLOOR_MATERIAL_HATCHES = { "Wood": "floor-hatch-wood", "Concrete": "floor-hatch-concrete", "Vinyl": "floor-hatch-vinyl", "Carpet": "floor-hatch-carpet" };
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [addingLeaderToId, setAddingLeaderToId] = useState(null);
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
  const MAX_HISTORY = 50;
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const snapshot = useCallback(() => {
    if (skipSnapshotRef.current) { skipSnapshotRef.current = false; return; }
    const state = JSON.stringify({ nodes, walls, zones, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, floorMaterial, elevAnnotations });
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
  }, [nodes, walls, zones, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, floorMaterial, elevAnnotations]);

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
    setColumns(state.columns || []); setDims(state.dims || []); setLabels(state.labels || []); setRevClouds(state.revClouds || []); setFlowPaths(state.flowPaths || []); setFloorRegions(state.floorRegions || []); if (state.floorMaterial) setFloorMaterial(state.floorMaterial);
    setElevAnnotations(state.elevAnnotations || {});
    setSelectedId(null); setSelType(null);
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
    setNodes(state.nodes); setWalls(state.walls); setZones(state.zones);
    setMarkers(state.markers); setDoors(state.doors); setWindows(state.windows);
    setColumns(state.columns || []); setDims(state.dims || []); setLabels(state.labels || []); setRevClouds(state.revClouds || []); setFlowPaths(state.flowPaths || []); setFloorRegions(state.floorRegions || []); if (state.floorMaterial) setFloorMaterial(state.floorMaterial);
    setElevAnnotations(state.elevAnnotations || {});
    setSelectedId(null); setSelType(null);
    setCanUndo(true);
    setCanRedo(newIdx < historyRef.current.length - 1);
  }, []);

  // tool: select, pan, wall, zone, marker, door, window, column, calibrate
  const [tool, setTool] = useState("select");
  const [activeZoneType, setActiveZoneType] = useState("entry");
  const [activeSpecLayer, setActiveSpecLayer] = useState("power");
  const [activeComponentType, setActiveComponentType] = useState("duplex_outlet");
  const [visibleLayers, setVisibleLayers] = useState({ power: true, av: true, it: true, mep: true, security: true });
  const [visibleBuildElectrical, setVisibleBuildElectrical] = useState(true);
  const [visibleBuildLighting, setVisibleBuildLighting] = useState(true);
  const [visibleZones, setVisibleZones] = useState(true);
  const [visibleDims, setVisibleDims] = useState(true);
  const [visibleLabels, setVisibleLabels] = useState(true);
  const [visibleRevClouds, setVisibleRevClouds] = useState(true);
  const [visibleFlowPaths, setVisibleFlowPaths] = useState(true);
  const [visibleFloorRegions, setVisibleFloorRegions] = useState(true);
  const [visibleITMEP, setVisibleITMEP] = useState(true); // master IT/MEP marker visibility (all modes)
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selType, setSelType] = useState(null);
  const [marquee, setMarquee] = useState(null); // { startX, startY, endX, endY }
  const [calibrationLine, setCalibrationLine] = useState(null); // { p1: {x, y}, p2: {x, y} }
  const [calibrationFeet, setCalibrationFeet] = useState("10");
  const gs = 20;
  const [showGrid, setShowGrid] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [zoneEdge, setZoneEdge] = useState(null); // { id, edge, cursor } for rect-zone edge hover
  // ── View panes ───────────────────────────────────────────────────────
  // panes[0] is always the interactive Plan canvas; aux panes (1..3) each pick
  // a view among 3d / front / back / left / right. 1 / 2 / 4 panes = single /
  // split / quad layout.
  const [panes, setPanes] = useState([{ view: "plan" }]);
  const [splitPos, setSplitPos] = useState(0.5);   // vertical divider (left column fraction)
  const [splitPosV, setSplitPosV] = useState(0.5); // horizontal divider (top row fraction, quad)
  const splitDragRef = useRef(null); // { axis, startPos, containerPx }
  const splitContainerRef = useRef(null); // ref for the flex container holding the panes
  const ELEV_DIRS = ["front", "back", "left", "right"];
  const PANE_VIEW_LABEL = { plan: "Plan", "3d": "3D", front: "Front", back: "Back", left: "Left", right: "Right" };
  // Derived compatibility flags — full-screen 3D is retired (3D lives in aux panes),
  // so existing `view3d`/`splitView` reads keep working: plan is always visible.
  const view3d = false;
  const splitView = panes.length > 1;
  const show3d = panes.some(p => p.view === "3d");
  const setLayout = (n) => setPanes(prev => {
    const aux = prev.slice(1);
    if (n <= 1) return [{ view: "plan" }];
    if (n === 2) return [{ view: "plan" }, aux[0] || { view: "3d" }];
    return [{ view: "plan" }, aux[0] || { view: "3d" }, aux[1] || { view: "front" }, aux[2] || { view: "left" }];
  });
  const setPaneView = (i, view) => setPanes(prev => prev.map((p, idx) => idx === i ? { ...p, view } : p));
  const [ceilingHeight, setCeilingHeight] = useState(108); // 9'-0" in inches
  const controls3dRef = useRef(null);
  const [show3dLabels, setShow3dLabels] = useState(false);
  const [show3dDims,   setShow3dDims]   = useState(false);
  const [style3d, setStyle3d] = useState("clay"); // "clay" | "xray" | "detailed"
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
  const [rotatingMarker, setRotatingMarker] = useState(null); // { id, cx, cy }
  const [clipboard, setClipboard] = useState(null); // { walls, nodes, doors, windows, columns, markers, zones }
  const [pasteOffset, setPasteOffset] = useState(0); // increments each paste
  const [lastCopyInfo, setLastCopyInfo] = useState(null); // { srcItems:[{id,type,x,y}], dx, dy } for "/" repeat-distribute
  const [repeatInput, setRepeatInput] = useState(null); // null = inactive; string = digits typed after "/"
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
  // Proximity hover — preview the nearest hoverable object as cursor approaches.
  // Lights up at PROX_R px, brightens linearly as cursor closes in.
  const [proxHover, setProxHover] = useState(null); // null | { type, id, x, y, dist }
  const [ghostPos, setGhostPos] = useState(null);
  const [smartGuides, setSmartGuides] = useState([]);

  // Dynamic snap grid: 1" at 300%+, 3" at 150%+, 1' otherwise
  const snapGrid = zoom >= 3 ? pxPerFoot / 12 : zoom >= 1.5 ? pxPerFoot / 4 : pxPerFoot;
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

  // ── Project management ─────────────────────────────────────────────
  // captureModel: the full live model WITHOUT snapshot meta (used as a snapshot's data).
  const captureModel = useCallback(() => ({
    projectName, nodes, walls, zones, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, floorMaterial,
    elevAnnotations,
    bgOpacity, bgScale, bgOffset, pxPerFoot, showDims, zoneLibrary,
    version: "testfit-v8",
  }), [projectName, nodes, walls, zones, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, floorMaterial, elevAnnotations, bgOpacity, bgScale, bgOffset, pxPerFoot, showDims, zoneLibrary]);

  // getProjectData: full file payload — model + snapshot library + view layout.
  const getProjectData = useCallback(() => ({
    ...captureModel(), snapshots, activeSnapshotId, panes, splitPos, splitPosV,
  }), [captureModel, snapshots, activeSnapshotId, panes, splitPos, splitPosV]);

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

  // loadModel: replace the live working state from a captured model blob.
  const loadModel = useCallback((d) => {
    if (!d) return;
    const arr = (x) => Array.isArray(x) ? x : [];
    setProjectName(d.projectName || "Untitled");
    setNodes(arr(d.nodes)); setWalls(arr(d.walls)); setZones(arr(d.zones));
    setMarkers(arr(d.markers)); setDoors(arr(d.doors)); setWindows(arr(d.windows));
    setColumns(arr(d.columns)); setDims(arr(d.dims)); setLabels(arr(d.labels)); setRevClouds(arr(d.revClouds)); setFlowPaths(arr(d.flowPaths)); setFloorRegions(arr(d.floorRegions)); if (d.floorMaterial) setFloorMaterial(d.floorMaterial);
    setElevAnnotations(d.elevAnnotations && typeof d.elevAnnotations === "object" ? d.elevAnnotations : {});
    setBgOpacity(d.bgOpacity ?? 0.35); setBgScale(d.bgScale ?? 1);
    setBgOffset(d.bgOffset ?? { x: 0, y: 0 });
    if (d.pxPerFoot) setPxPerFoot(d.pxPerFoot);
    if (d.showDims !== undefined) setShowDims(d.showDims);
    if (d.zoneLibrary) setZoneLibrary(d.zoneLibrary);
    historyRef.current = []; historyIdxRef.current = -1;
    setCanUndo(false); setCanRedo(false);
  }, []);

  // ── Snapshot operations ──────────────────────────────────────────────
  // Has the live model diverged from the active snapshot's stored data?
  // Stringify the live model once per actual model change (captureModel's identity
  // only changes when the underlying data does) — keeps drag/hover re-renders cheap.
  const liveModelStr = useMemo(() => JSON.stringify(captureModel()), [captureModel]);
  const liveDirtyMemo = useMemo(() => {
    if (!activeSnapshotId) return (nodes.length || zones.length || markers.length) > 0;
    const snap = snapshots.find(s => s.id === activeSnapshotId);
    if (!snap) return true;
    return liveModelStr !== JSON.stringify(snap.data);
  }, [activeSnapshotId, snapshots, liveModelStr, nodes, zones, markers]);
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
      ctx.fillStyle = themeMode === "dark" ? "#1A1812" : "#FAFAF8";
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
    const bgColor = themeMode === "dark" ? "#1A1812" : "#FAFAF8";
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
        const arr = (v) => Array.isArray(v) ? v : [];
        setProjectName(d.projectName || "Imported");
        setNodes(arr(d.nodes)); setWalls(arr(d.walls)); setZones(arr(d.zones));
        setMarkers(arr(d.markers)); setDoors(arr(d.doors));
        const migratedCutouts = arr(d.cutouts).map(c => ({ ...c, type: "Cut Opening" }));
        setWindows([...arr(d.windows), ...migratedCutouts]);
        setColumns(arr(d.columns)); setDims(arr(d.dims)); setLabels(arr(d.labels)); setRevClouds(arr(d.revClouds)); setFlowPaths(arr(d.flowPaths)); setFloorRegions(arr(d.floorRegions)); if (d.floorMaterial) setFloorMaterial(d.floorMaterial);
        setElevAnnotations(d.elevAnnotations && typeof d.elevAnnotations === "object" ? d.elevAnnotations : {});
        if (Array.isArray(d.panes) && d.panes.length) setPanes(d.panes); else setPanes([{ view: "plan" }]);
        if (typeof d.splitPos === "number") setSplitPos(d.splitPos);
        if (typeof d.splitPosV === "number") setSplitPosV(d.splitPosV);
        setBgOpacity(d.bgOpacity ?? 0.35); setBgScale(d.bgScale ?? 1);
        setBgOffset(d.bgOffset ?? { x: 0, y: 0 });
        if (d.pxPerFoot) setPxPerFoot(d.pxPerFoot);
        if (d.showDims !== undefined) setShowDims(d.showDims);
        if (d.zoneLibrary && typeof d.zoneLibrary === "object") setZoneLibrary(d.zoneLibrary);
        // Snapshots: prefer the new field; migrate legacy `versions` (named full-state
        // snapshots) into the new library when present.
        if (Array.isArray(d.snapshots)) {
          setSnapshots(d.snapshots);
          setActiveSnapshotId(d.activeSnapshotId ?? null);
        } else if (Array.isArray(d.versions) && d.versions.length) {
          setSnapshots(d.versions.map(v => ({ id: v.id || uid(), name: v.name || "Snapshot", ts: v.ts || Date.now(), data: v.data })));
          setActiveSnapshotId(null);
        } else {
          setSnapshots([]); setActiveSnapshotId(null);
        }
        setBgImage(null);
        setSelectedId(null); setSelType(null);
        historyRef.current = []; historyIdxRef.current = -1;
        setCanUndo(false); setCanRedo(false);
      } catch (e) { console.error("Import failed:", e); alert("Failed to import project: " + e.message); }
    };
    reader.readAsText(file);
  }, []);

  const newProject = useCallback(() => {
    setProjectName("New Club"); setNodes([]); setWalls([]); setZones([]);
    setMarkers([]); setDoors([]); setWindows([]); setDims([]); setLabels([]); setRevClouds([]); setFlowPaths([]); setFloorRegions([]); setFloorMaterial("Wood");
    setElevAnnotations({}); setPanes([{ view: "plan" }]);
    setBgImage(null); setBgOpacity(0.35); setBgScale(1); setBgOffset({ x: 0, y: 0 });
    setPxPerFoot(20); setShowDims(true); setShowGrid(true);
    setSelectedId(null); setSelType(null); setDrawChain(null); setDrawPolyZone(null); setCursorPos(null);
    setViewOff({ x: 0, y: 0 }); setZoom(1);
    historyRef.current = []; historyIdxRef.current = -1;
    setCanUndo(false); setCanRedo(false);
    setZoneLibrary(ZONE_LIBRARY_DEFAULTS);
    localStorage.removeItem("testfit-zone-library");
    setPhases(DEFAULT_PHASES); setActivePhase("existing"); setSnapshots([]); setActiveSnapshotId(null);
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
  const wl = useCallback((w) => { const c = wc(w); return c ? dst(c.x1, c.y1, c.x2, c.y2) : 0; }, [wc]);
  const wa = useCallback((w) => { const c = wc(w); return c ? (Math.atan2(c.y2 - c.y1, c.x2 - c.x1) * 180) / Math.PI : 0; }, [wc]);
  const findNear = useCallback((x, y, excl) => { let best = null, bd = SNAP_R; for (const n of nodes) { if (excl?.includes(n.id)) continue; const d = dst(x, y, n.x, n.y); if (d < bd) { best = n; bd = d; } } return best; }, [nodes]);
  // Proximity-hover scan — broader radius than findNear (which is for click-snap).
  // Walks wall nodes, markers, columns, doors, windows, dim endpoints, label anchors,
  // and (when their parent is selected) zone / floor region / revcloud / flow path vertices.
  const findProxHover = useCallback((x, y) => {
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
      for (const m of markers) { if (m.layer !== "power" || !markerVisible(m)) continue; const rp = resolvePos(m); add("marker", m.id, rp.x, rp.y); }
    } else if (mode === "itmep") {
      for (const m of markers) { if (!markerVisible(m)) continue; const rp = resolvePos(m); add("marker", m.id, rp.x, rp.y); }
    }
    // ── Universal annotations (available in every mode that allows selecting them) ──
    for (const lbl of labels) { if (!phaseVisible(lbl.phase)) continue;
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
  }, [mode, nodes, markers, columns, doors, windows, labels, zones, floorRegions, revClouds, flowPaths, selType, selectedId, markerVisible, phaseVisible, resolvePos, resolvePoints]);
  const wallsAt = useCallback((nid) => walls.filter(w => w.n1 === nid || w.n2 === nid), [walls]);

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

  const isWallTool = (t) => t === "wall";

  // Save/Load
  const save = useCallback(async () => {
    const payload = JSON.stringify({ projectName, nodes, walls, zones, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, floorMaterial, bgOpacity, bgScale, bgOffset, pxPerFoot, showDims });
    try {
      if (window.storage) { await window.storage.set("testfit:v4", payload); }
      else { localStorage.setItem("testfit:v4", payload); }
    } catch (e) { console.warn("Auto-save failed:", e); }
  }, [projectName, nodes, walls, zones, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, floorMaterial, bgOpacity, bgScale, bgOffset, pxPerFoot, showDims]);
  const load = useCallback(async () => {
    try {
      let raw = null;
      if (window.storage) { const r = await window.storage.get("testfit:v4"); raw = r?.value ?? null; }
      else { raw = localStorage.getItem("testfit:v4"); }
      if (raw) {
        const d = JSON.parse(raw);
        const migratedCutouts = (d.cutouts || []).map(c => ({ ...c, type: "Cut Opening" }));
        const loadedNodes = d.nodes || [];
        setProjectName(d.projectName || "New Club"); setNodes(loadedNodes); setWalls(d.walls || []); setZones(d.zones || []); setMarkers(d.markers || []); setDoors(d.doors || []); setWindows([...(d.windows || []), ...migratedCutouts]); setColumns(d.columns || []); setDims(d.dims || []); setLabels(d.labels || []); setRevClouds(d.revClouds || []); setFlowPaths(d.flowPaths || []); setFloorRegions(d.floorRegions || []); if (d.floorMaterial) setFloorMaterial(d.floorMaterial); setBgOpacity(d.bgOpacity ?? 0.35); setBgScale(d.bgScale ?? 1); setBgOffset(d.bgOffset ?? { x: 0, y: 0 }); if (d.pxPerFoot) setPxPerFoot(d.pxPerFoot); if (d.showDims !== undefined) setShowDims(d.showDims);
        if (loadedNodes.length) setTimeout(() => fitAll(loadedNodes), 50);
      }
    } catch (e) { console.warn("Auto-load failed:", e); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(save, 800); return () => clearTimeout(t); }, [save]);

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
      const w = { id: uid(), n1: n1Id, n2: n2Id, kind, phase: activePhase };
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
  }, [findNear, wc, wallMaterial, wallPaintColor, wallPaintFinish, wallNotes, ponyHeight, ponyDepth, activePhase]);

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
      // Pre-build set of node IDs connected to at least one visible wall — O(walls) once vs O(nodes×walls) per node
      const visibleWallNodeIds = new Set(walls.filter(w => phaseVisible(w.phase)).flatMap(w => [w.n1, w.n2]));
      for (const n of nodes) {
        if (!visibleWallNodeIds.has(n.id)) continue;
        if (dst(pos.x, pos.y, n.x, n.y) < 10) return { type: "node", id: n.id };
      }
      for (let i = columns.length - 1; i >= 0; i--) { const col = columns[i]; if (!phaseVisible(col.phase)) continue; const rp = resolvePos(col); const r = inToPx(col.size) / 2; if (dst(pos.x, pos.y, rp.x, rp.y) < r + 4) return { type: "column", id: col.id }; }
      for (let i = markers.length - 1; i >= 0; i--) {
        const p = markers[i];
        if (p.layer !== "power") continue;
        if (!markerVisible(p)) continue;
        const rp = resolvePos(p);
        const ct = p.componentType;
        const isHtrack = ct === "htrack_4" || ct === "htrack_8" || ct === "htrack";
        if (isHtrack) {
          const ftLen = ct === "htrack_8" ? 8 : 4;
          const lenPx = ftLen * pxPerFoot, widPx = 0.25 * pxPerFoot;
          const angle = p.angle || 0;
          const ddx = pos.x - rp.x, ddy = pos.y - rp.y;
          const lx = ddx * Math.cos(-angle) - ddy * Math.sin(-angle);
          const ly = ddx * Math.sin(-angle) + ddy * Math.cos(-angle);
          if (Math.abs(lx) <= lenPx / 2 + 8 && Math.abs(ly) <= widPx / 2 + 8) return { type: "marker", id: p.id };
        } else if (ct?.startsWith("light_linear")) {
          const ftLen = ct === "light_linear_4" ? 4 : 2;
          const lenPx = ftLen * pxPerFoot, widPx = 8;
          const angle = p.angle || 0;
          const ddx = pos.x - rp.x, ddy = pos.y - rp.y;
          const lx = ddx * Math.cos(-angle) - ddy * Math.sin(-angle);
          const ly = ddx * Math.sin(-angle) + ddy * Math.cos(-angle);
          if (Math.abs(lx) <= lenPx / 2 + 8 && Math.abs(ly) <= widPx / 2 + 8) return { type: "marker", id: p.id };
        } else {
          // All other power-layer marker types (outlets, switches, lights, etc.)
          if (dst(pos.x, pos.y, rp.x, rp.y) < 16) return { type: "marker", id: p.id };
        }
      }
      for (let i = doors.length - 1; i >= 0; i--) { const d = doors[i]; if (!phaseVisible(d.phase)) continue; const rp = resolvePos(d); if (dst(pos.x, pos.y, rp.x, rp.y) < inToPx(d.width) / 2 + 4) return { type: "door", id: d.id }; }
      for (let i = windows.length - 1; i >= 0; i--) { const w = windows[i]; if (!phaseVisible(w.phase)) continue; const rp = resolvePos(w); if (dst(pos.x, pos.y, rp.x, rp.y) < inToPx(w.width) / 2 + 4) return { type: "window", id: w.id }; }
      for (let i = walls.length - 1; i >= 0; i--) { const w = walls[i]; if (!phaseVisible(w.phase)) continue; const c = wc(w); if (c && ptSeg(pos.x, pos.y, c.x1, c.y1, c.x2, c.y2) < 10) return { type: "wall", id: w.id }; }
    } else if (mode === "zone") {
      // In ZONE mode — check zone vertices first, then edges, then zone bodies (all using resolved positions)
      for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i];
        if (!phaseVisible(z.phase)) continue;
        if (z.points && (selectedId === z.id || selectedIds.includes(z.id))) {
          const rpts = resolvePoints(z);
          for (let vi = 0; vi < rpts.length; vi++) {
            if (dst(pos.x, pos.y, rpts[vi].x, rpts[vi].y) < 10) return { type: "zone-vertex", id: z.id, vertexIndex: vi };
          }
        }
      }
      for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i];
        if (!phaseVisible(z.phase)) continue;
        if (z.points && (selectedId === z.id || selectedIds.includes(z.id))) {
          const rpts = resolvePoints(z);
          for (let ei = 0; ei < rpts.length; ei++) {
            const ej = (ei + 1) % rpts.length;
            if (ptSeg(pos.x, pos.y, rpts[ei].x, rpts[ei].y, rpts[ej].x, rpts[ej].y) < 8) return { type: "zone-edge", id: z.id, edgeIndex: ei };
          }
        }
      }
      for (let i = zones.length - 1; i >= 0; i--) { const z = zones[i];
        if (!phaseVisible(z.phase)) continue;
        if (z.points) { if (pointInPoly(pos.x, pos.y, resolvePoints(z))) return { type: "zone", id: z.id }; }
        else { if (pos.x >= z.x && pos.x <= z.x + z.w && pos.y >= z.y && pos.y <= z.y + z.h) return { type: "zone", id: z.id }; }
      }
    } else if (mode === "itmep") {
      for (let i = markers.length - 1; i >= 0; i--) { const p = markers[i]; if (!markerVisible(p)) continue; const rp = resolvePos(p); if (dst(pos.x, pos.y, rp.x, rp.y) < 14) return { type: "marker", id: p.id }; }
    }
    for (let i = labels.length - 1; i >= 0; i--) {
      const lbl = labels[i];
      if (!phaseVisible(lbl.phase)) continue;
      // Leader tip hit (small circle, checked before box so tip is always reachable)
      if (lbl.lx != null) {
        const tip = resolveLeaderTip(lbl);
        if (dst(pos.x, pos.y, tip.lx, tip.ly) <= 8) return { type: "label-tip", id: lbl.id };
      }
      const { w, h } = labelBounds(lbl);
      if (pos.x >= lbl.x - w / 2 && pos.x <= lbl.x + w / 2 &&
          pos.y >= lbl.y - h / 2 && pos.y <= lbl.y + h / 2)
        return { type: "label", id: lbl.id };
    }
    // RevCloud hit testing
    for (let i = revClouds.length - 1; i >= 0; i--) {
      const rc = revClouds[i];
      if (!phaseVisible(rc.phase)) continue;
      const isSel = selectedId === rc.id && selType === "revcloud";
      if (isSel) {
        for (let vi = 0; vi < rc.points.length; vi++)
          if (dst(pos.x, pos.y, rc.points[vi].x, rc.points[vi].y) < SNAP_R)
            return { type: "revcloud-vertex", id: rc.id, vertexIndex: vi };
        for (let ei = 0; ei < rc.points.length; ei++) {
          const ej = (ei + 1) % rc.points.length;
          if (ptSeg(pos.x, pos.y, rc.points[ei].x, rc.points[ei].y, rc.points[ej].x, rc.points[ej].y) < 10)
            return { type: "revcloud-edge", id: rc.id, edgeIndex: ei };
        }
      }
      if (rc.points.length >= 3 && pointInPoly(pos.x, pos.y, rc.points))
        return { type: "revcloud", id: rc.id };
    }
    // Flow path hit testing — open polyline, band half-width as the hit margin.
    for (let i = flowPaths.length - 1; i >= 0; i--) {
      const fp = flowPaths[i];
      if (!phaseVisible(fp.phase)) continue;
      const isSel = selectedId === fp.id && selType === "flowPath";
      if (isSel) {
        for (let vi = 0; vi < fp.points.length; vi++)
          if (dst(pos.x, pos.y, fp.points[vi].x, fp.points[vi].y) < SNAP_R)
            return { type: "flowPath-vertex", id: fp.id, vertexIndex: vi };
      }
      const halfBand = (fp.width / 12) * pxPerFoot / 2 + 2;
      for (let ei = 0; ei < fp.points.length - 1; ei++) {
        if (ptSeg(pos.x, pos.y, fp.points[ei].x, fp.points[ei].y, fp.points[ei+1].x, fp.points[ei+1].y) < halfBand)
          return { type: "flowPath", id: fp.id, edgeIndex: ei };
      }
    }
    // Floor region hit testing — checked last so everything above wins.
    for (let i = floorRegions.length - 1; i >= 0; i--) {
      const fr = floorRegions[i];
      if (!phaseVisible(fr.phase)) continue;
      const isSel = selectedId === fr.id && selType === "floorRegion";
      if (isSel) {
        for (let vi = 0; vi < fr.points.length; vi++)
          if (dst(pos.x, pos.y, fr.points[vi].x, fr.points[vi].y) < SNAP_R)
            return { type: "floorRegion-vertex", id: fr.id, vertexIndex: vi };
        for (let ei = 0; ei < fr.points.length; ei++) {
          const ej = (ei + 1) % fr.points.length;
          if (ptSeg(pos.x, pos.y, fr.points[ei].x, fr.points[ei].y, fr.points[ej].x, fr.points[ej].y) < 10)
            return { type: "floorRegion-edge", id: fr.id, edgeIndex: ei };
        }
      }
      if (fr.points.length >= 3 && pointInPoly(pos.x, pos.y, fr.points))
        return { type: "floorRegion", id: fr.id };
    }
    return null;
  }, [mode, nodes, walls, zones, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, pxPerFoot, wc, inToPx, selectedId, selectedIds, selType, resolvePos, resolvePoints, phaseVisible, resolveLeaderTip]);

  const onDown = useCallback((e) => {
    // Pan with middle click or spacebar held
    if (e.button === 1 || (e.button === 0 && (tool === "pan" || spaceHeld))) {
      setPanning(true); setPanSt({ sx: e.clientX, sy: e.clientY, ox: viewOff.x, oy: viewOff.y }); return;
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
        setDrawChain({ lastNodeId: startNode?.id || null, lastX: startNode?.x ?? (startWallSnap?.x ?? sx), lastY: startNode?.y ?? (startWallSnap?.y ?? sy), history: [] });
      } else {
        // Subsequent click: commit segment and continue
        if (dst(drawChain.lastX, drawChain.lastY, tx, ty) > 8) {
          const result = commitWallSegment(drawChain.lastNodeId, drawChain.lastX, drawChain.lastY, tx, ty, wallKind);
          if (result) {
            // If we connected to an existing node, finish the chain (stay in wall tool)
            if (near) {
              setDrawChain(null);
              setCursorPos(null);
              setDimInput("");
            } else {
              setDrawChain({ lastNodeId: result.nodeId, lastX: result.x, lastY: result.y, history: [...(drawChain.history || []), { lastNodeId: drawChain.lastNodeId, lastX: drawChain.lastX, lastY: drawChain.lastY }] });
            }
          }
        }
      }
      return;
    }
    if (tool === "zone") {
      const zt = zoneLibrary[activeZoneType]; const nid = uid();
      const pts = [{ x: sx, y: sy }, { x: sx + zt.defaultW * pxPerFoot, y: sy }, { x: sx + zt.defaultW * pxPerFoot, y: sy + zt.defaultH * pxPerFoot }, { x: sx, y: sy + zt.defaultH * pxPerFoot }];
      setZones(p => [...p, { id: nid, type: activeZoneType, points: pts, label: zt.name, notes: zoneNotes, paintColor: zonePaintColor, paintFinish: zonePaintFinish, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("zone"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "marker") {
      const nid = uid();
      const compData = SPEC_COMPONENTS[activeSpecLayer][activeComponentType];
      setMarkers(p => [...p, { id: nid, layer: activeSpecLayer, componentType: activeComponentType, x: sx, y: sy, label: compData.name, notes: markerNotes, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("marker"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "door") {
      const nid = uid();
      const snap = snapToWall(pos.x, pos.y);
      const dx = snap ? snap.x : sx, dy = snap ? snap.y : sy, da = snap ? snap.angle : 0;
      setDoors(p => [...p, { id: nid, x: dx, y: dy, angle: da, width: doorWidth, flipped: doorFlipped, hingeRight: doorHingeRight, doorType, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("door"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "window") {
      const nid = uid();
      const snap = snapToWall(pos.x, pos.y);
      const wx = snap ? snap.x : sx, wy = snap ? snap.y : sy, wa2 = snap ? snap.angle : 0;
      setWindows(p => [...p, { id: nid, x: wx, y: wy, angle: wa2, width: windowWidth, height: windowHeight, sill: windowSill, type: windowType, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("window"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "column") {
      const nid = uid();
      setColumns(p => [...p, { id: nid, x: sx, y: sy, size: columnSize, shape: columnShape, label: columnLabel, notes: columnNotes, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("column"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "outlet") {
      const nid = uid();
      const isCeiling = outletType === "outlet_ceiling" || outletType === "pendent_prewire" || outletType.startsWith("htrack_") || (outletType.startsWith("light_") && outletType !== "light_sconce");
      const wallSnap = !isCeiling; // wall-mounted types snap to walls
      const snap = wallSnap ? snapToWall(pos.x, pos.y, Infinity) : null;
      const ox = snap ? snap.x : sx, oy = snap ? snap.y : sy;
      const angleRad = outletType.startsWith("htrack_") ? (htrackAngle * Math.PI / 180) : (snap ? (snap.angle * Math.PI / 180) : 0);
      setMarkers(p => [...p, { id: nid, layer: "power", componentType: outletType, x: ox, y: oy, angle: angleRad, isNew: outletIsNew, label: SPEC_COMPONENTS.power[outletType].name, notes: "", phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("marker"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "lighting") {
      const nid = uid();
      const isCeiling = lightingType !== "light_sconce" && lightingType !== "sconce_prewire";
      const snap = isCeiling ? null : snapToWall(pos.x, pos.y, Infinity);
      const ox = snap ? snap.x : sx, oy = snap ? snap.y : sy;
      const angleRad = lightingType.startsWith("htrack_") ? (htrackAngle * Math.PI / 180) : (snap ? (snap.angle * Math.PI / 180) : 0);
      setMarkers(p => [...p, { id: nid, layer: "power", componentType: lightingType, x: ox, y: oy, angle: angleRad, isNew: lightingIsNew, label: SPEC_COMPONENTS.power[lightingType].name, notes: "", phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("marker"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "dim") {
      const snap = findDimSnap(pos.x, pos.y);
      const px = snap ? snap.x : sx, py = snap ? snap.y : sy;
      if (!drawDim) {
        setDrawDim({ x1: px, y1: py, anchor1Id: snap?.anchorId ?? null, anchor1Type: snap?.anchorType ?? null });
      } else if (!("x2" in drawDim)) {
        if (Math.hypot(px - drawDim.x1, py - drawDim.y1) < 4) return;
        setDrawDim({ ...drawDim, x2: px, y2: py, anchor2Id: snap?.anchorId ?? null, anchor2Type: snap?.anchorType ?? null });
      } else {
        const ddx = drawDim.x2 - drawDim.x1, ddy = drawDim.y2 - drawDim.y1;
        const dlen = Math.hypot(ddx, ddy);
        if (dlen < 1) { setDrawDim(null); return; }
        const nnx = -ddy / dlen, nny = ddx / dlen;
        const off = (pos.x - drawDim.x1) * nnx + (pos.y - drawDim.y1) * nny;
        setDims(prev => [...prev, {
          id: uid(), x1: drawDim.x1, y1: drawDim.y1, x2: drawDim.x2, y2: drawDim.y2, offset: off,
          anchor1Id: drawDim.anchor1Id ?? null, anchor1Type: drawDim.anchor1Type ?? null,
          anchor2Id: drawDim.anchor2Id ?? null, anchor2Type: drawDim.anchor2Type ?? null,
        }]);
        if (e.shiftKey) { setDrawDim(null); }
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
    if (tool === "revcloud") {
      const near = findNear(pos.x, pos.y);
      const cx = near ? near.x : sx, cy = near ? near.y : sy;
      if (!drawRevCloud) {
        setDrawRevCloud({ points: [{ x: cx, y: cy }] });
      } else {
        const pts = drawRevCloud.points;
        const distToFirst = dst(cx, cy, pts[0].x, pts[0].y);
        if (pts.length >= 3 && distToFirst < SNAP_R * 1.5) {
          const nid = uid();
          setRevClouds(prev => [...prev, { id: nid, points: pts, arcR: 8, label: "", color: "#E05252", phase: activePhase }]);
          setDrawRevCloud(null);
          setSelectedId(nid); setSelType("revcloud"); setSelectedIds([nid]);
          setT("select");
        } else {
          const last = pts[pts.length - 1];
          if (dst(cx, cy, last.x, last.y) > 4)
            setDrawRevCloud({ points: [...pts, { x: cx, y: cy }] });
        }
      }
      return;
    }
    if (tool === "flowPath") {
      // Open polyline. Double-click finishes (>=2 pts) without adding a dup point.
      if (e.detail === 2 && drawFlowPath) {
        const pts = drawFlowPath.points;
        if (pts.length >= 2) {
          if (drawFlowPath.editingId) {
            const eid = drawFlowPath.editingId;
            setFlowPaths(prev => prev.map(f => f.id === eid ? { ...f, points: pts } : f));
            setSelectedId(eid); setSelType("flowPath"); setSelectedIds([eid]);
          } else {
            const nid = uid();
            setFlowPaths(prev => [...prev, { id: nid, points: pts, width: 36, color: "#4A90D9", label: "", phase: activePhase }]);
            setSelectedId(nid); setSelType("flowPath"); setSelectedIds([nid]);
          }
          setT("select");
        }
        setDrawFlowPath(null);
        return;
      }
      const near = findNear(pos.x, pos.y);
      const cx = near ? near.x : sx, cy = near ? near.y : sy;
      if (!drawFlowPath) {
        setDrawFlowPath({ points: [{ x: cx, y: cy }] });
      } else {
        const last = drawFlowPath.points[drawFlowPath.points.length - 1];
        if (dst(cx, cy, last.x, last.y) > 4)
          setDrawFlowPath({ points: [...drawFlowPath.points, { x: cx, y: cy }] });
      }
      return;
    }
    if (tool === "floorRegion") {
      // Closed polygon. Click first point (3+ pts) to close.
      if (drawFloorRegion) {
        const pts = drawFloorRegion.points;
        if (pts.length >= 3 && dst(pos.x, pos.y, pts[0].x, pts[0].y) < SNAP_R * 1.5) {
          const nid = uid();
          setFloorRegions(prev => [...prev, { id: nid, points: pts, material: "Wood", label: "", phase: activePhase }]);
          setDrawFloorRegion(null);
          setSelectedId(nid); setSelType("floorRegion"); setSelectedIds([nid]);
          setT("select");
          return;
        }
      }
      const near = findNear(pos.x, pos.y);
      const cx = near ? near.x : sx, cy = near ? near.y : sy;
      if (!drawFloorRegion) {
        setDrawFloorRegion({ points: [{ x: cx, y: cy }] });
      } else {
        const last = drawFloorRegion.points[drawFloorRegion.points.length - 1];
        if (dst(cx, cy, last.x, last.y) > 4)
          setDrawFloorRegion({ points: [...drawFloorRegion.points, { x: cx, y: cy }] });
      }
      return;
    }
    // "Add Leader" mode: next click sets leader anchor
    if (addingLeaderToId) {
      const { x, y, anchorId, anchorType } = snapLabelAnchor(pos.x, pos.y);
      setLabels(p => p.map(l => l.id !== addingLeaderToId ? l : { ...l, lx: x, ly: y, anchorId, anchorType }));
      setAddingLeaderToId(null);
      e.stopPropagation();
      return;
    }
    if (tool === "label") {
      const { x: startX, y: startY, anchorId: startAnchorId, anchorType: startAnchorType } = snapLabelAnchor(pos.x, pos.y);
      setDrag({ type: "label-place", startX, startY, startAnchorId, startAnchorType, snapped: !!(startAnchorId || startX !== pos.x || startY !== pos.y) });
      e.stopPropagation();
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
        // Alt+drag: duplicate selected objects and immediately start dragging the copies
        const isMultiCopy = selectedIds.length > 1 && selectedIds.includes(hit.id);

        if (isMultiCopy) {
          // Duplicate ALL selected items and start a multi-drag with the copies
          const srcItems = [];
          const newColumns = [], newMarkers = [], newDoors = [], newWindows = [], newZones = [], newLabels = [], newNodes = [], newWalls = [];
          const copyIds = [];

          // Pre-pass: build node ID remap so wall copies can reference new node IDs
          const nodeIdMap = new Map();
          selectedIds.forEach(id => { if (nodes.find(n => n.id === id)) nodeIdMap.set(id, uid()); });

          selectedIds.forEach(id => {
            // Nodes — must come before walls; drag.objects includes nodes so walls follow automatically
            const nd = nodes.find(n => n.id === id);
            if (nd) { const nid = nodeIdMap.get(id); const rp = resolvePos(nd); newNodes.push({ ...nd, id: nid, px: undefined, x: rp.x, y: rp.y }); srcItems.push({ id: nid, type: "node", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            // Walls — remap n1/n2 to new node IDs; walls follow nodes during drag so not added to srcItems
            const wl = walls.find(w => w.id === id);
            if (wl) { const nid = uid(); newWalls.push({ ...wl, id: nid, n1: nodeIdMap.get(wl.n1) ?? wl.n1, n2: nodeIdMap.get(wl.n2) ?? wl.n2 }); copyIds.push(nid); return; }
            const col = columns.find(c => c.id === id);
            if (col) { const rp = resolvePos(col); const nid = uid(); newColumns.push({ ...col, id: nid, px: undefined, x: rp.x, y: rp.y }); srcItems.push({ id: nid, type: "column", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            const mk = markers.find(m => m.id === id);
            if (mk) { const rp = resolvePos(mk); const nid = uid(); newMarkers.push({ ...mk, id: nid, px: undefined, x: rp.x, y: rp.y, deletedAtPhase: undefined }); srcItems.push({ id: nid, type: "marker", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            const dr = doors.find(d => d.id === id);
            if (dr) { const rp = resolvePos(dr); const nid = uid(); newDoors.push({ ...dr, id: nid, px: undefined, x: rp.x, y: rp.y }); srcItems.push({ id: nid, type: "door", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            const win = windows.find(w => w.id === id);
            if (win) { const rp = resolvePos(win); const nid = uid(); newWindows.push({ ...win, id: nid, px: undefined, x: rp.x, y: rp.y }); srcItems.push({ id: nid, type: "window", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            const zn = zones.find(z => z.id === id);
            if (zn) { const rpts = resolvePoints(zn); const nid = uid(); newZones.push({ ...zn, id: nid, px: undefined, points: rpts.map(p => ({ ...p })) }); const c = polyCentroid(rpts); srcItems.push({ id: nid, type: "zone", x: c.x, y: c.y }); copyIds.push(nid); return; }
            const lb = labels.find(l => l.id === id);
            if (lb) { const nid = uid(); newLabels.push({ ...lb, id: nid }); srcItems.push({ id: nid, type: "label", x: lb.x, y: lb.y }); copyIds.push(nid); return; }
          });

          if (newNodes.length)   setNodes(p => [...p, ...newNodes]);
          if (newWalls.length)   setWalls(p => [...p, ...newWalls]);
          if (newColumns.length) setColumns(p => [...p, ...newColumns]);
          if (newMarkers.length) setMarkers(p => [...p, ...newMarkers]);
          if (newDoors.length)   setDoors(p => [...p, ...newDoors]);
          if (newWindows.length) setWindows(p => [...p, ...newWindows]);
          if (newZones.length)   setZones(p => [...p, ...newZones]);
          if (newLabels.length)  setLabels(p => [...p, ...newLabels]);

          setSelectedIds(copyIds);
          setSelectedId(copyIds[0]);
          setSelType(hit.type);
          // Record source positions so "/" can distribute later
          setLastCopyInfo({ srcItems, dx: 0, dy: 0 });
          setDrag({ type: "multi", objects: srcItems, startX: pos.x, startY: pos.y, lastX: pos.x, lastY: pos.y, isCopy: true });
        } else {
          // Single-item alt-drag copy
          const nid = uid();
          if (hit.type === "zone") {
            const src = zones.find(z => z.id === hit.id);
            if (src) {
              const rpts = resolvePoints(src);
              const dup = { ...src, id: nid, px: undefined, points: rpts.map(p => ({ ...p })) };
              setZones(p => [...p, dup]);
              const c = polyCentroid(rpts);
              setSelectedId(nid); setSelType("zone");
              setLastCopyInfo({ srcItems: [{ id: nid, type: "zone", x: c.x, y: c.y }], dx: 0, dy: 0 });
              setDrag({ type: "zone", id: nid, ox: pos.x - c.x, oy: pos.y - c.y, startX: sn(c.x, snapGrid), startY: sn(c.y, snapGrid), startPts: rpts.map(p => ({ ...p })), lastX: sn(c.x, snapGrid), lastY: sn(c.y, snapGrid), isCopy: true });
            }
          } else if (hit.type === "door") {
            const src = doors.find(d => d.id === hit.id);
            if (src) { const rp = resolvePos(src); setDoors(p => [...p, { ...src, id: nid, px: undefined, x: rp.x, y: rp.y }]); setSelectedId(nid); setSelType("door"); setLastCopyInfo({ srcItems: [{ id: nid, type: "door", x: rp.x, y: rp.y }], dx: 0, dy: 0 }); setDrag({ type: "door", id: nid, ox: pos.x - rp.x, oy: pos.y - rp.y, isCopy: true }); }
          } else if (hit.type === "window") {
            const src = windows.find(w => w.id === hit.id);
            if (src) { const rp = resolvePos(src); setWindows(p => [...p, { ...src, id: nid, px: undefined, x: rp.x, y: rp.y }]); setSelectedId(nid); setSelType("window"); setLastCopyInfo({ srcItems: [{ id: nid, type: "window", x: rp.x, y: rp.y }], dx: 0, dy: 0 }); setDrag({ type: "window", id: nid, ox: pos.x - rp.x, oy: pos.y - rp.y, isCopy: true }); }
          } else if (hit.type === "column") {
            const src = columns.find(c => c.id === hit.id);
            if (src) { const rp = resolvePos(src); setColumns(p => [...p, { ...src, id: nid, px: undefined, x: rp.x, y: rp.y }]); setSelectedId(nid); setSelType("column"); setLastCopyInfo({ srcItems: [{ id: nid, type: "column", x: rp.x, y: rp.y }], dx: 0, dy: 0 }); setDrag({ type: "column", id: nid, ox: pos.x - rp.x, oy: pos.y - rp.y, isCopy: true }); }
          } else if (hit.type === "marker") {
            const src = markers.find(m => m.id === hit.id);
            if (src) { const rp = resolvePos(src); setMarkers(p => [...p, { ...src, id: nid, px: undefined, x: rp.x, y: rp.y, deletedAtPhase: undefined }]); setSelectedId(nid); setSelType("marker"); setLastCopyInfo({ srcItems: [{ id: nid, type: "marker", x: rp.x, y: rp.y }], dx: 0, dy: 0 }); setDrag({ type: "marker", id: nid, ox: pos.x - rp.x, oy: pos.y - rp.y, isCopy: true }); }
          } else if (hit.type === "label") {
            const src = labels.find(l => l.id === hit.id);
            if (src) { setLabels(p => [...p, { ...src, id: nid }]); setSelectedId(nid); setSelType("label"); setLastCopyInfo({ srcItems: [{ id: nid, type: "label", x: src.x, y: src.y }], dx: 0, dy: 0 }); setDrag({ type: "label", id: nid, ox: pos.x - src.x, oy: pos.y - src.y, isCopy: true }); }
          }
        }
        setSelectedIds([]);
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
              return;
            }
            const lbl = labels.find(l => l.id === id);
            if (lbl) {
              initialPositions.push({ id, type: "label", x: lbl.x, y: lbl.y, lx: lbl.lx, ly: lbl.ly });
              return;
            }
            const rc = revClouds.find(r => r.id === id);
            if (rc) {
              const c = polyCentroid(rc.points);
              const startLabelPositions = labels.filter(l => l.anchorType === "revcloud" && l.anchorId === id).map(l => ({ id: l.id, x: l.x, y: l.y, lx: l.lx, ly: l.ly }));
              initialPositions.push({ id, type: "revcloud", centroid: c, points: rc.points.map(p => ({ ...p })), startLabelPositions });
              return;
            }
            const fp = flowPaths.find(r => r.id === id);
            if (fp) {
              initialPositions.push({ id, type: "flowPath", points: fp.points.map(p => ({ ...p })) });
              return;
            }
            const fr = floorRegions.find(r => r.id === id);
            if (fr) {
              initialPositions.push({ id, type: "floorRegion", points: fr.points.map(p => ({ ...p })) });
            }
          });

          setDrag({ type: "multi", objects: initialPositions, startX: pos.x, startY: pos.y, lastX: pos.x, lastY: pos.y });
          setSelectedId(hit.id); setSelType(hit.type === "label-tip" ? "label" : hit.type);
        } else {
          // Clear multi-selection when clicking on a single object (unless shift is held)
          if (!e.shiftKey) {
            setSelectedIds([hit.id]);
          }
          const resolvedSelType = hit.type === "label-tip" ? "label"
            : (hit.type === "zone-vertex" || hit.type === "zone-edge") ? "zone"
            : (hit.type === "flowPath-vertex") ? "flowPath"
            : (hit.type === "floorRegion-vertex" || hit.type === "floorRegion-edge") ? "floorRegion"
            : hit.type;
          setSelectedId(hit.id); setSelType(resolvedSelType);
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
              setWalls(p => [...p.map(ww => ww.id === w.id ? { ...ww, n2: newNodeId } : ww), { ...w, id: newWallId, n1: newNodeId, n2: origN2 }]);
              setSelectedId(newNodeId); setSelType("node");
            }
          } else {
            const w = walls.find(ww => ww.id === hit.id), c = wc(w);
            if (c) {
              const n1 = gn(w.n1), n2 = gn(w.n2);
              if (n1 && n2) {
                // Items on the dragged wall itself — parametric t keeps them on centerline
                // even when snap grid causes slight wall rotation.
                const doorIds = new Set(doors.map(d => d.id));
                const attachedItems = [];
                const wdxA = c.x2 - c.x1, wdyA = c.y2 - c.y1, wlen2A = wdxA * wdxA + wdyA * wdyA;
                const itemIds = new Set();
                [...doors, ...windows].forEach(item => {
                  if (ptSeg(item.x, item.y, c.x1, c.y1, c.x2, c.y2) < 8) {
                    const t = wlen2A > 0 ? ((item.x - c.x1) * wdxA + (item.y - c.y1) * wdyA) / wlen2A : 0;
                    attachedItems.push({ id: item.id, t, isDoor: doorIds.has(item.id) });
                    itemIds.add(item.id);
                  }
                });
                // Items on adjacent walls — when this wall translates, shared nodes move,
                // causing adjacent walls to skew. Reposition items along the new skewed wall.
                const adjacentAttached = [];
                [{ nodeId: w.n1, isN1W: true }, { nodeId: w.n2, isN1W: false }].forEach(({ nodeId, isN1W }) => {
                  walls.forEach(adjW => {
                    if (adjW.id === w.id) return;
                    if (adjW.n1 !== nodeId && adjW.n2 !== nodeId) return;
                    const adjC = wc(adjW);
                    if (!adjC) return;
                    const sharedIsN1ofAdj = adjW.n1 === nodeId;
                    const otherX = sharedIsN1ofAdj ? adjC.x2 : adjC.x1;
                    const otherY = sharedIsN1ofAdj ? adjC.y2 : adjC.y1;
                    const adjDx = adjC.x2 - adjC.x1, adjDy = adjC.y2 - adjC.y1, adjLen2 = adjDx * adjDx + adjDy * adjDy;
                    [...doors, ...windows].forEach(item => {
                      if (itemIds.has(item.id)) return;
                      if (ptSeg(item.x, item.y, adjC.x1, adjC.y1, adjC.x2, adjC.y2) < 8) {
                        const t = adjLen2 > 0 ? ((item.x - adjC.x1) * adjDx + (item.y - adjC.y1) * adjDy) / adjLen2 : 0;
                        adjacentAttached.push({ id: item.id, t, isDoor: doorIds.has(item.id), isN1W, sharedIsN1WA: sharedIsN1ofAdj, otherX, otherY });
                        itemIds.add(item.id);
                      }
                    });
                  });
                });
                setDrag({ type: "wall", id: hit.id, ox: pos.x, oy: pos.y, n1x: n1.x, n1y: n1.y, n2x: n2.x, n2y: n2.y, attached: attachedItems, adjacentAttached });
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
              const rpts = resolvePoints(z);
              const vt = rpts[hit.vertexIndex];
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
              const rpts = resolvePoints(z);
              const ei = hit.edgeIndex, ej = (ei + 1) % rpts.length;
              const p1 = rpts[ei], p2 = rpts[ej];
              const edx = p2.x - p1.x, edy = p2.y - p1.y;
              const elen = Math.hypot(edx, edy) || 1;
              setDrag({ type: "zone-edge", id: hit.id, edgeIndex: ei, ox: pos.x, oy: pos.y, p1x: p1.x, p1y: p1.y, p2x: p2.x, p2y: p2.y, nx: -edy / elen, ny: edx / elen, cursor: wallResizeCursor(p1.x, p1.y, p2.x, p2.y) });
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
            const rpts = resolvePoints(z);
            const c = polyCentroid(rpts);
            setDrag({ type: "zone", id: hit.id, ox: pos.x - c.x, oy: pos.y - c.y, startX: sn(c.x, snapGrid), startY: sn(c.y, snapGrid), startPts: rpts, lastX: sn(c.x, snapGrid), lastY: sn(c.y, snapGrid) });
          } else if (zoneEdge && zoneEdge.id === hit.id) {
            setResize({ id: hit.id, edge: zoneEdge.edge });
          } else {
            setDrag({ type: "zone", id: hit.id, ox: pos.x - z.x, oy: pos.y - z.y });
          }
        }
          else if (hit.type === "marker") { const p = markers.find(pp => pp.id === hit.id); if (p) { const rp = resolvePos(p); setDrag({ type: "marker", id: hit.id, ox: pos.x - rp.x, oy: pos.y - rp.y }); } }
          else if (hit.type === "door") { const d = doors.find(dd => dd.id === hit.id); if (d) { const rp = resolvePos(d); setDrag({ type: "door", id: hit.id, ox: pos.x - rp.x, oy: pos.y - rp.y }); } }
          else if (hit.type === "window") { const w = windows.find(ww => ww.id === hit.id); if (w) { const rp = resolvePos(w); setDrag({ type: "window", id: hit.id, ox: pos.x - rp.x, oy: pos.y - rp.y }); } }
          else if (hit.type === "column") { const c = columns.find(cc => cc.id === hit.id); if (c) { const rp = resolvePos(c); setDrag({ type: "column", id: hit.id, ox: pos.x - rp.x, oy: pos.y - rp.y }); } }
          else if (hit.type === "dim") { setDrag({ type: "dim", id: hit.id }); }
          else if (hit.type === "label-tip") {
            setSelectedId(hit.id); setSelType("label"); setSelectedIds([hit.id]);
            setDrag({ type: "label-tip", id: hit.id, snapX: null, snapY: null, snapped: false, snapAnchorId: null, snapAnchorType: null });
          }
          else if (hit.type === "label") {
            if (e.detail < 2) {
              const hitLbl = labels.find(l => l.id === hit.id);
              setDrag({ type: "label", id: hit.id, ox: pos.x - (hitLbl?.x ?? 0), oy: pos.y - (hitLbl?.y ?? 0) });
            }
            // double-click handled by onClick on the <g> via e.detail >= 2
          }
          else if (hit.type === "revcloud-vertex") {
            const rc = revClouds.find(r => r.id === hit.id);
            if (rc) {
              if (e.detail === 2 && rc.points.length > 3)
                setRevClouds(p => p.map(r => r.id === hit.id ? { ...r, points: r.points.filter((_, i) => i !== hit.vertexIndex) } : r));
              else if (e.detail < 2) {
                const vt = rc.points[hit.vertexIndex];
                setDrag({ type: "revcloud-vertex", id: hit.id, vertexIndex: hit.vertexIndex, ox: pos.x - vt.x, oy: pos.y - vt.y, origVx: vt.x, origVy: vt.y });
              }
            }
          }
          else if (hit.type === "revcloud-edge") {
            const rc = revClouds.find(r => r.id === hit.id);
            if (rc) {
              if (e.detail === 2) {
                // Double-click: insert a new vertex on this edge
                const newPts = [...rc.points];
                newPts.splice((hit.edgeIndex + 1) % rc.points.length, 0, { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) });
                setRevClouds(p => p.map(r => r.id === hit.id ? { ...r, points: newPts } : r));
              } else {
                // Single drag: move both endpoints of this edge together
                const ei = hit.edgeIndex, ej = (hit.edgeIndex + 1) % rc.points.length;
                const a = rc.points[ei], b = rc.points[ej];
                setDrag({ type: "revcloud-edge", id: hit.id, edgeIndex: ei,
                  ox: pos.x, oy: pos.y,
                  startA: { ...a }, startB: { ...b },
                  cursor: wallResizeCursor(a.x, a.y, b.x, b.y) });
              }
            }
          }
          else if (hit.type === "revcloud") {
            const rc = revClouds.find(r => r.id === hit.id);
            if (rc) {
              const c = polyCentroid(rc.points);
              const startLabelPositions = labels
                .filter(l => l.anchorType === "revcloud" && l.anchorId === rc.id)
                .map(l => ({ id: l.id, x: l.x, y: l.y, lx: l.lx, ly: l.ly }));
              setDrag({ type: "revcloud", id: hit.id, ox: pos.x - c.x, oy: pos.y - c.y,
                startX: c.x, startY: c.y, startPts: rc.points.map(p => ({ ...p })), startLabelPositions });
            }
          }
          else if (hit.type === "flowPath-vertex") {
            const fp = flowPaths.find(r => r.id === hit.id);
            if (fp) {
              if (e.detail === 2 && fp.points.length > 2)
                setFlowPaths(p => p.map(r => r.id === hit.id ? { ...r, points: r.points.filter((_, i) => i !== hit.vertexIndex) } : r));
              else if (e.detail < 2) {
                const vt = fp.points[hit.vertexIndex];
                setDrag({ type: "flowPath-vertex", id: hit.id, vertexIndex: hit.vertexIndex, ox: pos.x - vt.x, oy: pos.y - vt.y });
              }
            }
          }
          else if (hit.type === "flowPath") {
            const fp = flowPaths.find(r => r.id === hit.id);
            if (fp) {
              if (e.detail === 2) {
                // Double-click on band: insert a vertex at the click point on that segment
                const newPts = [...fp.points];
                newPts.splice(hit.edgeIndex + 1, 0, { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) });
                setFlowPaths(p => p.map(r => r.id === hit.id ? { ...r, points: newPts } : r));
              } else {
                const cx = fp.points.reduce((s,p)=>s+p.x,0)/fp.points.length, cy = fp.points.reduce((s,p)=>s+p.y,0)/fp.points.length;
                setDrag({ type: "flowPath", id: hit.id, ox: pos.x - cx, oy: pos.y - cy, startX: cx, startY: cy, startPts: fp.points.map(p => ({ ...p })) });
              }
            }
          }
          else if (hit.type === "floorRegion-vertex") {
            const fr = floorRegions.find(r => r.id === hit.id);
            if (fr) {
              if (e.detail === 2 && fr.points.length > 3)
                setFloorRegions(p => p.map(r => r.id === hit.id ? { ...r, points: r.points.filter((_, i) => i !== hit.vertexIndex) } : r));
              else if (e.detail < 2) {
                const vt = fr.points[hit.vertexIndex];
                setDrag({ type: "floorRegion-vertex", id: hit.id, vertexIndex: hit.vertexIndex, ox: pos.x - vt.x, oy: pos.y - vt.y });
              }
            }
          }
          else if (hit.type === "floorRegion-edge") {
            const fr = floorRegions.find(r => r.id === hit.id);
            if (fr) {
              if (e.detail === 2) {
                const ej = (hit.edgeIndex + 1) % fr.points.length;
                const newPts = [...fr.points];
                newPts.splice(ej, 0, { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) });
                setFloorRegions(p => p.map(r => r.id === hit.id ? { ...r, points: newPts } : r));
              } else {
                const ei = hit.edgeIndex, ej = (ei + 1) % fr.points.length;
                const a = fr.points[ei], b = fr.points[ej];
                const edx = b.x - a.x, edy = b.y - a.y, elen = Math.hypot(edx, edy) || 1;
                setDrag({ type: "floorRegion-edge", id: hit.id, edgeIndex: ei, ox: pos.x, oy: pos.y,
                  startA: { ...a }, startB: { ...b }, nx: -edy / elen, ny: edx / elen,
                  cursor: wallResizeCursor(a.x, a.y, b.x, b.y) });
              }
            }
          }
          else if (hit.type === "floorRegion") {
            const fr = floorRegions.find(r => r.id === hit.id);
            if (fr) {
              const c = polyCentroid(fr.points);
              setDrag({ type: "floorRegion", id: hit.id, ox: pos.x - c.x, oy: pos.y - c.y, startX: c.x, startY: c.y, startPts: fr.points.map(p => ({ ...p })) });
            }
          }
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
  }, [tool, activeZoneType, activeSpecLayer, s2c, findNear, findDimSnap, hitTest, walls, wc, zones, markers, doors, windows, columns, labels, revClouds, flowPaths, viewOff, drawChain, commitWallSegment, spaceHeld, doorWidth, windowWidth, columnSize, columnShape, snapToWall, snapGrid, activeComponentType, selectedIds, bgImage, bgOffset, gn, calibrationLine, drawDim, dims, nodes, pxPerFoot, zoneEdge, resolvePos, resolvePoints, activePhase, addingLeaderToId, snapLabelAnchor, drawRevCloud, drawFlowPath, floorRegions, drawFloorRegion, polyCentroid]);

  const onMove = useCallback((e) => {
    if (panning && panSt) {
      const dsx = e.clientX - panSt.sx, dsy = e.clientY - panSt.sy;
      let dvx = dsx, dvy = dsy;
      if (canvasRotation !== 0) {
        const rad = -canvasRotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        dvx = dsx * cos - dsy * sin;
        dvy = dsx * sin + dsy * cos;
      }
      setViewOff({ x: panSt.ox + dvx, y: panSt.oy + dvy });
      return;
    }
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
      let cpx = near ? near.x : wallSnap2 ? wallSnap2.x : sx;
      let cpy = near ? near.y : wallSnap2 ? wallSnap2.y : sy;
      // Smart guides while drawing — only when not already snapping to a node or wall
      if (!near && !wallSnap2 && drawChain) {
        const excludeId = drawChain.lastNodeId;
        const wallGuideTargets = [
          ...nodes.filter(n => n.id !== excludeId).map(n => ({ x: n.x, y: n.y })),
          ...doors.map(d => ({ x: d.x, y: d.y })),
          ...windows.map(w => ({ x: w.x, y: w.y })),
        ];
        const g = applySmartGuides(cpx, cpy, wallGuideTargets);
        cpx = g.x; cpy = g.y;
        setSmartGuides(g.guides);
      } else {
        setSmartGuides([]);
      }
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

    if (tool === "select" && !drag) {
      const near = findNear(pos.x, pos.y);
      setHoverNid(near ? near.id : null);
      // Proximity-hover: preview the nearest hoverable as cursor approaches
      setProxHover(findProxHover(pos.x, pos.y));
    } else if (drag && PROX_DRAG_TYPES.has(drag.type)) {
      // While dragging a face/edge/vertex/element, keep the proximity preview
      // alive (excluding the dragged item itself) so nearby snap targets glow.
      const ph = findProxHover(pos.x, pos.y);
      setProxHover(ph && ph.id !== drag.id ? ph : null);
    } else if (proxHover) {
      setProxHover(null);
    }
    if (tool === "dim") { const dsnap = findDimSnap(pos.x, pos.y); setGhostPos(dsnap ? { x: dsnap.x, y: dsnap.y, snapped: true } : { x: pos.x, y: pos.y, snapped: false }); }
    if (tool === "zone" || tool === "marker" || tool === "column") { setGhostPos({ x: sx, y: sy }); }
    if (tool === "revcloud") {
      const near = findNear(pos.x, pos.y);
      setGhostPos(near ? { x: near.x, y: near.y, snapped: true } : { x: sx, y: sy, snapped: false });
    }
    if (tool === "flowPath") {
      const near = findNear(pos.x, pos.y);
      setGhostPos(near ? { x: near.x, y: near.y, snapped: true } : { x: sx, y: sy, snapped: false });
    }
    if (tool === "floorRegion") {
      // snap-to-first when near the opening vertex (3+ pts) for a clean close
      let snappedFirst = false;
      if (drawFloorRegion && drawFloorRegion.points.length >= 3) {
        const p0 = drawFloorRegion.points[0];
        if (dst(pos.x, pos.y, p0.x, p0.y) < SNAP_R * 1.5) { setGhostPos({ x: p0.x, y: p0.y, snapped: true, closing: true }); snappedFirst = true; }
      }
      if (!snappedFirst) {
        const near = findNear(pos.x, pos.y);
        setGhostPos(near ? { x: near.x, y: near.y, snapped: true } : { x: sx, y: sy, snapped: false });
      }
    }
    if (tool === "label") {
      const snap = snapLabelAnchor(pos.x, pos.y);
      setGhostPos({ x: snap.x, y: snap.y, snapped: !!(snap.anchorId || snap.x !== pos.x || snap.y !== pos.y) });
    }
    // Leader tip drag: snap to objects and update ghost for snap indicator
    if (drag?.type === "label-tip") {
      const { x, y, anchorId, anchorType } = snapLabelAnchor(pos.x, pos.y);
      setGhostPos({ x, y, snapped: !!anchorId });
      setDrag(d => ({ ...d, snapX: x, snapY: y, snapAnchorId: anchorId, snapAnchorType: anchorType, snapped: !!anchorId }));
      return;
    }
    if (drag?.type === "label-place") {
      const snap = snapLabelAnchor(pos.x, pos.y);
      setGhostPos({ x: snap.x, y: snap.y, snapped: !!(snap.anchorId || snap.x !== pos.x || snap.y !== pos.y) });
      return;
    }
    if (tool === "door" || tool === "window") {
      const snap = snapToWall(pos.x, pos.y);
      if (snap) setGhostPos({ x: snap.x, y: snap.y, angle: snap.angle, snapped: true });
      else setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
    }
    if (tool === "outlet") {
      const isCeiling = outletType === "outlet_ceiling" || outletType === "pendent_prewire" || outletType.startsWith("htrack_");
      if (isCeiling) {
        const angle = outletType.startsWith("htrack_") ? (htrackAngle * Math.PI / 180) : 0;
        setGhostPos({ x: sx, y: sy, angle, snapped: false });
      } else {
        const snap = snapToWall(pos.x, pos.y, Infinity);
        if (snap) setGhostPos({ x: snap.x, y: snap.y, angle: snap.angle * Math.PI / 180, snapped: true });
        else setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
      }
    }
    if (tool === "lighting") {
      if (lightingType !== "light_sconce" && lightingType !== "sconce_prewire") {
        const angle = lightingType.startsWith("htrack_") ? (htrackAngle * Math.PI / 180) : 0;
        setGhostPos({ x: sx, y: sy, angle, snapped: false });
      } else {
        const snap = snapToWall(pos.x, pos.y, Infinity);
        if (snap) setGhostPos({ x: snap.x, y: snap.y, angle: snap.angle * Math.PI / 180, snapped: true });
        else setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
      }
    }

    // Zone edge detection — drives resize cursor and onDown decision
    if (!drag && !resize) {
      let fe = null;
      for (const z of zones) {
        if (z.points) continue;
        const T = 12 / zoom;
        if (pos.x < z.x - T || pos.x > z.x + z.w + T || pos.y < z.y - T || pos.y > z.y + z.h + T) continue;
        const inX = pos.x >= z.x && pos.x <= z.x + z.w;
        const inY = pos.y >= z.y && pos.y <= z.y + z.h;
        if (!inX || !inY) continue;
        const nL = pos.x - z.x < T, nR = z.x + z.w - pos.x < T;
        const nT = pos.y - z.y < T, nB = z.y + z.h - pos.y < T;
        if (nT && nL) { fe = { id: z.id, edge: "nw", cursor: "nwse-resize" }; break; }
        if (nT && nR) { fe = { id: z.id, edge: "ne", cursor: "nesw-resize" }; break; }
        if (nB && nL) { fe = { id: z.id, edge: "sw", cursor: "nesw-resize" }; break; }
        if (nB && nR) { fe = { id: z.id, edge: "se", cursor: "nwse-resize" }; break; }
        if (nT)       { fe = { id: z.id, edge: "n",  cursor: "ns-resize"   }; break; }
        if (nB)       { fe = { id: z.id, edge: "s",  cursor: "ns-resize"   }; break; }
        if (nL)       { fe = { id: z.id, edge: "w",  cursor: "ew-resize"   }; break; }
        if (nR)       { fe = { id: z.id, edge: "e",  cursor: "ew-resize"   }; break; }
      }
      setZoneEdge(fe);
    }

    if (rotatingMarker) {
      const dx = pos.x - rotatingMarker.cx;
      const dy = pos.y - rotatingMarker.cy;
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (e.shiftKey) angle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      setMarkers(prev => prev.map(m => m.id === rotatingMarker.id ? { ...m, angle } : m));
      return;
    }

    if (drag) {
      // Build smart-guide target list — all element centers except the one(s) being dragged
      const _dragIds = new Set(
        drag.type === "multi" ? drag.objects.map(o => o.id)
        : drag.type === "wall" ? [walls.find(w => w.id === drag.id)?.n1, walls.find(w => w.id === drag.id)?.n2].filter(Boolean)
        : [drag.id]
      );
      const _guideTargets = [
        ...nodes.filter(n => !_dragIds.has(n.id)).map(n => ({ x: n.x, y: n.y })),
        ...doors.filter(d => !_dragIds.has(d.id)).map(d => ({ x: d.x, y: d.y })),
        ...windows.filter(w => !_dragIds.has(w.id)).map(w => ({ x: w.x, y: w.y })),
        ...columns.filter(c => !_dragIds.has(c.id)).map(c => ({ x: c.x, y: c.y })),
        ...markers.filter(m => !_dragIds.has(m.id)).map(m => ({ x: m.x, y: m.y })),
      ];

      if (drag.type === "multi") {
        // Multi-object drag
        const dx = sn(pos.x, snapGrid) - sn(drag.lastX, snapGrid);
        const dy = sn(pos.y, snapGrid) - sn(drag.lastY, snapGrid);
        
        if (dx || dy) {
          drag.objects.forEach(obj => {
            if (obj.type === "node") {
              setNodes(prev => prev.map(n => {
                if (n.id !== obj.id) return n;
                if (activePhase && activePhase !== "existing") {
                  const cur = n.px?.[activePhase] ?? { x: n.x, y: n.y };
                  return { ...n, px: { ...n.px, [activePhase]: { x: cur.x + dx, y: cur.y + dy } } };
                }
                return { ...n, x: n.x + dx, y: n.y + dy };
              }));
            } else if (obj.type === "zone") {
              const phased = activePhase && activePhase !== "existing";
              if (obj.points) {
                setZones(p => p.map(z => {
                  if (z.id !== obj.id) return z;
                  if (phased) {
                    const base = z.px?.[activePhase] ?? z.points;
                    return { ...z, px: { ...z.px, [activePhase]: base.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) } };
                  }
                  return { ...z, points: z.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
                }));
              } else {
                setZones(p => p.map(z => {
                  if (z.id !== obj.id) return z;
                  if (phased) {
                    const base = z.px?.[activePhase] ?? { x: z.x, y: z.y };
                    return { ...z, px: { ...z.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } };
                  }
                  return { ...z, x: z.x + dx, y: z.y + dy };
                }));
              }
            } else if (obj.type === "marker") {
              setMarkers(p => p.map(m => {
                if (m.id !== obj.id) return m;
                if (activePhase && activePhase !== "existing") { const base = m.px?.[activePhase] ?? { x: m.x, y: m.y }; return { ...m, px: { ...m.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } }; }
                return { ...m, x: m.x + dx, y: m.y + dy };
              }));
            } else if (obj.type === "door") {
              setDoors(p => p.map(d => {
                if (d.id !== obj.id) return d;
                if (activePhase && activePhase !== "existing") { const base = d.px?.[activePhase] ?? { x: d.x, y: d.y }; return { ...d, px: { ...d.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } }; }
                return { ...d, x: d.x + dx, y: d.y + dy };
              }));
            } else if (obj.type === "window") {
              setWindows(p => p.map(w => {
                if (w.id !== obj.id) return w;
                if (activePhase && activePhase !== "existing") { const base = w.px?.[activePhase] ?? { x: w.x, y: w.y }; return { ...w, px: { ...w.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } }; }
                return { ...w, x: w.x + dx, y: w.y + dy };
              }));
            } else if (obj.type === "column") {
              setColumns(p => p.map(c => {
                if (c.id !== obj.id) return c;
                if (activePhase && activePhase !== "existing") { const base = c.px?.[activePhase] ?? { x: c.x, y: c.y }; return { ...c, px: { ...c.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } }; }
                return { ...c, x: c.x + dx, y: c.y + dy };
              }));
            } else if (obj.type === "label") {
              setLabels(p => p.map(l => l.id !== obj.id ? l : { ...l, x: l.x + dx, y: l.y + dy }));
            } else if (obj.type === "revcloud") {
              const rdx = sn(pos.x, snapGrid) - drag.startX, rdy = sn(pos.y, snapGrid) - drag.startY;
              setRevClouds(p => p.map(r => r.id !== obj.id ? r
                : { ...r, points: obj.points.map(pt => ({ x: pt.x + rdx, y: pt.y + rdy })) }));
              // move labels anchored to this cloud that aren't themselves in the multi-selection
              const selSet = new Set(selectedIds);
              setLabels(p => p.map(l => {
                if (l.anchorType !== "revcloud" || l.anchorId !== obj.id || selSet.has(l.id)) return l;
                const lp = obj.startLabelPositions?.find(lsp => lsp.id === l.id);
                if (!lp || lp.lx == null) return l; // no leader → text stays put
                return { ...l, lx: lp.lx + rdx, ly: lp.ly + rdy }; // only leader tip moves
              }));
            } else if (obj.type === "flowPath") {
              const rdx = sn(pos.x, snapGrid) - drag.startX, rdy = sn(pos.y, snapGrid) - drag.startY;
              setFlowPaths(p => p.map(r => r.id !== obj.id ? r
                : { ...r, points: obj.points.map(pt => ({ x: pt.x + rdx, y: pt.y + rdy })) }));
            } else if (obj.type === "floorRegion") {
              const rdx = sn(pos.x, snapGrid) - drag.startX, rdy = sn(pos.y, snapGrid) - drag.startY;
              setFloorRegions(p => p.map(r => r.id !== obj.id ? r
                : { ...r, points: obj.points.map(pt => ({ x: pt.x + rdx, y: pt.y + rdy })) }));
            }
          });
          setDrag(d => ({ ...d, lastX: pos.x, lastY: pos.y }));
        }
      } else if (drag.type === "node") {
        const near = findNear(sx, sy, [drag.id]);
        let newNodeX = near ? near.x : sx, newNodeY = near ? near.y : sy;
        if (!near) {
          const g = applySmartGuides(newNodeX, newNodeY, _guideTargets);
          newNodeX = g.x; newNodeY = g.y;
          setSmartGuides(g.guides);
        } else { setSmartGuides([]); }
        setNodes(prev => prev.map(n => {
          if (n.id !== drag.id) return n;
          if (activePhase && activePhase !== "existing")
            return { ...n, px: { ...n.px, [activePhase]: { x: newNodeX, y: newNodeY } } };
          return { ...n, x: newNodeX, y: newNodeY };
        }));
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
          const phased = activePhase && activePhase !== "existing";
          setNodes(prev => prev.map(n => {
            if (n.id === w.n1) return phased ? { ...n, px: { ...n.px, [activePhase]: { x: n1NewX, y: n1NewY } } } : { ...n, x: n1NewX, y: n1NewY };
            if (n.id === w.n2) return phased ? { ...n, px: { ...n.px, [activePhase]: { x: n2NewX, y: n2NewY } } } : { ...n, x: n2NewX, y: n2NewY };
            return n;
          }));
          // Items on the dragged wall — parametric reposition keeps them on the centerline.
          if (drag.attached?.length) {
            const newAngle = Math.atan2(n2NewY - n1NewY, n2NewX - n1NewX) * 180 / Math.PI;
            drag.attached.forEach(item => {
              const nx = n1NewX + item.t * (n2NewX - n1NewX);
              const ny = n1NewY + item.t * (n2NewY - n1NewY);
              const np = { x: nx, y: ny, angle: newAngle };
              if (item.isDoor) setDoors(p => p.map(d => {
                if (d.id !== item.id) return d;
                if (phased) return { ...d, px: { ...d.px, [activePhase]: np } };
                return { ...d, ...np };
              }));
              else setWindows(p => p.map(ww => {
                if (ww.id !== item.id) return ww;
                if (phased) return { ...ww, px: { ...ww.px, [activePhase]: np } };
                return { ...ww, ...np };
              }));
            });
          }
          // Items on adjacent walls that skew because a shared node moved.
          if (drag.adjacentAttached?.length) {
            drag.adjacentAttached.forEach(item => {
              const movingX = item.isN1W ? n1NewX : n2NewX;
              const movingY = item.isN1W ? n1NewY : n2NewY;
              const ax = item.sharedIsN1WA ? movingX : item.otherX;
              const ay = item.sharedIsN1WA ? movingY : item.otherY;
              const bx = item.sharedIsN1WA ? item.otherX : movingX;
              const by = item.sharedIsN1WA ? item.otherY : movingY;
              const nx = ax + item.t * (bx - ax);
              const ny = ay + item.t * (by - ay);
              const newAngle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
              if (item.isDoor) setDoors(p => p.map(d => d.id === item.id ? { ...d, x: nx, y: ny, angle: newAngle } : d));
              else setWindows(p => p.map(ww => ww.id === item.id ? { ...ww, x: nx, y: ny, angle: newAngle } : ww));
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
        if (z?.points && drag.startPts) {
          const curX = sn(pos.x - drag.ox, snapGrid);
          const curY = sn(pos.y - drag.oy, snapGrid);
          const totalDx = curX - drag.startX;
          const totalDy = curY - drag.startY;
          const newPts = drag.startPts.map(pt => ({ x: pt.x + totalDx, y: pt.y + totalDy }));
          setZones(p => p.map(zz => {
            if (zz.id !== drag.id) return zz;
            if (activePhase && activePhase !== "existing") return { ...zz, px: { ...zz.px, [activePhase]: newPts } };
            return { ...zz, points: newPts };
          }));
        } else if (z && !z.points) {
          setZones(p => p.map(zz => zz.id === drag.id ? { ...zz, x: sn(pos.x - drag.ox, snapGrid), y: sn(pos.y - drag.oy, snapGrid) } : zz));
        }
      }
      else if (drag.type === "marker") {
        const dragMarker = markers.find(x => x.id === drag.id);
        const ct = dragMarker?.componentType;
        const isCeilingMount = ct === "outlet_ceiling" || ct === "pendent_prewire" || ct?.startsWith("htrack_") || (ct?.startsWith("light_") && ct !== "light_sconce");
        const isWallOutlet = dragMarker?.layer === "power" && ct && !isCeilingMount &&
          (ct.startsWith("outlet_") || ct.startsWith("switch_") || ct === "panel_board" || ct === "light_sconce" || ct === "sconce_prewire" || ct === "tstat");
        if (isWallOutlet) {
          const snap = snapToWall(pos.x, pos.y, Infinity);
          if (snap) {
            const np = { x: snap.x, y: snap.y, angle: snap.angle * Math.PI / 180 };
            setMarkers(p => p.map(x => {
              if (x.id !== drag.id) return x;
              if (activePhase && activePhase !== "existing") return { ...x, px: { ...x.px, [activePhase]: np } };
              return { ...x, ...np };
            }));
          }
          setSmartGuides([]);
        } else {
          const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
          const g = applySmartGuides(rawX, rawY, _guideTargets);
          setSmartGuides(g.guides);
          const np = { x: g.x, y: g.y };
          setMarkers(p => p.map(x => {
            if (x.id !== drag.id) return x;
            if (activePhase && activePhase !== "existing") return { ...x, px: { ...x.px, [activePhase]: np } };
            return { ...x, ...np };
          }));
        }
      }
      else if (drag.type === "door") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const snap = snapToWall(pos.x - drag.ox, pos.y - drag.oy);
        const fx = snap ? snap.x : rawX, fy = snap ? snap.y : rawY;
        setDoors(p => p.map(d => {
          if (d.id !== drag.id) return d;
          const override = { x: fx, y: fy, ...(snap ? { angle: snap.angle } : {}) };
          if (activePhase && activePhase !== "existing") return { ...d, px: { ...d.px, [activePhase]: override } };
          return { ...d, ...override };
        }));
        const g = applySmartGuides(fx, fy, _guideTargets);
        setSmartGuides(g.guides);
      }
      else if (drag.type === "window") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const snap = snapToWall(pos.x - drag.ox, pos.y - drag.oy);
        const fx = snap ? snap.x : rawX, fy = snap ? snap.y : rawY;
        setWindows(p => p.map(w => {
          if (w.id !== drag.id) return w;
          const override = { x: fx, y: fy, ...(snap ? { angle: snap.angle } : {}) };
          if (activePhase && activePhase !== "existing") return { ...w, px: { ...w.px, [activePhase]: override } };
          return { ...w, ...override };
        }));
        const g = applySmartGuides(fx, fy, _guideTargets);
        setSmartGuides(g.guides);
      }
      else if (drag.type === "column") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const g = applySmartGuides(rawX, rawY, _guideTargets);
        setSmartGuides(g.guides);
        setColumns(p => p.map(c => {
          if (c.id !== drag.id) return c;
          if (activePhase && activePhase !== "existing") return { ...c, px: { ...c.px, [activePhase]: { x: g.x, y: g.y } } };
          return { ...c, x: g.x, y: g.y };
        }));
      }
      else if (drag.type === "dim") {
        const dim = dims.find(x => x.id === drag.id);
        if (dim) {
          const re = resolveDimEndpoints(dim);
          const ddx = re.x2 - re.x1, ddy = re.y2 - re.y1, dlen = Math.hypot(ddx, ddy);
          if (dlen > 0) {
            const nnx = -ddy / dlen, nny = ddx / dlen;
            const newOff = (pos.x - re.x1) * nnx + (pos.y - re.y1) * nny;
            setDims(p => p.map(x => x.id === drag.id ? { ...x, offset: newOff } : x));
          }
        }
      }
      else if (drag.type === "label") {
        const newX = sn(pos.x - drag.ox, snapGrid), newY = sn(pos.y - drag.oy, snapGrid);
        setLabels(p => p.map(l => l.id !== drag.id ? l : { ...l, x: newX, y: newY }));
      }
      else if (drag.type === "revcloud-edge") {
        const dx = pos.x - drag.ox, dy = pos.y - drag.oy;
        const ei = drag.edgeIndex;
        setRevClouds(p => p.map(r => {
          if (r.id !== drag.id) return r;
          const ej = (ei + 1) % r.points.length;
          return { ...r, points: r.points.map((pt, i) => {
            if (i === ei) return { x: sn(drag.startA.x + dx, snapGrid), y: sn(drag.startA.y + dy, snapGrid) };
            if (i === ej) return { x: sn(drag.startB.x + dx, snapGrid), y: sn(drag.startB.y + dy, snapGrid) };
            return pt;
          })};
        }));
      }
      else if (drag.type === "revcloud-vertex") {
        const newX = sn(pos.x - drag.ox, snapGrid), newY = sn(pos.y - drag.oy, snapGrid);
        setRevClouds(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: r.points.map((pt, i) => i === drag.vertexIndex ? { x: newX, y: newY } : pt) }));
        setLabels(p => p.map(l => {
          if (l.anchorType !== "revcloud" || l.anchorId !== drag.id) return l;
          const atTip = l.lx != null && Math.abs(l.lx - drag.origVx) < 1 && Math.abs(l.ly - drag.origVy) < 1;
          if (atTip) return { ...l, lx: newX, ly: newY };
          return l;
        }));
      }
      else if (drag.type === "revcloud") {
        const dx = sn(pos.x - drag.ox, snapGrid) - drag.startX;
        const dy = sn(pos.y - drag.oy, snapGrid) - drag.startY;
        setRevClouds(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: drag.startPts.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
        if (drag.startLabelPositions?.length) {
          const posMap = new Map(drag.startLabelPositions.map(lp => [lp.id, lp]));
          setLabels(p => p.map(l => {
            const lp = posMap.get(l.id);
            if (!lp || lp.lx == null) return l; // no leader → text stays put
            return { ...l, lx: lp.lx + dx, ly: lp.ly + dy }; // only leader tip moves
          }));
        }
      }
      else if (drag.type === "flowPath-vertex") {
        setFlowPaths(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: r.points.map((pt, i) => i === drag.vertexIndex
              ? { x: sn(pos.x - drag.ox, snapGrid), y: sn(pos.y - drag.oy, snapGrid) } : pt) }));
      }
      else if (drag.type === "flowPath") {
        const dx = sn(pos.x - drag.ox, snapGrid) - drag.startX;
        const dy = sn(pos.y - drag.oy, snapGrid) - drag.startY;
        setFlowPaths(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: drag.startPts.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
      }
      else if (drag.type === "floorRegion-vertex") {
        setFloorRegions(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: r.points.map((pt, i) => i === drag.vertexIndex
              ? { x: sn(pos.x - drag.ox, snapGrid), y: sn(pos.y - drag.oy, snapGrid) } : pt) }));
      }
      else if (drag.type === "floorRegion-edge") {
        const dx = pos.x - drag.ox, dy = pos.y - drag.oy;
        const proj = dx * drag.nx + dy * drag.ny;
        const mx = sn(drag.nx * proj, snapGrid), my = sn(drag.ny * proj, snapGrid);
        const ei = drag.edgeIndex;
        setFloorRegions(p => p.map(r => {
          if (r.id !== drag.id) return r;
          const ej = (ei + 1) % r.points.length;
          return { ...r, points: r.points.map((pt, i) => {
            if (i === ei) return { x: drag.startA.x + mx, y: drag.startA.y + my };
            if (i === ej) return { x: drag.startB.x + mx, y: drag.startB.y + my };
            return pt;
          }) };
        }));
      }
      else if (drag.type === "floorRegion") {
        const dx = sn(pos.x - drag.ox, snapGrid) - drag.startX;
        const dy = sn(pos.y - drag.oy, snapGrid) - drag.startY;
        setFloorRegions(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: drag.startPts.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
      }
      else if (drag.type === "underlay") {
        setBgOffset({ x: pos.x - drag.ox, y: pos.y - drag.oy });
      }
      return;
    }
    if (resize) {
      const { id: rid, edge } = resize;
      setZones(p => p.map(z => {
        if (z.id !== rid || z.points) return z;
        let { x, y, w, h } = z;
        const px = sn(pos.x, snapGrid), py = sn(pos.y, snapGrid);
        if (edge.includes("e")) w = Math.max(40, px - x);
        if (edge.includes("s")) h = Math.max(40, py - y);
        if (edge.includes("w")) { const nx = Math.min(px, x + w - 40); w = w + x - nx; x = nx; }
        if (edge.includes("n")) { const ny = Math.min(py, y + h - 40); h = h + y - ny; y = ny; }
        return { ...z, x, y, w, h };
      }));
    }
  }, [panning, panSt, canvasRotation, drawChain, drag, resize, s2c, findNear, findDimSnap, walls, wc, tool, snapToWall, snapGrid, marquee, calibrationLine, dims, drawDim, zones, zoom, rotatingMarker, outletType, lightingType, htrackAngle, nodes, doors, windows, columns, markers, activePhase, snapLabelAnchor, revClouds, drawRevCloud, flowPaths, drawFlowPath, floorRegions, drawFloorRegion, resolveDimEndpoints, findProxHover, proxHover]);

  const onUp = useCallback((e) => {
    // Commit label placement
    if (drag?.type === "label-tip") {
      const pos = s2c(e.clientX, e.clientY);
      const { x, y, anchorId, anchorType } = snapLabelAnchor(pos.x, pos.y);
      setLabels(p => p.map(l => l.id !== drag.id ? l : { ...l, lx: x, ly: y, anchorId, anchorType }));
      setDrag(null); setGhostPos(null);
      return;
    }
    if (drag?.type === "label-place") {
      const rawPos = s2c(e.clientX, e.clientY);
      const endSnap = snapLabelAnchor(rawPos.x, rawPos.y);
      const dx = endSnap.x - drag.startX, dy = endSnap.y - drag.startY;
      const isLeader = Math.hypot(dx, dy) > 8;
      const nid = uid();
      const rcAnchorId = drag.startAnchorType === "revcloud" ? drag.startAnchorId : endSnap.anchorType === "revcloud" ? endSnap.anchorId : null;
      const rcColor = rcAnchorId ? revClouds.find(r => r.id === rcAnchorId)?.color : null;
      const defaultColor = rcColor ?? (themeMode === "dark" ? "#F0EDE6" : "#1A1812");
      const newLabel = {
        id: nid, phase: activePhase,
        x: isLeader ? endSnap.x : drag.startX,
        y: isLeader ? endSnap.y : drag.startY,
        text: "",
        fontSize: 12, bold: false, italic: false,
        color: defaultColor,
        lx: isLeader ? drag.startX : null,
        ly: isLeader ? drag.startY : null,
        anchorId: isLeader ? (drag.startAnchorId ?? null) : null,
        anchorType: isLeader ? (drag.startAnchorType ?? null) : null,
      };
      setLabels(p => [...p, newLabel]);
      setEditingLabelId(nid);
      setEditingLabelText("");
      setDrag(null);
      return;
    }
    // Finish marquee selection
    if (marquee) {
      const minX = Math.min(marquee.startX, marquee.endX);
      const maxX = Math.max(marquee.startX, marquee.endX);
      const minY = Math.min(marquee.startY, marquee.endY);
      const maxY = Math.max(marquee.startY, marquee.endY);
      
      const selected = [];
      
      // Check nodes
      if (mode === "build") {
        const visibleWallNodeIds = new Set(walls.filter(w => phaseVisible(w.phase)).flatMap(w => [w.n1, w.n2]));
        nodes.forEach(n => {
          if (!visibleWallNodeIds.has(n.id)) return;
          if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
            selected.push({ id: n.id, type: "node" });
          }
        });
        // Add walls whose both endpoints are inside the marquee
        walls.forEach(w => {
          if (!phaseVisible(w.phase)) return;
          const c = wc(w); if (!c) return;
          const n1 = nodes.find(n => n.id === w.n1), n2 = nodes.find(n => n.id === w.n2);
          if (n1 && n2 &&
              n1.x >= minX && n1.x <= maxX && n1.y >= minY && n1.y <= maxY &&
              n2.x >= minX && n2.x <= maxX && n2.y >= minY && n2.y <= maxY) {
            selected.push({ id: w.id, type: "wall" });
          }
        });
        doors.forEach(d => {
          if (!phaseVisible(d.phase)) return;
          const rp = resolvePos(d);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: d.id, type: "door" });
          }
        });
        windows.forEach(w => {
          if (!phaseVisible(w.phase)) return;
          const rp = resolvePos(w);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: w.id, type: "window" });
          }
        });
        columns.forEach(c => {
          if (!phaseVisible(c.phase)) return;
          const rp = resolvePos(c);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: c.id, type: "column" });
          }
        });
        markers.forEach(m => {
          if (!markerVisible(m)) return;
          const rp = resolvePos(m);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: m.id, type: "marker" });
          }
        });
        labels.forEach(lbl => {
          if (!phaseVisible(lbl.phase)) return;
          if (lbl.x >= minX && lbl.x <= maxX && lbl.y >= minY && lbl.y <= maxY)
            selected.push({ id: lbl.id, type: "label" });
        });
        revClouds.forEach(rc => {
          if (!phaseVisible(rc.phase)) return;
          const c = polyCentroid(rc.points);
          if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY)
            selected.push({ id: rc.id, type: "revcloud" });
        });
        flowPaths.forEach(fp => {
          if (!phaseVisible(fp.phase)) return;
          const cx = fp.points.reduce((s,p)=>s+p.x,0)/fp.points.length, cy = fp.points.reduce((s,p)=>s+p.y,0)/fp.points.length;
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY)
            selected.push({ id: fp.id, type: "flowPath" });
        });
        floorRegions.forEach(fr => {
          if (!phaseVisible(fr.phase)) return;
          const c = polyCentroid(fr.points);
          if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY)
            selected.push({ id: fr.id, type: "floorRegion" });
        });
      } else if (mode === "zone") {
        zones.forEach(z => {
          if (!phaseVisible(z.phase)) return;
          const rpts = resolvePoints(z);
          const zx = z.points ? polyCentroid(rpts).x : z.x + z.w / 2;
          const zy = z.points ? polyCentroid(rpts).y : z.y + z.h / 2;
          if (zx >= minX && zx <= maxX && zy >= minY && zy <= maxY) {
            selected.push({ id: z.id, type: "zone" });
          }
        });
      } else if (mode === "itmep") {
        markers.forEach(m => {
          if (!markerVisible(m)) return;
          const rp = resolvePos(m);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
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
    // When a copy-drag finishes, record the total displacement so "/" can distribute intermediates
    if (drag?.isCopy && drag.type === "multi") {
      const dx = drag.lastX - drag.startX, dy = drag.lastY - drag.startY;
      if (dx !== 0 || dy !== 0) setLastCopyInfo(prev => prev ? { ...prev, dx, dy } : null);
    } else if (drag?.isCopy) {
      // Single-item copy: compute displacement from first srcItem position to its current resolved position
      setLastCopyInfo(prev => {
        if (!prev || prev.srcItems.length !== 1) return prev;
        const item = prev.srcItems[0];
        let el = null;
        if (item.type === "column") el = columns.find(c => c.id === item.id);
        else if (item.type === "marker") el = markers.find(m => m.id === item.id);
        else if (item.type === "door") el = doors.find(d => d.id === item.id);
        else if (item.type === "window") el = windows.find(w => w.id === item.id);
        else if (item.type === "zone") { const z = zones.find(z => z.id === item.id); if (z) { const c = polyCentroid(resolvePoints(z)); return { ...prev, dx: c.x - item.x, dy: c.y - item.y }; } }
        if (!el) return prev;
        const rp = resolvePos(el);
        return { ...prev, dx: rp.x - item.x, dy: rp.y - item.y };
      });
    }
    // No re-clipping on zone drag/vertex drag end — user controls shape manually
    setDrag(null); setResize(null); setPanning(false); setPanSt(null); setHoverNid(null); setProxHover(null); setRotatingMarker(null); setSmartGuides([]);
  }, [drag, resize, hoverNid, marquee, selectedIds, selectedId, mode, nodes, walls, doors, windows, zones, markers, columns, labels, revClouds, flowPaths, floorRegions, phaseVisible, resolvePos, resolvePoints, wc, lastCopyInfo, s2c, themeMode, activePhase, snapLabelAnchor]);

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
    Object.entries(wallFt).forEach(([k, v]) => { if (v > 0) wallFtFormatted[k] = { ft: v, label: wallKinds[k].label, color: wallKinds[k].color }; });
    return { zones: zc, markers: pc, total: zt + pt, totalSf, wallFt: wallFtFormatted };
  }, [zones, markers, walls, wl, ftN]);

  const selZone = useMemo(() => selType === "zone" ? zones.find(z => z.id === selectedId) : null, [selType, selectedId, zones]);
  const selMarker = useMemo(() => selType === "marker" ? markers.find(p => p.id === selectedId) : null, [selType, selectedId, markers]);
  const selWall = useMemo(() => selType === "wall" ? walls.find(w => w.id === selectedId) : null, [selType, selectedId, walls]);
  const selNode = useMemo(() => selType === "node" ? gn(selectedId) : null, [selType, selectedId, gn]);
  const selDoor = useMemo(() => selType === "door" ? doors.find(d => d.id === selectedId) : null, [selType, selectedId, doors]);
  const selWindow = useMemo(() => selType === "window" ? windows.find(w => w.id === selectedId) : null, [selType, selectedId, windows]);
  const selColumn = useMemo(() => selType === "column" ? columns.find(c => c.id === selectedId) : null, [selType, selectedId, columns]);
  const selLabel = useMemo(() => (selType === "label" || selType === "label-tip") ? labels.find(l => l.id === selectedId) : null, [selType, selectedId, labels]);
  const selRevCloud = useMemo(() => selType === "revcloud" ? revClouds.find(r => r.id === selectedId) : null, [selType, selectedId, revClouds]);
  const selFlowPath = useMemo(() => selType === "flowPath" ? flowPaths.find(r => r.id === selectedId) : null, [selType, selectedId, flowPaths]);
  const selFloorRegion = useMemo(() => selType === "floorRegion" ? floorRegions.find(r => r.id === selectedId) : null, [selType, selectedId, floorRegions]);
  const updFloorRegion = (u) => setFloorRegions(p => p.map(r => r.id === selectedId ? { ...r, ...u } : r));
  const updFlowPath = (u) => setFlowPaths(p => p.map(r => r.id === selectedId ? { ...r, ...u } : r));

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
      setZones(p => p.filter(z => !idsToDelete.has(z.id)));
      setMarkers(p => phaseDeleteMarkers(p, m => idsToDelete.has(m.id)));
      setDims(p => p.filter(d => !idsToDelete.has(d.id)));
      setLabels(p => p.filter(l => !idsToDelete.has(l.id)));
      setRevClouds(p => p.filter(r => !idsToDelete.has(r.id)));
      setFlowPaths(p => p.filter(r => !idsToDelete.has(r.id)));
      setFloorRegions(p => p.filter(r => !idsToDelete.has(r.id)));

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
      else if (selType === "label" || selType === "label-tip") setLabels(p => p.filter(l => l.id !== selectedId));
      else if (selType === "revcloud") setRevClouds(p => p.filter(r => r.id !== selectedId));
      else if (selType === "flowPath") setFlowPaths(p => p.filter(r => r.id !== selectedId));
      else if (selType === "floorRegion") setFloorRegions(p => p.filter(r => r.id !== selectedId));
      else if (selType === "elevDim" || selType === "elevLabel") {
        const key = selType === "elevDim" ? "dims" : "labels";
        setElevAnnotations(prev => Object.fromEntries(Object.entries(prev).map(([dir, a]) => [dir, { ...a, [key]: (a[key] || []).filter(x => x.id !== selectedId) }])));
      }
      else { setZones(p => p.filter(z => z.id !== selectedId)); setMarkers(p => phaseDeleteMarkers(p, m => m.id === selectedId)); }
      setSelectedId(null); setSelType(null); setSelectedIds([]);
    }
  }, [selectedId, selectedIds, selType, walls, nodes, wallsAt, phases, activePhase]);

  const _ids = () => new Set(selectedIds.length > 1 ? selectedIds : [selectedId].filter(Boolean));
  const updZone = (u) => { const ids = _ids(); setZones(p => p.map(z => ids.has(z.id) ? { ...z, ...u } : z)); };
  const updMarker = (u) => { const ids = _ids(); setMarkers(p => p.map(x => ids.has(x.id) ? { ...x, ...u } : x)); };
  const updWall = (u) => { const ids = _ids(); setWalls(p => p.map(w => ids.has(w.id) ? { ...w, ...u } : w)); };
  const updDoor = (u) => { const ids = _ids(); setDoors(p => p.map(d => ids.has(d.id) ? { ...d, ...u } : d)); };
  const updWindow = (u) => { const ids = _ids(); setWindows(p => p.map(w => ids.has(w.id) ? { ...w, ...u } : w)); };
  const updColumn = (u) => { const ids = _ids(); setColumns(p => p.map(c => ids.has(c.id) ? { ...c, ...u } : c)); };
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
  }, [selectedIds, activePhase, columns, markers, doors, windows, zones, resolvePos, resolvePoints]);

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
            const newCols = [], newMks = [], newDrs = [], newWins = [], newZns = [];
            const newIds = [];
            for (let i = 1; i <= n; i++) {
              const frac = i * step;
              srcItems.forEach(item => {
                const nid = uid();
                newIds.push(nid);
                const nx = item.x + dx * frac, ny = item.y + dy * frac;
                if (item.type === "column") { const src = columns.find(c => c.id === item.id); if (src) newCols.push({ ...src, id: nid, px: undefined, x: nx, y: ny }); }
                else if (item.type === "marker") { const src = markers.find(m => m.id === item.id); if (src) newMks.push({ ...src, id: nid, px: undefined, x: nx, y: ny, deletedAtPhase: undefined }); }
                else if (item.type === "door") { const src = doors.find(d => d.id === item.id); if (src) newDrs.push({ ...src, id: nid, px: undefined, x: nx, y: ny }); }
                else if (item.type === "window") { const src = windows.find(w => w.id === item.id); if (src) newWins.push({ ...src, id: nid, px: undefined, x: nx, y: ny }); }
                else if (item.type === "zone") { const src = zones.find(z => z.id === item.id); if (src) { const c = polyCentroid(resolvePoints(src)); const odx = nx - c.x, ody = ny - c.y; newZns.push({ ...src, id: nid, px: undefined, points: resolvePoints(src).map(p => ({ x: p.x + odx, y: p.y + ody })) }); } }
              });
            }
            if (newCols.length) setColumns(p => [...p, ...newCols]);
            if (newMks.length) setMarkers(p => [...p, ...newMks]);
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
        const newMarkers = clipboard.markers.map(m => ({ ...m, id: uid(), x: m.x + off, y: m.y + off, deletedAtPhase: undefined }));
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
      if (e.key === "1") { setMode("build");  setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); return; }
      if (e.key === "2") { setMode("itmep");  setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); return; }
      if (e.key === "3") { setMode("zone");   setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); return; }
      if (e.key === "4") { setMode("budget"); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); return; }
      if (k === "V" || k === "H") { setT(k === "V" ? "select" : "pan"); }
      else if (mode === "build" && { W: "wall", C: "column" }[k]) { setT({ W: "wall", C: "column" }[k]); }
      else if (mode === "itmep" && k === "E") { setT("outlet"); }
      else if (mode === "itmep" && k === "L") { setT("lighting"); }
      else if (k === "M") { setT("dim"); setDrawDim(null); }
      else if (k === "T") { setT("label"); }
      else if (k === "N") { setT("revcloud"); }
      else if (k === "K") { setT("flowPath"); }
      else if (k === "A" && !(e.ctrlKey || e.metaKey)) { setT("floorRegion"); }
      else if (mode === "zone" && k === "Z") { setT("zone"); }
      else if (mode === "itmep" && k === "P") { setT("marker"); }
      if (k === "D" && !e.ctrlKey) setShowDims(d => !d);
      if (k === "G") setShowGrid(g => !g);
      if (k === "R" && ((tool === "outlet" && outletType.startsWith("htrack_")) || (tool === "lighting" && lightingType.startsWith("htrack_")))) { setHtrackAngle(a => (a + 45) % 180); }
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
      if (k === "ESCAPE") {
        if (addingLeaderToId) { setAddingLeaderToId(null); }
        else if (drawRevCloud) { setDrawRevCloud(null); }
        else if (drawFlowPath) { setDrawFlowPath(null); }
        else if (drawFloorRegion) { setDrawFloorRegion(null); }
        else if (drawChain || drawPolyZone || drawDim) {
          setDrawChain(null); setDrawPolyZone(null); setCursorPos(null); setDimInput(""); setDrawDim(null);
        } else {
          setSelectedId(null); setSelType(null); setSelectedIds([]);
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
        setZones(prev => prev.map(z => {
          if (!ids.has(z.id)) return z;
          if (z.points) {
            if (phased) { const b = z.px?.[activePhase] ?? z.points; return { ...z, px: { ...z.px, [activePhase]: b.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) } }; }
            return { ...z, points: z.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
          }
          return nudgeXY(z);
        }));
        setMarkers(prev => prev.map(m => ids.has(m.id) ? nudgeXY(m) : m));
        setDoors(prev => prev.map(d => ids.has(d.id) ? nudgeXY(d) : d));
        setWindows(prev => prev.map(w => ids.has(w.id) ? nudgeXY(w) : w));
        setColumns(prev => prev.map(c => ids.has(c.id) ? nudgeXY(c) : c));
        setLabels(prev => prev.map(l => !ids.has(l.id) ? l : { ...l, x: l.x + dx, y: l.y + dy, lx: l.lx != null ? l.lx + dx : null, ly: l.ly != null ? l.ly + dy : null }));
        setRevClouds(prev => prev.map(r => !ids.has(r.id) ? r : { ...r, points: r.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
        setFlowPaths(prev => prev.map(r => !ids.has(r.id) ? r : { ...r, points: r.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
        setFloorRegions(prev => prev.map(r => !ids.has(r.id) ? r : { ...r, points: r.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
        return;
      }

      if (e.key === "0" || e.key === "Home") { e.preventDefault(); fitAll(); }
      if (e.key === "`") { e.preventDefault(); setPanes(prev => prev.length > 1 ? [{ view: "plan" }] : [{ view: "plan" }, { view: "3d" }]); }
      if (e.key === "/" && lastCopyInfo && (lastCopyInfo.dx !== 0 || lastCopyInfo.dy !== 0)) { e.preventDefault(); setRepeatInput(""); return; }
    };
    const up = (e) => { if (e.key === " ") setSpaceHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [selectedId, selectedIds, selType, delSel, selDoor, selWindow, undo, redo, fitAll, dimInput, cursorPos, drawChain, pxPerFoot, commitWallSegment, tool, findNear, walls, nodes, doors, windows, columns, markers, zones, clipboard, pasteOffset, outletType, htrackAngle, lightingType, lastCopyInfo, repeatInput, resolvePos, resolvePoints, editingLabelId, addingLeaderToId, activePhase, labels, revClouds, flowPaths, drawFlowPath, drawFloorRegion]);

  const $ = (n) => "$" + n.toLocaleString();
  const font = "'SF Mono','Consolas','Monaco',monospace";
  const nodeConns = useMemo(() => { const c = {}; walls.forEach(w => { c[w.n1] = (c[w.n1] || 0) + 1; c[w.n2] = (c[w.n2] || 0) + 1; }); return c; }, [walls]);
  const nodeWallsMap = useMemo(() => { const m = {}; walls.forEach(w => { if (!m[w.n1]) m[w.n1] = []; if (!m[w.n2]) m[w.n2] = []; m[w.n1].push(w); m[w.n2].push(w); }); return m; }, [walls]);

  // 3D data — only resolved when 3D or split view is active
  const data3d = useMemo(() => {
    if (!show3d) return null;
    return {
      walls: walls.filter(w => phaseVisible(w.phase)),
      nodes: nodes.map(n => { const r = gn(n.id); return r ? { ...n, x: r.x, y: r.y } : n; }),
      doors: doors.filter(d => phaseVisible(d.phase)).map(d => ({ ...d, ...resolvePos(d) })),
      windows: windows.filter(w => phaseVisible(w.phase)).map(w => ({ ...w, ...resolvePos(w) })),
      columns: columns.filter(c => phaseVisible(c.phase)).map(c => ({ ...c, ...resolvePos(c) })),
      zones: zones.filter(z => phaseVisible(z.phase)).map(z => z.points ? { ...z, points: resolvePoints(z) } : z),
      markers: markers.filter(m => markerVisible(m)).map(m => ({ ...m, ...resolvePos(m) })),
      floorRegions: visibleFloorRegions ? floorRegions.filter(r => phaseVisible(r.phase)) : [],
    };
  }, [show3d, walls, nodes, doors, windows, columns, zones, markers, floorRegions, visibleFloorRegions, phaseVisible, markerVisible, gn, resolvePos, resolvePoints]);

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
    return <g style={{ cursor: tool === "select" && mode === "build" ? "pointer" : "inherit" }}>
      <circle cx={d.x} cy={d.y} r={wpx / 2 + 8} fill="transparent" />
      {isCaseOpening ? <>
        <line x1={d.x - wdx * wpx / 2} y1={d.y - wdy * wpx / 2} x2={d.x + wdx * wpx / 2} y2={d.y + wdy * wpx / 2} stroke={sel ? T.nodeFill : T.uiDoor + "80"} strokeWidth={2} strokeDasharray="4 3" />
        <circle cx={d.x - wdx * wpx / 2} cy={d.y - wdy * wpx / 2} r={2.5} fill={sel ? T.nodeFill : T.uiDoor} />
        <circle cx={d.x + wdx * wpx / 2} cy={d.y + wdy * wpx / 2} r={2.5} fill={sel ? T.nodeFill : T.uiDoor} />
      </> : <>
        <line x1={hx} y1={hy} x2={ex} y2={ey} stroke={sel ? T.nodeFill : T.uiDoor} strokeWidth={2} />
        <path d={`M ${fx} ${fy} A ${wpx} ${wpx} 0 0 ${sweep} ${ex} ${ey}`}
          fill="none" stroke={sel ? T.nodeFill : T.uiDoor + "88"} strokeWidth={1} strokeDasharray="4 2" />
        <circle cx={hx} cy={hy} r={3} fill={sel ? T.nodeFill : T.uiDoor} />
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
      return <g style={{ cursor: tool === "select" && mode === "build" ? "pointer" : "inherit" }}>
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
    return <g style={{ cursor: tool === "select" && mode === "build" ? "pointer" : "inherit" }}>
      <line x1={w.x - dx} y1={w.y - dy} x2={w.x + dx} y2={w.y + dy} stroke="transparent" strokeWidth={12} />
      <line x1={w.x - dx + nx} y1={w.y - dy + ny} x2={w.x + dx + nx} y2={w.y + dy + ny} stroke={sel ? T.nodeFill : "#60A0C8"} strokeWidth={1.5} />
      <line x1={w.x - dx - nx} y1={w.y - dy - ny} x2={w.x + dx - nx} y2={w.y + dy - ny} stroke={sel ? T.nodeFill : "#60A0C8"} strokeWidth={1.5} />
      <line x1={w.x - dx} y1={w.y - dy} x2={w.x + dx} y2={w.y + dy} stroke={sel ? "#E8E0D088" : "#60A0C844"} strokeWidth={6} />
    </g>;
  };

  // Marker Symbol SVG: custom symbols for IT/MEP markers
  // Maps bright "schematic" colors to readable equivalents in light mode
  const uiColor = (c) => themeMode === 'dark' ? c : ({
    '#E8D070': T.uiLighting, '#C8A060': T.uiDoor, '#E0A050': T.uiConduit,
    '#C87840': T.uiPrewire,  '#50C878': T.uiElec,  '#E05050': T.uiPanel,
    '#E8C840': T.uiBudget,   '#60B0E0': '#2060A0',  '#4080E0': '#1A50A0',
  }[c] ?? c);

  const MarkerSymbol = ({ marker, selected }) => {
    const compData = SPEC_COMPONENTS[marker.layer]?.[marker.componentType];
    if (!compData) return null;

    const { symbol, letter } = compData;
    const color = uiColor(compData.color);
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
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit" }}>
        <circle cx={0} cy={0} r={r + 6} fill="transparent" />
        {isSurface && <rect x={-(r+4)} y={-(r+4)} width={(r+4)*2} height={(r+4)*2} fill="none" stroke={color} strokeWidth={1} strokeDasharray="3 2" rx={2} style={{ pointerEvents: "none" }} />}
        <circle cx={0} cy={0} r={r} fill={color + "18"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
        <line x1={-r} y1={0} x2={r} y2={0} stroke={color} strokeWidth={2} style={{ pointerEvents: "none" }} />
        <text x={0} y={-2} textAnchor="middle" fontSize={selected ? 8 : 7} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>{isQuad ? "Q" : "D"}</text>
      </g>;
    }
    if (symbol === "outlet_ceiling") {
      return <g style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit" }}>
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
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit" }}>
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
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit" }}>
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
    if (symbol === "recessed") {
      const sz = compData.size || 4; // inches
      const rPx = (sz / 12) * pxPerFoot / 2;
      const rv = Math.max(rPx, selected ? 10 : 8);
      return <g style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "default" }}>
        <circle cx={marker.x} cy={marker.y} r={rv + 5} fill="transparent" />
        <circle cx={marker.x} cy={marker.y} r={rv} fill={color + "18"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
        <circle cx={marker.x} cy={marker.y} r={rv * 0.45} fill={color + "55"} stroke={color} strokeWidth={0.75} style={{ pointerEvents: "none" }} />
        {/* X cross inside */}
        <line x1={marker.x - rv * 0.6} y1={marker.y - rv * 0.6} x2={marker.x + rv * 0.6} y2={marker.y + rv * 0.6} stroke={color} strokeWidth={0.75} style={{ pointerEvents: "none" }} />
        <line x1={marker.x + rv * 0.6} y1={marker.y - rv * 0.6} x2={marker.x - rv * 0.6} y2={marker.y + rv * 0.6} stroke={color} strokeWidth={0.75} style={{ pointerEvents: "none" }} />
      </g>;
    }
    if (symbol === "pendant") {
      return <g style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "default" }}>
        <circle cx={marker.x} cy={marker.y} r={r + 5} fill="transparent" />
        <circle cx={marker.x} cy={marker.y} r={r} fill={color + "18"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
        <circle cx={marker.x} cy={marker.y} r={3} fill={color} style={{ pointerEvents: "none" }} />
        <line x1={marker.x} y1={marker.y - r} x2={marker.x} y2={marker.y - r - 8} stroke={color} strokeWidth={1} style={{ pointerEvents: "none" }} />
        <line x1={marker.x - 4} y1={marker.y - r - 8} x2={marker.x + 4} y2={marker.y - r - 8} stroke={color} strokeWidth={1.5} style={{ pointerEvents: "none" }} />
      </g>;
    }
    if (symbol === "linear_lt") {
      const ftLen = compData.ftLen || 4;
      const lenPx = ftLen * pxPerFoot;
      const thk = selected ? 5 : 4;
      const angle = marker.angle || 0;
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angle * 180 / Math.PI})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "default" }}>
        <rect x={-lenPx / 2 - 4} y={-thk - 4} width={lenPx + 8} height={thk * 2 + 8} fill="transparent" />
        <rect x={-lenPx / 2} y={-thk / 2} width={lenPx} height={thk} fill={color + "40"} stroke={color} strokeWidth={selected ? 1.5 : 1} rx={1} style={{ pointerEvents: "none" }} />
        <text x={0} y={thk / 2 + 9} textAnchor="middle" fontSize={7} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>{ftLen}'</text>
      </g>;
    }
    if (symbol === "sconce") {
      const angleDeg = (marker.angle || 0) * 180 / Math.PI;
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "default" }}>
        <circle cx={0} cy={0} r={r + 5} fill="transparent" />
        {/* Wall plate */}
        <rect x={-r * 0.5} y={-r} width={r} height={r * 2} fill={color + "18"} stroke={color} strokeWidth={strokeW} rx={1} style={{ pointerEvents: "none" }} />
        {/* Light cone */}
        <line x1={0} y1={-r * 0.6} x2={r * 1.4} y2={-r * 1.2} stroke={color} strokeWidth={0.75} style={{ pointerEvents: "none" }} />
        <line x1={0} y1={r * 0.6} x2={r * 1.4} y2={r * 1.2} stroke={color} strokeWidth={0.75} style={{ pointerEvents: "none" }} />
        <circle cx={r * 0.4} cy={0} r={2.5} fill={color} style={{ pointerEvents: "none" }} />
      </g>;
    }
    return null;
  };

  // ── Mode system ─────────────────────────────────────────────────────
  const setT = (t) => {
    setTool(t); setGhostPos(null); setDrawChain(null); setDrawPolyZone(null); setCursorPos(null); setDimInput(""); setDrawDim(null); setDrawRevCloud(null); setDrawFloorRegion(null); setProxHover(null);
    // Re-entering the flow-path tool with a flow path selected → continue it.
    if (t === "flowPath" && selType === "flowPath" && selectedId) {
      const fp = flowPaths.find(f => f.id === selectedId);
      if (fp && fp.points.length) { setDrawFlowPath({ points: fp.points.map(p => ({ ...p })), editingId: fp.id }); }
      else setDrawFlowPath(null);
    } else {
      setDrawFlowPath(null);
    }
    if (t !== "select" && t !== "pan") { setSelectedId(null); setSelType(null); setSelectedIds([]); }
  };

  const MODES = {
    build:  { label: "(1) Build",   color: "#9A9488" },
    itmep:  { label: "(2) IT/MEP",  color: "#4080E0" },
    zone:   { label: "(3) Zones",   color: "#50A070" },
    budget: { label: "(4) Budget",  color: T.uiBudget },
  };

  const S = {
    root: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: font, fontSize: 11, background: T.bg0, color: T.text, overflow: "hidden" },
    bar: { display: "flex", alignItems: "center", background: T.bg2, borderBottom: "1px solid " + T.border, padding: "0 12px", height: "44px", flexShrink: 0, gap: "6px", overflowX: "auto", overflowY: "hidden" },
    mbtn: (a, c) => ({
      padding: "7px 14px",
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
    side: { width: sidebarOpen ? "clamp(190px, 18vw, 240px)" : "0px", background: T.bg1, borderRight: sidebarOpen ? "1px solid " + T.bg3 : "none", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden", transition: "width 0.2s cubic-bezier(0.4,0,0.2,1)" },
    body: { flex: 1, overflow: "auto", padding: "12px" },
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
      top: "12px",
      right: "12px",
      width: "clamp(190px, 20vw, 230px)",
      maxHeight: "calc(100vh - 120px)",
      overflow: "auto",
      background: T.panelBg,
      border: "1px solid " + T.border,
      borderRadius: "8px",
      padding: "12px",
      zIndex: 10,
      backdropFilter: "blur(12px)",
      boxShadow: T.panelShadow
    },
    inp: { background: T.bg3, border: "1.5px solid " + T.border, borderRadius: "5px", padding: "6px 10px", color: T.textBright, fontSize: "11px", fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s ease" },
    lbl: { fontSize: "9px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px", fontWeight: 600 },
    del: { background: T.delBg, border: "none", borderRadius: "5px", padding: "8px 12px", color: T.delText, fontSize: "10px", fontFamily: "inherit", cursor: "pointer", width: "100%", marginTop: "10px", fontWeight: 500, transition: "all 0.15s ease" },
    cr: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + T.bg3 + "33", fontSize: "10px" },
    ct: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1.5px solid " + T.border, marginTop: "8px", fontWeight: 600, color: T.textBright, fontSize: "13px" },
    sec: { marginBottom: "14px" },
    sh: { fontSize: "10px", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", fontWeight: 600 },
    smBtn: { padding: "5px 9px", background: "transparent", color: T.accent, border: "1.5px solid " + T.bg3, borderRadius: "5px", cursor: "pointer", fontSize: "10px", fontFamily: "inherit", transition: "all 0.15s ease", fontWeight: 500 },
    bg: { position: "absolute", bottom: "92px", left: "16px", display: "flex", gap: "8px", alignItems: "center", background: T.panelBg, border: "1px solid " + T.border, borderRadius: "6px", padding: "6px 12px", zIndex: 10, fontSize: "10px", backdropFilter: "blur(12px)", boxShadow: T.panelShadow },
    floatingToolbar: {
      position: "absolute",
      left: "50%",
      bottom: "36px",
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

  const isDrawing = drawChain || drawPolyZone || drawRevCloud || drawFlowPath || drawFloorRegion;

  // ── Pane rendering ───────────────────────────────────────────────────
  const render3dPane = () => (
    <div style={{ width: "100%", height: "100%", position: "relative", background: T.canvas }}>
      {data3d && <TestFit3D
        walls={data3d.walls} nodes={data3d.nodes} doors={data3d.doors} windows={data3d.windows}
        columns={data3d.columns} zones={data3d.zones} markers={data3d.markers} dims={dims}
        pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight} T={T} themeMode={themeMode}
        controlsRef={controls3dRef} mode={mode} selectedId={selectedId} selType={selType}
        show3dLabels={show3dLabels} setShow3dLabels={setShow3dLabels}
        show3dDims={show3dDims} setShow3dDims={setShow3dDims}
        style3d={style3d} floorMaterial={floorMaterial} floorRegions={data3d.floorRegions}
        zoneLibrary={zoneLibrary} visibleLayers={visibleLayers}
        visibleBuildElectrical={visibleBuildElectrical} visibleBuildLighting={visibleBuildLighting}
        onSelect={(id, type) => { setSelectedId(id); setSelType(type); setSelectedIds(id ? [id] : []); }}
      />}
      {/* 3D style switcher */}
      <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 4, backdropFilter: "blur(12px)", zIndex: 10 }}>
        {[["clay", "Clay"], ["xray", "X-Ray"], ["detailed", "Detailed"]].map(([k, label]) => (
          <button key={k} onClick={() => setStyle3d(k)}
            style={{ padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer", background: style3d === k ? T.accent + "40" : "transparent", color: style3d === k ? T.textBright : T.textMuted, fontSize: 10, fontFamily: "inherit", fontWeight: style3d === k ? 600 : 400, outline: style3d === k ? "1px solid " + T.accent : "none" }}>
            {label}
          </button>
        ))}
      </div>
      <button onClick={() => controls3dRef.current?.reset()} title="Reset camera"
        style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: T.panelBg, color: T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow }}>
        <RotateCcw size={14} />
      </button>
    </div>
  );
  const renderAuxPane = (i) => {
    const view = panes[i]?.view;
    if (view === "3d") return render3dPane();
    // elevation
    const dir = view;
    const anno = elevAnnotations[dir];
    const placeDim = (d) => setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; const nid = uid(); setSelectedId(nid); setSelType("elevDim"); return { ...prev, [dir]: { ...cur, dims: [...(cur.dims || []), { id: nid, ...d }] } }; });
    const placeLabel = (p) => { const text = window.prompt("Label text:"); if (text == null) return; setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; const nid = uid(); setSelectedId(nid); setSelType("elevLabel"); return { ...prev, [dir]: { ...cur, labels: [...(cur.labels || []), { id: nid, x: p.x, y: p.y, text }] } }; }); };
    const updateDim = (id, patch) => setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; return { ...prev, [dir]: { ...cur, dims: (cur.dims || []).map(d => d.id === id ? { ...d, ...patch } : d) } }; });
    const updateLabel = (id, patch) => setElevAnnotations(prev => { const cur = prev[dir] || { dims: [], labels: [] }; return { ...prev, [dir]: { ...cur, labels: (cur.labels || []).map(l => l.id === id ? { ...l, ...patch } : l) } }; });
    return <ElevationView dir={dir} nodes={nodes} walls={walls} doors={doors} windows={windows} columns={columns}
      ceilingHeight={ceilingHeight} pxPerFoot={pxPerFoot} T={T} ft={ft} tool={tool}
      selectedId={selectedId} selType={selType}
      onSelect={(id, type) => { setSelectedId(id); setSelType(type); setSelectedIds(id ? [id] : []); }}
      anno={anno} onPlaceDim={placeDim} onPlaceLabel={placeLabel} onUpdateDim={updateDim} onUpdateLabel={updateLabel} />;
  };
  // Per-pane view selector chip (top-left of each pane). Plan pane is fixed.
  const PaneChip = ({ i }) => {
    const view = panes[i]?.view;
    if (i === 0) return <div style={{ position: "absolute", top: 8, left: 8, zIndex: 12, padding: "3px 9px", borderRadius: 6, background: T.panelBg, border: "1px solid " + T.border, color: T.textMuted, fontSize: 10, fontWeight: 600, fontFamily: "inherit", backdropFilter: "blur(8px)", pointerEvents: "none" }}>Plan</div>;
    return <select value={view} onChange={e => setPaneView(i, e.target.value)}
      style={{ position: "absolute", top: 8, left: 8, zIndex: 12, padding: "3px 6px", borderRadius: 6, background: T.panelBg, border: "1px solid " + T.border, color: T.textBright, fontSize: 10, fontWeight: 600, fontFamily: "inherit", backdropFilter: "blur(8px)", cursor: "pointer", outline: "none" }}>
      <option value="3d">3D</option>
      {ELEV_DIRS.map(d => <option key={d} value={d}>{PANE_VIEW_LABEL[d]}</option>)}
    </select>;
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

  return (
    <TooltipProvider>
    <div style={S.root}>
      {/* ── Top Mode Bar ──────────────────────────────────────────── */}
      <div style={S.bar}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button style={{ ...S.smBtn, padding: "5px 6px" }} onClick={() => setSidebarOpen(v => !v)}>
              {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{sidebarOpen ? "Hide panel" : "Show panel"}</TooltipContent>
        </Tooltip>
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        {/* Snapshot switcher */}
        {(() => {
          const activeSnap = snapshots.find(s => s.id === activeSnapshotId);
          const dirty = liveDirty();
          const ac = T.accent;
          const openSwitcher = e => {
            setSnapMenuRect(e.currentTarget.getBoundingClientRect());
            setShowSnapMenu(v => !v); setNewSnapMode(false); setRenamingSnapId(null);
          };
          return <div style={{ position: "relative", marginRight: 4 }}>
            <button
              onClick={openSwitcher}
              title="Snapshots"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", maxWidth: 200, background: showSnapMenu ? ac + "28" : ac + "14", border: "1px solid " + ac + (showSnapMenu ? "88" : "40"), borderRadius: 6, cursor: "pointer", color: ac, fontWeight: 600, fontSize: 10, fontFamily: "inherit", transition: "all 0.12s ease", height: 28 }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dirty ? ac : "transparent", border: "1.5px solid " + ac, flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeSnap ? activeSnap.name : "Draft"}{dirty && activeSnap ? " •" : ""}</span>
              <ChevronDown size={10} style={{ opacity: 0.7, flexShrink: 0, transition: "transform 0.15s", transform: showSnapMenu ? "rotate(180deg)" : "none" }} />
            </button>
            {showSnapMenu && <>
              <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => { setShowSnapMenu(false); setNewSnapMode(false); setRenamingSnapId(null); }} />
              <div style={{ position: "fixed", top: (snapMenuRect?.bottom ?? 44) + 6, left: snapMenuRect?.left ?? 12, background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 6, zIndex: 1000, minWidth: 230, maxWidth: 300, boxShadow: T.panelShadow, backdropFilter: "blur(16px)" }}>
                <div style={{ fontSize: 8, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 8px 6px", fontWeight: 600 }}>Snapshots</div>
                {snapshots.length === 0 && <div style={{ padding: "8px 10px", fontSize: 10, color: T.textFaint, fontStyle: "italic" }}>None yet — save one below.</div>}
                {snapshots.map(s => {
                  const isActive = s.id === activeSnapshotId;
                  return <div key={s.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: isActive ? ac + "18" : "transparent", marginBottom: 2, cursor: "pointer", transition: "background 0.12s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.border + "44"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? ac : T.textFaint, flexShrink: 0 }} />
                    {renamingSnapId === s.id ? (
                      <input autoFocus defaultValue={s.name}
                        onClick={e => e.stopPropagation()}
                        onBlur={e => { renameSnapshot(s.id, e.target.value); setRenamingSnapId(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { renameSnapshot(s.id, e.target.value); setRenamingSnapId(null); } if (e.key === "Escape") setRenamingSnapId(null); }}
                        style={{ flex: 1, background: T.bg2, border: "1px solid " + ac, borderRadius: 4, color: T.textBright, fontSize: 10, fontFamily: "inherit", padding: "2px 6px", outline: "none" }} />
                    ) : (
                      <span style={{ flex: 1, fontSize: 10, color: isActive ? ac : T.textMuted, fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        onClick={() => { if (!isActive) { if (liveDirty() && !window.confirm("Switch snapshots? Unsaved changes to the current state will be lost.")) return; } switchSnapshot(s.id); setShowSnapMenu(false); }}
                        onDoubleClick={() => setRenamingSnapId(s.id)}
                        title="Click to switch · double-click to rename">{s.name}</span>
                    )}
                    {isActive && <span style={{ fontSize: 8, color: ac, opacity: 0.75 }}>active</span>}
                    <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete snapshot "${s.name}"?`)) deleteSnapshot(s.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, padding: 2, display: "flex" }}><X size={11} /></button>
                  </div>;
                })}
                <div style={{ height: 1, background: T.border, margin: "6px 4px" }} />
                {activeSnap && (
                  <div onClick={() => { updateSnapshot(activeSnap.id); setShowSnapMenu(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, cursor: "pointer", fontSize: 10, color: dirty ? ac : T.textMuted, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.border + "44"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <RotateCcw size={12} /> Update "{activeSnap.name}"
                  </div>
                )}
                {newSnapMode ? (
                  <div style={{ display: "flex", gap: 6, padding: "6px 8px" }} onClick={e => e.stopPropagation()}>
                    <input autoFocus placeholder="Snapshot name…" value={snapDraftName}
                      onChange={e => setSnapDraftName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { takeSnapshot(snapDraftName); setSnapDraftName(""); setNewSnapMode(false); setShowSnapMenu(false); } if (e.key === "Escape") { setNewSnapMode(false); setSnapDraftName(""); } }}
                      style={{ flex: 1, background: T.bg2, border: "1px solid " + ac, borderRadius: 5, color: T.textBright, fontSize: 10, fontFamily: "inherit", padding: "5px 8px", outline: "none" }} />
                    <button onClick={() => { takeSnapshot(snapDraftName); setSnapDraftName(""); setNewSnapMode(false); setShowSnapMenu(false); }}
                      style={{ padding: "4px 10px", background: ac + "22", border: "1px solid " + ac + "55", borderRadius: 5, color: ac, fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Save</button>
                  </div>
                ) : (
                  <div onClick={() => { setNewSnapMode(true); setSnapDraftName(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, cursor: "pointer", fontSize: 10, color: T.textMuted, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.border + "44"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Plus size={12} /> Save as new snapshot
                  </div>
                )}
              </div>
            </>}
          </div>;
        })()}
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 6px 0 2px" }} />
        {Object.entries(MODES).map(([k, m]) => <button key={k} style={S.mbtn(mode === k, m.color)} onClick={() => { setMode(k); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); }}>{m.label}</button>)}
        <div style={{ flex: 1 }} />
        <Tooltip>
          <TooltipTrigger asChild>
            <button style={{ ...S.smBtn, opacity: canUndo ? 1 : 0.35, cursor: canUndo ? "pointer" : "default" }} onClick={undo} disabled={!canUndo}><Undo2 size={13} /></button>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button style={{ ...S.smBtn, opacity: canRedo ? 1 : 0.35, cursor: canRedo ? "pointer" : "default" }} onClick={redo} disabled={!canRedo}><Redo2 size={13} /></button>
          </TooltipTrigger>
          <TooltipContent>Redo (⌘⇧Z / ⌘Y)</TooltipContent>
        </Tooltip>
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        <button style={S.smBtn} onClick={() => setThemeMode(m => m === "dark" ? "light" : "dark")}>{themeMode === "dark" ? "Light" : "Dark"}</button>
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        <div style={{ position: "relative" }}>
          <button style={{ ...S.smBtn, display: "flex", alignItems: "center", gap: 4 }} onClick={e => { setSaveMenuRect(e.currentTarget.getBoundingClientRect()); setShowSaveMenu(v => !v); }}>
            Save<ChevronDown size={11} style={{ opacity: 0.7, transition: "transform 0.15s", transform: showSaveMenu ? "rotate(180deg)" : "none" }} />
          </button>
          {showSaveMenu && <>
            <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setShowSaveMenu(false)} />
            <div style={{ position: "fixed", top: (saveMenuRect?.bottom ?? 44) + 6, right: Math.max(8, window.innerWidth - (saveMenuRect?.right ?? 0)), background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 6, zIndex: 1000, minWidth: 160, boxShadow: T.panelShadow, backdropFilter: "blur(16px)" }}>
              {[
                { label: "Save Project (.json)", fn: exportProject },
                { label: "Export PNG", fn: exportPng },
                { label: "Export PDF", fn: exportPdf },
              ].map(({ label, fn }) => (
                <div key={label} onClick={() => { setShowSaveMenu(false); fn(); }}
                  style={{ padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, color: T.textMuted, fontFamily: "inherit", transition: "background 0.12s" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.border + "60"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{label}</div>
              ))}
            </div>
          </>}
        </div>
        <button style={S.smBtn} onClick={() => loadRef.current?.click()}>Load</button>
        <button style={S.smBtn} onClick={() => { if (walls.length || zones.length || markers.length) { if (confirm("New project?")) newProject(); } else newProject(); }}>New</button>
        <input ref={loadRef} type="file" accept=".json" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = ""; }} />
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        <Tooltip>
          <TooltipTrigger asChild>
            <button style={S.smBtn} onClick={() => setShowSettings(true)}><Settings size={13} /></button>
          </TooltipTrigger>
          <TooltipContent>Zone Library Settings</TooltipContent>
        </Tooltip>
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
                  <button onClick={() => { setBgImage(null); setBgOpacity(0.35); setBgScale(1); setBgOffset({ x: 0, y: 0 }); }} style={{ ...S.del, marginTop: 10, width: "100%", textAlign: "center" }}>Delete Reference Image</button>
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
                    style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiConduit, fontSize: 10, fontWeight: 500, marginBottom: 6 }}
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
              {/* Drawing Scale — hidden, state + functionality preserved */}
              <div style={S.sec}>
                <div style={S.sh}>Summary</div>
                {Object.entries(cost.wallFt).map(([k, v]) => <div key={k} style={S.cr}><span style={{ color: v.color, fontWeight: 500 }}>{v.label}</span><span style={{ fontWeight: 500 }}>{ft(v.ft)}</span></div>)}
                {Object.keys(cost.wallFt).length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>No walls yet</div>}
                <div style={{ ...S.cr, color: T.accent, borderBottom: "none" }}><span>Doors</span><span>{doors.length}</span></div>
                <div style={{ ...S.cr, color: T.accent, borderBottom: "none" }}><span>Windows</span><span>{windows.length}</span></div>
                <div style={{ ...S.cr, color: T.accent, borderBottom: "none", paddingBottom: 0 }}><span>Columns</span><span>{columns.length}</span></div>
                {(() => {
                  const pm = markers.filter(m => m.layer === "power");
                  if (!pm.length) return null;

                  // Group by componentType + isNew
                  const groups = {};
                  pm.forEach(m => {
                    const compData = SPEC_COMPONENTS.power[m.componentType];
                    if (!compData) return;
                    const isLighting = m.componentType?.startsWith("light_") || m.componentType?.startsWith("htrack_") || m.componentType === "sconce_prewire" || m.componentType === "pendent_prewire";
                    const key = m.componentType + (m.isNew ? "_new" : "_ab");
                    if (!groups[key]) groups[key] = { name: compData.name, isNew: !!m.isNew, isLighting, color: isLighting ? T.uiLighting : T.uiElec, ids: [] };
                    groups[key].ids.push(m.id);
                  });

                  const elecGroups = Object.values(groups).filter(g => !g.isLighting);
                  const ltGroups   = Object.values(groups).filter(g =>  g.isLighting);

                  const SummaryRow = ({ group }) => {
                    const isGroupSel = group.ids.length > 0 && group.ids.every(id => selectedIds.includes(id));
                    const rowColor = group.isNew ? "#50A0E0" : group.color;
                    return <div
                      style={{ ...S.cr, cursor: "pointer", background: isGroupSel ? T.selBg : "transparent", borderRadius: 4, transition: "all 0.12s ease" }}
                      onClick={() => { setSelectedIds(group.ids); setSelectedId(group.ids[0]); setSelType("marker"); setT("select"); }}>
                      <span style={{ color: rowColor, fontWeight: 500 }}>{group.ids.length}× {group.name}</span>
                      <span style={{ fontSize: 9, color: group.isNew ? "#50A0E0" : T.textMuted, fontStyle: "italic" }}>{group.isNew ? "new" : "existing"}</span>
                    </div>;
                  };

                  return <>
                    {elecGroups.length > 0 && <>
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid " + T.border, fontSize: 8, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 600 }}>Electrical</div>
                      {elecGroups.map((g, i) => <SummaryRow key={i} group={g} />)}
                    </>}
                    {ltGroups.length > 0 && <>
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid " + T.border, fontSize: 8, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 600 }}>Lighting</div>
                      {ltGroups.map((g, i) => <SummaryRow key={i} group={g} />)}
                    </>}
                  </>;
                })()}
              </div>
            </>}

            {/* ── ZONE ────��──────────────────────────────────────── */}
            {mode === "zone" && <>
              <div style={S.sec}>
                <div style={S.sh}>Zone Types</div>
              </div>
              <div style={S.sec}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Object.entries(zoneLibrary).map(([k, z]) => <button key={k} style={S.btn(activeZoneType === k, z.color)}
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
                  <span style={S.dot(zoneLibrary[z.type].color)} />
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
                {Object.entries(SPEC_LAYERS).filter(([k]) => k !== "power").map(([k, l]) => <div key={k} style={{
                  ...S.lr, 
                  background: activeSpecLayer === k ? uiColor(l.color) + "20" : "transparent",
                  border: activeSpecLayer === k ? "2px solid " + uiColor(l.color) + "60" : "2px solid transparent",
                  borderRadius: "6px",
                  padding: "8px 6px",
                  margin: "2px 0",
                  transition: "all 0.15s ease"
                }} onClick={() => { setActiveSpecLayer(k); const firstComp = Object.keys(SPEC_COMPONENTS[k])[0]; setActiveComponentType(firstComp); setT("marker"); }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: uiColor(l.color), opacity: visibleLayers[k] ? 1 : 0.3, flexShrink: 0 }} />
                  <span style={{ color: activeSpecLayer === k ? T.textBright : T.accent, flex: 1, fontWeight: activeSpecLayer === k ? 600 : 400 }}>{l.name}</span>
                  <span style={{ color: activeSpecLayer === k ? uiColor(l.color) : T.accentDim, fontSize: 10, fontWeight: 500 }}>{markers.filter(p => p.layer === k).length}</span>
                </div>)}
              </div>
              <div style={S.sec}>
                <div style={S.sh}>Placed Components ({markers.length})</div>
                {markers.length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>No components placed yet</div>}
                {Object.entries(SPEC_LAYERS).filter(([k]) => k !== "power").map(([layerKey, layer]) => {
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
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={S.dot(zoneLibrary[z.type].color)} />{z.label}</span>
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
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiBudget, marginTop: 10, fontSize: 10, fontWeight: 500 }}
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
                          const wk = wallKinds[w.kind || "existing"];
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
          {/* ── Visibility panel — all modes ── */}
          {(() => {
            const isLightComp = ct => ct?.startsWith("light_") || ct?.startsWith("htrack_") || ct === "sconce_prewire" || ct === "pendent_prewire";
            const rows = [
              // Universal items
              { key: "grid",       label: "Grid",           color: T.textMuted,            visible: showGrid,              toggle: () => setShowGrid(v => !v),              count: null },
              { key: "zones",      label: "Zones",          color: T.uiZone ?? "#6A9BCC", visible: visibleZones,          toggle: () => setVisibleZones(v => !v),          count: zones.length },
              { key: "dims",       label: "Dimensions",     color: T.dimText,              visible: visibleDims,           toggle: () => setVisibleDims(v => !v),           count: dims.length },
              { key: "labels",     label: "Labels",         color: T.textBright,           visible: visibleLabels,         toggle: () => setVisibleLabels(v => !v),         count: labels.length },
              { key: "revClouds",  label: "Rev Clouds",     color: "#E05252",              visible: visibleRevClouds,      toggle: () => setVisibleRevClouds(v => !v),      count: revClouds.length },
              { key: "flowPaths",  label: "Flow Paths",     color: "#4A90D9",              visible: visibleFlowPaths,      toggle: () => setVisibleFlowPaths(v => !v),      count: flowPaths.length },
              { key: "floorRegions", label: "Floors",       color: "#7A9E5A",              visible: visibleFloorRegions,   toggle: () => setVisibleFloorRegions(v => !v),   count: floorRegions.length },
              { key: "itmep",      label: "IT / MEP",       color: T.uiElec ?? "#E0A030",  visible: visibleITMEP,          toggle: () => setVisibleITMEP(v => !v),          count: markers.length },
              // ITMEP-specific per-layer toggles (only inside IT/MEP mode, and only when the master is on)
              ...(mode === "itmep" && visibleITMEP ? [
                { key: "elec",   label: "Electrical", color: T.uiElec,     visible: visibleBuildElectrical, toggle: () => setVisibleBuildElectrical(v => !v), count: markers.filter(m => m.layer === "power" && !isLightComp(m.componentType)).length },
                { key: "light",  label: "Lighting",   color: T.uiLighting, visible: visibleBuildLighting,   toggle: () => setVisibleBuildLighting(v => !v),   count: markers.filter(m => m.layer === "power" && isLightComp(m.componentType)).length },
              ] : []),
              // ITMEP spec layers
              ...(mode === "itmep" && visibleITMEP ? Object.entries(SPEC_LAYERS).filter(([k]) => k !== "power").map(([k, l]) => ({
                key: k, label: l.name, color: uiColor(l.color), visible: visibleLayers[k],
                toggle: () => setVisibleLayers(v => ({ ...v, [k]: !v[k] })),
                count: markers.filter(m => m.layer === k).length,
              })) : []),
            ];
            return (
              <div style={{ borderTop: "1px solid " + T.bg3, padding: "10px 12px", background: T.bg1, flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>Visibility</div>
                {[...rows].sort((a, b) => a.label.localeCompare(b.label)).map(({ key, label, color, visible, toggle, count }) => (
                  <div key={key} style={{ ...S.lr, padding: "4px 4px", borderRadius: 6, marginBottom: 1 }}>
                    <div style={S.chk(visible, color)} onClick={toggle}>{visible && "✓"}</div>
                    <span style={{ color: visible ? T.accent : T.textMuted, flex: 1, fontSize: 11 }}>{label}</span>
                    {count != null && <span style={{ color: visible ? color : T.accentDim, fontSize: 10, fontWeight: 500 }}>{count}</span>}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── Canvas area — configurable panes (plan + elevations + 3D) ── */}
        <div ref={splitContainerRef} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* Row 1 (plan + aux pane 1) */}
        <div style={{ display: "flex", minHeight: 0, flex: panes.length === 4 ? "none" : 1, height: panes.length === 4 ? `${splitPosV * 100}%` : undefined }}>
        <div ref={cvsContainer} style={panes.length > 1
          ? { ...S.cv, flex: "none", width: `${splitPos * 100}%` }
          : S.cv}>
          <PaneChip i={0} />
          {/* 2D plan controls — bottom-right */}
          <div style={{ position: "absolute", bottom: 40, right: 12, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 4, maxWidth: "calc(100vw - 24px)" }}>
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
              <div style={{ width: 1, height: 20, background: T.border, margin: "0 2px" }} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => controls3dRef.current?.reset()} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 6, border: "1px solid " + T.border, background: T.panelBg, color: T.textMuted, cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: T.panelShadow, userSelect: "none" }}>
                    <RotateCcw size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Reset camera</TooltipContent>
              </Tooltip>
              <div style={{ width: 1, height: 20, background: T.border, margin: "0 2px" }} />
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
              <div style={{ width: 1, height: 20, background: T.border, margin: "0 2px" }} />
            </>}
          </div>

          {view3d && !splitView && data3d && (
            <TestFit3D
              walls={data3d.walls}
              nodes={data3d.nodes}
              doors={data3d.doors}
              windows={data3d.windows}
              columns={data3d.columns}
              zones={data3d.zones}
              markers={data3d.markers}
              dims={dims}
              pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight} T={T} themeMode={themeMode}
              controlsRef={controls3dRef} mode={mode}
              selectedId={selectedId} selType={selType}
              show3dLabels={show3dLabels} setShow3dLabels={setShow3dLabels}
              show3dDims={show3dDims}     setShow3dDims={setShow3dDims}
              style3d={style3d}
              floorMaterial={floorMaterial}
              floorRegions={data3d.floorRegions}
              zoneLibrary={zoneLibrary}
              visibleLayers={visibleLayers}
              visibleBuildElectrical={visibleBuildElectrical}
              visibleBuildLighting={visibleBuildLighting}
              onSelect={(id, type) => { setSelectedId(id); setSelType(type); setSelectedIds(id ? [id] : []); }}
            />
          )}

          {/* 3D style switcher — only in full 3D mode (not split; split shows it in the 3D pane) */}
          {view3d && !splitView && (
            <div style={{ position: "absolute", bottom: 112, left: "50%", transform: "translateX(-50%)",
              display: "flex", gap: 4, background: T.panelBg, border: "1px solid " + T.border,
              borderRadius: 8, padding: 4, backdropFilter: "blur(12px)", zIndex: 10 }}>
              {[["clay","Clay"],["xray","X-Ray"],["detailed","Detailed"]].map(([k, label]) => (
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

          <svg ref={cvs} width="100%" height="100%"
            style={{ cursor: (panning || spaceHeld) ? "grabbing" : resize ? ({ n:"ns-resize",s:"ns-resize",e:"ew-resize",w:"ew-resize",ne:"nesw-resize",sw:"nesw-resize",nw:"nwse-resize",se:"nwse-resize" }[resize.edge] || "nwse-resize") : (drag?.type === "zone-edge" && drag.cursor) ? drag.cursor : (drag?.type === "revcloud-edge" && drag.cursor) ? drag.cursor : (drag?.type === "floorRegion-edge" && drag.cursor) ? drag.cursor : zoneEdge ? zoneEdge.cursor : cadCrosshair(T.crosshairColor), userSelect: "none", display: (view3d && !splitView) ? "none" : undefined, transform: canvasRotation ? `rotate(${canvasRotation}deg)` : undefined, transformOrigin: "center", transition: canvasRotNoTransition ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)" }}
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

                  {/* 3" (quarter-foot) subdivisions at 150%+ */}
                  {zoom >= 1.5 && <g opacity={0.15}>
                    {Array.from({ length: (endI - startI) * 4 + 1 }, (_, i) => {
                      const pos = (startI * 4 + i) * (pxPerFoot / 4);
                      if (Math.abs(pos % pxPerFoot) < 0.1) return null;
                      return <line key={"vi3" + (startI * 4 + i)} x1={pos} y1={minY} x2={pos} y2={maxY}
                        stroke={T.gridSub} strokeWidth={0.4} />;
                    })}
                    {Array.from({ length: (endJ - startJ) * 4 + 1 }, (_, i) => {
                      const pos = (startJ * 4 + i) * (pxPerFoot / 4);
                      if (Math.abs(pos % pxPerFoot) < 0.1) return null;
                      return <line key={"hi3" + (startJ * 4 + i)} x1={minX} y1={pos} x2={maxX} y2={pos}
                        stroke={T.gridSub} strokeWidth={0.4} />;
                    })}
                  </g>}

                  {/* 1" subdivisions at 300%+ */}
                  {zoom >= 3 && <g opacity={0.1}>
                    {Array.from({ length: (endI - startI) * 12 + 1 }, (_, i) => {
                      const pos = (startI * 12 + i) * (pxPerFoot / 12);
                      if (Math.abs(pos % (pxPerFoot / 4)) < 0.1) return null;
                      return <line key={"vi1" + (startI * 12 + i)} x1={pos} y1={minY} x2={pos} y2={maxY}
                        stroke={T.gridSub} strokeWidth={0.25} />;
                    })}
                    {Array.from({ length: (endJ - startJ) * 12 + 1 }, (_, i) => {
                      const pos = (startJ * 12 + i) * (pxPerFoot / 12);
                      if (Math.abs(pos % (pxPerFoot / 4)) < 0.1) return null;
                      return <line key={"hi1" + (startJ * 12 + i)} x1={minX} y1={pos} x2={maxX} y2={pos}
                        stroke={T.gridSub} strokeWidth={0.25} />;
                    })}
                  </g>}
                </>;
              })()}
              {bgImage && <image href={bgImage} x={bgOffset.x} y={bgOffset.y} style={{ opacity: bgOpacity, transform: `scale(${bgScale})`, transformOrigin: `${bgOffset.x}px ${bgOffset.y}px` }} preserveAspectRatio="xMidYMid meet" />}

              {/* Floor regions — hatch fill, above bg image / below walls */}
              {visibleFloorRegions && floorRegions.map(fr => {
                if (!phaseVisible(fr.phase)) return null;
                if (!fr.points || fr.points.length < 3) return null;
                const sel = (selectedId === fr.id && selType === "floorRegion") || selectedIds.includes(fr.id);
                const d = "M " + fr.points.map(p => `${p.x},${p.y}`).join(" L ") + " Z";
                const hatchId = FLOOR_MATERIAL_HATCHES[fr.material] || FLOOR_MATERIAL_HATCHES.Wood;
                const c = polyCentroid(fr.points);
                return <g key={fr.id} style={{ cursor: tool === "select" ? "pointer" : "inherit" }}
                  onClick={() => { if (tool === "select") { setSelectedId(fr.id); setSelType("floorRegion"); setSelectedIds([fr.id]); } }}>
                  <path d={d} fill={`url(#${hatchId})`} stroke={sel ? T.accent : "transparent"} strokeWidth={sel ? 1.5 : 0} strokeDasharray={sel ? "4 3" : "none"} />
                  {sel && fr.points.map((a, ei) => {
                    const b = fr.points[(ei + 1) % fr.points.length];
                    return <line key={"e" + ei} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16} strokeLinecap="round" style={{ cursor: wallResizeCursor(a.x, a.y, b.x, b.y) }} />;
                  })}
                  {fr.label && <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={T.textMuted} fontFamily="inherit" style={{ pointerEvents: "none" }}>{fr.label}</text>}
                  {sel && fr.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5} fill={T.accent} stroke={T.nodeFill} strokeWidth={1.5} style={{ cursor: "move" }} />)}
                </g>;
              })}
              {/* Floor region ghost while drawing */}
              {tool === "floorRegion" && drawFloorRegion && drawFloorRegion.points.length >= 1 && ghostPos && (() => {
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
              })()}

              {/* Walls — two-pass render: fills first, then all edge lines on top.
                  This prevents double-hatching at overlaps and keeps edges always visible. */}
              {(() => {
                // Helper: compute miter corners per-side at an endpoint
                const getMiterSides = (w, c, nx, ny, halfT, nid, dirX, dirY) => {
                  const jx = nid === w.n1 ? c.x1 : c.x2, jy = nid === w.n1 ? c.y1 : c.y2;
                  // Find neighbors by node ID or by endpoint proximity (handles coincident-but-unshared nodes)
                  const PROX = 6;
                  const nodeConns = nodeWallsMap[nid] || [];
                  const others = walls.filter(ow => {
                    if (ow.id === w.id) return false;
                    if (nodeConns.some(x => x.id === ow.id)) return true;
                    const oc2 = wc(ow); if (!oc2) return false;
                    return dst(oc2.x1, oc2.y1, jx, jy) < PROX || dst(oc2.x2, oc2.y2, jx, jy) < PROX;
                  });
                  const myAngle = Math.atan2(dirY, dirX);
                  const norm = a => ((a - myAngle) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
                  const info = others.map(ow => {
                    const oc = wc(ow); if (!oc) return null;
                    const atN1 = ow.n1 === nid || dst(oc.x1, oc.y1, jx, jy) < PROX;
                    const odx = atN1 ? oc.x2 - oc.x1 : oc.x1 - oc.x2;
                    const ody = atN1 ? oc.y2 - oc.y1 : oc.y1 - oc.y2;
                    const olen = Math.hypot(odx, ody) || 1;
                    const oux = odx/olen, ouy = ody/olen;
                    const owk = wallKinds[ow.kind || "existing"];
                    const oTI = ow.kind === "pony" ? (ow.ponyDepth || 6) : (owk.thickness || 5);
                    const oHalfT = (oTI / 12) * pxPerFoot / 2;
                    return { oux, ouy, onx: -ouy, ony: oux, oHalfT, na: norm(Math.atan2(ouy, oux)) };
                  }).filter(Boolean);
                  const lN = info.filter(o => o.na > 0.02 && o.na < Math.PI - 0.02).sort((a,b) => a.na - b.na)[0];
                  const rN = info.filter(o => o.na > Math.PI + 0.02).sort((a,b) => b.na - a.na)[0];
                  // Cap prevents runaway miters at very acute angles (6× the larger half-thickness)
                  const cap = Math.max(halfT, (lN ?? rN)?.oHalfT ?? halfT) * 6;
                  const Lpt = lN
                    ? wallMiterPt(jx,jy,dirX,dirY,nx,ny,halfT,lN.oux,lN.ouy,lN.onx,lN.ony,lN.oHalfT, 1)
                    : rN
                      ? lineInt(jx+nx*halfT,jy+ny*halfT,dirX,dirY, jx-rN.onx*rN.oHalfT,jy-rN.ony*rN.oHalfT,rN.oux,rN.ouy,cap)
                      : {x:jx+nx*halfT, y:jy+ny*halfT};
                  const Rpt = rN
                    ? wallMiterPt(jx,jy,dirX,dirY,nx,ny,halfT,rN.oux,rN.ouy,rN.onx,rN.ony,rN.oHalfT,-1)
                    : lN
                      ? lineInt(jx-nx*halfT,jy-ny*halfT,dirX,dirY, jx+lN.onx*lN.oHalfT,jy+lN.ony*lN.oHalfT,lN.oux,lN.ouy,cap)
                      : {x:jx-nx*halfT, y:jy-ny*halfT};
                  return { L: Lpt, R: Rpt, openL: !lN, openR: !rN, free: others.length === 0 };
                };

                // Compute geometry for all walls once
                const wallData = walls.map(w => {
                  if (!phaseVisible(w.phase)) return null;
                  const c = wc(w); if (!c) return null;
                  const sel = (selectedId === w.id && selType === "wall") || selectedIds.includes(w.id);
                  const wk = wallKinds[w.kind || "existing"];
                  const wLen = dst(c.x1, c.y1, c.x2, c.y2); if (wLen < 1) return null;
                  const dx = c.x2 - c.x1, dy = c.y2 - c.y1;
                  const wallThicknessIn = w.kind === "pony" ? (w.ponyDepth || 6) : (wk.thickness || 5);
                  const halfT = (wallThicknessIn / 12) * pxPerFoot / 2;
                  const nx = -dy / wLen, ny = dx / wLen;
                  const ux = dx / wLen, uy = dy / wLen;
                  const cuts = []; [...doors, ...windows].filter(item => phaseVisible(item.phase)).forEach(item => { const rp = resolvePos(item); const projT = ((rp.x - c.x1) * dx + (rp.y - c.y1) * dy) / (wLen * wLen); if (projT < -0.05 || projT > 1.05) return; const projX = c.x1 + projT * dx, projY = c.y1 + projT * dy; if (dst(rp.x, rp.y, projX, projY) > 8) return; const halfW = inToPx(item.width) / 2 / wLen; cuts.push({ t0: Math.max(0, projT - halfW), t1: Math.min(1, projT + halfW) }); });
                  cuts.sort((a,b) => a.t0 - b.t0); const merged = []; cuts.forEach(cu => { if (merged.length && cu.t0 <= merged[merged.length-1].t1) merged[merged.length-1].t1 = Math.max(merged[merged.length-1].t1, cu.t1); else merged.push({...cu}); });
                  const segs = []; let tS = 0; merged.forEach(cu => { if (cu.t0 > tS) segs.push({t0:tS,t1:cu.t0}); tS = cu.t1; }); if (tS < 1) segs.push({t0:tS,t1:1});
                  const hatchId = w.material && WALL_MATERIAL_HATCHES[w.material] ? WALL_MATERIAL_HATCHES[w.material] : ({demo:"hatch-demo",new:"hatch-new",pony:"hatch-pony"}[w.kind] ?? "hatch-existing");
                  const edgeColor = sel ? T.nodeFill : wk.color;
                  const edgeW = sel ? 2 : 1.5;
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

                // Terminators (more open ends) render first; through-walls render last so their
                // canvas fill buries any junction edge bleed from the walls they cross.
                const openCount = d => (d.mN1.openL?1:0)+(d.mN1.openR?1:0)+(d.mN2.openL?1:0)+(d.mN2.openR?1:0);
                const fillOrder = wallData.filter(Boolean).sort((a, b) => openCount(a) - openCount(b));

                return <>
                  {fillOrder.map(({ w, wk, sel, hatchId, edgeColor, edgeW, mN1, mN2, segPts, glowEffect }) =>
                    <g key={"f"+w.id} style={{ pointerEvents: "none" }} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                      {segPts.map((sp, i) => <g key={i}>
                        <polygon points={sp.pts} fill={T.canvas} stroke="none" />
                        <line x1={sp.sL.x} y1={sp.sL.y} x2={sp.eL.x} y2={sp.eL.y} stroke={edgeColor} strokeWidth={edgeW} strokeLinecap="butt" strokeDasharray={sel ? undefined : wk.dash} />
                        <line x1={sp.sR.x} y1={sp.sR.y} x2={sp.eR.x} y2={sp.eR.y} stroke={edgeColor} strokeWidth={edgeW} strokeLinecap="butt" strokeDasharray={sel ? undefined : wk.dash} />
                        {sp.isFirst && mN1.free && <line x1={sp.sL.x} y1={sp.sL.y} x2={sp.sR.x} y2={sp.sR.y} stroke={edgeColor} strokeWidth={edgeW} strokeLinecap="square" />}
                        {sp.isLast  && mN2.free && <line x1={sp.eL.x} y1={sp.eL.y} x2={sp.eR.x} y2={sp.eR.y} stroke={edgeColor} strokeWidth={edgeW} strokeLinecap="square" />}
                        {!sel && <polygon points={sp.pts} fill={wk.color + "18"} stroke="none" />}
                        <polygon points={sp.pts} fill={sel ? edgeColor + "22" : `url(#${hatchId})`} stroke="none" />
                      </g>)}
                    </g>
                  )}
                  {/* Pass 2: hit-detection + dims only */}
                  {wallData.filter(Boolean).map(({ w, c, sel, halfT, glowEffect }) =>
                    <g key={"s"+w.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="transparent" strokeWidth={halfT * 2 + 6} style={{ cursor: tool === "select" && mode === "build" ? wallResizeCursor(c.x1, c.y1, c.x2, c.y2) : "inherit" }} />
                      {showDims && visibleDims && <WallDim w={w} hi={sel} />}
                    </g>
                  )}
                </>;
              })()}

              {/* Zones */}
              {visibleZones && zones.map(z => { if (!phaseVisible(z.phase)) return null; const lib = zoneLibrary[z.type], sel = (selectedId === z.id && selType === "zone") || selectedIds.includes(z.id);
                const glowEffect = mode === "budget" && sel;
                if (z.points) { const rpts = resolvePoints(z); const pts = rpts.map(p => `${p.x},${p.y}`).join(" "); const c = polyCentroid(rpts); const sf = Math.round(polyArea(rpts) / (pxPerFoot * pxPerFoot));
                  return <g key={z.id} filter={glowEffect ? "url(#glow-budget)" : undefined}><polygon points={pts} fill={lib.color + "25"} stroke={sel ? T.nodeFill : lib.color + "88"} strokeWidth={sel ? 2 : 1} strokeDasharray={sel ? "none" : "4 2"} strokeLinejoin="round" />
                    <text x={c.x} y={c.y - 4} textAnchor="middle" fill={lib.color + "CC"} fontSize={10} fontFamily="inherit" fontWeight={500} style={{ pointerEvents: "none" }}>{z.label}</text>
                    <text x={c.x} y={c.y + 14} textAnchor="middle" fill={lib.color + "BB"} fontSize={13} fontFamily="inherit" fontWeight={700} style={{ pointerEvents: "none" }}>{sf} sf</text>
                    {sel && rpts.map((p, i) => { const j = (i + 1) % rpts.length; const p2 = rpts[j]; return <line key={"e" + i} x1={p.x} y1={p.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={14} style={{ cursor: wallResizeCursor(p.x, p.y, p2.x, p2.y) }} />; })}
                    {sel && rpts.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={7} fill={lib.color} stroke={T.nodeFill} strokeWidth={2} style={{ cursor: "move" }} /><circle cx={p.x} cy={p.y} r={3} fill={T.nodeFill} style={{ cursor: "move", pointerEvents: "none" }} /></g>)}
                  </g>; }
                return <g key={z.id} filter={glowEffect ? "url(#glow-budget)" : undefined}><rect x={z.x} y={z.y} width={z.w} height={z.h} fill={lib.color + "25"} stroke={sel ? T.nodeFill : lib.color + "88"} strokeWidth={sel ? 2 : 1} strokeDasharray={sel ? "none" : "4 2"} rx={3} />
                  <text x={z.x + 8} y={z.y + 16} fill={lib.color + "CC"} fontSize={10} fontFamily="inherit" fontWeight={500} style={{ pointerEvents: "none" }}>{z.label}</text>
                  <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 7} textAnchor="middle" fill={lib.color + "BB"} fontSize={13} fontFamily="inherit" fontWeight={700} style={{ pointerEvents: "none" }}>{Math.round(ftN(z.w) * ftN(z.h))} sf</text>
                  {showDims && visibleDims && <><text x={z.x + z.w / 2} y={z.y + z.h + 14} textAnchor="middle" fill={T.dimText} fontSize={9} fontFamily="inherit" style={{ pointerEvents: "none" }}>{ft(z.w)}</text>
                    <text x={z.x + z.w + 14} y={z.y + z.h / 2} textAnchor="middle" dominantBaseline="middle" fill={T.dimText} fontSize={9} fontFamily="inherit" transform={`rotate(90,${z.x + z.w + 14},${z.y + z.h / 2})`} style={{ pointerEvents: "none" }}>{ft(z.h)}</text></>}
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
                // Only show nodes when: selected, hovered, or actively drawing a wall chain
                const showNode = isSel || isHov || (drawChain && isWallTool(tool));
                if (!showNode) return null;
                const r = isSel ? 5 : isHov ? 4.5 : cn > 1 ? 3 : 2.5;
                return <g key={n.id}><circle cx={n.x} cy={n.y} r={12} fill="transparent" style={{ cursor: "crosshair" }} />
                  <circle cx={n.x} cy={n.y} r={r} fill={isSel ? T.nodeFill : isHov ? "#50C878" : T.nodeStroke} stroke={isSel ? T.nodeFill : isHov ? "#50C87888" : "transparent"} strokeWidth={isSel ? 1.5 : 1} style={{ pointerEvents: "none" }} />
                  {isHov && !isSel && <circle cx={n.x} cy={n.y} r={r + 5} fill="none" stroke="#50C87833" strokeWidth={1.5} style={{ pointerEvents: "none" }} />}
                </g>;
              })}

              {/* Doors & Windows */}
              {doors.map(d => {
                if (!phaseVisible(d.phase)) return null;
                const rp = resolvePos(d);
                const sel = (selectedId === d.id && selType === "door") || selectedIds.includes(d.id);
                const glowEffect = mode === "budget" && sel;
                return <g key={d.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                  <DoorSvg d={{ ...d, ...rp }} sel={sel} />
                </g>;
              })}
              {windows.map(w => {
                if (!phaseVisible(w.phase)) return null;
                const rp = resolvePos(w);
                const sel = (selectedId === w.id && selType === "window") || selectedIds.includes(w.id);
                const glowEffect = mode === "budget" && sel;
                return <g key={w.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                  <WindowSvg w={{ ...w, ...rp }} sel={sel} />
                </g>;
              })}

              {/* Columns */}
              {columns.map(col => {
                if (!phaseVisible(col.phase)) return null;
                const rp = resolvePos(col);
                const sel = (selectedId === col.id && selType === "column") || selectedIds.includes(col.id);
                const r = inToPx(col.size) / 2;
                const glowEffect = mode === "budget" && sel;
                return <g key={col.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                  {col.shape === "circle" ? (
                    <>
                      <circle cx={rp.x} cy={rp.y} r={r + 8} fill="transparent" style={{ cursor: tool === "select" && mode === "build" ? "move" : "inherit" }} />
                      <circle cx={rp.x} cy={rp.y} r={r} fill={sel ? "#9A9488" : T.nodeStroke} stroke={sel ? T.nodeFill : "#9A9488"} strokeWidth={sel ? 2.5 : 1.5} style={{ pointerEvents: "none" }} />
                    </>
                  ) : (
                    <>
                      <rect x={rp.x - r - 8} y={rp.y - r - 8} width={(r + 8) * 2} height={(r + 8) * 2} fill="transparent" style={{ cursor: tool === "select" && mode === "build" ? "move" : "inherit" }} />
                      <rect x={rp.x - r} y={rp.y - r} width={r * 2} height={r * 2} fill={sel ? "#9A9488" : T.nodeStroke} stroke={sel ? T.nodeFill : "#9A9488"} strokeWidth={sel ? 2.5 : 1.5} rx={2} style={{ pointerEvents: "none" }} />
                    </>
                  )}
                </g>;
              })}

              {/* Dimension strings */}
              {visibleDims && dims.map(d => {
                const sel = selectedId === d.id && selType === "dim";
                const dr = { ...d, ...resolveDimEndpoints(d) };
                return <g key={d.id} onClick={() => { setSelectedId(d.id); setSelType("dim"); }}><DimString d={dr} sel={sel} /></g>;
              })}

              {/* Labels & Callouts */}
              {visibleLabels && labels.map(lbl => {
                if (!phaseVisible(lbl.phase)) return null;
                const isEditing = editingLabelId === lbl.id;
                const isTipDrag = drag?.type === "label-tip" && drag.id === lbl.id;
                const sel = selectedId === lbl.id && selType === "label";
                const tip = resolveLeaderTip(lbl);
                const lblR = { ...lbl, lx: tip.lx, ly: tip.ly };
                return <g key={lbl.id}
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
                    : <LabelAnnotation lbl={isTipDrag ? { ...lblR, lx: ghostPos?.x ?? lblR.lx, ly: ghostPos?.y ?? lblR.ly } : lblR} sel={sel} tool={tool} bg={T.bg2} />}
                </g>;
              })}

              {/* Label tool ghost preview */}
              {tool === "label" && ghostPos && !drag && (
                <g style={{ pointerEvents: "none" }} opacity={0.75}>
                  {ghostPos.snapped && <>
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5}
                      fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                    <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} />
                  </>}
                  <text x={ghostPos.x} y={ghostPos.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={12} fill={T.textBright} fontFamily="'Inter', system-ui, sans-serif">Label…</text>
                </g>
              )}
              {/* Label callout drag preview */}
              {drag?.type === "label-place" && ghostPos && (
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
              )}
              {/* Leader tip drag snap indicator */}
              {drag?.type === "label-tip" && ghostPos && (
                <g style={{ pointerEvents: "none" }} opacity={0.8}>
                  {drag.snapped
                    ? <><circle cx={ghostPos.x} cy={ghostPos.y} r={7} fill={T.accent} fillOpacity={0.2} stroke={T.accent} strokeWidth={1.5} /><circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} /></>
                    : <circle cx={ghostPos.x} cy={ghostPos.y} r={4} fill={T.textBright} opacity={0.6} />}
                </g>
              )}

              {/* Revision Clouds */}
              {visibleRevClouds && revClouds.map(rc => {
                if (!phaseVisible(rc.phase)) return null;
                const sel = selectedId === rc.id && selType === "revcloud";
                const d = revCloudPath(rc.points, rc.arcR ?? 8);
                const c = polyCentroid(rc.points);
                return <g key={rc.id} style={{ cursor: tool === "select" ? (sel ? "move" : "pointer") : "inherit" }}
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
                      stroke="transparent" strokeWidth={16} strokeLinecap="round"
                      style={{ cursor: wallResizeCursor(a.x, a.y, b.x, b.y) }} />;
                  })}
                  {rc.label && <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={10} fill={rc.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{rc.label}</text>}
                  {sel && rc.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5}
                    fill={rc.color} stroke={T.nodeFill} strokeWidth={1.5} style={{ cursor: "move" }} />)}
                </g>;
              })}

              {/* Revision Cloud ghost preview while drawing */}
              {tool === "revcloud" && drawRevCloud && drawRevCloud.points.length >= 1 && ghostPos && (() => {
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
              })()}
              {/* Snap ring ghost before first revcloud point */}
              {tool === "revcloud" && !drawRevCloud && ghostPos && ghostPos.snapped && (
                <g style={{ pointerEvents: "none" }}>
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5}
                    fill={T.accent} fillOpacity={0.12} stroke={T.accent} strokeWidth={1.5} strokeDasharray="3 2" />
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill={T.accent} />
                </g>
              )}

              {/* Flow paths — translucent walkway band + dashed centerline */}
              {visibleFlowPaths && flowPaths.map(fp => {
                if (!phaseVisible(fp.phase)) return null;
                if (!fp.points || fp.points.length < 2) return null;
                if (drawFlowPath?.editingId === fp.id) return null; // hidden while being extended (ghost shows it)
                const sel = (selectedId === fp.id && selType === "flowPath") || selectedIds.includes(fp.id);
                const d = "M " + fp.points.map(p => `${p.x},${p.y}`).join(" L ");
                const bandPx = (fp.width / 12) * pxPerFoot;
                const cx = fp.points.reduce((s,p)=>s+p.x,0)/fp.points.length, cy = fp.points.reduce((s,p)=>s+p.y,0)/fp.points.length;
                return <g key={fp.id} style={{ cursor: tool === "select" ? "pointer" : "inherit" }}
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
              {tool === "flowPath" && drawFlowPath && drawFlowPath.points.length >= 1 && ghostPos && (() => {
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
              })()}
              {tool === "flowPath" && !drawFlowPath && ghostPos && ghostPos.snapped && (
                <g style={{ pointerEvents: "none" }}>
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={SNAP_R * 1.5} fill="#4A90D9" fillOpacity={0.12} stroke="#4A90D9" strokeWidth={1.5} strokeDasharray="3 2" />
                  <circle cx={ghostPos.x} cy={ghostPos.y} r={3} fill="#4A90D9" />
                </g>
              )}

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

              {/* Smart guides */}
              {smartGuides.length > 0 && (() => {
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
                        <line x1={g.pos} y1={minPt - pad} x2={g.pos} y2={maxPt + pad} stroke="#FF40FF" strokeWidth={1 / zoom} opacity={0.85} />
                        {pts.slice(0, -1).map((from, j) => {
                          const to = pts[j + 1];
                          const dist = to - from;
                          if (dist < 1) return null;
                          const label = ft(dist);
                          const pw = (label.length * 5.5 + 8) / zoom;
                          const my = (from + to) / 2;
                          return <g key={j}>
                            <line x1={g.pos - 4 / zoom} y1={from} x2={g.pos + 4 / zoom} y2={from} stroke="#FF40FF" strokeWidth={1 / zoom} opacity={0.7} />
                            <line x1={g.pos - 4 / zoom} y1={to}   x2={g.pos + 4 / zoom} y2={to}   stroke="#FF40FF" strokeWidth={1 / zoom} opacity={0.7} />
                            <rect x={g.pos - pw / 2} y={my - ph / 2} width={pw} height={ph} rx={pr} fill="#FF40FF" opacity={0.92} />
                            <text x={g.pos} y={my + fs * 0.36} textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={600} fontFamily="inherit" letterSpacing="0.02em">{label}</text>
                          </g>;
                        })}
                      </g>;
                    } else {
                      return <g key={i}>
                        <line x1={minPt - pad} y1={g.pos} x2={maxPt + pad} y2={g.pos} stroke="#FF40FF" strokeWidth={1 / zoom} opacity={0.85} />
                        {pts.slice(0, -1).map((from, j) => {
                          const to = pts[j + 1];
                          const dist = to - from;
                          if (dist < 1) return null;
                          const label = ft(dist);
                          const pw = (label.length * 5.5 + 8) / zoom;
                          const mx = (from + to) / 2;
                          return <g key={j}>
                            <line x1={from} y1={g.pos - 4 / zoom} x2={from} y2={g.pos + 4 / zoom} stroke="#FF40FF" strokeWidth={1 / zoom} opacity={0.7} />
                            <line x1={to}   y1={g.pos - 4 / zoom} x2={to}   y2={g.pos + 4 / zoom} stroke="#FF40FF" strokeWidth={1 / zoom} opacity={0.7} />
                            <rect x={mx - pw / 2} y={g.pos - ph / 2} width={pw} height={ph} rx={pr} fill="#FF40FF" opacity={0.92} />
                            <text x={mx} y={g.pos + fs * 0.36} textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={600} fontFamily="inherit" letterSpacing="0.02em">{label}</text>
                          </g>;
                        })}
                      </g>;
                    }
                  })}
                </g>;
              })()}

              {/* Ghosts */}
              {tool === "zone" && ghostPos && (() => { const lib = zoneLibrary[activeZoneType];
                const gw = lib.defaultW * pxPerFoot, gh = lib.defaultH * pxPerFoot; return <g style={{ pointerEvents: "none" }}>
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

              {/* Lighting ghost */}
              {tool === "lighting" && ghostPos && (() => {
                const ghostMarker = { x: ghostPos.x, y: ghostPos.y, layer: "power", componentType: lightingType, angle: ghostPos.angle || 0 };
                const compData = SPEC_COMPONENTS.power[lightingType];
                return <g style={{ pointerEvents: "none", opacity: 0.5 }}>
                  <MarkerSymbol marker={ghostMarker} selected={false} />
                  {ghostPos.snapped && <circle cx={ghostPos.x} cy={ghostPos.y} r={15} fill="none" stroke={compData?.color} strokeWidth={1} strokeDasharray="3 3" />}
                </g>;
              })()}

              {/* Markers (top) */}
              {markers.map(p => {
                if (!markerVisible(p)) return null;
                const rp = resolvePos(p);
                const p_r = rp.x !== p.x || rp.y !== p.y ? { ...p, x: rp.x, y: rp.y } : p;
                const l = SPEC_LAYERS[p_r.layer];
                const ct = p_r.componentType;
                const isBuildLighting = ct?.startsWith("light_") || ct?.startsWith("htrack_") || ct === "sconce_prewire" || ct === "pendent_prewire";
                const isBuildElec = !isBuildLighting && (ct?.startsWith("outlet_") || ct?.startsWith("switch_") || ct === "panel_board" || ct === "tstat");
                const isPowerMode = (mode === "build" || mode === "itmep") && p.layer === "power" && (isBuildElec || isBuildLighting);
                // In build/itmep mode, power items are hidden by their own visibility flags
                if ((mode === "build" || mode === "itmep") && p.layer === "power") {
                  if (isBuildElec && !visibleBuildElectrical) return null;
                  if (isBuildLighting && !visibleBuildLighting) return null;
                }
                if (!l || (!visibleLayers[p.layer] && mode !== "budget" && !isPowerMode)) return null;
                const compData = SPEC_COMPONENTS[p.layer]?.[p.componentType];
                const sel = (selectedId === p.id && selType === "marker") || selectedIds.includes(p.id);
                const glowEffect = sel && (mode === "budget" || mode === "itmep" || (mode === "build" && selectedIds.length > 1));
                
                const rotHandle = sel && selectedIds.length <= 1 && tool === "select" ? (() => {
                  const HANDLE_R = 22 / zoom;
                  const angle = p_r.angle || 0;
                  const hx = p_r.x + Math.cos(angle - Math.PI / 2) * HANDLE_R;
                  const hy = p_r.y + Math.sin(angle - Math.PI / 2) * HANDLE_R;
                  return <g
                    onMouseDown={ev => {
                      ev.stopPropagation();
                      setRotatingMarker({ id: p.id, cx: p_r.x, cy: p_r.y });
                    }}>
                    <line x1={p_r.x} y1={p_r.y} x2={hx} y2={hy} stroke="#50A0E0" strokeWidth={1.5 / zoom} strokeDasharray={`${3/zoom} ${2/zoom}`} style={{ pointerEvents: "none" }} />
                    <circle cx={hx} cy={hy} r={5 / zoom} fill="#50A0E0" stroke="#fff" strokeWidth={1.5 / zoom} style={{ cursor: "grab" }} />
                  </g>;
                })() : null;

                // Use custom symbol if available, otherwise use icon
                if (compData?.symbol) {
                  return <g key={p.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                    <MarkerSymbol marker={p_r} selected={sel} />
                    {sel && <text x={p_r.x} y={p_r.y + 24} textAnchor="middle" fontSize={9} fill={compData.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{p_r.label}</text>}
                    {p.isNew && <g style={{ pointerEvents: "none" }}>
                      <rect x={p_r.x - 10} y={p_r.y - 22} width={20} height={9} rx={2.5} fill="#50A0E0" opacity={0.92} />
                      <text x={p_r.x} y={p_r.y - 15} textAnchor="middle" fontSize={5.5} fill="#fff" fontWeight="bold" letterSpacing="0.04em" style={{ pointerEvents: "none" }}>NEW</text>
                    </g>}
                    {rotHandle}
                  </g>;
                }

                // Fallback to icon rendering
                const icon = compData?.icon || "📍";
                return <g key={p.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
                  <circle cx={p_r.x} cy={p_r.y} r={sel ? 11 : 9} fill={l.color + "30"} stroke={l.color} strokeWidth={sel ? 2.5 : 1.5} />
                  <text x={p_r.x} y={p_r.y + 4} textAnchor="middle" fontSize={11} fill={l.color} style={{ pointerEvents: "none" }}>{icon}</text>
                  {sel && <text x={p_r.x} y={p_r.y + 24} textAnchor="middle" fontSize={9} fill={l.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{p_r.label}</text>}
                  {p.isNew && <g style={{ pointerEvents: "none" }}>
                    <rect x={p_r.x - 10} y={p_r.y - 22} width={20} height={9} rx={2.5} fill="#50A0E0" opacity={0.92} />
                    <text x={p_r.x} y={p_r.y - 15} textAnchor="middle" fontSize={5.5} fill="#fff" fontWeight="bold" letterSpacing="0.04em" style={{ pointerEvents: "none" }}>NEW</text>
                  </g>}
                  {rotHandle}
                </g>;
              })}

              {/* Proximity-hover preview ring — fades in as cursor approaches a hoverable */}
              {proxHover && !marquee && tool === "select" && (!drag || PROX_DRAG_TYPES.has(drag.type)) && (() => {
                const PROX_R = 32;
                const fade = Math.max(0, 1 - proxHover.dist / PROX_R);
                const r = 8 + (1 - fade) * 4;
                return <g style={{ pointerEvents: "none" }}>
                  <circle cx={proxHover.x} cy={proxHover.y} r={r} fill="none" stroke={T.accent} strokeWidth={1.5}
                    opacity={0.2 + fade * 0.55} strokeDasharray="3 3" />
                  <circle cx={proxHover.x} cy={proxHover.y} r={2.5} fill={T.accent} opacity={0.25 + fade * 0.65} />
                </g>;
              })()}

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
                    stroke={T.uiConduit}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={calibrationLine.p2 ? "0" : "6 4"}
                    style={{ pointerEvents: "none" }}
                  />
                  <circle cx={calibrationLine.p1.x} cy={calibrationLine.p1.y} r={6} fill={T.uiConduit} />
                  {calibrationLine.p2 && <circle cx={calibrationLine.p2.x} cy={calibrationLine.p2.y} r={6} fill={T.uiConduit} />}
                </g>
              )}
            </g>
          </svg>

          {/* Detail panel */}
          {(selZone || selMarker || selWall || selNode || selDoor || selWindow || selColumn || selLabel || selRevCloud || selFlowPath || selFloorRegion || selType === "floor" || (selectedIds.length > 1 && multiSelType)) && <div style={S.det}>
            {selectedIds.length <= 1 && selNode && <><div style={{ fontSize: 11, color: T.textBright, marginBottom: 6, fontWeight: 600 }}>Node · {wallsAt(selNode.id).length} walls</div><button style={S.del} onClick={delSel}>Delete Node + Walls</button></>}
            {selectedIds.length <= 1 && selWall && (() => { const wk = wallKinds[selWall.kind || "existing"]; return <>
              <div style={{ fontSize: 12, color: wk.color, marginBottom: 10, fontWeight: 600 }}>{wk.label} Wall · {ft(wl(selWall))}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {Object.entries(wallKinds).map(([k, v]) => <button key={k} style={{ padding: "6px 8px", background: (selWall.kind || "existing") === k ? v.color + "40" : "transparent", color: (selWall.kind || "existing") === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}
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
                  <SliderInput value={selWall.ponyHeight || 42} min={12} max={60} onChange={v => updWall({ ponyHeight: v })} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Depth (inches)</div>
                  <SliderInput value={selWall.ponyDepth || 6} min={3} max={12} onChange={v => updWall({ ponyDepth: v })} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
                </div>
              </>}
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Ceiling Height</div>
                <select value={selWall.ceilingHeight ?? ceilingHeight} onChange={e => updWall({ ceilingHeight: Number(e.target.value) })} style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }}>
                  {[84, 96, 108, 120, 132, 144].map(h => <option key={h} value={h}>{Math.floor(h / 12)}'-{h % 12 ? h % 12 + '"' : '0"'}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 72, resize: "vertical" }} value={selWall.notes || ""} onChange={e => updWall({ notes: e.target.value })} placeholder="Load-bearing, plumbing chase..." /></div>
            </>; })()}
            {selectedIds.length <= 1 && selDoor && <>
              <div style={{ fontSize: 12, color: T.uiDoor, marginBottom: 10, fontWeight: 600 }}>{selDoor.doorType || "Wood"} Door · {selDoor.width}"</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {DOOR_TYPES.map(t => <button key={t} style={{ padding: "6px 8px", background: (selDoor.doorType || "Wood") === t ? T.border + "60" : "transparent", color: (selDoor.doorType || "Wood") === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => updDoor({ doorType: t })}>{t}</button>)}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}><SliderInput value={selDoor.width} min={24} max={96} onChange={w => updDoor({ width: w })} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              {(selDoor.doorType || "Wood") !== "Case Opening" && <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ flipped: !selDoor.flipped })}>In/Out (F)</button>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ hingeRight: !selDoor.hingeRight })}>Hinge (R)</button>
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
              <div style={{ marginBottom: 10 }}><SliderInput value={selWindow.width} min={12} max={96} onChange={w => updWindow({ width: w })} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div><SliderInput value={selWindow.height || 48} min={12} max={96} onChange={v => updWindow({ height: v })} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Sill Height (inches)</div><SliderInput value={selWindow.sill ?? 30} min={0} max={60} onChange={v => updWindow({ sill: v })} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              <button style={S.del} onClick={delSel}>Delete</button>
            </>; })()}
            {selectedIds.length <= 1 && selLabel && (() => {
              const LABEL_COLORS = [
                { hex: "#F0EDE6", name: "White" },
                { hex: "#E05252", name: "Red" },
                { hex: "#4EBA78", name: "Green" },
                { hex: "#4A8FE8", name: "Blue" },
              ];
              const stepFont = (d) => updLabel({ fontSize: Math.min(72, Math.max(8, selLabel.fontSize + d)) });
              const btnActive = (on) => ({ flex: 1, padding: "5px 0", background: on ? T.accent + "25" : "transparent", border: "1px solid " + (on ? T.accent : T.border), borderRadius: 4, color: on ? T.textBright : T.textMuted, cursor: "pointer", fontFamily: "inherit" });
              return <>
                <div style={{ fontSize: 12, color: T.textBright, marginBottom: 10, fontWeight: 600 }}>
                  {selLabel.lx != null ? "Callout" : "Label"}
                </div>
                {/* Edit text */}
                <button style={{ ...S.inp, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: T.textMuted, fontSize: 11, marginBottom: 10 }}
                  onClick={() => { setEditingLabelId(selLabel.id); setEditingLabelText(selLabel.text); }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M8.5 1.5L11.5 4.5L4.5 11.5H1.5V8.5L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round"/>
                    <path d="M7 3L10 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Edit Text
                </button>
                {/* Font size + Bold + Italic on one row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1px solid " + T.border, borderRadius: 4, overflow: "hidden", flex: 1 }}>
                    <button style={{ padding: "5px 10px", background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
                      onClick={() => stepFont(-1)}>−</button>
                    <span style={{ flex: 1, textAlign: "center", fontSize: 11, color: T.textBright, userSelect: "none", borderLeft: "1px solid " + T.border, borderRight: "1px solid " + T.border, padding: "5px 0" }}>{selLabel.fontSize}</span>
                    <button style={{ padding: "5px 10px", background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
                      onClick={() => stepFont(1)}>+</button>
                  </div>
                  <button style={{ ...btnActive(selLabel.bold), flex: "0 0 32px", fontWeight: 700, fontSize: 13 }} onClick={() => updLabel({ bold: !selLabel.bold })}>B</button>
                  <button style={{ ...btnActive(selLabel.italic), flex: "0 0 32px", fontStyle: "italic", fontSize: 13 }} onClick={() => updLabel({ italic: !selLabel.italic })}>I</button>
                </div>
                {/* Color swatches */}
                <div style={{ marginBottom: 10 }}>
                  <div style={S.lbl}>Color</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {LABEL_COLORS.map(({ hex, name }) => (
                      <button key={hex} title={name}
                        style={{ width: 22, height: 22, borderRadius: 4, background: hex, cursor: "pointer", flexShrink: 0,
                          boxShadow: selLabel.color === hex ? "0 0 0 2px " + T.accent : "0 0 0 1.5px rgba(255,255,255,0.12)",
                          border: "none", outline: "none" }}
                        onClick={() => updLabel({ color: hex })} />
                    ))}
                  </div>
                </div>
                {/* Leader line */}
                <div style={{ marginBottom: 10 }}>
                  <div style={S.lbl}>Leader Line</div>
                  {selLabel.lx != null
                    ? <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", fontSize: 10, color: T.textMuted }}
                        onClick={() => updLabel({ lx: null, ly: null, anchorId: null, anchorType: null })}>Remove Leader</button>
                    : <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", fontSize: 10, color: T.accent }}
                        onClick={() => setAddingLeaderToId(selLabel.id)}>Add Leader…</button>}
                </div>
                <button style={S.del} onClick={delSel}>Delete Label</button>
              </>;
            })()}
            {selectedIds.length <= 1 && selRevCloud && (() => {
              const RC_COLORS = [{ hex: "#E05252", name: "Red" }, { hex: "#E0A030", name: "Amber" },
                { hex: "#4A8FE8", name: "Blue" }, { hex: "#50A070", name: "Green" }];
              return <>
                <div style={{ fontSize: 12, color: selRevCloud.color, marginBottom: 10, fontWeight: 600 }}>Revision Cloud</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Label</div>
                  <input style={S.inp} value={selRevCloud.label} onChange={e => updRevCloud({ label: e.target.value })} placeholder="Rev A…" />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Arc Size</div>
                  <SliderInput value={selRevCloud.arcR ?? 8} min={4} max={20} onChange={v => updRevCloud({ arcR: v })}
                    accent={selRevCloud.color} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={S.lbl}>Color</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {RC_COLORS.map(({ hex, name }) =>
                      <button key={hex} title={name}
                        style={{ width: 22, height: 22, borderRadius: 4, background: hex, cursor: "pointer",
                          border: "none", outline: "none",
                          boxShadow: selRevCloud.color === hex ? "0 0 0 2px " + T.accent : "0 0 0 1.5px rgba(255,255,255,0.12)" }}
                        onClick={() => updRevCloud({ color: hex })} />)}
                  </div>
                </div>
                <button style={S.del} onClick={delSel}>Delete Cloud</button>
              </>;
            })()}
            {selectedIds.length <= 1 && selFlowPath && <>
              <div style={{ fontSize: 12, color: selFlowPath.color, marginBottom: 10, fontWeight: 600 }}>Flow Path</div>
              <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Clearance Preset</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 6 }}>
                  {[
                    { w: 36, label: "Walkway", sub: "36\"" , tip: "Main walking path (minimum)" },
                    { w: 48, label: "Tight", sub: "48\"" , tip: "Tighter spaces / behind seated chairs" },
                    { w: 60, label: "Dining", sub: "60\"", tip: "Dining: scoot out + walk behind" },
                  ].map(({ w, label, sub, tip }) => {
                    const isSel = selFlowPath.width === w;
                    return <button key={w} title={tip} onClick={() => updFlowPath({ width: w })}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "5px 4px",
                        background: isSel ? selFlowPath.color + "30" : "transparent",
                        border: "1.5px solid " + (isSel ? selFlowPath.color : T.border),
                        borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                        color: isSel ? T.textBright : T.textMuted }}>
                      <span style={{ fontSize: 10, fontWeight: isSel ? 600 : 500 }}>{label}</span>
                      <span style={{ fontSize: 9, color: isSel ? selFlowPath.color : T.textDim }}>{sub}</span>
                    </button>;
                  })}
                </div>
                <div style={S.lbl}>Custom Width</div>
                <SliderInput value={selFlowPath.width} min={18} max={96} step={6} onChange={v => updFlowPath({ width: v })}
                  accent={selFlowPath.color} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
                <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>{ft(selFlowPath.width / 12 * pxPerFoot)} wide</div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Label (optional)</div>
                <input style={S.inp} value={selFlowPath.label || ""} onChange={e => updFlowPath({ label: e.target.value })} placeholder="Main aisle…" />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={S.lbl}>Color</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {FLOW_PATH_COLORS.map(c =>
                    <button key={c} title={c}
                      style={{ width: 22, height: 22, borderRadius: 4, background: c, cursor: "pointer", border: "none", outline: "none",
                        boxShadow: selFlowPath.color === c ? "0 0 0 2px " + T.accent : "0 0 0 1.5px rgba(255,255,255,0.12)" }}
                      onClick={() => updFlowPath({ color: c })} />)}
                </div>
              </div>
              <button style={S.del} onClick={delSel}>Delete Flow Path</button>
            </>}
            {selectedIds.length <= 1 && selFloorRegion && (() => {
              const FR_COLORS = { "Wood": "#C8A878", "Concrete": "#AEABA4", "Vinyl": "#BFA889", "Carpet": "#786758" };
              return <>
                <div style={{ fontSize: 12, color: T.textBright, marginBottom: 10, fontWeight: 600 }}>Floor Region · {selFloorRegion.material}</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={S.lbl}>Material</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {FLOOR_MATERIALS.map(m => { const isSel = selFloorRegion.material === m; const hex = FR_COLORS[m];
                      return <button key={m} onClick={() => updFloorRegion({ material: m })}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", background: isSel ? hex + "30" : "transparent",
                          border: "1.5px solid " + (isSel ? hex : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                          color: isSel ? T.textBright : T.textMuted, fontSize: 10, fontWeight: isSel ? 600 : 400 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: hex, flexShrink: 0 }} />{m}
                      </button>; })}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Label (optional)</div>
                  <input style={S.inp} value={selFloorRegion.label || ""} onChange={e => updFloorRegion({ label: e.target.value })} placeholder="Bathroom, Kitchen…" />
                </div>
                <button style={S.del} onClick={delSel}>Delete Floor Region</button>
              </>;
            })()}
            {selectedIds.length <= 1 && selType === "floor" && (() => {
              const FR_COLORS = { "Wood": "#C8A878", "Concrete": "#AEABA4", "Vinyl": "#BFA889", "Carpet": "#786758" };
              return <>
                <div style={{ fontSize: 12, color: T.textBright, marginBottom: 10, fontWeight: 600 }}>Floor · {floorMaterial}</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={S.lbl}>Material</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {FLOOR_MATERIALS.map(m => { const isSel = floorMaterial === m; const hex = FR_COLORS[m];
                      return <button key={m} onClick={() => setFloorMaterial(m)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", background: isSel ? hex + "30" : "transparent",
                          border: "1.5px solid " + (isSel ? hex : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                          color: isSel ? T.textBright : T.textMuted, fontSize: 10, fontWeight: isSel ? 600 : 400 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: hex, flexShrink: 0 }} />{m}
                      </button>; })}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: T.textDim, fontStyle: "italic" }}>Visible in Detailed 3D view. Click elsewhere to deselect.</div>
              </>;
            })()}
            {selectedIds.length <= 1 && selColumn && <>
              <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>Column · {selColumn.size}"</div>
              <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Shape</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: selColumn.shape === "circle" ? T.textBright : T.textMuted, background: selColumn.shape === "circle" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "circle" })}>● Circle</button>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: selColumn.shape === "square" ? T.textBright : T.textMuted, background: selColumn.shape === "square" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "square" })}>■ Square</button>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Size (inches)</div><SliderInput value={selColumn.size} min={6} max={48} onChange={v => updColumn({ size: v })} accent="#9A9488" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selColumn.label || ""} onChange={e => updColumn({ label: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={selColumn.notes || ""} onChange={e => updColumn({ notes: e.target.value })} /></div>
              <button style={S.del} onClick={delSel}>Delete Column</button>
            </>}
            {selectedIds.length <= 1 && selZone && (() => {
              const pts = selZone.points || [];
              const sf = pts.length ? Math.round(polyArea(pts) / (pxPerFoot * pxPerFoot)) : Math.round(ftN(selZone.w) * ftN(selZone.h));
              const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
              const minX = Math.min(...xs), maxX = Math.max(...xs);
              const minY = Math.min(...ys), maxY = Math.max(...ys);
              const wFt = Math.round((maxX - minX) / pxPerFoot * 10) / 10;
              const hFt = Math.round((maxY - minY) / pxPerFoot * 10) / 10;
              const lib = zoneLibrary[selZone.type] ?? {};
              const items = lib.items ?? [];
              const estCost = items.reduce((s, i) => s + i.qty * i.unitCost, 0);
              return <>
              <div style={{ fontSize: 12, marginBottom: 10, fontWeight: 600, color: lib.color }}>{lib.name} · {sf} sf</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={selZone.type}
                  onChange={e => { const newType = e.target.value; const l = zoneLibrary[newType]; updZone({ type: newType, label: selZone.label === lib.name ? l.name : selZone.label }); }}>
                  {Object.entries(zoneLibrary).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selZone.label} onChange={e => updZone({ label: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={selZone.notes ?? ""} onChange={e => updZone({ notes: e.target.value })} /></div>
              {/* Dimensions */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={S.lbl}>Width (ft)</div>
                    <input type="number" step="0.5" min="1" value={wFt} style={S.inp}
                      onChange={e => {
                        const newW = Math.max(1, Number(e.target.value)) * pxPerFoot;
                        const oldW = maxX - minX || 1;
                        const scale = newW / oldW;
                        updZone({ points: pts.map(p => ({ ...p, x: minX + (p.x - minX) * scale })) });
                      }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={S.lbl}>Height (ft)</div>
                    <input type="number" step="0.5" min="1" value={hFt} style={S.inp}
                      onChange={e => {
                        const newH = Math.max(1, Number(e.target.value)) * pxPerFoot;
                        const oldH = maxY - minY || 1;
                        const scale = newH / oldH;
                        updZone({ points: pts.map(p => ({ ...p, y: minY + (p.y - minY) * scale })) });
                      }} />
                  </div>
                </div>
              </div>
              {/* FF&E Items */}
              {items.length > 0 && <div style={{ marginBottom: 10 }}>
                <div style={S.lbl}>FF&amp;E Items</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "4px 0", borderBottom: "1px solid " + T.border + "55" }}>
                      <span style={{ color: T.textMuted }}>{item.qty > 1 ? `${item.qty}× ` : ""}{item.name}</span>
                      <span style={{ color: T.text, whiteSpace: "nowrap", paddingLeft: 8 }}>{$(item.qty * item.unitCost)}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: T.accentDim ?? "#8A8478", marginTop: 5, textAlign: "right", fontWeight: 600 }}>Est. {$(estCost)}</div>
                </div>
              </div>}
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
                {selMarker.layer === "power" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 8px", background: T.panelBg, borderRadius: 6, border: "1px solid " + T.border }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1 }}>
                      <input type="checkbox" checked={!!selMarker.isNew}
                        onChange={e => updMarker({ isNew: e.target.checked })}
                        style={{ width: 14, height: 14, accentColor: "#50A0E0", cursor: "pointer" }} />
                      <span style={{ fontSize: 10, color: T.textMuted }}>New / Planned</span>
                    </label>
                  </div>
                )}
                <button style={S.del} onClick={delSel}>Delete Component</button>
              </>;
            })()}
            {/* Multi-select panels */}
            {selectedIds.length > 1 && multiSelType && multiSelType !== "wall" && (
              <div style={{ marginBottom: 10 }}>
                <div style={S.lbl}>Align & Distribute</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  <AlignBtn action="alignLeft"    label="⬤◌◌" tip="Align Left"       onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
                  <AlignBtn action="alignCenterH" label="◌⬤◌" tip="Align Center (H)" onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
                  <AlignBtn action="alignRight"   label="◌◌⬤" tip="Align Right"      onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
                </div>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  <AlignBtn action="alignTop"     label="▲" tip="Align Top"        onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
                  <AlignBtn action="alignMiddleV" label="↕" tip="Align Middle (V)" onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
                  <AlignBtn action="alignBottom"  label="▼" tip="Align Bottom"     onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
                </div>
                {selectedIds.length > 2 && <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  <AlignBtn action="distributeH" label="⇔ Space H" tip="Distribute Horizontally" onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
                  <AlignBtn action="distributeV" label="⇕ Space V" tip="Distribute Vertically"   onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
                </div>}
              </div>
            )}
            {selectedIds.length > 1 && multiSelType === "wall" && (() => {
              const items = multiSelItems;
              const kind = cv(items, "kind") || "existing";
              const wk = wallKinds[kind];
              return <>
                <div style={{ fontSize: 12, color: wk?.color || "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Walls Selected</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                  {Object.entries(wallKinds).map(([k, v]) => <button key={k} style={{ padding: "6px 8px", background: kind === k ? v.color + "40" : "transparent", color: kind === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}
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
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Ceiling Height</div>
                  <select value={cv(items, "ceilingHeight") ?? ceilingHeight} onChange={e => updWall({ ceilingHeight: Number(e.target.value) })} style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }}>
                    {cv(items, "ceilingHeight") === undefined && <option value="">Mixed</option>}
                    {[84, 96, 108, 120, 132, 144].map(h => <option key={h} value={h}>{Math.floor(h / 12)}'-{h % 12 ? h % 12 + '"' : '0"'}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 72, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updWall({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Walls</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "door" && (() => {
              const items = multiSelItems;
              const w = cv(items, "width");
              return <>
                <div style={{ fontSize: 12, color: T.uiDoor, marginBottom: 10, fontWeight: 600 }}>{items.length} Doors Selected</div>
                <div style={{ marginBottom: 10 }}><SliderInput value={w} min={24} max={96} onChange={dw => updDoor({ width: dw })} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} disabled={w === undefined} /></div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ flipped: !items[0]?.flipped })}>In/Out (F)</button>
                  <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ hingeRight: !items[0]?.hingeRight })}>Hinge (R)</button>
                </div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Doors</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "window" && (() => {
              const items = multiSelItems;
              const w = cv(items, "width");
              return <>
                <div style={{ fontSize: 12, color: "#60A0C8", marginBottom: 10, fontWeight: 600 }}>{items.length} Windows Selected</div>
                <div style={{ marginBottom: 10 }}><SliderInput value={w} min={12} max={96} onChange={ww => updWindow({ width: ww })} accent="#60A0C8" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} disabled={w === undefined} /></div>
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
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Size (inches)</div><SliderInput value={size} min={6} max={48} onChange={v => updColumn({ size: v })} accent="#9A9488" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} disabled={size === undefined} /></div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={cv(items, "label") ?? ""} onChange={e => updColumn({ label: e.target.value })} placeholder={cv(items, "label") === undefined ? "Mixed" : ""} /></div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updColumn({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
                <button style={S.del} onClick={delSel}>Delete {items.length} Columns</button>
              </>;
            })()}
            {selectedIds.length > 1 && multiSelType === "zone" && (() => {
              const items = multiSelItems;
              const type = cv(items, "type");
              return <>
                <div style={{ fontSize: 12, color: type ? zoneLibrary[type]?.color : "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Zones Selected</div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                  <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={type ?? ""}
                    onChange={e => { const nt = e.target.value; const lib = zoneLibrary[nt]; updZone({ type: nt, label: lib.name }); }}>
                    {!type && <option value="">Mixed</option>}
                    {Object.entries(zoneLibrary).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
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
          {!selectedId && ((mode === "build" && (isWallTool(tool) || tool === "door" || tool === "window" || tool === "column")) || (mode === "itmep" && (tool === "marker" || tool === "outlet" || tool === "lighting")) || (mode === "zone" && tool === "zone")) && <div style={S.det}>

            {mode === "build" && isWallTool(tool) && (() => { const wk = wallKinds[wallKind]; return <>
              {/* Header */}
              <div style={{ fontSize: 12, color: wk.color, marginBottom: 10, fontWeight: 600 }}>{wk.label} Wall</div>

              {/* Type */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {Object.entries(wallKinds).map(([k, v]) => <button key={k} onClick={() => setWallKind(k)}
                  style={{ padding: "6px 8px", background: wallKind === k ? v.color + "40" : "transparent", color: wallKind === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}>
                  {v.label}
                </button>)}
              </div>

              {/* Material */}
              <div style={{ marginBottom: 10 }}><div style={S.lbl}>Material</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                  {WALL_MATERIALS.map(mat => {
                    const isSel = wallMaterial === mat;
                    const patId = WALL_MATERIAL_HATCHES[mat];
                    return <button key={mat} onClick={() => setWallMaterial(mat)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 4px", background: isSel ? T.border + "60" : "transparent", border: "1.5px solid " + (isSel ? T.accent : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="32" height="14" style={{ display: "block", borderRadius: 2, overflow: "hidden" }}>
                        <defs><clipPath id={"tc-" + mat.replace(/\s|\/|\*/g, "")}><rect width="32" height="14"/></clipPath></defs>
                        <rect width="32" height="14" fill={T.bg2}/>
                        {patId && <rect width="32" height="14" fill={`url(#${patId})`} clipPath={`url(#tc-${mat.replace(/\s|\/|\*/g, "")})`}/>}
                        <rect width="32" height="14" fill="none" stroke={isSel ? T.accent : T.border} strokeWidth="1"/>
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? T.textBright : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{mat}</span>
                    </button>;
                  })}
                </div>
              </div>

              {wallKind === "pony" && <>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div>
                  <SliderInput value={ponyHeight} min={12} max={60} onChange={setPonyHeight} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
                </div>
                <div style={{ marginBottom: 8 }}><div style={S.lbl}>Depth (inches)</div>
                  <SliderInput value={ponyDepth} min={3} max={12} onChange={setPonyDepth} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
                </div>
              </>}
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div>
                <textarea style={{ ...S.inp, height: 72, resize: "vertical" }} value={wallNotes} onChange={e => setWallNotes(e.target.value)} placeholder="Load-bearing, plumbing chase..." />
              </div>
              <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
            </>; })()}
            {mode === "build" && tool === "door" && <>
              <div style={{ fontSize: 12, color: T.uiDoor, marginBottom: 10, fontWeight: 600 }}>{doorType} Door · {doorWidth}"</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {DOOR_TYPES.map(t => <button key={t} style={{ padding: "6px 8px", background: doorType === t ? T.border + "60" : "transparent", color: doorType === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}
                    onClick={() => setDoorType(t)}>{t}</button>)}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}><SliderInput value={doorWidth} min={24} max={96} onChange={setDoorWidth} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              {doorType !== "Case Opening" && <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setDoorFlipped(f => !f)}>In/Out {doorFlipped ? "✓" : ""}</button>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setDoorHingeRight(h => !h)}>Hinge {doorHingeRight ? "R" : "L"}</button>
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
              <div style={{ marginBottom: 10 }}><SliderInput value={windowWidth} min={12} max={96} onChange={setWindowWidth} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div><SliderInput value={windowHeight} min={12} max={96} onChange={setWindowHeight} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Sill Height (inches)</div><SliderInput value={windowSill} min={0} max={60} onChange={setWindowSill} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
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
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Size (inches)</div><SliderInput value={columnSize} min={6} max={48} onChange={setColumnSize} accent="#9A9488" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={columnLabel} onChange={e => setColumnLabel(e.target.value)} /></div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={columnNotes} onChange={e => setColumnNotes(e.target.value)} /></div>
              <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
            </>}
            {mode === "itmep" && tool === "outlet" && (() => {
              const active = SPEC_COMPONENTS.power[outletType];
              const isSwitch = outletType.startsWith("switch_");
              const isPanel = outletType === "panel_board";
              const sectionColor = isPanel ? T.uiPanel : isSwitch ? T.uiSwitch : T.uiElec;

              const OUTLET_OPTS = [
                { key: "outlet_duplex",         label: "Duplex",    color: T.uiElec },
                { key: "outlet_quad",           label: "Quad",      color: T.uiElec },
                { key: "outlet_duplex_surface", label: "Conduit D", color: T.uiConduit },
                { key: "outlet_quad_surface",   label: "Conduit Q", color: T.uiConduit },
                { key: "outlet_ceiling",        label: "Ceiling",   color: "#60B0E0" },
              ];
              const SWITCH_OPTS = [
                { key: "switch_single",  label: "Single\nPole",  color: T.uiSwitch },
                { key: "switch_double",  label: "Double\nPole",  color: T.uiSwitch },
                { key: "switch_dimmer", label: "Dimmer",        color: T.uiSwitch },
              ];

              return <>
                <div style={{ fontSize: 12, color: sectionColor, marginBottom: 10, fontWeight: 600 }}>Electrical · {active?.name}</div>

                {/* New vs As-Built toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 8px", background: T.panelBg, borderRadius: 6, border: "1px solid " + T.border }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1 }}>
                    <input type="checkbox" checked={outletIsNew} onChange={e => setOutletIsNew(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: "#50A0E0", cursor: "pointer" }} />
                    <span style={{ fontSize: 10, color: T.textMuted }}>New / Planned</span>
                  </label>
                </div>

                {/* Outlets section */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Outlets</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
                  {OUTLET_OPTS.map(({ key: oKey, label, color }) => {
                    const isSel = outletType === oKey;
                    const isQuad = oKey.includes("quad");
                    const isSurf = oKey.includes("surface");
                    const isCeil = oKey === "outlet_ceiling";
                    return <button key={oKey} onClick={() => { setOutletType(oKey); setT("outlet"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
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
                      <span style={{ fontSize: 8, color: isSel ? color : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
                    </button>;
                  })}
                </div>

                {/* Switches section */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Switches</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
                  {SWITCH_OPTS.map(({ key: oKey, label, color }) => {
                    const isSel = outletType === oKey;
                    return <button key={oKey} onClick={() => { setOutletType(oKey); setT("outlet"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect x="5" y="5" width="18" height="18" rx="2" fill={color + "18"} stroke={color} strokeWidth="1.5" />
                        <line x1="9" y1="19" x2="17" y2="8" stroke={color} strokeWidth="2" />
                        <circle cx="17" cy="8" r="2.5" fill={color} />
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? color : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
                    </button>;
                  })}
                </div>

                {/* Panel Board section */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Panel</div>
                <div style={{ marginBottom: 14 }}>
                  {(() => {
                    const isSel = outletType === "panel_board";
                    const pcolor = T.uiPanel;
                    return <button onClick={() => { setOutletType("panel_board"); setT("outlet"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", width: "100%", background: isSel ? pcolor + "22" : "transparent", border: "1.5px solid " + (isSel ? pcolor : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                        <rect x="3" y="2" width="22" height="32" rx="2" fill={pcolor + "18"} stroke={pcolor} strokeWidth="1.5" />
                        {[6, 12, 18, 24].map(y => <rect key={y} x="9" y={y - 2} width="10" height="4" rx="1" fill={pcolor + "55"} />)}
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? pcolor : T.textMuted, textAlign: "center", lineHeight: 1.3 }}>Elec. Panel</span>
                    </button>;
                  })()}
                </div>

                {/* T-Stat / Controls section */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Controls</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
                  {[{ key: "tstat", label: "T-Stat", color: "#E8C0A0" }].map(({ key: oKey, label, color }) => {
                    const isSel = outletType === oKey;
                    return <button key={oKey} onClick={() => { setOutletType(oKey); setT("outlet"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect x="5" y="5" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" />
                        <text x="14" y="17" textAnchor="middle" fontSize="10" fill={color} fontWeight="bold">T</text>
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? color : T.textMuted }}>{label}</span>
                    </button>;
                  })}
                </div>

                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>Est. {$(active?.unitCost || 0)}{outletType.startsWith("outlet_") ? " / outlet" : ""}</div>
                <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
                {outletType !== "outlet_ceiling" && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Snaps to nearest wall</div>}
                {outletType === "outlet_ceiling" && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Ceiling mount · free placement</div>}
              </>;
            })()}
            {mode === "itmep" && tool === "lighting" && (() => {
              const active = SPEC_COMPONENTS.power[lightingType];
              const lightColor = T.uiLighting;
              const LIGHT_OPTS = [
                { key: "light_can_4",    label: '4" Can',    color: T.uiLighting, sym: "can"    },
                { key: "light_can_6",    label: '6" Can',    color: T.uiLighting, sym: "can6"   },
                { key: "light_pendant",  label: "Pendant",   color: T.uiLighting, sym: "pend"   },
                { key: "light_linear_2", label: "Linear 2'", color: T.uiLighting, sym: "lin2"   },
                { key: "light_linear_4", label: "Linear 4'", color: T.uiLighting, sym: "lin4"   },
                { key: "light_sconce",   label: "Sconce",    color: T.uiLighting, sym: "sconce" },
              ];
              return <>
                <div style={{ fontSize: 12, color: lightColor, marginBottom: 10, fontWeight: 600 }}>Lighting · {active?.name}</div>
                {/* New vs As-Built toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 8px", background: T.panelBg, borderRadius: 6, border: "1px solid " + T.border }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1 }}>
                    <input type="checkbox" checked={lightingIsNew} onChange={e => setLightingIsNew(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: "#50A0E0", cursor: "pointer" }} />
                    <span style={{ fontSize: 10, color: T.textMuted }}>New / Planned</span>
                  </label>
                </div>
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Fixtures</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
                  {LIGHT_OPTS.map(({ key: lKey, label, color, sym }) => {
                    const isSel = lightingType === lKey;
                    const isCan = sym === "can" || sym === "can6";
                    const isLin = sym === "lin2" || sym === "lin4";
                    const isPend = sym === "pend";
                    const isSconce = sym === "sconce";
                    const bigCan = sym === "can6";
                    return <button key={lKey} onClick={() => { setLightingType(lKey); setT("lighting"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        {isCan && <>
                          <circle cx="14" cy="14" r={bigCan ? 9 : 7} stroke={color} strokeWidth="1.5"/>
                          <circle cx="14" cy="14" r={bigCan ? 5 : 3.5} stroke={color} strokeWidth="1"/>
                          <line x1="10" y1="10" x2="18" y2="18" stroke={color} strokeWidth="1"/>
                          <line x1="18" y1="10" x2="10" y2="18" stroke={color} strokeWidth="1"/>
                        </>}
                        {isPend && <>
                          <line x1="14" y1="2" x2="14" y2="8" stroke={color} strokeWidth="1.5"/>
                          <line x1="8" y1="2" x2="20" y2="2" stroke={color} strokeWidth="1.5"/>
                          <circle cx="14" cy="14" r="6" stroke={color} strokeWidth="1.5"/>
                          <circle cx="14" cy="14" r="2" fill={color}/>
                        </>}
                        {isLin && <>
                          <rect x={sym === "lin4" ? "3" : "6"} y="11" width={sym === "lin4" ? "22" : "16"} height="6" rx="1" stroke={color} strokeWidth="1.5"/>
                          <line x1="14" y1="2" x2="14" y2="11" stroke={color} strokeWidth="1" strokeDasharray="2 2"/>
                        </>}
                        {isSconce && <>
                          <rect x="10" y="6" width="8" height="16" rx="1" stroke={color} strokeWidth="1.5"/>
                          <line x1="10" y1="10" x2="4" y2="7"  stroke={color} strokeWidth="1"/>
                          <line x1="10" y1="14" x2="3" y2="14" stroke={color} strokeWidth="1"/>
                          <line x1="10" y1="18" x2="4" y2="21" stroke={color} strokeWidth="1"/>
                        </>}
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? color : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
                    </button>;
                  })}
                </div>
                {/* Prewires */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Prewires</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 14 }}>
                  {[
                    { key: "sconce_prewire",  label: "Sconce PW",  color: T.uiPrewire },
                    { key: "pendent_prewire", label: "Pendant PW", color: T.uiPrewire },
                  ].map(({ key: lKey, label, color }) => {
                    const isSel = lightingType === lKey;
                    return <button key={lKey} onClick={() => { setLightingType(lKey); setT("lighting"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <circle cx="14" cy="14" r="5" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
                        <line x1="14" y1="9" x2="14" y2="2" stroke={color} strokeWidth="1.5" />
                        <line x1="10" y1="2" x2="18" y2="2" stroke={color} strokeWidth="1.5" />
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? color : T.textMuted }}>{label}</span>
                    </button>;
                  })}
                </div>

                {/* H-Track */}
                <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>H-Track</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 14 }}>
                  {[
                    { key: "htrack_4", label: "4' Track", color: T.uiLighting },
                    { key: "htrack_8", label: "8' Track", color: T.uiLighting },
                  ].map(({ key: lKey, label, color }) => {
                    const isSel = lightingType === lKey;
                    return <button key={lKey} onClick={() => { setLightingType(lKey); setT("lighting"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect x="3" y="10" width="22" height="8" rx="1" stroke={color} strokeWidth="1.5" />
                        <text x="14" y="17" textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">{lKey === "htrack_4" ? "4'" : "8'"}</text>
                      </svg>
                      <span style={{ fontSize: 8, color: isSel ? color : T.textMuted }}>{label}</span>
                    </button>;
                  })}
                </div>
                {htrackAngle > 0 && lightingType.startsWith("htrack_") && <div style={{ fontSize: 9, color: T.uiLighting, marginTop: -8, marginBottom: 10, fontStyle: "italic" }}>Press R to rotate 45° · {htrackAngle}°</div>}

                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>Est. {$(active?.unitCost || 0)}</div>
                <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
                {(lightingType === "light_sconce" || lightingType === "sconce_prewire") && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Snaps to nearest wall</div>}
                {lightingType !== "light_sconce" && lightingType !== "sconce_prewire" && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Ceiling mount · free placement</div>}
              </>;
            })()}
            {mode === "zone" && tool === "zone" && (() => { const zt = zoneLibrary[activeZoneType]; return <>
              <div style={{ fontSize: 12, color: zt.color, marginBottom: 10, fontWeight: 600 }}>{zt.name}</div>
              <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
                <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={activeZoneType}
                  onChange={e => setActiveZoneType(e.target.value)}>
                  {Object.entries(zoneLibrary).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
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

          {/* ── Floating Toolbar (all modes) ────────────────────────── */}
          <div style={S.floatingToolbar}>

            {/* ── Universal tools (Select · Dim · Label · RevCloud) ── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "select")} onClick={() => setT("select")}>
                  <MousePointer2 size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Select (V)</TooltipContent>
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

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "label", T.textBright)} onClick={() => setT("label")}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <text x="10" y="15" textAnchor="middle" fontSize="15" fontWeight="700"
                      fill={tool === "label" ? T.textBright : T.textMuted} fontFamily="sans-serif">T</text>
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Label / Callout (T)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "revcloud", "#E05252")} onClick={() => setT("revcloud")}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 16 A3 3 0 0 1 4 16 A3 3 0 0 1 2 11 A3 3 0 0 1 5 6 A3 3 0 0 1 10 5 A3 3 0 0 1 15 6 A3 3 0 0 1 18 11 A3 3 0 0 1 16 16 Z"
                      stroke={tool === "revcloud" ? "#E05252" : T.textMuted} strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Revision Cloud (N)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "flowPath", "#4A90D9")} onClick={() => setT("flowPath")}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 15 L8 7 L13 12 L17 5" stroke={tool === "flowPath" ? "#4A90D9" : T.textMuted} strokeWidth="3.5" strokeOpacity="0.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 15 L8 7 L13 12 L17 5" stroke={tool === "flowPath" ? "#4A90D9" : T.textMuted} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Flow Path (K)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "floorRegion", "#7A9E5A")} onClick={() => setT("floorRegion")}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="3" width="14" height="14" rx="1.5" stroke={tool === "floorRegion" ? "#7A9E5A" : T.textMuted} strokeWidth="1.5" />
                    <line x1="3" y1="8"  x2="17" y2="8"  stroke={tool === "floorRegion" ? "#7A9E5A" : T.textMuted} strokeWidth="0.8" opacity="0.6" />
                    <line x1="3" y1="12" x2="17" y2="12" stroke={tool === "floorRegion" ? "#7A9E5A" : T.textMuted} strokeWidth="0.8" opacity="0.6" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>Floor Region (A)</TooltipContent>
            </Tooltip>

            {/* ── Build-mode tools ───────────────────────────────────── */}
            {mode === "build" && <>
              <div style={S.toolSep} />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "wall", wallKinds[wallKind].color)} onClick={() => setT("wall")}>
                    <WallIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Wall <kbd style={{ background:"#333", border:"1px solid #555", borderRadius:3, padding:"1px 4px", fontSize:10 }}>W</kbd></TooltipContent>
              </Tooltip>

              <div style={S.toolSep} />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "door")} onClick={() => setT("door")}>
                    <DoorOpen size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Door</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "window")} onClick={() => setT("window")}>
                    <WindowIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Window</TooltipContent>
              </Tooltip>

              <div style={S.toolSep} />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "column")} onClick={() => setT("column")}>
                    <ColumnIcon />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>Column (C)</TooltipContent>
              </Tooltip>

              {bgImage && <>
                <div style={S.toolSep} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "calibrate", T.uiConduit)} onClick={() => setT("calibrate")}>
                      <Ruler size={20} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Calibrate Scale</TooltipContent>
                </Tooltip>
              </>}
            </>}

            {/* ── ITMEP-mode tools ── */}
            {mode === "itmep" && <>
              <div style={S.toolSep} />

              {/* Power layer: Outlet + Lighting */}
              {activeSpecLayer === "power" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "outlet", T.uiElec)} onClick={() => setT("outlet")}>
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
                    <button style={S.toolBtn(tool === "lighting", T.uiLighting)} onClick={() => setT("lighting")}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="5" stroke={T.uiLighting} strokeWidth="1.5" />
                        <circle cx="10" cy="10" r="2" fill={T.uiLighting} />
                        <line x1="10" y1="1" x2="10" y2="4" stroke={T.uiLighting} strokeWidth="1.5" />
                        <line x1="10" y1="16" x2="10" y2="19" stroke={T.uiLighting} strokeWidth="1.5" />
                        <line x1="1" y1="10" x2="4" y2="10" stroke={T.uiLighting} strokeWidth="1.5" />
                        <line x1="16" y1="10" x2="19" y2="10" stroke={T.uiLighting} strokeWidth="1.5" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Lighting (L)</TooltipContent>
                </Tooltip>
              </>}

              {activeSpecLayer === "av" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "wall_speaker", SPEC_LAYERS.av.color)} onClick={() => { setActiveComponentType("wall_speaker"); setT("marker"); }}>
                      <span style={{ fontSize: 16 }}>🔊</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Wall Speaker</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "subwoofer", SPEC_LAYERS.av.color)} onClick={() => { setActiveComponentType("subwoofer"); setT("marker"); }}>
                      <span style={{ fontSize: 16 }}>📻</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Subwoofer</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "pendant_speaker", SPEC_LAYERS.av.color)} onClick={() => { setActiveComponentType("pendant_speaker"); setT("marker"); }}>
                      <span style={{ fontSize: 16 }}>🔈</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Pendant Speaker</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "speaker_line", SPEC_LAYERS.av.color)} onClick={() => { setActiveComponentType("speaker_line"); setT("marker"); }}>
                      <span style={{ fontSize: 16 }}>📡</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Speaker Line</TooltipContent>
                </Tooltip>
              </>}

              {activeSpecLayer === "it" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "router", SPEC_LAYERS.it.color)} onClick={() => { setActiveComponentType("router"); setT("marker"); }}>
                      <span style={{ fontSize: 16 }}>📶</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Router</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "access_point", SPEC_LAYERS.it.color)} onClick={() => { setActiveComponentType("access_point"); setT("marker"); }}>
                      <span style={{ fontSize: 16 }}>📡</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Access Point</TooltipContent>
                </Tooltip>
              </>}

              {activeSpecLayer === "mep" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "drain_line", SPEC_LAYERS.mep.color)} onClick={() => { setActiveComponentType("drain_line"); setT("marker"); }}>
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#50A070" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#50A070" fontWeight="bold">D</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Drain Line</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "water_line", SPEC_LAYERS.mep.color)} onClick={() => { setActiveComponentType("water_line"); setT("marker"); }}>
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#5050A0" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#5050A0" fontWeight="bold">W</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Water Line</TooltipContent>
                </Tooltip>
              </>}

              {activeSpecLayer === "security" && <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "white_camera", SPEC_LAYERS.security.color)} onClick={() => { setActiveComponentType("white_camera"); setT("marker"); }}>
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#E8E0D0" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#E8E0D0" fontWeight="bold">C</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>White Camera</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "black_camera", SPEC_LAYERS.security.color)} onClick={() => { setActiveComponentType("black_camera"); setT("marker"); }}>
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#2A2A26" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#2A2A26" fontWeight="bold">C</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Black Camera</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={S.toolBtn(tool === "marker" && activeComponentType === "outdoor_camera", SPEC_LAYERS.security.color)} onClick={() => { setActiveComponentType("outdoor_camera"); setT("marker"); }}>
                      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" fill="none" stroke="#556B2F" strokeWidth="2" /><text x="10" y="13" textAnchor="middle" fontSize="10" fill="#556B2F" fontWeight="bold">O</text></svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>Outdoor Camera</TooltipContent>
                </Tooltip>
              </>}
            </>}

          </div>

          {/* ── Bottom Status Bar ────────────────────────────────────── */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.bg2, borderTop: "1px solid " + T.border, padding: "6px 16px", display: "flex", alignItems: "center", gap: 12, fontSize: 10, color: T.textDim, zIndex: 10 }}>
            {mode === "zone" && (
              <span style={{ color: zoneLibrary[activeZoneType]?.color || "#5A5448", fontSize: 10, fontWeight: 500 }}>
                {zoneLibrary[activeZoneType]?.name || "—"}
              </span>
            )}

            {mode === "itmep" && activeSpecLayer !== "power" && (
              <span style={{ color: SPEC_LAYERS[activeSpecLayer]?.color || "#5A5448", fontSize: 10, fontWeight: 500 }}>
                {SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType]?.icon} {SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType]?.name}
              </span>
            )}

            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: T.textMuted }}>{Math.round(zoom * 100)}%</span>
            <div style={{ width: 1, height: 18, background: T.border }} />
            <span style={{ color: T.uiBudget, fontWeight: 600, fontSize: 11 }}>{$(cost.total)}</span>
          </div>
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
        {/* Layout switcher (single / split / quad) */}
        <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 30, display: "flex", gap: 2, background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 3, backdropFilter: "blur(12px)", boxShadow: T.panelShadow }}>
          {[[1, "▢", "Single"], [2, "◫", "Split"], [4, "⊞", "Quad"]].map(([n, g, label]) => (
            <Tooltip key={n}><TooltipTrigger asChild>
              <button onClick={() => setLayout(n)} style={{ padding: "4px 9px", borderRadius: 5, border: "none", cursor: "pointer", background: panes.length === n ? T.accent : "transparent", color: panes.length === n ? "#fff" : T.textMuted, fontSize: 13, fontWeight: 600, fontFamily: "inherit", lineHeight: 1 }}>{g}</button>
            </TooltipTrigger><TooltipContent side="top" sideOffset={8}>{label}</TooltipContent></Tooltip>
          ))}
        </div>

        </div>{/* end splitContainerRef */}
      </div>
    </div>

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

// ─── Zone Library Settings Modal ───────────────────────────────────────────────
function ZoneLibraryModal({ zoneLibrary, setZoneLibrary, onReset, onClose, T }) {
  const [expandedKey, setExpandedKey] = useState(null);

  const updZone = (key, patch) =>
    setZoneLibrary(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const updItem = (key, idx, patch) =>
    setZoneLibrary(prev => {
      const items = prev[key].items.map((it, i) => i === idx ? { ...it, ...patch } : it);
      return { ...prev, [key]: { ...prev[key], items } };
    });

  const addItem = (key) =>
    setZoneLibrary(prev => ({
      ...prev,
      [key]: { ...prev[key], items: [...prev[key].items, { name: "", qty: 1, unitCost: 0 }] },
    }));

  const removeItem = (key, idx) =>
    setZoneLibrary(prev => ({
      ...prev,
      [key]: { ...prev[key], items: prev[key].items.filter((_, i) => i !== idx) },
    }));

  const addZoneType = () => {
    const newKey = "custom_" + Date.now();
    setZoneLibrary(prev => ({
      ...prev,
      [newKey]: { name: "New Zone", color: "#888888", defaultW: 12, defaultH: 10, recommendedSf: 120, items: [] },
    }));
    setExpandedKey(newKey);
  };

  const deleteZoneType = (key) => {
    setZoneLibrary(prev => { const next = { ...prev }; delete next[key]; return next; });
    setExpandedKey(null);
  };

  const inp = (extra = {}) => ({
    background: T.bg2, border: "1px solid " + T.border, borderRadius: 4,
    color: T.text, fontSize: 11, fontFamily: "inherit", padding: "3px 6px",
    outline: "none", ...extra,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 48, paddingBottom: 48, overflowY: "auto" }}>
      <div style={{ background: T.bg1, border: "1px solid " + T.border, borderRadius: 10, width: 680, maxWidth: "95vw", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid " + T.border, background: T.bg0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: T.textBright, flex: 1 }}>Zone Library</span>
          <button onClick={onReset} style={{ ...inp(), marginRight: 8, cursor: "pointer", color: T.textMuted }}>Reset to defaults</button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4 }}><X size={16} /></button>
        </div>

        {/* Zone list */}
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {Object.entries(zoneLibrary).map(([key, zone]) => {
            const isOpen = expandedKey === key;
            const total = zone.items.reduce((s, i) => s + (i.qty || 0) * (i.unitCost || 0), 0);
            return (
              <div key={key} style={{ borderBottom: "1px solid " + T.border }}>
                {/* Row header */}
                <div
                  onClick={() => setExpandedKey(isOpen ? null : key)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", cursor: "pointer", background: isOpen ? T.bg2 : "transparent" }}
                >
                  <span style={{ color: T.textMuted, width: 14 }}>{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                  <input type="color" value={zone.color} onClick={e => e.stopPropagation()}
                    onChange={e => updZone(key, { color: e.target.value })}
                    style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0, background: "none" }} />
                  <input value={zone.name} onClick={e => e.stopPropagation()}
                    onChange={e => updZone(key, { name: e.target.value })}
                    style={{ ...inp(), flex: 1, fontWeight: 500 }} />
                  <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>Rec. {zone.recommendedSf ?? "—"} sf</span>
                  <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>${total.toLocaleString()} est.</span>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "12px 20px 16px 48px", background: T.bg0 }}>
                    {/* Meta row */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                        Sq Ft
                        <input type="number" value={zone.recommendedSf ?? ""} onChange={e => {
                          const newSf = Number(e.target.value);
                          const ratio = (zone.defaultW || 1) / (zone.defaultH || 1);
                          const newH = Math.round(Math.sqrt(newSf / ratio) * 10) / 10;
                          const newW = Math.round(Math.sqrt(newSf * ratio) * 10) / 10;
                          updZone(key, { recommendedSf: newSf, defaultW: newW, defaultH: newH });
                        }} style={{ ...inp({ width: 64 }) }} />
                      </label>
                      <label style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                        Default Width (ft)
                        <input type="number" value={zone.defaultW} onChange={e => {
                          const newW = Number(e.target.value);
                          updZone(key, { defaultW: newW, recommendedSf: Math.round(newW * (zone.defaultH || 1)) });
                        }} style={{ ...inp({ width: 64 }) }} />
                      </label>
                      <label style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                        Default Depth (ft)
                        <input type="number" value={zone.defaultH} onChange={e => {
                          const newH = Number(e.target.value);
                          updZone(key, { defaultH: newH, recommendedSf: Math.round((zone.defaultW || 1) * newH) });
                        }} style={{ ...inp({ width: 64 }) }} />
                      </label>
                    </div>

                    {/* FF&E items table */}
                    <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>FF&amp;E / Budget Items</div>
                    {zone.items.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 80px 28px", gap: 4, marginBottom: 6, fontSize: 10, color: T.textMuted, paddingRight: 4 }}>
                        <span>Item</span><span style={{ textAlign: "center" }}>Qty</span><span style={{ textAlign: "right" }}>$/unit</span><span />
                      </div>
                    )}
                    {zone.items.map((item, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 56px 80px 28px", gap: 4, marginBottom: 4 }}>
                        <input value={item.name} onChange={e => updItem(key, idx, { name: e.target.value })} placeholder="Item name" style={inp({ width: "100%" })} />
                        <input type="number" value={item.qty} onChange={e => updItem(key, idx, { qty: Number(e.target.value) })} style={{ ...inp({ textAlign: "center" }) }} />
                        <input type="number" value={item.unitCost} onChange={e => updItem(key, idx, { unitCost: Number(e.target.value) })} style={{ ...inp({ textAlign: "right" }) }} />
                        <button onClick={() => removeItem(key, idx)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 2, display: "flex", alignItems: "center" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addItem(key)} style={{ ...inp(), cursor: "pointer", marginTop: 4, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                      <Plus size={11} /> Add item
                    </button>

                    {/* Delete zone type */}
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid " + T.border }}>
                      <button onClick={() => deleteZoneType(key)}
                        style={{ ...inp(), cursor: "pointer", color: "#E05050", display: "flex", alignItems: "center", gap: 4 }}>
                        <Trash2 size={11} /> Delete zone type
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.border, background: T.bg0 }}>
          <button onClick={addZoneType} style={{ ...inp(), cursor: "pointer", color: T.accent, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
            <Plus size={13} /> Add zone type
          </button>
        </div>
      </div>
    </div>
  );
}

