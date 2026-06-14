// ─── Component spec catalogs & editor constants ──────────────────────────────
// Pure data — no React, no state. SPEC_COMPONENTS/SPEC_LAYERS drive IT/MEP marker
// placement, rendering, and the cost rollup; the rest are editor option lists and
// shared tuning constants.

// Component specifications organized by layer category
export const SPEC_COMPONENTS = {
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

export const SPEC_LAYERS = {
  power: { name: "Power / Electrical", color: "#E8C840" },
  av: { name: "Speakers / AV", color: "#E06040" },
  it: { name: "IT / Network", color: "#4080E0" },
  mep: { name: "MEP / Plumbing", color: "#50A070" },
  security: { name: "Security", color: "#9A4A9A" }
};

export const DOOR_WIDTHS = [36, 48, 60];
export const DOOR_TYPES = ["Wood", "Glass", "Metal", "Case Opening"];
export const DOOR_HEIGHT_IN = 84; // 7'-0" standard door height (matches 3D DOOR_HEIGHT_FT)
export const DOOR_KNOB_HEIGHT_IN = 38; // knob/lever centerline AFF, used in elevation + 3D
export const WINDOW_WIDTHS = [24, 36, 48, 60];
export const WINDOW_TYPES = ["Window", "Cut Opening"];

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
