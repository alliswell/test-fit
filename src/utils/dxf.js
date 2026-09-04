// ─── DXF export ──────────────────────────────────────────────────────────────
// Pure: turns the plan model into an AutoCAD R12 (AC1009) ASCII DXF — the most widely
// readable flavour (AutoCAD, Revit, Vectorworks, SketchUp, Illustrator, LibreCAD…).
// Units are FEET (1 drawing unit = 1 ft); the plan's y-down pixel space is flipped to
// DXF's y-up. Entities land on conventional AIA-style layers so a consultant can turn
// off what they don't need. Only R12 primitives are used (LINE / POLYLINE+VERTEX /
// CIRCLE / ARC / TEXT) — no LWPOLYLINE, no DIMENSION objects — for maximum compatibility.
import { computeWallFootprints, wallSolidRuns } from "../imports/geometry";
import { SPEC_COMPONENTS } from "../constants/specs";

// Layer → ACI colour index (1 red, 2 yellow, 3 green, 4 cyan, 5 blue, 6 magenta,
// 7 white/black, 8 gray, 30 orange).
export const DXF_LAYERS = {
  "A-WALL": 7, "A-WALL-CNTR": 8, "A-DOOR": 30, "A-GLAZ": 4, "S-COLS": 7,
  "A-AREA": 3, "A-FLOR": 8, "A-FURN": 30, "A-FLOW": 5,
  "A-ANNO-TEXT": 7, "A-ANNO-DIMS": 1, "A-ANNO-REVC": 1,
  "E-POWR": 2, "T-DATA": 5, "A-AV": 6, "M-HVAC": 3, "E-SECU": 1,
};
const MARKER_LAYER = { power: "E-POWR", it: "T-DATA", av: "A-AV", mep: "M-HVAC", security: "E-SECU" };

// Feet-and-inches label, same convention as the plan's dimension strings.
export function formatFtIn(px, pxPerFoot) {
  const v = px / pxPerFoot; const w = Math.floor(v), inc = Math.round((v - w) * 12);
  if (inc === 0) return `${w}'-0"`; if (inc === 12) return `${w + 1}'-0"`;
  return `${w}'-${inc}"`;
}

const num = (n) => {
  const r = Math.round(n * 10000) / 10000;
  return Object.is(r, -0) ? "0" : String(r);
};
// DXF TEXT can't hold control chars; keep it single-line and ASCII-safe.
const esc = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").replace(/[^\x20-\x7E]/g, "?");

