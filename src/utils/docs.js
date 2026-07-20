// ─── Docs sheet math (pure — no React/DOM) ───────────────────────────────────
// Sheet sizes are in CSS logical px at 96 dpi so 1px = 1/96in: at 100% print scale
// the sheet maps exactly onto the physical page set by @page { size }.

// ── Per-slide layer visibility ───────────────────────────────────────────────
// A slide's `vis` is null (inherit the live editor layer visibility) OR an object of
// booleans keyed by SLIDE_LAYER_DEFS. Structure (walls/doors/windows/columns) is always
// shown — these keys control only the overlays. Power markers split into elec / light;
// the other IT/MEP layers map straight to their SPEC_LAYERS key (av/it/mep/security).
export const SLIDE_LAYER_DEFS = [
  { key: "grid",      label: "Grid" },
  { key: "dims",      label: "Dimensions" },
  { key: "zones",     label: "Zones" },
  { key: "floors",    label: "Floors" },
  { key: "labels",    label: "Labels" },
  { key: "revClouds", label: "Rev Clouds" },
  { key: "flowPaths", label: "Flow Paths" },
  { key: "guides",    label: "Elevation Rulers" },
  { key: "elec",      label: "Electrical" },
  { key: "light",     label: "Lighting" },
  { key: "av",        label: "Speakers / AV" },
  { key: "it",        label: "IT / Network" },
  { key: "mep",       label: "MEP / Plumbing" },
  { key: "security",  label: "Security" },
];

// Baseline when a slide first switches to explicit control: grid + elevation rulers off
// (they're editor aids, not sheet content), everything else on.
export const DEFAULT_SLIDE_VIS = Object.fromEntries(
  SLIDE_LAYER_DEFS.map(d => [d.key, d.key !== "grid" && d.key !== "guides"])
);

// Named guide presets — the "electrical guide", "zone guide" etc. one-click looks.
const _preset = (on) => Object.fromEntries(SLIDE_LAYER_DEFS.map(d => [d.key, on.includes(d.key)]));
export const SLIDE_VIS_PRESETS = [
  { id: "clean",       label: "Clean",       vis: _preset(["floors"]) },
  { id: "dimensioned", label: "Dimensioned", vis: _preset(["grid", "dims", "floors", "labels", "revClouds"]) },
  { id: "electrical",  label: "Electrical",  vis: _preset(["grid", "floors", "labels", "elec", "light"]) },
  { id: "technology",  label: "Technology",  vis: _preset(["grid", "floors", "labels", "av", "it", "security"]) },
  { id: "zoning",      label: "Zoning",      vis: _preset(["zones", "floors", "labels", "flowPaths"]) },
];

// ── Deck ordering + one-level nesting ────────────────────────────────────────
// Slides stay a FLAT array in document (print) order with an invariant: a child
// (parentId set) immediately follows its parent, and nesting is one level deep.

// Normalize an arbitrary slide array to that invariant: drop bad parent refs
// (missing parent, self-parent, parent-that-is-itself-a-child) and regroup children
// directly after their parents, preserving relative order.
export const sanitizeSlideTree = (slides) => {
  const byId = new Map(slides.map(s => [s.id, s]));
  const cleaned = slides.map(s => {
    const p = s.parentId && s.parentId !== s.id ? byId.get(s.parentId) : null;
    const ok = p && !p.parentId; // parent exists and is top-level
    return ok ? s : (s.parentId ? { ...s, parentId: null } : s);
  });
  const out = [];
  cleaned.forEach(s => {
    if (s.parentId) return;
    out.push(s, ...cleaned.filter(c => c.parentId === s.id));
  });
  return out.length === cleaned.length ? out : [...out, ...cleaned.filter(s => !out.includes(s))];
};

// The group a drag moves as one block: a top-level slide brings its children.
const slideGroup = (slides, id) => {
  const s = slides.find(x => x.id === id);
  if (!s) return [];
  return s.parentId ? [s] : [s, ...slides.filter(c => c.parentId === id)];
};

