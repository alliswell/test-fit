// ─── Docs sheet math (pure — no React/DOM) ───────────────────────────────────
// Sheet sizes are in CSS logical px at 96 dpi so 1px = 1/96in: at 100% print scale
// the sheet maps exactly onto the physical page set by @page { size }.

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

const VIEW_TITLES = { plan: "Plan", front: "Front Elevation", back: "Back Elevation", left: "Left Elevation", right: "Right Elevation", "3d": "3D View" };
export const viewTitle = (view) => VIEW_TITLES[view] || "View";

// "Plan 01", "Front Elevation 02" — count is how many slides exist BEFORE this one.
export const defaultSlideName = (view, count) => `${viewTitle(view)} ${String(count + 1).padStart(2, "0")}`;

// "02 / 07" title-block sheet number.
export const formatSheetNo = (index, total) => `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
