// ─── Pure model + geometry helpers ──────────────────────────────────────────
// Extracted from the main component so they can be unit-tested in isolation and
// reused by a future backend. Everything here is PURE (no React/three/DOM deps).
import { sanitizeSlideTree } from "../utils/docs";
import { SPEC_COMPONENTS } from "../constants/specs";

// Every component type the catalog still offers. A marker whose type has been retired
// (e.g. the 2'/4' linear fixtures) would otherwise linger invisibly — no symbol to draw,
// no mount height, but still counted in layer tallies — so loading drops it.
const _LIVE_COMPONENT_TYPES = new Set(Object.values(SPEC_COMPONENTS).flatMap(l => Object.keys(l)));
const _liveMarkers = (arr) => arr.filter(m => !m?.componentType || _LIVE_COMPONENT_TYPES.has(m.componentType));

export const uid = () => Math.random().toString(36).slice(2, 10);
// Snap v to a grid of g. A non-positive/absent g means SNAPPING OFF — that's what the
// hold-to-bypass modifier sets, so every call site opts out at once rather than each
// needing its own flag.
export const sn = (v, g) => (g > 0 ? Math.round(v / g) * g : v);

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

// Does a zone cover this point? Polygon zones carry `points` (pass the phase-RESOLVED
// ones); rect zones use x/y/w/h. Same rule the zone hit test uses.
export const zoneCoversPoint = (zone, pts, px, py) => pts
  ? pointInPoly(px, py, pts)
  : px >= zone.x && px <= zone.x + zone.w && py >= zone.y && py <= zone.y + zone.h;

// The furniture that belongs to a zone — the association the plan makes visually: a piece
// is "in" the zone its CENTER sits in. Deliberately positional rather than `fromZone`
// provenance, so a piece dragged out of a zone stops following it and one dragged in
// starts, matching what the drawing shows.
export const furnitureInZone = (furniture, zone, pts) =>
  furniture.filter(f => zoneCoversPoint(zone, pts, f.x, f.y));

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
export const PROJECT_VERSION = "testfit-v17";
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

// Split wall `wallId` into two segments meeting at `junctionNodeId`, copying the
// wall's props (kind/material/phase…) to both halves with fresh ids. No-op if the
// wall is missing or the junction is already one of its endpoints. Used when a
// dragged node/wall endpoint is dropped onto another wall's body (a T-junction):
// openings reattach on their own since doors/windows are positioned in world space,
// not bound to a wall id.
export const splitWallAtNode = (walls, wallId, junctionNodeId, makeId = uid) => {
  const w = _arr(walls).find(x => x && x.id === wallId);
  if (!w || w.n1 === junctionNodeId || w.n2 === junctionNodeId) return walls;
  return walls.flatMap(x => x.id === wallId
    ? [{ ...w, id: makeId(), n2: junctionNodeId }, { ...w, id: makeId(), n1: junctionNodeId }]
    : [x]);
};

// Split wall `wallId` at every node that lies ON its span (mid-span, within `tol` px of
// the centerline), producing a chain of segments through those nodes. Guards the
// collinear-connect case: a wall drawn/dragged in line with an existing wall otherwise
// stacks on top of one of its halves — splitting the new wall at the passed-over
// endpoint lets dedupeWalls collapse the doubled piece. Only nodes referenced by at
// least one wall qualify (orphan nodes would create invisible surprise junctions).
export const splitWallThroughNodes = (walls, nodes, wallId, tol = 4) => {
  const list = _arr(walls);
  const w = list.find(x => x && x.id === wallId);
  if (!w) return walls;
  const byId = Object.fromEntries(_arr(nodes).map(n => [n.id, n]));
  const A = byId[w.n1], B = byId[w.n2];
  if (!A || !B) return walls;
  const dx = B.x - A.x, dy = B.y - A.y, ls = dx * dx + dy * dy;
  if (ls < 1) return walls;
  const used = new Set(); list.forEach(x => { used.add(x.n1); used.add(x.n2); });
  const hits = [];
  for (const n of _arr(nodes)) {
    if (n.id === w.n1 || n.id === w.n2 || !used.has(n.id)) continue;
    const t = ((n.x - A.x) * dx + (n.y - A.y) * dy) / ls;
    if (t <= 0.02 || t >= 0.98) continue;
    if (dst(n.x, n.y, A.x + t * dx, A.y + t * dy) > tol) continue;
    hits.push({ t, id: n.id });
  }
  if (!hits.length) return walls;
  hits.sort((a, b) => a.t - b.t);
  const chain = [w.n1, ...hits.map(h => h.id), w.n2];
  const segs = [];
  for (let i = 0; i < chain.length - 1; i++) segs.push({ ...w, id: uid(), n1: chain[i], n2: chain[i + 1] });
  return list.flatMap(x => x.id === wallId ? segs : [x]);
};

