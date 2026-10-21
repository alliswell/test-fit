// ─── Theme palettes & wall appearance constants ──────────────────────────────
// Pure design tokens — no React, no state. The active theme object `T` is
// selected per-render in the main component (THEMES[themeMode]).
//
// The CHROME follows Yardstick (the Club Design Suite design system): one `paper`
// ground, `ink` for text/borders/glyphs/linework, `ink-muted` for secondary text,
// `rule-soft` for in-block row dividers (decorative only), `tint` for wells and hover,
// and ONE blue, `selected`, which means "the thing you are working on" and nothing
// else. Hierarchy comes from size, weight (400/500 only) and grid position — never
// from extra grays, which is why textMuted/textDim/textFaint all resolve to ink-muted.
// The legacy keys are kept so every consumer keeps working; the mapping is:
//   bg0/bg1 → paper · bg2 → tint · bg3 → rule-soft · border → ink
//   text/textBright/accent → ink · textMuted/textDim/textFaint/accentDim → ink-muted
//   brand/selBorder → selected · brandDim → proposed (blueprint navy) · panelShadow → none
//   delBg/delText → problem fill + cream text (the Yardstick "problem" state)
// Three themes: light (paper) · dark (paper and ink swapped, selected lightened) ·
// print (white paper, black ink). State fills (YS_STATE) keep their values in all three.
// The plan's layer colours (walls by kind, zones, IT/MEP layers) are data, not chrome,
// and are untouched; the canvas paper, grid and selection follow the theme.
export const YS_FONT_SANS = "'Host Grotesk','Helvetica Neue',Arial,sans-serif";
export const YS_FONT_MONO = "'Geist Mono',ui-monospace,'SF Mono',Menlo,monospace";
// Yardstick state fills — identical in every theme ("State fills keep their values in
// both themes"). Each is always paired with a mark (hatch / check / !), never alone.
export const YS_STATE = {
  proposed: "#13294b", pending: "#d5a144", done: "#97a466", problem: "#a24a24",
  cream: "#f3ecd9", onLightAccent: "#211d18",
};
export const THEMES = {
  dark: {
    bg0: "#1d1a16", bg1: "#1d1a16", bg2: "#26221d", bg3: "#3b352d", border: "#efe7d6",
    text: "#efe7d6", textBright: "#efe7d6", textMuted: "#a0968a", textDim: "#a0968a", textFaint: "#a0968a",
    accent: "#efe7d6", accentDim: "#a0968a",
    brand: "#86a8e0", brandDim: "#86a8e0", brandSoft: "#86a8e01E",
    canvas: "#1d1a16", gridMajor: "#3b352d", gridMinor: "#3b352d80", gridSub: "#3b352d",
    nodeStroke: "#1d1a16", nodeFill: "#efe7d6",
    selBg: "#86a8e016", selBorder: "#86a8e0",
    panelBg: "#1d1a16", panelShadow: "none",
    toolbarBg: "#1d1a16", toolbarShadow: "none",
    delBg: "#a24a24", delText: "#f3ecd9",
    dimText: "#efe7d6B3", wallNode: "#efe7d6", furniture: "#a0968a",
    crosshairColor: "%23efe7d6",
    // UI accent colors (sidebar/panel text — distinct from canvas marker colors)
    uiLighting: "#E8D070", uiElec: "#50C878", uiDoor: "#C8A060",
    uiSwitch: "#C8A060", uiBudget: "#E8C840", uiPanel: "#E05050",
    uiConduit: "#E0A050", uiPrewire: "#C87840",
  },
  light: {
    bg0: "#fbf9f4", bg1: "#fbf9f4", bg2: "#f1ece1", bg3: "#d9d1c1", border: "#211d18",
    text: "#211d18", textBright: "#211d18", textMuted: "#6b6255", textDim: "#6b6255", textFaint: "#6b6255",
    accent: "#211d18", accentDim: "#6b6255",
    brand: "#2b5a9e", brandDim: "#13294b", brandSoft: "#2b5a9e1E",
    canvas: "#fbf9f4", gridMajor: "#d9d1c1", gridMinor: "#d9d1c180", gridSub: "#d9d1c1",
    nodeStroke: "#fbf9f4", nodeFill: "#211d18",
    selBg: "#2b5a9e16", selBorder: "#2b5a9e",
    panelBg: "#fbf9f4", panelShadow: "none",
    toolbarBg: "#fbf9f4", toolbarShadow: "none",
    delBg: "#a24a24", delText: "#f3ecd9",
    dimText: "#211d18B3", wallNode: "#211d18", furniture: "#6b6255",
    crosshairColor: "%23211d18",
    // UI accent colors — darkened for legibility on paper
    uiLighting: "#7A6010", uiElec: "#1A6E3A", uiDoor: "#7A5518",
    uiSwitch: "#7A5518", uiBudget: "#8A6A10", uiPanel: "#B02020",
    uiConduit: "#8A5A10", uiPrewire: "#7A4818",
  },
  // PRINT — pure white paper, black ink, neutral grays. Printed content (walls, dims,
  // type) is black/gray; `selected` blue is a screen-only affordance.
  print: {
    bg0: "#ffffff", bg1: "#ffffff", bg2: "#f0f0f0", bg3: "#d0d0d0", border: "#000000",
    text: "#000000", textBright: "#000000", textMuted: "#565656", textDim: "#565656", textFaint: "#565656",
    accent: "#000000", accentDim: "#565656",
    brand: "#2b5a9e", brandDim: "#13294b", brandSoft: "#2b5a9e14",
    canvas: "#ffffff", gridMajor: "#d0d0d0", gridMinor: "#d0d0d080", gridSub: "#d0d0d0",
    nodeStroke: "#ffffff", nodeFill: "#000000",
    selBg: "#2b5a9e14", selBorder: "#2b5a9e",
    panelBg: "#ffffff", panelShadow: "none",
    toolbarBg: "#ffffff", toolbarShadow: "none",
    delBg: "#a24a24", delText: "#f3ecd9",
    dimText: "#000000B3", wallNode: "#000000", furniture: "#333333",
    crosshairColor: "%23000000",
    // UI accent colors — dark grayscale, so schematic layers stay legible without ink-heavy hues
    uiLighting: "#4A4A4A", uiElec: "#2A2A2A", uiDoor: "#4A4A4A",
    uiSwitch: "#4A4A4A", uiBudget: "#3A3A3A", uiPanel: "#5A5A5A",
    uiConduit: "#4A4A4A", uiPrewire: "#5A5A5A",
  }
};

