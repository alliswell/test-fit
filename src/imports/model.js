// ─── Pure model + geometry helpers ──────────────────────────────────────────
// Extracted from the main component so they can be unit-tested in isolation and
// reused by a future backend. Everything here is PURE (no React/three/DOM deps).

export const uid = () => Math.random().toString(36).slice(2, 10);
export const sn = (v, g) => Math.round(v / g) * g;

// Power-layer markers split into Lighting vs Electrical by component type.
export const isLightComponent = (ct) => ct?.startsWith("light_") || ct?.startsWith("htrack_");

// Shift-ortho: snap point B to a 90° (horizontal or vertical) line from anchor A,
// choosing the axis the segment is mostly drawn along.
export const orthoSnap = (ax, ay, bx, by) => Math.abs(bx - ax) >= Math.abs(by - ay) ? { x: bx, y: ay } : { x: ax, y: by };

// ── Geometry ──
export const dst = (ax, ay, bx, by) => Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
export const ptSeg = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1, ls = dx * dx + dy * dy;
  if (ls === 0) return dst(px, py, x1, y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / ls));
  return dst(px, py, x1 + t * dx, y1 + t * dy);
};
// Shoelace formula for polygon area (in px²)
export const polyArea = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a / 2);
};
// Centroid of polygon (vertex average)
export const polyCentroid = (pts) => {
  let cx = 0, cy = 0;
  pts.forEach(p => { cx += p.x; cy += p.y; });
  return { x: cx / pts.length, y: cy / pts.length };
};
// Point in polygon (ray casting)
export const pointInPoly = (px, py, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Parse a feet/inches dim input ("3'6"", "18"", "12") to pixels at ppf px/ft.
export const parseDimInput = (str, ppf) => {
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

// ─── Project schema + migration ─────────────────────────────────────────────
// The single source of truth for a serialized project. captureModel() produces this
// shape; migrateProjectData() normalizes any older/partial blob (file import,
// localStorage autosave, snapshot data) up to the current version. The seam that file
// import, autosave, and a future database all flow through.
export const PROJECT_VERSION = "testfit-v9";
export const AUTOSAVE_KEY = "testfit-autosave"; // localStorage key for crash-safe session restore
const _arr = (v) => Array.isArray(v) ? v : [];
const _obj = (v) => (v && typeof v === "object") ? v : {};
// Collapse redundant walls: the same node-pair (either direction) → one wall, and drop any
// zero-length wall (n1===n2). Guards against duplicate/overlapping segments, which otherwise
// double-render a door in 3D (each wall claims the door) and double-count footage in budget.
export const dedupeWalls = (walls) => {
  const seen = new Set();
  const out = [];
  for (const w of _arr(walls)) {
    if (!w || w.n1 == null || w.n2 == null || w.n1 === w.n2) continue;
    const key = String(w.n1) < String(w.n2) ? w.n1 + "|" + w.n2 : w.n2 + "|" + w.n1;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
};

export function migrateProjectData(d) {
  if (!d || typeof d !== "object") d = {};
  // legacy: standalone `cutouts` were folded into windows as a window type
  const windows = [..._arr(d.windows), ..._arr(d.cutouts).map(c => ({ ...c, type: "Cut Opening" }))];
  // legacy: named `versions` became the `snapshots` library
  let snapshots = _arr(d.snapshots);
  if (!snapshots.length && _arr(d.versions).length) {
    snapshots = d.versions.map(v => ({ id: v.id || uid(), name: v.name || "Snapshot", ts: v.ts || Date.now(), data: v.data }));
  }
  return {
    projectName: typeof d.projectName === "string" ? d.projectName : "Untitled",
    nodes: _arr(d.nodes), walls: dedupeWalls(d.walls), zones: _arr(d.zones), markers: _arr(d.markers),
    doors: _arr(d.doors), windows, columns: _arr(d.columns), dims: _arr(d.dims), labels: _arr(d.labels),
    revClouds: _arr(d.revClouds), flowPaths: _arr(d.flowPaths), floorRegions: _arr(d.floorRegions),
    guides: _arr(d.guides), // elevation cut-line guides { id, dir, pos }
    floorMaterial: d.floorMaterial || "Wood",
    elevAnnotations: _obj(d.elevAnnotations),
    bgOpacity: typeof d.bgOpacity === "number" ? d.bgOpacity : 0.35,
    bgScale: typeof d.bgScale === "number" ? d.bgScale : 1,
    bgOffset: (d.bgOffset && typeof d.bgOffset === "object") ? d.bgOffset : { x: 0, y: 0 },
    pxPerFoot: typeof d.pxPerFoot === "number" ? d.pxPerFoot : 20,
    showDims: d.showDims !== undefined ? !!d.showDims : true,
    zoneLibrary: (d.zoneLibrary && typeof d.zoneLibrary === "object") ? d.zoneLibrary : null,
    snapshots, activeSnapshotId: d.activeSnapshotId ?? null,
    panes: (Array.isArray(d.panes) && d.panes.length) ? d.panes : [{ view: "plan" }],
    splitPos: typeof d.splitPos === "number" ? d.splitPos : 0.5,
    splitPosV: typeof d.splitPosV === "number" ? d.splitPosV : 0.5,
    lockedLayers: _obj(d.lockedLayers),
    version: PROJECT_VERSION,
  };
}
