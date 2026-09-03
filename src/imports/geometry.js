// ─── Drawing geometry helpers ────────────────────────────────────────────────
// Pure (no React/three/DOM). Extracted from the main components so the subtle bits —
// wall mitering, alignment guides, the room-boundary face trace — can be unit-tested.
import { isWallOffsetComponent, wallDeviceOffsetPx } from "../constants/specs";
import { pointInPoly, polyInteriorPoint } from "./model";

// Pick a bidirectional resize cursor based on a segment's angle.
export const wallResizeCursor = (x1, y1, x2, y2) => {
  const a = (Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI % 180 + 180) % 180;
  if (a < 22.5 || a >= 157.5) return "ns-resize";
  if (a < 67.5) return "nesw-resize";
  if (a < 112.5) return "ew-resize";
  return "nwse-resize";
};

// Smart guide snapping — snaps (x,y) to the nearest aligned target on each axis
// (within GUIDE_THRESH) and returns the guide lines to draw.
export const GUIDE_THRESH = 7; // canvas px; ~4" at default scale
export function applySmartGuides(x, y, targets) {
  let sx = x, sy = y;
  const guides = [];
  let bestDX = GUIDE_THRESH + 1, bestDY = GUIDE_THRESH + 1;
  let vSnapX = null, hSnapY = null;

  for (const t of targets) {
    const dx = Math.abs(t.x - x), dy = Math.abs(t.y - y);
    if (dx < bestDX) { bestDX = dx; vSnapX = t.x; sx = t.x; }
    if (dy < bestDY) { bestDY = dy; hSnapY = t.y; sy = t.y; }
  }
  if (vSnapX !== null && bestDX <= GUIDE_THRESH) {
    const aligned = targets.filter(t => Math.abs(t.x - vSnapX) <= GUIDE_THRESH);
    const pts = [...new Set([...aligned.map(t => t.y), y])].sort((a, b) => a - b);
    guides.push({ axis: "v", pos: vSnapX, points: pts });
  }
  if (hSnapY !== null && bestDY <= GUIDE_THRESH) {
    const aligned = targets.filter(t => Math.abs(t.y - hSnapY) <= GUIDE_THRESH);
    const pts = [...new Set([...aligned.map(t => t.x), x])].sort((a, b) => a - b);
    guides.push({ axis: "h", pos: hSnapY, points: pts });
  }
  return { x: sx, y: sy, guides };
}

// 2D line–line intersection: point P moving in direction pd meets Q moving in qd.
// Falls back to P when (near) parallel or |t| exceeds cap.
export const lineInt = (px, py, pdx, pdy, qx, qy, qdx, qdy, cap) => {
  const den = pdx * qdy - pdy * qdx;
  if (Math.abs(den) < 0.001) return { x: px, y: py };
  const t = ((qx - px) * qdy - (qy - py) * qdx) / den;
  if (cap != null && Math.abs(t) > cap) return { x: px, y: py };
  return { x: px + pdx * t, y: py + pdy * t };
};
// Miter corner for two walls meeting at junction (jx,jy). d/n/h = direction,
// left-normal, half-thickness per wall (direction points away from junction);
// side = +1 left edge / -1 right edge.
export const wallMiterPt = (jx, jy, d1x, d1y, n1x, n1y, h1, d2x, d2y, n2x, n2y, h2, side) => {
  const Px = jx + n1x * h1 * side, Py = jy + n1y * h1 * side;
  const Qx = jx + n2x * h2 * side, Qy = jy + n2y * h2 * side;
  return lineInt(Px, Py, d1x, d1y, Qx, Qy, d2x, d2y, Math.max(h1, h2) * 6);
};