class DxfWriter {
  constructor(pxPerFoot) { this.ppf = pxPerFoot; this.out = []; this.counts = {}; this.ext = null; }
  x(px) { return px / this.ppf; }
  y(px) { return -px / this.ppf; }
  pt(p) { const x = this.x(p.x), y = this.y(p.y); this.bump(x, y); return [x, y]; }
  bump(x, y) {
    if (!this.ext) this.ext = { x0: x, y0: y, x1: x, y1: y };
    else { const e = this.ext; e.x0 = Math.min(e.x0, x); e.y0 = Math.min(e.y0, y); e.x1 = Math.max(e.x1, x); e.y1 = Math.max(e.y1, y); }
  }
  tag(code, value) { this.out.push(String(code), String(value)); }
  entity(type, layer) { this.tag(0, type); this.tag(8, layer); this.counts[type] = (this.counts[type] || 0) + 1; }
  line(layer, a, b) {
    const [x1, y1] = this.pt(a), [x2, y2] = this.pt(b);
    this.entity("LINE", layer);
    this.tag(10, num(x1)); this.tag(20, num(y1)); this.tag(30, 0);
    this.tag(11, num(x2)); this.tag(21, num(y2)); this.tag(31, 0);
  }
  polyline(layer, pts, closed) {
    if (!pts || pts.length < 2) return;
    this.entity("POLYLINE", layer);
    this.tag(66, 1); this.tag(70, closed ? 1 : 0);
    this.tag(10, 0); this.tag(20, 0); this.tag(30, 0);
    for (const p of pts) {
      const [x, y] = this.pt(p);
      this.tag(0, "VERTEX"); this.tag(8, layer);
      this.tag(10, num(x)); this.tag(20, num(y)); this.tag(30, 0);
    }
    this.tag(0, "SEQEND"); this.tag(8, layer);
  }
  circle(layer, c, rPx) {
    const [x, y] = this.pt(c); const r = rPx / this.ppf;
    this.bump(x - r, y - r); this.bump(x + r, y + r);
    this.entity("CIRCLE", layer);
    this.tag(10, num(x)); this.tag(20, num(y)); this.tag(30, 0); this.tag(40, num(r));
  }
  // Angles in DEGREES, counter-clockwise in DXF (y-up) space.
  arc(layer, c, rPx, startDeg, endDeg) {
    const [x, y] = this.pt(c); const r = rPx / this.ppf;
    this.bump(x - r, y - r); this.bump(x + r, y + r);
    this.entity("ARC", layer);
    this.tag(10, num(x)); this.tag(20, num(y)); this.tag(30, 0); this.tag(40, num(r));
    this.tag(50, num(startDeg)); this.tag(51, num(endDeg));
  }
  // Centre-justified text; `hPx` is the cap height in plan px, `rotDeg` in DXF space.
  text(layer, c, hPx, str, rotDeg = 0) {
    const s = esc(str).trim(); if (!s) return;
    const [x, y] = this.pt(c);
    this.entity("TEXT", layer);
    this.tag(10, num(x)); this.tag(20, num(y)); this.tag(30, 0);
    this.tag(40, num(Math.max(0.05, hPx / this.ppf)));
    this.tag(1, s);
    if (rotDeg) this.tag(50, num(rotDeg));
    this.tag(72, 1); this.tag(73, 2); // centre / middle, anchored at the second alignment point
    this.tag(11, num(x)); this.tag(21, num(y)); this.tag(31, 0);
  }
  header() {
    const e = this.ext || { x0: 0, y0: 0, x1: 0, y1: 0 };
    const h = [];
    const t = (c, v) => h.push(String(c), String(v));
    t(0, "SECTION"); t(2, "HEADER");
    t(9, "$ACADVER"); t(1, "AC1009");
    t(9, "$EXTMIN"); t(10, num(e.x0)); t(20, num(e.y0)); t(30, 0);
    t(9, "$EXTMAX"); t(10, num(e.x1)); t(20, num(e.y1)); t(30, 0);
    t(0, "ENDSEC");
    // TABLES: line types + layers + text style — readers choke on a LAYER that names an
    // LTYPE or STYLE the file never declares, so all three are spelled out.
    t(0, "SECTION"); t(2, "TABLES");
    t(0, "TABLE"); t(2, "LTYPE"); t(70, 1);
    t(0, "LTYPE"); t(2, "CONTINUOUS"); t(70, 0); t(3, "Solid line"); t(72, 65); t(73, 0); t(40, 0);
    t(0, "ENDTAB");
    const layers = Object.entries(DXF_LAYERS);
    t(0, "TABLE"); t(2, "LAYER"); t(70, layers.length);
    for (const [name, color] of layers) { t(0, "LAYER"); t(2, name); t(70, 0); t(62, color); t(6, "CONTINUOUS"); }
    t(0, "ENDTAB");
    t(0, "TABLE"); t(2, "STYLE"); t(70, 1);
    t(0, "STYLE"); t(2, "STANDARD"); t(70, 0); t(40, 0); t(41, 1); t(50, 0); t(71, 0); t(42, 0.2); t(3, "txt"); t(4, "");
    t(0, "ENDTAB");
    t(0, "ENDSEC");
    return h;
  }
  finish() {
    const body = this.out;
    const lines = [...this.header(), "0", "SECTION", "2", "ENTITIES", ...body, "0", "ENDSEC", "0", "EOF"];
    return lines.join("\r\n") + "\r\n";
  }
}

const dxfAngle = (from, to, w) => { // degrees, in DXF (y-up) space
  const [fx, fy] = [w.x(from.x), w.y(from.y)], [tx, ty] = [w.x(to.x), w.y(to.y)];
  return ((Math.atan2(ty - fy, tx - fx) * 180) / Math.PI + 360) % 360;
};

