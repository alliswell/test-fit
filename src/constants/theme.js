// ─── Theme palettes & wall appearance constants ──────────────────────────────
// Pure design tokens — no React, no state. The active theme object `T` is
// selected per-render in the main component (THEMES[themeMode]).

// Two themes with distinct identities, not a flat invert:
//   dark  = BLUEPRINT — deep cyanotype navy, luminous cyan accent (brand).
//   light = VELLUM    — warm trace-paper, ink-black type, drafting-vermilion accent (brand).
// `brand`/`brandDim`/`brandSoft` carry the signature accent; `accent` stays a neutral
// interactive gray (it doubles as inactive icon/label color in many places).
export const THEMES = {
  dark: {
    bg0: "#0B1320", bg1: "#0E1828", bg2: "#101D30", bg3: "#16263C", border: "#26384F",
    text: "#AEC2D8", textBright: "#EAF3FC", textMuted: "#6E84A0", textDim: "#536886", textFaint: "#3A4D68",
    accent: "#7C8FA8", accentDim: "#56698A",
    brand: "#3FC8E8", brandDim: "#2C90AE", brandSoft: "#3FC8E81E",
    canvas: "#0C1422", gridMajor: "#3FC8E814", gridMinor: "#3FC8E80A", gridSub: "#2A405C",
    nodeStroke: "#0C1422", nodeFill: "#EAF3FC",
    selBg: "#3FC8E81E", selBorder: "#3FC8E8",
    panelBg: "#0E1828F4", panelShadow: "0 10px 30px rgba(0,0,0,0.5)",
    toolbarBg: "#0E1828EE", toolbarShadow: "0 10px 30px rgba(0,0,0,0.5)",
    delBg: "#5A1D24", delText: "#FFB6BE",
    dimText: "#EAF3FC55", wallNode: "#EAF3FC",
    crosshairColor: "%233FC8E8",
    // UI accent colors (sidebar/panel text — distinct from canvas marker colors)
    uiLighting: "#E8D070", uiElec: "#50C878", uiDoor: "#C8A060",
    uiSwitch: "#C8A060", uiBudget: "#E8C840", uiPanel: "#E05050",
    uiConduit: "#E0A050", uiPrewire: "#C87840",
  },
  light: {
    bg0: "#E6DECF", bg1: "#EFE8DA", bg2: "#E1D9C8", bg3: "#D6CCB8", border: "#C2B7A0",
    text: "#2E2820", textBright: "#15110A", textMuted: "#6C6453", textDim: "#928974", textFaint: "#B3AA95",
    accent: "#564E42", accentDim: "#8A8170",
    brand: "#BC3B26", brandDim: "#8E3322", brandSoft: "#BC3B2618",
    canvas: "#ECE4D5", gridMajor: "#B0A78F22", gridMinor: "#92897412", gridSub: "#B6AC95",
    nodeStroke: "#ECE4D5", nodeFill: "#15110A",
    selBg: "#BC3B2616", selBorder: "#BC3B26",
    panelBg: "#EFE8DAF6", panelShadow: "0 10px 28px rgba(60,42,20,0.14)",
    toolbarBg: "#EFE8DAF2", toolbarShadow: "0 10px 28px rgba(60,42,20,0.14)",
    delBg: "#DCB3AD", delText: "#7A1A12",
    dimText: "#15110A55", wallNode: "#15110A",
    crosshairColor: "%2315110A",
    // UI accent colors — darkened for legibility on warm light background
    uiLighting: "#7A6010", uiElec: "#1A6E3A", uiDoor: "#7A5518",
    uiSwitch: "#7A5518", uiBudget: "#8A6A10", uiPanel: "#B02020",
    uiConduit: "#8A5A10", uiPrewire: "#7A4818",
  },
  // PRINT — pure white paper, black ink, neutral grays. A utilitarian output look:
  // maximum contrast, minimum ink (no warm tone, no colored fills, no heavy shadows).
  // The blue `brand` is a screen-only selection affordance — printed content (walls,
  // dims, type) is black/gray, so a deselected sheet prints monochrome.
  print: {
    bg0: "#F2F2F2", bg1: "#FFFFFF", bg2: "#ECECEC", bg3: "#E2E2E2", border: "#C9C9C9",
    text: "#1A1A1A", textBright: "#000000", textMuted: "#565656", textDim: "#7C7C7C", textFaint: "#ABABAB",
    accent: "#3F3F3F", accentDim: "#8A8A8A",
    brand: "#2E6FB7", brandDim: "#245A96", brandSoft: "#2E6FB714",
    canvas: "#FFFFFF", gridMajor: "#0000000E", gridMinor: "#00000006", gridSub: "#D8D8D8",
    nodeStroke: "#FFFFFF", nodeFill: "#000000",
    selBg: "#2E6FB714", selBorder: "#2E6FB7",
    panelBg: "#FFFFFFF6", panelShadow: "0 10px 28px rgba(0,0,0,0.12)",
    toolbarBg: "#FFFFFFF2", toolbarShadow: "0 10px 28px rgba(0,0,0,0.12)",
    delBg: "#F0D4D4", delText: "#9A1F1F",
    dimText: "#00000099", wallNode: "#000000",
    crosshairColor: "%23000000",
    // UI accent colors — dark grayscale, so schematic layers stay legible without ink-heavy hues
    uiLighting: "#4A4A4A", uiElec: "#2A2A2A", uiDoor: "#4A4A4A",
    uiSwitch: "#4A4A4A", uiBudget: "#3A3A3A", uiPanel: "#5A5A5A",
    uiConduit: "#4A4A4A", uiPrewire: "#5A5A5A",
  }
};

