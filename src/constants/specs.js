// ─── Component spec catalogs & editor constants ──────────────────────────────
// Pure data — no React, no state. SPEC_COMPONENTS/SPEC_LAYERS drive IT/MEP marker
// placement, rendering, and the cost rollup; the rest are editor option lists and
// shared tuning constants.

// Component specifications organized by layer category.
// Normalized field set so all three renderers (plan / elevation / 3D) are data-driven:
//   { name, unitCost, symbol, color, letter?, mount, finish?: ["white","black"],
//     directional?: true, product?, ...dims }
// `symbol` keys map to a MarkerSymbol branch (2D), an elevation glyph, and an M3D shape.
export const SPEC_COMPONENTS = {
  power: {
    // ── Electrical ──
    outlet_duplex:         { name: "Duplex Outlet (In-Wall)",         symbol: "outlet",         color: "#50C878", letter: "D", unitCost: 320, outletCount: 2, mount: "inwall"  },
    outlet_quad:           { name: "Quad Outlet (In-Wall)",           symbol: "outlet",         color: "#50C878", letter: "Q", unitCost: 480, outletCount: 4, mount: "inwall"  },
    outlet_duplex_surface: { name: "Duplex Outlet (Surface/Conduit)", symbol: "outlet",         color: "#E0A050", letter: "D", unitCost: 420, outletCount: 2, mount: "surface" },
    outlet_quad_surface:   { name: "Quad Outlet (Surface/Conduit)",   symbol: "outlet",         color: "#E0A050", letter: "Q", unitCost: 580, outletCount: 4, mount: "surface" },
    outlet_ceiling:        { name: "Ceiling Quad Outlet",             symbol: "outlet_ceiling", color: "#60B0E0", letter: "Q", unitCost: 420, outletCount: 4, mount: "ceiling" },
    switch_single:         { name: "Single-Pole Switch",              symbol: "switch",         color: "#C8A060", letter: "S", unitCost: 180, mount: "inwall"  },
    switch_double:         { name: "Double-Pole Switch",              symbol: "switch",         color: "#C8A060", letter: "S2", unitCost: 260, mount: "inwall" },
    switch_dimmer:         { name: "Dimmer Switch",                   symbol: "switch",         color: "#C8A060", letter: "DM", unitCost: 320, mount: "inwall" },
    panel_board:           { name: "Electrical Panel",                symbol: "panel",          color: "#E05050", letter: "P", unitCost: 2800, mount: "inwall" },
    tstat:                 { name: "T-Stat",                          symbol: "tstat",          color: "#E0716A", letter: "T", unitCost: 450, mount: "inwall" },
    // ── Lighting ──
    light_can_4:    { name: "4\" Recessed Can",    symbol: "recessed",   color: "#E8D070", letter: null, unitCost: 280, size: 4,  mount: "ceiling" },
    light_can_6:    { name: "6\" Recessed Can",    symbol: "recessed",   color: "#E8D070", letter: null, unitCost: 340, size: 6,  mount: "ceiling" },
    light_pendant:  { name: "Pendant Light",        symbol: "pendant",    color: "#E8D070", letter: "P",  unitCost: 450,           mount: "ceiling" },
    light_sconce:   { name: "Wall Sconce",          symbol: "sconce",     color: "#E8D070", letter: "W",  unitCost: 380,           mount: "inwall"  },
    htrack_4:       { name: "H-Track 4'",           symbol: "rect",       color: "#E0A84A", letter: "H",  unitCost: 520, mount: "ceiling", directional: true },
    htrack_8:       { name: "H-Track 8'",           symbol: "rect",       color: "#E0A84A", letter: "H",  unitCost: 840, mount: "ceiling", directional: true },
  },
  av: {
    wall_speaker:    { name: "Wall Speaker",    symbol: "speaker",      color: "#E06040", unitCost: 480, mount: "inwall",  finish: ["white", "black"], directional: true, product: "JBL Control 23-1" },
    subwoofer:       { name: "Subwoofer",       symbol: "sub",          color: "#E06040", unitCost: 650, mount: "floor",   finish: ["white", "black"], product: "JBL Control SB2210" },
    pendant_speaker: { name: "Pendant Speaker", symbol: "pendant_spkr", color: "#E06040", unitCost: 520, mount: "ceiling", finish: ["white", "black"], product: "JBL Control 64P/T" },
    speaker_drop:    { name: "Speaker Drop",    symbol: "speaker_drop", color: "#E06040", unitCost: 120, mount: "ceiling" },
  },
  it: {
    it_rack: { name: "IT Rack (9U)", symbol: "rack",   color: "#4080E0", unitCost: 650, mount: "inwall",  product: "9U Wall-Mount Rack" },
    router:  { name: "Router",       symbol: "router", color: "#4080E0", unitCost: 450, mount: "ceiling", finish: ["white", "black"], product: "Ubiquiti U7 Lite" },
  },
  mep: {
    drain_line: { name: "Drain Line", symbol: "drain", color: "#50A070", letter: "D", unitCost: 380, mount: "inwall" },
    water_line: { name: "Water Line", symbol: "water", color: "#5070C0", letter: "W", unitCost: 380, mount: "inwall" },
  },
  security: {
    camera_indoor:     { name: "Indoor Camera",  symbol: "camera",     color: "#9A4A9A", unitCost: 250, mount: "inwall", finish: ["white", "black"], directional: true, product: "Ring Indoor Cam" },
    camera_floodlight: { name: "Floodlight Cam", symbol: "floodlight", color: "#9A4A9A", unitCost: 280, mount: "inwall", finish: ["white", "black"], directional: true, product: "Ring Floodlight Cam" },
  },
};