// Weld X-crossings: where wall `wallId` crosses another wall strictly mid-span (both
// interiors), create a node at the intersection and split the crossed wall there. The
// caller then splits `wallId` through those nodes (splitWallThroughNodes) so both walls
// share a junction. Walls sharing a node with `wallId` (corners/tees — already welded)
// and near-parallel walls (collinear case — handled by node-span splits) are skipped.
// `tol` is parametric distance from segment ends: near-end contacts are endpoint welds.
export const weldWallCrossings = (nodes, walls, wallId, tol = 0.02) => {
  const list = _arr(walls);
  const w = list.find(x => x && x.id === wallId);
  if (!w) return { nodes, walls };
  const byId = Object.fromEntries(_arr(nodes).map(n => [n.id, n]));
  const A = byId[w.n1], B = byId[w.n2];
  if (!A || !B) return { nodes, walls };
  const d1x = B.x - A.x, d1y = B.y - A.y;
  let ns = _arr(nodes), ws = walls, changed = false;
  for (const o of list) {
    if (o.id === wallId) continue;
    if (o.n1 === w.n1 || o.n1 === w.n2 || o.n2 === w.n1 || o.n2 === w.n2) continue;
    const C = byId[o.n1], D = byId[o.n2];
    if (!C || !D) continue;
    const d2x = D.x - C.x, d2y = D.y - C.y;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((C.x - A.x) * d2y - (C.y - A.y) * d2x) / den; // along wallId
    const u = ((C.x - A.x) * d1y - (C.y - A.y) * d1x) / den; // along o
    if (t <= tol || t >= 1 - tol || u <= tol || u >= 1 - tol) continue;
    const nn = { id: uid(), x: A.x + t * d1x, y: A.y + t * d1y };
    ns = [...ns, nn];
    ws = splitWallAtNode(ws, o.id, nn.id);
    changed = true;
  }
  return changed ? { nodes: ns, walls: ws } : { nodes, walls };
};

// Weld node `srcId` onto `tgtId`: re-point every wall from src to tgt, remove the src
// node, drop walls that collapse to zero length, and dedupe duplicate segments. Used
// when a dragged node/endpoint lands on an existing node.
export const mergeNode = (nodes, walls, srcId, tgtId) => ({
  nodes: _arr(nodes).filter(n => n.id !== srcId),
  walls: dedupeWalls(_arr(walls)
    .map(w => ({ ...w, n1: w.n1 === srcId ? tgtId : w.n1, n2: w.n2 === srcId ? tgtId : w.n2 }))
    .filter(w => w.n1 !== w.n2)),
});

// Docs-stage slide sanitizer: whitelist the view enum, coerce field types, drop junk.
const SLIDE_VIEWS = new Set(["plan", "front", "back", "left", "right", "3d", "budget", "ffe", "title"]); // data sheets: budget (v12), ffe (v13); title = section divider (v15)
const _slide = (s) => {
  if (!s || typeof s !== "object" || !SLIDE_VIEWS.has(s.view)) return null;
  const rect = (s.rect && typeof s.rect === "object" && typeof s.rect.w === "number") ? s.rect : null;
  const cam3d = (s.cam3d && Array.isArray(s.cam3d.position) && Array.isArray(s.cam3d.target))
    ? { position: s.cam3d.position, target: s.cam3d.target, style3d: s.cam3d.style3d || "clay" } : null;
  return {
    id: s.id || uid(),
    name: typeof s.name === "string" ? s.name : "Slide",
    view: s.view, rect, cam3d,
    image: typeof s.image === "string" ? s.image : null,
    notes: _arr(s.notes),
    title: typeof s.title === "string" ? s.title : "",
    // v15: subtitle line for "title" section-divider slides (ignored by other views).
    subtitle: typeof s.subtitle === "string" ? s.subtitle : "",
    scaleText: typeof s.scaleText === "string" ? s.scaleText : "",
    // v11: per-slide layer visibility — null = inherit the live editor layers.
    vis: (s.vis && typeof s.vis === "object") ? s.vis : null,
    // v14: one-level deck nesting — parent slide id, or null for top level.
    // Cross-slide validity (parent exists, is top-level) is enforced tree-wide in
    // migrateProjectData via sanitizeSlideTree.
    parentId: typeof s.parentId === "string" ? s.parentId : null,
    // v15: a section slide remembers whether its children are collapsed in the deck strip.
    collapsed: s.collapsed === true,
    ts: typeof s.ts === "number" ? s.ts : Date.now(),
  };
};

// v16: elevation dims are scoped to their section cut. Drop legacy dims that predate the
// `cut` field (they'd otherwise show on every cut of that direction); tagged dims + all
// labels/revClouds pass through untouched.
const _elevAnno = (ea) => {
  if (!ea || typeof ea !== "object") return {};
  const out = {};
  for (const [dir, a] of Object.entries(ea)) {
    if (!a || typeof a !== "object") continue;
    out[dir] = { ...a, dims: _arr(a.dims).filter(dm => dm && typeof dm === "object" && "cut" in dm) };
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
    nodes: _arr(d.nodes), walls: dedupeWalls(d.walls), zones: _arr(d.zones), markers: _liveMarkers(_arr(d.markers)),
    furniture: _arr(d.furniture), // Furnish stage (v17): placed 2D parametric furniture
    doors: _arr(d.doors), windows, columns: _arr(d.columns), dims: _arr(d.dims), labels: _arr(d.labels),
    revClouds: _arr(d.revClouds), flowPaths: _arr(d.flowPaths), floorRegions: _arr(d.floorRegions),
    guides: _arr(d.guides), // elevation cut-line guides { id, dir, pos }
    floorMaterial: d.floorMaterial || "Wood",
    elevAnnotations: _elevAnno(d.elevAnnotations),
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
    // Docs stage (v10): slide deck + sheet settings — project-level like snapshots.
    slides: sanitizeSlideTree(_arr(d.slides).map(_slide).filter(Boolean)),
    docSettings: {
      size: ["letter", "tabloid"].includes(d.docSettings?.size) ? d.docSettings.size : "letter",
      orientation: ["landscape", "portrait"].includes(d.docSettings?.orientation) ? d.docSettings.orientation : "landscape",
    },
    version: PROJECT_VERSION,
  };
}