// CAD-style crosshair cursor (data URI)
export const cadCrosshair = (color) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cline x1='16' y1='0' x2='16' y2='14' stroke='${color}' stroke-width='1'/%3E%3Cline x1='16' y1='18' x2='16' y2='32' stroke='${color}' stroke-width='1'/%3E%3Cline x1='0' y1='16' x2='14' y2='16' stroke='${color}' stroke-width='1'/%3E%3Cline x1='18' y1='16' x2='32' y2='16' stroke='${color}' stroke-width='1'/%3E%3C/svg%3E") 16 16, crosshair`;

export const WALL_KINDS = {
  existing: { label: "Existing", color: "#9A9488", dash: null,  thickness: 7   },
  demo:     { label: "Demo",     color: "#E05050", dash: "8 4", thickness: 7   },
  new:      { label: "New",      color: "#50A0E0", dash: null,  thickness: 7   },
  pony:     { label: "Pony",     color: "#C8A060", dash: null,  thickness: 4,   thin: true },
};
// Darker wall colors for light-mode rendering — high contrast on the pale canvas.
export const WALL_KINDS_LIGHT = {
  existing: { label: "Existing", color: "#3A352A", dash: null,  thickness: 7   },
  demo:     { label: "Demo",     color: "#B83838", dash: "8 4", thickness: 7   },
  new:      { label: "New",      color: "#1F5FA8", dash: null,  thickness: 7   },
  pony:     { label: "Pony",     color: "#86601E", dash: null,  thickness: 4,   thin: true },
};
// Print rendering — grayscale, distinguished by ink VALUE + dash rather than hue, the way
// a black-and-white construction drawing reads: new work heaviest/blackest, existing a
// medium gray, demo dashed, pony a lighter gray.
export const WALL_KINDS_PRINT = {
  existing: { label: "Existing", color: "#4A4A4A", dash: null,  thickness: 7   },
  demo:     { label: "Demo",     color: "#4A4A4A", dash: "8 4", thickness: 7   },
  new:      { label: "New",      color: "#000000", dash: null,  thickness: 7   },
  pony:     { label: "Pony",     color: "#767676", dash: null,  thickness: 4,   thin: true },
};

export const WALL_MATERIALS = ["Drywall", "Brick", "CMU / Block", "Concrete", "Plaster", "Other"];
export const WALL_MATERIAL_HATCHES = {
  "Drywall":     "mat-drywall",
  "Brick":       "mat-brick",
  "CMU / Block": "mat-cmu",
  "Concrete":    "mat-concrete",
  "Plaster":     "mat-plaster",
  "Other":       "mat-other",
};

// Per-door-type visual styles. Keys must match DOOR_TYPES in specs.js.
// elev: 2D elevation SVG; clay: 3D clay/xray lambert; pbr: 3D detailed material params
// (Glass pbr feeds meshPhysicalMaterial — extra transmission/opacity keys).
export const DOOR_TYPE_STYLES = {
  "Wood":  { elev: { stroke: "#A9885F", fill: "#A9885F33", panels: true, knob: true },
             clay: { color: "#C8A878", opacity: 0.88 },
             pbr:  { color: "#A87545", roughness: 0.55, metalness: 0.05 } },
  "Glass": { elev: { stroke: "#60A0C8", fill: null, lite: "full", knob: true },
             clay: { color: "#90CAF9", opacity: 0.32 },
             pbr:  { color: "#a8c8e0", roughness: 0.05, metalness: 0, transmission: 0.85, opacity: 0.55 },
             frame: { clay: "#C8C4BC", pbr: { color: "#8A8D92", roughness: 0.4, metalness: 0.6 } } },
  "Metal": { elev: { stroke: "#8A8D92", fill: "#8A8D9233", lite: "vision", knob: true },
             clay: { color: "#9AA0A6", opacity: 0.88 },
             pbr:  { color: "#8A8D92", roughness: 0.35, metalness: 0.8 } },
  "Case Opening": { elev: { stroke: "#A9885F", fill: null, dash: "5 4" } }, // no 3D leaf, no knob
};

// Per-window-type elevation styles. Keys must match WINDOW_TYPES in specs.js.
export const WINDOW_TYPE_STYLES = {
  "Window":      { stroke: "#60A0C8", fill: "#7FB4D633", glassTick: true },
  "Cut Opening": { stroke: "#A09068", fill: null, dash: "5 4" }, // matches its plan-symbol tan
};