// Apply a deck-strip drop. zone: "before" | "after" (reorder next to target) or
// "into" (nest under a top-level target). Returns the SAME array when the drop is
// invalid or a no-op, so callers can identity-check.
export const dropSlideList = (slides, dragId, targetId, zone) => {
  if (dragId === targetId) return slides;
  const drag = slides.find(s => s.id === dragId);
  const target = slides.find(s => s.id === targetId);
  if (!drag || !target) return slides;
  if (target.parentId === dragId) return slides; // can't drop into/next to your own child
  const block = slideGroup(slides, dragId);
  const rest = slides.filter(s => !block.includes(s));

  if (zone === "into") {
    if (target.parentId || block.length > 1) return slides; // one level deep only
    const group = slideGroup(rest, targetId);
    const at = rest.indexOf(group[group.length - 1]) + 1; // end of the target's group
    const placed = [{ ...drag, parentId: targetId }];
    return [...rest.slice(0, at), ...placed, ...rest.slice(at)];
  }

  // before/after: adopt the target's parent — unless the drag brings children, which
  // must stay top-level; then drop relative to the target's whole top-level group.
  let newParent = target.parentId ?? null;
  let anchor = target;
  if (block.length > 1 && newParent) {
    anchor = rest.find(s => s.id === newParent) ?? target;
    newParent = null;
  }
  const anchorGroup = slideGroup(rest, anchor.id);
  const at = zone === "before"
    ? rest.indexOf(anchorGroup[0])
    : rest.indexOf(anchorGroup[anchorGroup.length - 1]) + 1;
  if (at < 0) return slides;
  const placed = block.map((s, i) => i === 0 ? { ...s, parentId: newParent } : s);
  const next = [...rest.slice(0, at), ...placed, ...rest.slice(at)];
  // no-op detection: same ids in the same order with the same parents
  const same = next.length === slides.length && next.every((s, i) => s.id === slides[i].id && (s.parentId ?? null) === (slides[i].parentId ?? null));
  return same ? slides : next;
};

// Resolve a slide's vis to a full boolean map (missing keys default on), or null to
// signal "inherit the live editor layers".
export const resolveSlideVis = (vis) => vis ? { ...DEFAULT_SLIDE_VIS, ...vis } : null;

// Which preset (if any) a slide's vis currently matches — for highlighting the buttons.
export const matchSlidePreset = (vis) => {
  if (!vis) return "live";
  const rv = resolveSlideVis(vis);
  const eq = (a) => SLIDE_LAYER_DEFS.every(d => !!rv[d.key] === !!a[d.key]);
  return SLIDE_VIS_PRESETS.find(p => eq(p.vis))?.id ?? null;
};

export const SHEET_SIZES = {
  letter:  { w: 11 * 96, h: 8.5 * 96 },  // 1056 × 816 (landscape base)
  tabloid: { w: 17 * 96, h: 11 * 96 },   // 1632 × 1056
};

// Logical sheet dimensions for the deck settings. Base sizes are landscape;
// portrait swaps.
export const sheetDims = ({ size = "letter", orientation = "landscape" } = {}) => {
  const base = SHEET_SIZES[size] || SHEET_SIZES.letter;
  return orientation === "portrait" ? { w: base.h, h: base.w } : { ...base };
};

// Physical page size in inches for the @page CSS rule.
export const sheetInches = (docSettings) => {
  const d = sheetDims(docSettings);
  return { w: d.w / 96, h: d.h / 96 };
};

// Sheet layout constants shared by the Docs editor sheet + print deck + scale math.
export const SHEET_TITLE_H = 56;  // title-block strip height (sheet-logical px)
export const SHEET_BODY_PAD = 20; // margin around the drawing area
export const sheetBodyDims = (docSettings) => {
  const d = sheetDims(docSettings);
  return { w: d.w - SHEET_BODY_PAD * 2, h: d.h - SHEET_TITLE_H - SHEET_BODY_PAD * 2 };
};