// Revision-cloud SVG path: scalloped arc "bumps" around a closed polygon.
export function revCloudPath(points, arcR) {
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

// Trace the outer perimeter of the wall graph ("always turn most CCW" face trace
// from the leftmost node) → ordered array of node objects, or null if no closed loop.
export function traceOuterBoundary(nodes, walls) {
  if (!walls?.length || !nodes?.length) return null;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adj = new Map();
  for (const w of walls) {
    if (!nodeMap.has(w.n1) || !nodeMap.has(w.n2) || w.n1 === w.n2) continue;
    if (!adj.has(w.n1)) adj.set(w.n1, []);
    if (!adj.has(w.n2)) adj.set(w.n2, []);
    adj.get(w.n1).push(w.n2); adj.get(w.n2).push(w.n1);
  }
  if (!adj.size) return null;
  let startId = null, startNode = null;
  for (const id of adj.keys()) {
    const n = nodeMap.get(id);
    if (!startNode || n.x < startNode.x || (n.x === startNode.x && n.y < startNode.y)) { startId = id; startNode = n; }
  }
  if (!startId) return null;
  const path = [startId]; let prevId = null, currId = startId, inAngle = Math.PI;
  const maxSteps = walls.length * 2 + 8;
  for (let step = 0; step < maxSteps; step++) {
    const curr = nodeMap.get(currId);
    const candidates = (adj.get(currId) || []).filter(id => id !== prevId);
    if (!candidates.length) return null;
    let bestId = null, bestTurn = -Infinity;
    for (const cid of candidates) {
      const c = nodeMap.get(cid);
      const outAngle = Math.atan2(c.y - curr.y, c.x - curr.x);
      let turn = outAngle - inAngle; while (turn <= 0) turn += 2 * Math.PI; while (turn > 2 * Math.PI) turn -= 2 * Math.PI;
      if (turn > bestTurn) { bestTurn = turn; bestId = cid; }
    }
    if (!bestId) return null;
    if (bestId === startId) return path.length >= 3 ? path.map(id => nodeMap.get(id)) : null;
    if (path.includes(bestId)) return null;
    path.push(bestId);
    const best = nodeMap.get(bestId);
    inAngle = Math.atan2(curr.y - best.y, curr.x - best.x);
    prevId = currId; currId = bestId;
  }
  return null;
}

// Shoelace signed area. Sign encodes winding, so it's what separates a planar graph's
// interior faces from its outer face — see traceRoomLoops.
function signedArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j].x * pts[i].y) - (pts[i].x * pts[j].y);
  return a / 2;
}