// The Yardstick CSS custom properties for a theme — written onto :root by testfit.jsx so
// the stylesheet (src/styles/yardstick.css) and PORTALED surfaces (tooltips, toasts), which
// render outside the app root, all read the same tokens.
export const ysVars = (T) => ({
  "--paper": T.bg1, "--ink": T.text, "--ink-muted": T.textMuted, "--rule-soft": T.bg3, "--tint": T.bg2,
  "--selected": T.selBorder, "--on-selected": T.bg1, "--focus": T.text,
  "--proposed": YS_STATE.proposed, "--pending": YS_STATE.pending, "--done": YS_STATE.done,
  "--problem": YS_STATE.problem, "--cream": YS_STATE.cream, "--on-light-accent": YS_STATE.onLightAccent,
  "--font-sans": YS_FONT_SANS, "--font-mono": YS_FONT_MONO,
});

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

// ─── Mono drawing system ─────────────────────────────────────────────────────
// A monochrome DRAWING style rather than a UI palette. One hue for everything;
// hierarchy is carried by line WEIGHT + lightness, never by hue. Because the token
// scale is fixed, the same four tiers read identically in plan, elevation and
// isometric — only the MAPPING changes (MONO_PROFILES): what reads as primary in a
// plan (the cut envelope) is not what reads as primary in an elevation (the ground
// line + silhouette). The hue/background is a swappable "skin".
export const MONO_TIER_WEIGHT = [2.6, 1.7, 1.05, 0.62];
export const MONO_RAMP = {
  "dark-on-light": [22, 34, 48, 63], // HSL lightness per tier, T1..T4
  "light-on-dark": [93, 81, 67, 53],
};
// T1 must separate from the background or the whole hierarchy stops reading.
export const MONO_MIN_CONTRAST = 26;

export const MONO_PRESETS = [
  { id: "blue-cream", name: "Blue / cream", baseHue: 226, lineSat: 68, bg: { h: 52, s: 66, l: 92 }, pol: "dark-on-light" },
  { id: "blueprint",  name: "Blueprint",    baseHue: 212, lineSat: 42, bg: { h: 218, s: 52, l: 21 }, pol: "light-on-dark" },
  { id: "sepia",      name: "Sepia",        baseHue: 28,  lineSat: 46, bg: { h: 38, s: 44, l: 90 },  pol: "dark-on-light" },
  { id: "charcoal",   name: "Charcoal",     baseHue: 220, lineSat: 7,  bg: { h: 40, s: 16, l: 93 },  pol: "dark-on-light" },
  { id: "oxblood",    name: "Oxblood / bone", baseHue: 356, lineSat: 40, bg: { h: 40, s: 30, l: 91 }, pol: "dark-on-light" },
];
export const MONO_DEFAULT_SKIN = MONO_PRESETS[0];

// Which geometry lands on which tier, per view type. Documentation for the mapping
// implemented in the renderers — and the legend text shown in the UI.
export const MONO_PROFILES = {
  plan:      ["External wall / structure", "Internal wall", "Doors / windows / joinery", "Furniture / zones / swing"],
  elevation: ["Ground line / silhouette", "Primary facade & roof", "Openings / reveals", "Texture / entourage"],
  iso:       ["Outer silhouette edge", "Volume-meeting edge", "Surface / detail edge", "Hidden line"],
};