export const SPEC_LAYERS = {
  power: { name: "Power / Electrical", color: "#E8C840" },
  av: { name: "Speakers / AV", color: "#E06040" },
  it: { name: "IT / Network", color: "#4080E0" },
  mep: { name: "MEP / Plumbing", color: "#50A070" },
  security: { name: "Security", color: "#9A4A9A" }
};

// Wall-mounted devices drawn standing off the wall into the room rather than centered on
// the wall centerline they're stored at (see markerDrawPos in geometry.js). These are the
// small symbols convention floats in the room — outlets, switches, and sconces (whose light
// throw also fans toward that room, so the plan shows both wall and direction). Bigger wall
// equipment (panel, t-stat, rack) stays drawn on the wall face, and ceiling outlets have no
// wall to stand off of.
export const isWallOffsetComponent = (ct) =>
  !!ct && ((ct.startsWith("outlet_") && ct !== "outlet_ceiling") ||
           ct.startsWith("switch_") || ct === "light_sconce" || ct === "sconce_prewire");

// Devices fixed to a wall — these get a mount-height (AFF) control, defaulting to the
// industry standard in M3D. Ceiling- and floor-mounted components are excluded.
export const isWallMounted = (spec) => spec?.mount === "inwall" || spec?.mount === "surface";
// Centerline → symbol-center clearance: half a standard 7" wall (scales with the plan) plus
// the glyph's own radius (fixed plan px), so the body sits just clear of the wall face. Sized
// off the SELECTED radius (11) with a hair of air, so a device doesn't dip into the wall when
// its symbol grows on selection — and doesn't hop, since the offset itself never changes.
export const wallDeviceOffsetPx = (pxPerFoot) => (3.5 / 12) * pxPerFoot + 12;

// White/black device finish. Components whose spec has `finish` support the toggle.
export const COMPONENT_FINISHES = ["white", "black"];
export const FINISH_COLORS = {
  white: { fill: "#F4F1EA", line: "#2A2A26", body: "#ECE7DD" },
  black: { fill: "#26292E", line: "#A0A3A8", body: "#2C2F35" },
};
// Installed unit cost of a door-mounted access reader (Openpath/Avigilon Alta).
export const ACCESS_READER_COST = 420;

export const DOOR_WIDTHS = [36, 48, 60];
export const DOOR_TYPES = ["Wood", "Glass", "Metal", "Case Opening"];
export const DOOR_HEIGHT_IN = 84; // 7'-0" standard door height (matches 3D DOOR_HEIGHT_FT)
export const DOOR_KNOB_HEIGHT_IN = 38; // knob/lever centerline AFF, used in elevation + 3D
export const WINDOW_WIDTHS = [24, 36, 48, 60];
export const WINDOW_TYPES = ["Window", "Cut Opening"];

// ── Construction unit costs ──────────────────────────────────────────────────
// Net-new / spec'd built items that roll into the budget. Existing walls carry no
// cost (they're there already); Case Opening / Cut Opening are just framed openings.
export const WALL_COST_PER_FT = { existing: 0, demo: 12, new: 95, pony: 65 };
export const DOOR_COST = { "Wood": 850, "Glass": 1650, "Metal": 1200, "Case Opening": 350 };
export const WINDOW_COST = { "Window": 780, "Cut Opening": 220 };
// Doors, windows, and columns count toward the budget only when flagged `isNew` — an
// unflagged item is part of the as-built plan and priced at $0. New columns are a flat each.
export const COLUMN_COST = 1200;

export const FLOW_PATH_COLORS = ["#4A90D9", "#2BB3A3", "#E0A030", "#9B6BD6"]; // blue, teal, amber, violet

// Drag types where proximity-hover preview should stay live (so nearby snap
// targets light up as the user drags a face/edge/vertex/element near them).
export const PROX_DRAG_TYPES = new Set([
  "node", "marker", "door", "window", "column",
  "zone", "zone-vertex", "zone-edge",
  "revcloud", "revcloud-vertex", "revcloud-edge",
  "floorRegion", "floorRegion-vertex", "floorRegion-edge",
  "flowPath", "flowPath-vertex",
]);

export const SNAP_R = 12; // node/edge snap radius (screen px)
export const LABEL_MAX_W = 160; // label box max width before word-wrap (canvas px)

export const DEFAULT_PHASES = [
  { id: "existing", name: "Existing", color: "#9A9488", visible: true },
  { id: "phase1",   name: "v0",       color: "#4A7EC0", visible: true },
  { id: "phase2",   name: "v1",       color: "#4A9060", visible: true },
  { id: "phase3",   name: "v2",       color: "#9060B0", visible: true },
  { id: "phase4",   name: "v3",       color: "#B06040", visible: true },
];