// Every ENCLOSED room in the wall graph → [{ nodeIds:[…], points:[{x,y}] }].
//
// traceOuterBoundary answers "what's the building's outline"; this answers "what rooms are
// there", which is a different question — an inner partition wall creates two rooms inside
// one unchanged outline, and a plan can hold several separate wall groups, each with rooms
// of its own. So this is a full planar face traversal rather than a single walk:
//
//   for each directed half-edge u→v, the next half-edge of the same face leaves v along
//   the neighbour immediately CLOCKWISE from u in v's angular order.
//
// Following that rule from every unused half-edge partitions the graph into faces exactly
// once. Every face comes out wound one way and each connected component's OUTER face comes
// out wound the other, so the winding sign — not "the biggest one" — is what drops the
// outdoors. That distinction matters: with several disjoint wall groups there are several
// outer faces, and a plan whose only room IS its outline has an outer face of identical
// area, so any area-based rule gets both cases wrong.
//
// Dangling walls (a spur off a room) are traversed out and back; the two passes cancel in
// the shoelace sum, so they cost area nothing, and the repeated node is dropped below.
export function traceRoomLoops(nodes, walls, minAreaSqPx = 4) {
  if (!walls?.length || !nodes?.length) return [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  // Deduped adjacency: two walls drawn between the same pair of nodes are one graph edge.
  const adj = new Map();
  for (const w of walls) {
    if (!nodeMap.has(w.n1) || !nodeMap.has(w.n2) || w.n1 === w.n2) continue;
    if (!adj.has(w.n1)) adj.set(w.n1, new Set());
    if (!adj.has(w.n2)) adj.set(w.n2, new Set());
    adj.get(w.n1).add(w.n2); adj.get(w.n2).add(w.n1);
  }
  if (!adj.size) return [];

  // Neighbours around each node in angular order — the "clockwise from" lookup above.
  const ring = new Map();
  for (const [id, nbrs] of adj) {
    const n = nodeMap.get(id);
    ring.set(id, [...nbrs]
      .map(b => ({ id: b, a: Math.atan2(nodeMap.get(b).y - n.y, nodeMap.get(b).x - n.x) }))
      .sort((p, q) => p.a - q.a)
      .map(e => e.id));
  }

  const used = new Set();          // "u|v" half-edges already consumed
  const faces = [];
  const maxSteps = walls.length * 2 + 8;
  for (const [u0, nbrs] of adj) {
    for (const v0 of nbrs) {
      if (used.has(u0 + "|" + v0)) continue;
      const loop = [];
      let a = u0, b = v0;
      for (let step = 0; step < maxSteps && !used.has(a + "|" + b); step++) {
        used.add(a + "|" + b);
        loop.push(a);
        const r = ring.get(b);
        const next = r[(r.indexOf(a) - 1 + r.length) % r.length]; // one step clockwise from where we came in
        a = b; b = next;
      }
      if (loop.length >= 3) faces.push(loop);
    }
  }

  // Interior faces all share one winding; every component's outer face has the other.
  const built = faces.map(ids => {
    const pts = ids.map(id => ({ x: nodeMap.get(id).x, y: nodeMap.get(id).y }));
    return { nodeIds: ids, points: pts, area: signedArea(pts) };
  });
  // Positive is the interior winding here (screen coords, +y down). A lone square's two
  // faces have identical |area| and identical node sets, so only the sign tells them apart —
  // which is why the partition-wall case (two 40000 rooms vs one 80000 outdoors) is the test
  // that actually pins this down.
  return built
    .filter(f => f.area >= minAreaSqPx)
    .map(f => ({ nodeIds: f.nodeIds, points: f.points }));
}

// Outward unit normals for the boundary (exterior) walls, taken from the traced outer
// LOOP rather than the node centroid. A centroid test ("normal points away from the mean
// of the nodes") only holds for convex footprints: on an L-shaped / notched plan a
// re-entrant wall's exterior side does NOT point away from the centroid — the centroid can
// sit on the outdoor side of it — so the heuristic flips that wall's normal backwards.
// The polygon winding is unambiguous everywhere, concave corners included: step a hair off
// the edge midpoint along a candidate normal; whichever way leaves the polygon is outward.
// Returns Map<wallId, {nx, ny}> (plan px; ny is +y = south, matching camera vec z).
export function boundaryOutwardNormals(nodes, walls) {
  const out = new Map();
  const loop = traceOuterBoundary(nodes, walls);
  if (!loop) return out;
  const inPoly = (px, py) => {
    let inside = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const xi = loop[i].x, yi = loop[i].y, xj = loop[j].x, yj = loop[j].y;
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const onLoop = new Set();
  for (let i = 0; i < loop.length; i++) onLoop.add(loop[i].id + "|" + loop[(i + 1) % loop.length].id);
  const nm = new Map(nodes.map(n => [n.id, n]));
  for (const w of walls) {
    if (!onLoop.has(w.n1 + "|" + w.n2) && !onLoop.has(w.n2 + "|" + w.n1)) continue; // boundary only
    const A = nm.get(w.n1), B = nm.get(w.n2); if (!A || !B) continue;
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, eps = Math.min(2, L * 0.05) || 0.5;
    if (inPoly(mx + nx * eps, my + ny * eps)) { nx = -nx; ny = -ny; } // stepped inward → flip
    out.set(w.id, { nx, ny });
  }
  return out;
}

// ── Wall-mounted device display offset ───────────────────────────────────────────────
// Outlets/switches are STORED on the wall centerline — that's what wall snapping,
// elevation projection, 3D placement and dimensions all need — but a real electrical plan
// draws the symbol standing off the wall INTO the room it serves, clear of the poché, so
// the device reads at a glance. These two helpers are the single source of truth for that
// offset: the renderer draws at the display point and the hit test picks there too, so the
// symbol you click is the symbol you see.
//
// A wall's local frame is its `angle` (direction along the wall); the perpendicular is
// n = (-sin a, cos a) — the local +y axis. `side` is which way along n the device faces,
// captured at placement from the side of the wall the user clicked (so an outlet on a
// partition serves the room it was dropped in).
export function wallSideSign(px, py, wx, wy, angleRad) {
  const nx = -Math.sin(angleRad), ny = Math.cos(angleRad);
  return ((px - wx) * nx + (py - wy) * ny) >= 0 ? 1 : -1;
}

// Where a marker is DRAWN, given its resolved (phase-aware) stored point. Devices without
// an offset — and pre-offset markers that never captured a `side` — draw where they sit.
export function markerDrawPos(marker, x, y, pxPerFoot) {
  const side = marker.side;
  if (!side || !isWallOffsetComponent(marker.componentType)) return { x, y };
  const a = marker.angle || 0, off = wallDeviceOffsetPx(pxPerFoot) * side;
  return { x: x - Math.sin(a) * off, y: y + Math.cos(a) * off };
}

// Which boundary walls the isometric cutaway should hide for a camera looking along
// `camVec` ([x, _, z]): the FOREGROUND walls — those on the camera's side of the building.
// A boundary wall is hidden when its midpoint sits toward the camera from the node centroid
// (dot of (mid − centroid) with the camera direction > 0). This is the "nearness" rule the
// user chose over a face-normal test: at a re-entrant/notch corner a wall's OUTWARD face
// can point away from the camera while the wall itself is still in the foreground occluding
// the view (e.g. the notch door wall), so nearness — not which way the face points — is
// what should drop it. Trade-off the user accepted: a perpendicular side wall whose
// midpoint lands on the near side (e.g. a window wall) can drop at some angles too. Only
// boundary walls (traceOuterBoundary, via boundaryOutwardNormals' keys) are eligible;
// interior partitions always stay so the cutaway still shows the layout.
export function cutawayHiddenWalls(nodes, walls, camVec) {
  const boundary = boundaryOutwardNormals(nodes, walls); // Map keyed by boundary wall id
  const hidden = new Set();
  if (!nodes.length) return hidden;
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cz = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  const nm = new Map(nodes.map(n => [n.id, n]));
  for (const w of walls) {
    if (!boundary.has(w.id)) continue;
    const A = nm.get(w.n1), B = nm.get(w.n2); if (!A || !B) continue;
    const mx = (A.x + B.x) / 2 - cx, mz = (A.y + B.y) / 2 - cz;
    if (mx * camVec[0] + mz * camVec[2] > 0) hidden.add(w.id);
  }
  return hidden;
}

// ─── Mitered wall footprints ─────────────────────────────────────────────────
// Shared by the 2D plan renderer AND the 3D wall solids: each wall's footprint is a
// quad whose end corners are mitered against the bounding neighbours at the junction,
// so adjacent footprints tile gap-free with ZERO overlap (both walls at a corner agree
// on the same shared point). Ported verbatim from the plan renderer's getMiterSides.
//
// wallEndMiter — miter one wall end. (jx,jy) junction; (dirX,dirY) unit direction
// pointing AWAY from the junction along this wall; (nx,ny) this wall's left normal;
// halfT half-thickness (px). others: [{oux,ouy,onx,ony,oHalfT}] per neighbour wall,
// direction pointing away from the junction.
export function wallEndMiter({ jx, jy, dirX, dirY, nx, ny, halfT, others }) {
  const myAngle = Math.atan2(dirY, dirX);
  const norm = a => ((a - myAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const info = others.map(o => ({ ...o, na: norm(Math.atan2(o.ouy, o.oux)) }));
  // Bucket a neighbour by which FACE of this wall it sits on — dot with the wall normal.
  // (The previous test used the angle relative to the outgoing direction, which flips
  // meaning at the n2 end, since that end's direction is reversed while `n` is not. With a
  // single neighbour the L/R fallback hid it; at a T it sent the perpendicular wall to the
  // wrong side and mitered the face that should have run straight.) Collinear neighbours
  // dot to ~0 and land in neither bucket, which is correct — they continue the face.
  // Within a side, the bounding neighbour is the one turning least from this wall.
  const turn = (o) => Math.min(o.na, 2 * Math.PI - o.na);
  const nearest = (arr) => arr.slice().sort((a, b) => turn(a) - turn(b))[0];
  const lN = nearest(info.filter(o => o.oux * nx + o.ouy * ny > 1e-6));
  const rN = nearest(info.filter(o => o.oux * nx + o.ouy * ny < -1e-6));
  // Miter a given side (s=+1 → +n edge / L, s=-1 → -n edge / R) with its bounding
  // neighbour. Inner vs outer is decided GEOMETRICALLY via the interior bisector (not
  // the wall's arbitrary node-order normal), so both walls at a corner agree on the
  // same shared point → seamless, gap-free joins.
  const cornerWith = (nb, s) => {
    const baseX = jx + nx * halfT * s, baseY = jy + ny * halfT * s;
    let bx = dirX + nb.oux, by = dirY + nb.ouy; const bl = Math.hypot(bx, by);
    if (bl < 1e-6) return { x: baseX, y: baseY }; // collinear → no miter
    bx /= bl; by /= bl;
    const isInner = (nx * s * bx + ny * s * by) > 0;      // this edge faces the interior?
    const sB = (nb.onx * bx + nb.ony * by) >= 0 ? 1 : -1; // neighbour's inner-edge sign
    const nbSign = (isInner ? 1 : -1) * sB;               // match same inner/outer side
    const qx = jx + nb.onx * nb.oHalfT * nbSign, qy = jy + nb.ony * nb.oHalfT * nbSign;
    return lineInt(baseX, baseY, dirX, dirY, qx, qy, nb.oux, nb.ouy, Math.max(halfT, nb.oHalfT) * 6);
  };
  // Fallback to the other side's neighbour is right for a plain 2-wall corner: one
  // neighbour, and BOTH edges have to miter to it. It is wrong at a T. There the
  // continuation is collinear (na ≈ π) so it lands in neither the left nor the right
  // bucket, and the fallback mitered both edges across the full thickness against the
  // PERPENDICULAR wall — the two collinear segments then cut opposite diagonals, crossing
  // in an X: they overlap in the junction block (coplanar solids → the z-fighting flicker
  // at every 3-wall junction) while leaving the opposite corners uncovered. With a
  // collinear continuation the un-mitered side must end square, because that neighbour
  // carries the face straight through.
  const collinear = info.some(o => Math.abs(o.na - Math.PI) < 0.02);
  const nbL = lN || (collinear ? null : rN);
  const nbR = rN || (collinear ? null : lN);
  const Lpt = nbL ? cornerWith(nbL, 1) : { x: jx + nx * halfT, y: jy + ny * halfT };
  const Rpt = nbR ? cornerWith(nbR, -1) : { x: jx - nx * halfT, y: jy - ny * halfT };
  return { L: Lpt, R: Rpt, openL: !lN, openR: !rN, free: others.length === 0 };
}

// computeWallFootprints — resolve every wall's mitered footprint quad in one pass.
// Neighbours are matched by shared node id OR endpoint proximity (< prox px), which
// closes joins where two walls meet but sit on separate, unsnapped nodes.
// halfTOf(wall) → half-thickness in px (kind/pony-aware; caller supplies so this stays
// free of theme/scale constants). Returns Map wallId → { c, ux, uy, nx, ny, halfT,
// mN1, mN2, quad:[mN1.L, mN2.L, mN2.R, mN1.R] }; degenerate walls (<1px, missing
// nodes) are omitted.
export function computeWallFootprints(walls, nodes, { halfTOf, prox = 6 } = {}) {
  const nodeMap = new Map((nodes || []).map(n => [n.id, n]));
  const coords = new Map();
  for (const w of walls || []) {
    const a = nodeMap.get(w.n1), b = nodeMap.get(w.n2);
    if (!a || !b) continue;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1) continue;
    coords.set(w.id, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }
  const byNode = new Map();
  for (const w of walls || []) {
    if (!coords.has(w.id)) continue;
    for (const nid of [w.n1, w.n2]) {
      if (!byNode.has(nid)) byNode.set(nid, []);
      byNode.get(nid).push(w);
    }
  }
  const endMiter = (w, c, nx, ny, halfT, nid, dirX, dirY) => {
    const jx = nid === w.n1 ? c.x1 : c.x2, jy = nid === w.n1 ? c.y1 : c.y2;
    const nodeConns = byNode.get(nid) || [];
    const others = [];
    for (const ow of walls) {
      if (ow.id === w.id) continue;
      const oc = coords.get(ow.id); if (!oc) continue;
      const shares = nodeConns.some(x => x.id === ow.id)
        || Math.hypot(oc.x1 - jx, oc.y1 - jy) < prox || Math.hypot(oc.x2 - jx, oc.y2 - jy) < prox;
      if (!shares) continue;
      const atN1 = ow.n1 === nid || Math.hypot(oc.x1 - jx, oc.y1 - jy) < prox;
      const odx = atN1 ? oc.x2 - oc.x1 : oc.x1 - oc.x2;
      const ody = atN1 ? oc.y2 - oc.y1 : oc.y1 - oc.y2;
      const olen = Math.hypot(odx, ody) || 1;
      const oux = odx / olen, ouy = ody / olen;
      others.push({ oux, ouy, onx: -ouy, ony: oux, oHalfT: halfTOf(ow) || 0 });
    }
    return wallEndMiter({ jx, jy, dirX, dirY, nx, ny, halfT, others });
  };
  const out = new Map();
  for (const w of walls || []) {
    const c = coords.get(w.id); if (!c) continue;
    const dx = c.x2 - c.x1, dy = c.y2 - c.y1, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const halfT = halfTOf(w) || 0;
    const mN1 = endMiter(w, c, nx, ny, halfT, w.n1, ux, uy);
    const mN2 = endMiter(w, c, nx, ny, halfT, w.n2, -ux, -uy);
    out.set(w.id, { c, ux, uy, nx, ny, halfT, mN1, mN2, quad: [mN1.L, mN2.L, mN2.R, mN1.R] });
  }
  return out;
}

// junctionCapPolys — where ≥2 walls meet, the per-wall mitered quads can leave a small
// uncovered wedge (worst at odd / T-junction angles). Cluster wall-end corner points by
// junction POSITION (per-axis prox, matching the miter's neighbour proximity) and emit
// the convex wedge polygon per junction. entries = footprint values (caller pre-filters,
// e.g. to phase-visible walls) each carrying an `id`. Returns
// [{ x, y, pts:[{x,y}] angle-sorted, wallIds:[first-touch order] }].
export function junctionCapPolys(entries, { prox = 6 } = {}) {
  const caps = [];
  const addCap = (jx, jy, p, id) => {
    let cl = caps.find(c => Math.abs(c.x - jx) <= prox && Math.abs(c.y - jy) <= prox);
    if (!cl) { cl = { x: jx, y: jy, pts: [], wallIds: [] }; caps.push(cl); }
    cl.pts.push(p);
    if (!cl.wallIds.includes(id)) cl.wallIds.push(id);
  };
  for (const e of entries || []) {
    addCap(e.c.x1, e.c.y1, e.mN1.L, e.id); addCap(e.c.x1, e.c.y1, e.mN1.R, e.id);
    addCap(e.c.x2, e.c.y2, e.mN2.L, e.id); addCap(e.c.x2, e.c.y2, e.mN2.R, e.id);
  }
  const out = [];
  for (const cl of caps) {
    if (cl.wallIds.length < 2) continue; // open end → no wedge
    const uniq = [];
    cl.pts.forEach(p => { if (!uniq.some(q => Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5)) uniq.push(p); });
    if (uniq.length < 3) continue; // collinear pass-through
    uniq.sort((a, b) => Math.atan2(a.y - cl.y, a.x - cl.x) - Math.atan2(b.y - cl.y, b.x - cl.x));
    out.push({ x: cl.x, y: cl.y, pts: uniq, wallIds: cl.wallIds });
  }
  return out;
}

// ─── Nested floors ───────────────────────────────────────────────────────────
// A room drawn inside another room yields a floor lying wholly within a bigger one, and
// painting both leaves two hatches stacked — the inner room reads as sitting ON the outer
// one rather than being carved out of it. Its true extent is its ring MINUS the floors
// nested in it, and that is DERIVED here from the current floor set rather than stored:
// a hole then appears, moves and closes on its own as the inner room is added, resized or
// deleted, with nothing to keep in sync and no schema change.
//
// Returns Map<parentId, holeRings[]> holding each floor's IMMEDIATE children only.
// Immediate matters at three levels of nesting: with every descendant listed, the innermost
// region would be knocked out of the grandparent AND the parent — subtracted twice from the
// area, and flipped back to filled by the even-odd rule that draws these. With immediate
// children, each ring is subtracted exactly once, by the one floor that directly contains it.
export function nestedFloorHoles(polys) {
  const items = [];
  for (const p of polys || []) {
    if (!(p?.points?.length >= 3)) continue;
    const inner = polyInteriorPoint(p.points);
    if (inner) items.push({ id: p.id, points: p.points, area: Math.abs(signedArea(p.points)), inner });
  }
  const holes = new Map();
  for (const child of items) {
    // Strictly larger, so two floors with identical outlines never hole each other — one
    // sits on top of the other, which is a duplicate, not a nesting.
    let parent = null;
    for (const cand of items) {
      if (cand === child || cand.area <= child.area) continue;
      if (!pointInPoly(child.inner.x, child.inner.y, cand.points)) continue;
      if (!parent || cand.area < parent.area) parent = cand;   // smallest container = immediate
    }
    if (!parent) continue;
    const list = holes.get(parent.id);
    if (list) list.push(child.points); else holes.set(parent.id, [child.points]);
  }
  return holes;
}

// ─── Clear-inside floor outline ──────────────────────────────────────────────
// Inset a floor polygon (points on wall CENTERLINES, e.g. the rect-room auto floor)
// to the clear inside-face outline: each edge that has a wall running along it moves
// inward by that wall's half-thickness; edges with no wall stay put. Corners re-close
// by intersecting the shifted neighbor edges (miter), so the result is the polygon a
// tape measure would find between finished wall faces.
// halfTOf(wall) → half-thickness in px (kind/pony-aware; supplied by the caller so
// this stays free of theme/scale constants). Returns a NEW points array.
// `outward` offsets the other way instead — used for a HOLE ring (a room nested inside
// this one): its walls eat into the surrounding room, so the carve-out a tape measure
// finds is the nested room's centerline grown by those walls, not shrunk by them. The
// winding normalization above is exactly why passing a reversed ring can't do this.
export function insetFloorPolygon(points, walls, nodes, halfTOf, tol = 1.5, outward = false) {
  const n = points?.length || 0;
  if (n < 3) return points || [];
  const nodeMap = new Map((nodes || []).map(nd => [nd.id, nd]));
  // Signed shoelace sum decides which perpendicular points into the room: for a>0 the
  // left normal (-dy,dx) faces inward (screen coords, y down); for a<0 it's flipped.
  let a = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += points[i].x * points[j].y - points[j].x * points[i].y; }
  const inSign = (a > 0 ? 1 : -1) * (outward ? -1 : 1);

  const edges = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy * inSign, ny = ux * inSign; // inward normal
    // Largest half-thickness among walls lying along this edge (collinear + overlapping).
    let inset = 0;
    for (const w of walls || []) {
      const A = nodeMap.get(w.n1), B = nodeMap.get(w.n2);
      if (!A || !B) continue;
      // (nx,ny) is a unit perpendicular of the edge, so |(P−p)·n̂| is P's distance to the
      // edge's infinite line — both wall endpoints must sit on it (within tol) to count.
      const distA = Math.abs((A.x - p.x) * nx + (A.y - p.y) * ny);
      const distB = Math.abs((B.x - p.x) * nx + (B.y - p.y) * ny);
      if (distA > tol || distB > tol) continue;
      const tA = ((A.x - p.x) * ux + (A.y - p.y) * uy) / len;
      const tB = ((B.x - p.x) * ux + (B.y - p.y) * uy) / len;
      if (Math.min(Math.max(tA, tB), 1) - Math.max(Math.min(tA, tB), 0) < 0.05) continue; // no real overlap
      inset = Math.max(inset, halfTOf(w) || 0);
    }
    return { px: p.x + nx * inset, py: p.y + ny * inset, ux, uy, inset, nx, ny };
  });

  // New vertex k = intersection of shifted edges k-1 and k; near-parallel neighbors
  // (collinear runs) fall back to the original corner shifted by the current edge.
  return points.map((p, k) => {
    const e0 = edges[(k - 1 + n) % n], e1 = edges[k];
    const den = e0.ux * e1.uy - e0.uy * e1.ux;
    if (Math.abs(den) < 0.001) return { x: p.x + e1.nx * e1.inset, y: p.y + e1.ny * e1.inset };
    const t = ((e1.px - e0.px) * e1.uy - (e1.py - e0.py) * e1.ux) / den;
    if (!Number.isFinite(t) || Math.abs(t) > 1e5) return { x: p.x + e1.nx * e1.inset, y: p.y + e1.ny * e1.inset };
    return { x: e0.px + e0.ux * t, y: e0.py + e0.uy * t };
  });
}

// ─── Carrying polygons with the nodes they sit on ────────────────────────────
// Floor regions and zones hold NO reference to walls or nodes — a room drawn with the rect
// tool gets a floor whose corners are written from the same scalars as the wall corners, and
// from then on the two are independent. So "resize the room, resize its floor" is a
// POSITIONAL binding, matched at drag start and re-derived: the same stance the codebase
// takes for openings ("doors/windows are positioned in world space, not bound to a wall id",
// model.js). It also survives the onUp weld, which can delete node ids outright.

// Polygon vertices sitting ON a node that is about to move. Snapshot this at drag start —
// recomputing mid-drag would drop a vertex the moment the node slid off it.
// The result is FLAT: a vertex shared by two polygons yields one entry each, so two rooms on
// a shared wall both deform (one grows, one shrinks) rather than only the first match.
// Each entry carries the vertex's OWN start position, which is what lets applyPolyCarry run
// without any access to `nodes`.
export function polyCarryStart(polys, movingNodes, tol = 0.5, excludeIds) {
  const out = [];
  if (!polys?.length || !movingNodes?.length) return out;
  const skip = excludeIds instanceof Set ? excludeIds : excludeIds?.length ? new Set(excludeIds) : null;
  for (const poly of polys) {
    if (!poly?.points?.length || skip?.has(poly.id)) continue;
    poly.points.forEach((pt, vertexIndex) => {
      for (const n of movingNodes) {
        if (Math.abs(pt.x - n.x) <= tol && Math.abs(pt.y - n.y) <= tol) {
          out.push({ polyId: poly.id, vertexIndex, nodeId: n.id, x: pt.x, y: pt.y });
          break; // one node per vertex — nodes never coincide with each other
        }
      }
    });
  }
  return out;
}

// Move the captured vertices by their node's TOTAL delta since drag start. Total, never
// per-frame and never absolute assignment: total-delta keeps a vertex exactly on its node
// across an unbounded drag with no accumulated rounding, and never fuses a vertex that
// merely started NEAR a node onto it.
// Returns the same array reference when nothing moves, and leaves untouched polygons with
// their original object identity.
export function applyPolyCarry(polys, carry, deltaOf) {
  if (!carry?.length || !polys?.length) return polys;
  const byPoly = new Map();
  for (const c of carry) {
    const d = deltaOf(c.nodeId);
    if (!d || (!d.dx && !d.dy)) continue;
    let m = byPoly.get(c.polyId);
    if (!m) byPoly.set(c.polyId, (m = new Map()));
    m.set(c.vertexIndex, { x: c.x + d.dx, y: c.y + d.dy });
  }
  if (!byPoly.size) return polys;
  return polys.map(poly => {
    const moved = byPoly.get(poly.id);
    if (!moved) return poly;
    return { ...poly, points: poly.points.map((pt, i) => moved.get(i) ?? pt) };
  });
}

// One-shot compose, for the discrete arrow-key nudge (no drag to snapshot into).
export function carryPolyWithNodes(polys, movingNodes, deltaOf, tol, excludeIds) {
  return applyPolyCarry(polys, polyCarryStart(polys, movingNodes, tol, excludeIds), deltaOf);
}

// ─── Minimap: fitting content into a box, and where the viewport sits ─────────
// The plan canvas draws content through `translate(viewOff) scale(zoom)`, so a content
// point maps to screen as p*zoom + viewOff. The minimap needs the inverse of that, plus a
// second transform that squeezes the whole model into a small box.

// Axis-aligned bounds of a point cloud. null for an empty model — callers use that to
// decide there is nothing worth showing.
export function contentBounds(points) {
  if (!points?.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// Uniform scale + offset that fits `bounds` inside boxW×boxH with `pad` px of margin, and
// centers it on the short axis. Uniform so the overview keeps the model's proportions —
// a stretched minimap is worse than useless for navigation.
// Returns { s, ox, oy }: minimapPoint = contentPoint * s + o.
export function fitTransform(bounds, boxW, boxH, pad = 6) {
  if (!bounds) return { s: 1, ox: 0, oy: 0 };
  const availW = Math.max(1, boxW - pad * 2), availH = Math.max(1, boxH - pad * 2);
  // A degenerate axis (a single wall, say) must not divide by zero or blow the scale up.
  const s = Math.min(bounds.w > 0 ? availW / bounds.w : Infinity,
                     bounds.h > 0 ? availH / bounds.h : Infinity);
  const scale = Number.isFinite(s) && s > 0 ? s : 1;
  return {
    s: scale,
    ox: pad + (availW - bounds.w * scale) / 2 - bounds.minX * scale,
    oy: pad + (availH - bounds.h * scale) / 2 - bounds.minY * scale,
  };
}

// The content-space rectangle currently on screen, given the canvas pan/zoom and its pixel
// size. This is what the minimap outlines as "you are here".
export function viewportRect(viewOff, zoom, canvasW, canvasH) {
  const z = zoom > 0 ? zoom : 1;
  // `+ 0` normalizes the -0 that negating a zero offset produces — harmless arithmetically,
  // but it leaks into rendered SVG coordinates and equality checks.
  return { x: -viewOff.x / z + 0, y: -viewOff.y / z + 0, w: canvasW / z, h: canvasH / z };
}

// The inverse: the viewOff that puts content point (cx,cy) at the middle of the canvas.
// Same formula fitAll uses, kept here so the minimap and fit-to-view can't disagree.
export function centerViewOn(cx, cy, zoom, canvasW, canvasH) {
  return { x: canvasW / 2 - cx * zoom, y: canvasH / 2 - cy * zoom };
}

// Real-world spacing (in feet) of the plan grid's base lines, given canvas zoom. A 1' grid
// zoomed out to 40% draws 30x as many lines as it needs to communicate scale — coarsen it as
// you zoom out (5' below 60%, 10' below 40%) so it reads as a scale reference instead of
// noise, mirroring the grid's existing zoom-IN refinement (3" cells at 1.5x, 1" at 3x).
export function gridStepFeet(zoom) {
  return zoom < 0.4 ? 10 : zoom < 0.6 ? 5 : 1;
}