const clampL = (l) => Math.max(0, Math.min(100, l));
// Mono colours are emitted as HEX, not `hsl(...)`, on purpose: the renderers lean on the
// `color + "25"` 8-digit-alpha idiom all over the place, and appending alpha to an
// `hsl(… … …)` string yields invalid CSS (which browsers silently render as black).
const mhsl = (h, s, l) => {
  const S = s / 100, L = clampL(l) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => Math.round(255 * (L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "#" + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, "0")).join("");
};
// The crosshair cursor embeds its colour in an SVG data URI → needs "%23" for "#".
const hslHex = (h, s, l) => "%23" + mhsl(h, s, l).slice(1);

// Build a full THEMES-shaped object from a skin, plus `tiers` (the drawing tokens)
// and `mono: true` so renderers can branch. UI chrome is derived from the same hue
// so the app reads as one material — no second accent color enters the system.
export function buildMonoTheme(skin = MONO_DEFAULT_SKIN) {
  const { baseHue: h, lineSat: s, bg, pol } = skin;
  const ramp = MONO_RAMP[pol] || MONO_RAMP["dark-on-light"];
  const tiers = ramp.map((l, i) => ({ color: mhsl(h, s, l), w: MONO_TIER_WEIGHT[i], l }));
  const dark = pol === "light-on-dark";
  const T1 = tiers[0].color, T2 = tiers[1].color, T3 = tiers[2].color, T4 = tiers[3].color;
  const canvas = mhsl(bg.h, bg.s, bg.l);
  // Panels step away from the canvas so the sidebar/inspector read as chrome, not paper.
  const step = dark ? 4 : -4;
  const surf = (n) => mhsl(bg.h, bg.s, clampL(bg.l + step * n));
  return {
    mono: true, tiers, skin,
    bg0: surf(1), bg1: surf(0), bg2: surf(1.6), bg3: surf(2.6), border: mhsl(h, Math.min(s, 30), dark ? 38 : 72),
    text: T2, textBright: T1, textMuted: T3, textDim: T4, textFaint: mhsl(h, Math.max(s - 20, 0), clampL(ramp[3] + (dark ? -14 : 14))),
    accent: T2, accentDim: T3,
    brand: T1, brandDim: T2, brandSoft: mhsl(h, s, ramp[0]) + "1E",
    canvas, gridMajor: mhsl(h, s, ramp[3]) + "1E", gridMinor: mhsl(h, s, ramp[3]) + "10", gridSub: T4,
    nodeStroke: canvas, nodeFill: T1,
    selBg: mhsl(h, s, ramp[0]) + "16", selBorder: T1,
    panelBg: surf(0) + "F4", panelShadow: dark ? "0 10px 30px rgba(0,0,0,0.5)" : "0 10px 28px rgba(0,0,0,0.14)",
    toolbarBg: surf(0) + "F0", toolbarShadow: dark ? "0 10px 30px rgba(0,0,0,0.5)" : "0 10px 28px rgba(0,0,0,0.14)",
    delBg: mhsl(2, 45, dark ? 30 : 84), delText: mhsl(2, 60, dark ? 82 : 32),
    dimText: T3, wallNode: T1, furniture: T3,
    crosshairColor: hslHex(h, s, ramp[0]),
    // Schematic layers collapse into the ramp too — a mono drawing has no stray hues.
    uiLighting: T2, uiElec: T2, uiDoor: T3, uiSwitch: T3, uiBudget: T2, uiPanel: T2,
    uiConduit: T3, uiPrewire: T3,
  };
}

// Wall kinds under mono: thickness + dash still encode the PHASE (demo stays dashed),
// but colour comes from the tier the wall earns (exterior vs interior), applied at the
// render site — so hierarchy, not category, drives the ink.
export const WALL_KINDS_MONO = {
  existing: { label: "Existing", color: "#000000", dash: null,  thickness: 7 },
  demo:     { label: "Demo",     color: "#000000", dash: "8 4", thickness: 7 },
  new:      { label: "New",      color: "#000000", dash: null,  thickness: 7 },
  pony:     { label: "Pony",     color: "#000000", dash: null,  thickness: 4, thin: true },
};

// Tier token lookup for the mono drawing system. Takes the theme explicitly because the
// canvas and the chrome use DIFFERENT themes (inside renderPlanCanvas `T` is the shadowed
// canvas theme, which is what this must read). Returns null outside mono so every call
// site keeps its existing look with a single `?? existing` fallback.
export const tierOf = (theme, i) => (theme?.mono ? theme.tiers[Math.max(0, Math.min(3, i))] : null);