// buildDxf(model, opts) → DXF string.
//   model: { nodes, walls, doors, windows, columns, zones, floorRegions, furniture,
//            markers, labels, dims, revClouds, flowPaths, pxPerFoot }
//   opts:  { wallHalfT(w) → px  (required: half the wall's thickness, kind-aware),
//            zoneLibrary (for zone names),
//            resolveDim(d) → {x1,y1,x2,y2}  (optional: anchored dim endpoints) }
// Returns { dxf, counts } — counts is the per-entity-type tally, for the toast.
export function buildDxf(model, opts = {}) {
  const ppf = model.pxPerFoot || 20;
  const w = new DxfWriter(ppf);
  const nodes = model.nodes || [], walls = model.walls || [];
  const doors = model.doors || [], windows = model.windows || [], columns = model.columns || [];
  const halfTOf = opts.wallHalfT || (() => (5 / 12) * ppf / 2);
  const inToPx = (inches) => (inches / 12) * ppf;

  // ── Walls: mitered footprint edges per solid run (openings cut), + centerlines ──
  const fps = computeWallFootprints(walls, nodes, { halfTOf });
  const openings = [...doors, ...windows];
  for (const wall of walls) {
    const fp = fps.get(wall.id); if (!fp) continue;
    const c = fp.c, dx = c.x2 - c.x1, dy = c.y2 - c.y1;
    const { halfT, nx, ny, mN1, mN2 } = fp;
    const { segs } = wallSolidRuns(c, openings, ppf);
    segs.forEach(seg => {
      const ax = c.x1 + seg.t0 * dx, ay = c.y1 + seg.t0 * dy;
      const bx = c.x1 + seg.t1 * dx, by = c.y1 + seg.t1 * dy;
      const isFirst = seg.t0 === 0, isLast = seg.t1 === 1;
      const sL = isFirst ? mN1.L : { x: ax + nx * halfT, y: ay + ny * halfT };
      const sR = isFirst ? mN1.R : { x: ax - nx * halfT, y: ay - ny * halfT };
      const eL = isLast ? mN2.L : { x: bx + nx * halfT, y: by + ny * halfT };
      const eR = isLast ? mN2.R : { x: bx - nx * halfT, y: by - ny * halfT };
      w.line("A-WALL", sL, eL);
      w.line("A-WALL", sR, eR);
      // End caps: at a free end, and at every opening jamb.
      if (!isFirst || mN1.free) w.line("A-WALL", sL, sR);
      if (!isLast || mN2.free) w.line("A-WALL", eL, eR);
    });
    w.line("A-WALL-CNTR", { x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 });
  }

  // ── Doors: leaf line + swing arc (same construction as the plan's DoorSvg) ──
  for (const d of doors) {
    const wpx = inToPx(d.width || 36);
    const rad = ((d.angle || 0) * Math.PI) / 180;
    const wdx = Math.cos(rad), wdy = Math.sin(rad), pdx = -wdy, pdy = wdx;
    const hingeSide = d.hingeRight ? 1 : -1, swingDir = d.flipped ? -1 : 1;
    const h = { x: d.x + wdx * (wpx / 2) * hingeSide, y: d.y + wdy * (wpx / 2) * hingeSide };
    if (d.doorType === "Case Opening") {
      w.line("A-DOOR", { x: d.x - wdx * wpx / 2, y: d.y - wdy * wpx / 2 }, { x: d.x + wdx * wpx / 2, y: d.y + wdy * wpx / 2 });
      continue;
    }
    const e = { x: h.x + pdx * wpx * swingDir, y: h.y + pdy * wpx * swingDir };
    const f = { x: h.x - wdx * wpx * hingeSide, y: h.y - wdy * wpx * hingeSide };
    w.line("A-DOOR", h, e);
    // DXF arcs run counter-clockwise; pick the ordering that covers the 90° swing.
    const a1 = dxfAngle(h, f, w), a2 = dxfAngle(h, e, w);
    const ccw = (a2 - a1 + 360) % 360;
    if (ccw <= 180) w.arc("A-DOOR", h, wpx, a1, a2); else w.arc("A-DOOR", h, wpx, a2, a1);
  }

  // ── Windows: glazing line + two jamb ticks across the wall thickness ──
  for (const win of windows) {
    const wpx = inToPx(win.width || 36);
    const rad = ((win.angle || 0) * Math.PI) / 180;
    const dx = Math.cos(rad) * wpx / 2, dy = Math.sin(rad) * wpx / 2;
    const nx = -Math.sin(rad) * 3, ny = Math.cos(rad) * 3;
    const a = { x: win.x - dx, y: win.y - dy }, b = { x: win.x + dx, y: win.y + dy };
    w.line("A-GLAZ", a, b);
    w.line("A-GLAZ", { x: a.x + nx, y: a.y + ny }, { x: a.x - nx, y: a.y - ny });
    w.line("A-GLAZ", { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny });
  }

  // ── Columns ──
  for (const col of columns) {
    const r = inToPx(col.size || 12) / 2;
    if (col.shape === "circle") w.circle("S-COLS", col, r);
    else w.polyline("S-COLS", [{ x: col.x - r, y: col.y - r }, { x: col.x + r, y: col.y - r }, { x: col.x + r, y: col.y + r }, { x: col.x - r, y: col.y + r }], true);
    if (col.label) w.text("A-ANNO-TEXT", { x: col.x, y: col.y - r - 6 }, 8, col.label);
  }

  // ── Zones (program areas) + floor regions ──
  const zoneLib = opts.zoneLibrary || {};
  const polyPts = (z) => z.points || [{ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y }, { x: z.x + z.w, y: z.y + z.h }, { x: z.x, y: z.y + z.h }];
  const centroid = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
  const areaSf = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; a += pts[i].x * pts[j].y - pts[j].x * pts[i].y; } return Math.round(Math.abs(a) / 2 / (ppf * ppf)); };
  for (const z of model.zones || []) {
    const pts = polyPts(z); if (pts.length < 3) continue;
    w.polyline("A-AREA", pts, true);
    const c = centroid(pts);
    w.text("A-AREA", { x: c.x, y: c.y - 6 }, 10, z.label || zoneLib[z.type]?.name || z.type);
    w.text("A-AREA", { x: c.x, y: c.y + 8 }, 9, `${areaSf(pts)} SF`);
  }
  for (const fr of model.floorRegions || []) {
    if (!fr.points || fr.points.length < 3) continue;
    w.polyline("A-FLOR", fr.points, true);
    if (fr.label) w.text("A-FLOR", centroid(fr.points), 10, fr.label);
  }

  // ── Furniture: rotated w×d footprint ──
  for (const f of model.furniture || []) {
    const a = f.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
    const hw = (f.w * ppf) / 2, hd = (f.d * ppf) / 2;
    const corner = (sx, sy) => ({ x: f.x + sx * hw * ca - sy * hd * sa, y: f.y + sx * hw * sa + sy * hd * ca });
    w.polyline("A-FURN", [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], true);
    if (f.label) w.text("A-FURN", f, 7, f.label);
  }

  // ── IT/MEP markers: circle + designation letter, on the layer for their discipline ──
  for (const m of model.markers || []) {
    const layer = MARKER_LAYER[m.layer] || "E-POWR";
    const comp = SPEC_COMPONENTS[m.layer]?.[m.componentType];
    w.circle(layer, m, ppf * 0.4);
    w.text(layer, m, 7, comp?.letter || comp?.name?.[0] || "?");
  }

  // ── Annotations: labels (+ leaders), dimension strings, rev clouds, flow paths ──
  for (const l of model.labels || []) {
    const lines = String(l.text || "").split(/\r?\n/);
    const fs = l.fontSize || 12, lh = fs * 1.3;
    lines.forEach((ln, i) => w.text("A-ANNO-TEXT", { x: l.x, y: l.y + (i - (lines.length - 1) / 2) * lh }, fs, ln));
    if (l.lx != null && l.ly != null) w.line("A-ANNO-TEXT", { x: l.lx, y: l.ly }, { x: l.x, y: l.y });
  }
  const resolveDim = opts.resolveDim || ((d) => d);
  for (const d0 of model.dims || []) {
    const d = { ...d0, ...resolveDim(d0) };
    const dx = d.x2 - d.x1, dy = d.y2 - d.y1, len = Math.hypot(dx, dy);
    if (len < 2) continue;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const off = d.offset || 0, sign = off >= 0 ? 1 : -1, absOff = Math.abs(off);
    const p1 = { x: d.x1 + nx * off, y: d.y1 + ny * off }, p2 = { x: d.x2 + nx * off, y: d.y2 + ny * off };
    w.line("A-ANNO-DIMS", p1, p2);
    const gap = 4, over = 6;
    w.line("A-ANNO-DIMS", { x: d.x1 + nx * sign * gap, y: d.y1 + ny * sign * gap }, { x: d.x1 + nx * sign * (absOff + over), y: d.y1 + ny * sign * (absOff + over) });
    w.line("A-ANNO-DIMS", { x: d.x2 + nx * sign * gap, y: d.y2 + ny * sign * gap }, { x: d.x2 + nx * sign * (absOff + over), y: d.y2 + ny * sign * (absOff + over) });
    const tk = 5, tx = (ux + nx * sign) / Math.SQRT2, ty = (uy + ny * sign) / Math.SQRT2;
    w.line("A-ANNO-DIMS", { x: p1.x - tx * tk, y: p1.y - ty * tk }, { x: p1.x + tx * tk, y: p1.y + ty * tk });
    w.line("A-ANNO-DIMS", { x: p2.x - tx * tk, y: p2.y - ty * tk }, { x: p2.x + tx * tk, y: p2.y + ty * tk });
    let ang = dxfAngle(p1, p2, w); if (ang > 90 && ang <= 270) ang = (ang + 180) % 360;
    const mid = { x: (p1.x + p2.x) / 2 - nx * sign * 7, y: (p1.y + p2.y) / 2 - ny * sign * 7 };
    w.text("A-ANNO-DIMS", mid, 9, formatFtIn(len, ppf), ang);
  }
  for (const rc of model.revClouds || []) {
    if (!rc.points || rc.points.length < 3) continue;
    w.polyline("A-ANNO-REVC", rc.points, true);
    if (rc.label) w.text("A-ANNO-REVC", centroid(rc.points), 10, rc.label);
  }
  for (const fp of model.flowPaths || []) {
    if (!fp.points || fp.points.length < 2) continue;
    w.polyline("A-FLOW", fp.points, false);
    if (fp.label) w.text("A-FLOW", centroid(fp.points), 10, fp.label);
  }

  return { dxf: w.finish(), counts: w.counts };
}
