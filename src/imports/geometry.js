// ─── Drawing geometry helpers ────────────────────────────────────────────────
// Pure (no React/three/DOM). Extracted from the main components so the subtle bits —
// wall mitering, alignment guides, the room-boundary face trace — can be unit-tested.

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
  const lN = info.filter(o => o.na > 0.02 && o.na < Math.PI - 0.02).sort((a, b) => a.na - b.na)[0];
  const rN = info.filter(o => o.na > Math.PI + 0.02).sort((a, b) => b.na - a.na)[0];
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
  const nbL = lN || rN, nbR = rN || lN;
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

// ─── Clear-inside floor outline ──────────────────────────────────────────────
// Inset a floor polygon (points on wall CENTERLINES, e.g. the rect-room auto floor)
// to the clear inside-face outline: each edge that has a wall running along it moves
// inward by that wall's half-thickness; edges with no wall stay put. Corners re-close
// by intersecting the shifted neighbor edges (miter), so the result is the polygon a
// tape measure would find between finished wall faces.
// halfTOf(wall) → half-thickness in px (kind/pony-aware; supplied by the caller so
// this stays free of theme/scale constants). Returns a NEW points array.
export function insetFloorPolygon(points, walls, nodes, halfTOf, tol = 1.5) {
  const n = points?.length || 0;
  if (n < 3) return points || [];
  const nodeMap = new Map((nodes || []).map(nd => [nd.id, nd]));
  // Signed shoelace sum decides which perpendicular points into the room: for a>0 the
  // left normal (-dy,dx) faces inward (screen coords, y down); for a<0 it's flipped.
  let a = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += points[i].x * points[j].y - points[j].x * points[i].y; }
  const inSign = a > 0 ? 1 : -1;

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