// Standard architectural scales — inches of paper per foot of world, largest first.
export const STANDARD_SCALES = [
  { s: 3,      label: "3\" = 1'-0\"" },
  { s: 1.5,    label: "1-1/2\" = 1'-0\"" },
  { s: 1,      label: "1\" = 1'-0\"" },
  { s: 0.75,   label: "3/4\" = 1'-0\"" },
  { s: 0.5,    label: "1/2\" = 1'-0\"" },
  { s: 0.375,  label: "3/8\" = 1'-0\"" },
  { s: 0.25,   label: "1/4\" = 1'-0\"" },
  { s: 3 / 16, label: "3/16\" = 1'-0\"" },
  { s: 0.125,  label: "1/8\" = 1'-0\"" },
  { s: 3 / 32, label: "3/32\" = 1'-0\"" },
  { s: 1 / 16, label: "1/16\" = 1'-0\"" },
  { s: 1 / 32, label: "1/32\" = 1'-0\"" },
];

// Largest standard scale whose rendering still CONTAIN-fits `rect` in the viewport.
// Returns { s, label, zoom } where zoom maps world px → sheet-logical px such that the
// print (96 logical px = 1 inch at 100% scale) measures true: s inches per world foot.
export const fitStandardScale = (rect, vw, vh, pxPerFoot, pad = 8) => {
  if (!rect || !(rect.w > 0) || !(rect.h > 0) || !(vw > 0) || !(vh > 0) || !(pxPerFoot > 0)) return null;
  const fitZoom = Math.min((vw - pad * 2) / rect.w, (vh - pad * 2) / rect.h);
  const fitS = fitZoom * pxPerFoot / 96; // paper inches per world foot at raw fit
  const std = STANDARD_SCALES.find(x => x.s <= fitS + 1e-9);
  return std ? { ...std, zoom: std.s * 96 / pxPerFoot } : null; // null → smaller than 1/32" — raw fit
};

// Camera for a rect centered at an EXACT zoom (used with fitStandardScale).
export const scaledRectCam = (rect, vw, vh, zoom) => ({
  zoom,
  viewOff: { x: vw / 2 - (rect.x + rect.w / 2) * zoom, y: vh / 2 - (rect.y + rect.h / 2) * zoom },
});

// Contain-fit a world rect into a viewport: returns { zoom, viewOff } such that
// worldX*zoom + viewOff.x maps the rect centered into [0..vw]×[0..vh] with `pad`
// logical px of breathing room. Degenerate rects fall back to a sane default.
export const fitRectToViewport = (rect, vw, vh, pad = 0) => {
  if (!rect || !(rect.w > 0) || !(rect.h > 0) || !(vw > 0) || !(vh > 0)) {
    return { zoom: 1, viewOff: { x: 0, y: 0 } };
  }
  const availW = Math.max(1, vw - pad * 2), availH = Math.max(1, vh - pad * 2);
  let zoom = Math.min(availW / rect.w, availH / rect.h);
  zoom = Math.max(0.01, Math.min(20, zoom));
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  return { zoom, viewOff: { x: vw / 2 - cx * zoom, y: vh / 2 - cy * zoom } };
};

const VIEW_TITLES = { plan: "Plan", front: "Front Elevation", back: "Back Elevation", left: "Left Elevation", right: "Right Elevation", "3d": "3D View", budget: "Budget", ffe: "FF&E Schedule", title: "Section" };
export const viewTitle = (view) => VIEW_TITLES[view] || "View";

// "Plan 01", "Front Elevation 02" — count is how many slides exist BEFORE this one.
export const defaultSlideName = (view, count) => `${viewTitle(view)} ${String(count + 1).padStart(2, "0")}`;

// "02 / 07" title-block sheet number.
export const formatSheetNo = (index, total) => `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
