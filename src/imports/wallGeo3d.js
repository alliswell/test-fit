// ─── 3D wall solid geometry ──────────────────────────────────────────────────
// three-dependent helpers for the mitered-footprint wall solids. Imported ONLY by
// testfit3d.jsx so the lazy 3D chunk stays intact. The footprint math itself lives in
// geometry.js (shared with the 2D plan); this file turns those plan-px quads into
// extruded prisms with CSG-cut openings.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

// Transform footprint quad corners (plan px) into the wall's LOCAL frame — origin at
// the wall midpoint, +x along the wall — matching Wall3D's
// <group position={[midX,0,midZ]} rotation={[0,-angle,0]}>. Returns [{x,z}] in feet.
export function footprintToLocal(quad, mid, angle, pxPerFoot) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return quad.map(p => {
    const wx = (p.x - mid.x) / pxPerFoot, wz = (p.y - mid.y) / pxPerFoot;
    return { x: wx * ca + wz * sa, z: -wx * sa + wz * ca };
  });
}

// Degenerate-miter guard: a runaway/acute miter can fold the quad into a self-
// intersecting "butterfly". Convex + consistently wound quads are safe to extrude.
export function isSimpleConvexQuad(q) {
  if (!q || q.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return sign !== 0;
}

// Planar box-projection UVs by dominant normal axis, in LOCAL feet ÷ tile size — so
// brick/CMU tile at real-world scale on every face, including CSG reveal jambs.
export function applyBoxUVs(geo, tileX, tileY) {
  const pos = geo.getAttribute("position"), nrm = geo.getAttribute("normal");
  if (!pos || !nrm) return geo;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }        // top/bottom
    else if (ax >= az)        { u = z; v = y; }        // end caps / jamb returns
    else                      { u = x; v = y; }        // long faces
    uv[i * 2] = u / tileX; uv[i * 2 + 1] = v / tileY;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Extrude an (x,z) polygon up +y by heightFt, floor at y=0, outward normals.
// Shape space is (x, y) extruded along +z; rotateX(-π/2) then sends shape-z up to
// world +y and shape-y to world −z, so feed (x, −z) and enforce CCW winding for
// outward side normals (plan coords are y-down, which flips winding).
function extrudePolyXZ(poly, heightFt) {
  const pts = poly.map(p => ({ x: p.x, y: -p.z }));
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; area += pts[i].x * pts[j].y - pts[j].x * pts[i].y; }
  if (area < 0) pts.reverse();
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: heightFt, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Junction cap wedge solid: an (x,z)-feet polygon (from junctionCapPolys, converted by
// the caller to world feet) extruded to the junction's height.
export function buildCapSolidGeometry(polyXZ, heightFt, { tileFt = null } = {}) {
  if (!polyXZ || polyXZ.length < 3) return null;
  const geo = extrudePolyXZ(polyXZ, heightFt);
  if (tileFt) applyBoxUVs(geo, tileFt.x || 1, tileFt.y || 1);
  return geo;
}

// Shared CSG evaluator (module-level; stateless between evaluates).
const evaluator = new Evaluator();
evaluator.attributes = ["position", "normal", "uv"];
evaluator.useGroups = false;

// Build one wall's solid: the local-frame footprint quad extruded up +y by heightFt,
// minus a box per opening. cuts: [{x0, x1, y0, y1}] in local feet (x along the wall
// from the midpoint, y up from the floor). cutDepth must exceed the footprint's z
// extent (thickness + miter widening) so openings pierce fully.
// Falls back to the uncut prism if a CSG evaluate throws (rare numeric coplanarity).
export function buildWallSolidGeometry(localQuad, heightFt, cuts = [], { cutDepth = 4, tileFt = null } = {}) {
  let quad = localQuad;
  if (!isSimpleConvexQuad(quad)) {
    // butterfly after a runaway miter — extrude the unmitered bounding rect instead
    const xs = localQuad.map(p => p.x), zs = localQuad.map(p => p.z);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    quad = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  }
  let geo = extrudePolyXZ(quad, heightFt);

  if (cuts.length) {
    try {
      let brush = new Brush(geo);
      brush.updateMatrixWorld();
      for (const cut of cuts) {
        const w = cut.x1 - cut.x0, h = cut.y1 - cut.y0;
        if (w <= 0.01 || h <= 0.01) continue;
        const b = new Brush(new THREE.BoxGeometry(w, h, cutDepth));
        b.position.set((cut.x0 + cut.x1) / 2, (cut.y0 + cut.y1) / 2, 0);
        b.updateMatrixWorld();
        const next = evaluator.evaluate(brush, b, SUBTRACTION);
        brush.geometry.dispose(); b.geometry.dispose();
        brush = next;
      }
      geo = brush.geometry;
    } catch (err) {
      console.warn("wall CSG failed; rendering uncut prism", err);
      // `geo` may already be disposed (the first successful subtract disposes the
      // original extrude) — rebuild a fresh uncut prism rather than return a dead one.
      geo = extrudePolyXZ(quad, heightFt);
    }
  }
  if (tileFt) applyBoxUVs(geo, tileFt.x || 1, tileFt.y || 1);
  return geo;
}

// Crisp outline of a plain (non-CSG) solid — junction caps etc. Weld on POSITION ONLY:
// extrude output carries per-face UVs/normals that differ at shared positions, so a
// full-attribute mergeVertices leaves seams unwelded and EdgesGeometry emits them all.
// NOT usable on CSG output — its triangulation has T-vertices, whose edges stay
// unpaired no matter how you weld; walls use buildWallEdgeSegments instead.
export function solidEdgesGeometry(geo, thresholdDeg = 20) {
  const posOnly = new THREE.BufferGeometry();
  posOnly.setAttribute("position", geo.getAttribute("position").clone());
  const welded = mergeVertices(posOnly, 1e-4);
  const edges = new THREE.EdgesGeometry(welded, thresholdDeg);
  posOnly.dispose(); welded.dispose();
  return edges;
}

// Procedural wall outline: we know the wall's shape analytically (footprint quad ×
// height, minus rectangular cuts), so draw its edges directly — bottom/top loops,
// corner verticals, and an opening rectangle on each long face. Immune to CSG
// triangulation artifacts by construction.
// Returns { shell, openings } as SEPARATE geometries: the mono drawing system puts the
// wall silhouette and its joinery on different tiers, so they have to be colourable
// independently. `openings` is null when the wall has no cuts.
export function buildWallEdgeSegments(quad, heightFt, cuts = []) {
  const shellSegs = [], openSegs = [];
  const push = (arr, ax, ay, az, bx, by, bz) => arr.push(ax, ay, az, bx, by, bz);
  for (let i = 0; i < 4; i++) {
    const a = quad[i], b = quad[(i + 1) % 4];
    push(shellSegs, a.x, 0, a.z, b.x, 0, b.z);
    push(shellSegs, a.x, heightFt, a.z, b.x, heightFt, b.z);
    push(shellSegs, a.x, 0, a.z, a.x, heightFt, a.z);
  }
  // quad order is [mN1.L, mN2.L, mN2.R, mN1.R] → long faces are 0→1 and 3→2;
  // z varies linearly along a mitered face, so interpolate it at the cut's x extents.
  const sides = [[quad[0], quad[1]], [quad[3], quad[2]]];
  for (const cut of cuts) for (const [a, b] of sides) {
    const zAt = x => a.z + (b.z - a.z) * ((x - a.x) / ((b.x - a.x) || 1));
    const z0 = zAt(cut.x0), z1 = zAt(cut.x1);
    push(openSegs, cut.x0, cut.y0, z0, cut.x1, cut.y0, z1);
    push(openSegs, cut.x1, cut.y0, z1, cut.x1, cut.y1, z1);
    push(openSegs, cut.x1, cut.y1, z1, cut.x0, cut.y1, z0);
    push(openSegs, cut.x0, cut.y1, z0, cut.x0, cut.y0, z0);
  }
  const geo = (arr) => {
    if (!arr.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(arr), 3));
    return g;
  };
  return { shell: geo(shellSegs), openings: geo(openSegs) };
}
