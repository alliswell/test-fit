// ─── Theme palettes & wall appearance constants ──────────────────────────────
// Pure design tokens — no React, no state. The active theme object `T` is
// selected per-render in the main component (THEMES[themeMode]).

export const THEMES = {
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
