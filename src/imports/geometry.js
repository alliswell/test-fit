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
