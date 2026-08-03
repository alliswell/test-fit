// ─── Furniture catalog (2D parametric) ───────────────────────────────────────
// The Furnish stage (workflow step 4) lets the user place furniture inside their zones.
// This first pass is 2D-only: each catalog entry is a PARAMETRIC top-down symbol — its
// footprint is driven by width×depth (feet), and a `draw(W, D, wFt, dFt)` fn returns
// primitive shapes (in a LOCAL frame centred at 0,0, +x = width, +y = depth, first two args
// in PX, last two in FEET for count-per-foot decisions like chairs) that scale with the
// piece. Furniture2D renders the base footprint (rect or ellipse) plus these detail
// primitives; the whole group is then translated to (x,y) and rotated by `angle`.
//
// Keep entries pure DATA + a draw fn (no React) so they're unit-testable and reusable by a
// future 3D pass. Dimensions are nominal real-world feet. `padFt` (optional) is how far the
// drawing may spill OUTSIDE the w×d box (e.g. chairs around a table) — the 3D floor decal
// expands its plane by this so nothing is clipped; the selection box / hit test stay w×d.
//
// Primitive shapes draw() may return:
//   { t: "rect",   x, y, w, h, r? }     top-left x/y, optional corner radius
//   { t: "line",   x1, y1, x2, y2 }
//   { t: "circle", cx, cy, r }
//   { t: "ellipse", cx, cy, rx, ry }
//   { t: "path",   d }                  raw SVG path (local px)
// A primitive may set `fill:false` to draw as outline only (default: light fill).

// Rounded-rect inset helper: a body outline inset by `m` px on every side.
const inset = (W, D, m, r = 0) => ({ t: "rect", x: -W / 2 + m, y: -D / 2 + m, w: W - 2 * m, h: D - 2 * m, r });

// Chairs around a table — roughly one seat per `every` feet of edge, drawn just OUTSIDE the
// table so the symbol reads as the real space a setting occupies. Rectangular tables get
// rounded-rect seats along both long sides (+ an end seat when the ends are deep enough);
// round tables space seats around the circle. Primitives are in the same centred local (px)
// frame. Real feet are required to count seats — px alone is scale-free.
export function tableChairs(W, D, wFt, dFt, { round = false, every = 4 } = {}) {
  if (!(wFt > 0) || !(dFt > 0)) return [];
  const ppf = W / wFt;
  const seat = 1.5 * ppf, deep = 1.35 * ppf, gap = 0.15 * ppf, r = deep * 0.22;
  const out = [];
  if (round) {
    const n = Math.max(3, Math.round((Math.PI * dFt) / every));
    const cr = Math.max(W, D) / 2 + gap + deep / 2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      out.push({ t: "circle", cx: Math.cos(ang) * cr, cy: Math.sin(ang) * cr, r: seat / 2 });
    }
    return out;
  }
  const n = Math.max(1, Math.round(wFt / every));           // seats per long side
  for (const sy of [-1, 1]) for (let i = 0; i < n; i++) {
    const cx = -W / 2 + (W * (i + 0.5)) / n;
    const y = sy === 1 ? D / 2 + gap : -D / 2 - gap - deep;
    out.push({ t: "rect", x: cx - seat / 2, y, w: seat, h: deep, r });
  }
  if (dFt >= 3.5) for (const sx of [-1, 1]) {                // an end seat on deep tables
    const x = sx === 1 ? W / 2 + gap : -W / 2 - gap - deep;
    out.push({ t: "rect", x, y: -seat / 2, w: deep, h: seat, r });
  }
  return out;
}

export const FURNITURE_CATALOG = {
  // ── Seating ────────────────────────────────────────────────────────────────
  task_chair: {
    type: "task_chair", name: "Task Chair", cat: "seating", w: 2, d: 2, round: false,
    draw: (W, D) => [
      { t: "rect", x: -W / 2 + W * 0.12, y: -D / 2 + D * 0.28, w: W * 0.76, h: D * 0.62, r: Math.min(W, D) * 0.18 },
      { t: "path", d: `M ${-W / 2 + W * 0.1} ${-D / 2 + D * 0.28} Q 0 ${-D / 2} ${W / 2 - W * 0.1} ${-D / 2 + D * 0.28}`, fill: false },
    ],
  },
  lounge_chair: {
    type: "lounge_chair", name: "Lounge Chair", cat: "seating", w: 2.8, d: 2.8, round: false,
    draw: (W, D) => [
      inset(W, D, Math.min(W, D) * 0.06, Math.min(W, D) * 0.14),
      { t: "rect", x: -W / 2 + W * 0.18, y: -D / 2 + D * 0.3, w: W * 0.64, h: D * 0.5, r: Math.min(W, D) * 0.1 },
      { t: "rect", x: -W / 2 + W * 0.06, y: -D / 2 + D * 0.18, w: W * 0.14, h: D * 0.64 },
      { t: "rect", x: W / 2 - W * 0.2, y: -D / 2 + D * 0.18, w: W * 0.14, h: D * 0.64 },
    ],
  },
  sofa: {
    type: "sofa", name: "Sofa", cat: "seating", w: 7, d: 3, round: false,
    draw: (W, D) => {
      const arm = Math.min(W * 0.1, D * 0.28);
      const seats = Math.max(2, Math.round((W - 2 * arm) / (D * 0.85)));
      const prims = [
        inset(W, D, Math.min(W, D) * 0.04, Math.min(W, D) * 0.1),
        { t: "rect", x: -W / 2 + arm * 0.3, y: -D / 2 + D * 0.06, w: W - arm * 0.6, h: D * 0.34, r: D * 0.08 },
        { t: "rect", x: -W / 2 + arm * 0.15, y: -D / 2 + D * 0.06, w: arm, h: D * 0.88, r: D * 0.08 },
        { t: "rect", x: W / 2 - arm * 1.15, y: -D / 2 + D * 0.06, w: arm, h: D * 0.88, r: D * 0.08 },
      ];
      const seatX0 = -W / 2 + arm * 1.3, seatW = (W - arm * 2.6) / seats;
      for (let i = 0; i < seats; i++)
        prims.push({ t: "rect", x: seatX0 + i * seatW + seatW * 0.06, y: -D / 2 + D * 0.42, w: seatW * 0.88, h: D * 0.5, r: D * 0.08 });
      return prims;
    },
  },
  stool: {
    type: "stool", name: "Stool", cat: "seating", w: 1.4, d: 1.4, round: true,
    draw: (W) => [{ t: "circle", cx: 0, cy: 0, r: W * 0.22 }],
  },

  // ── Tables (with chair settings) ─────────────────────────────────────────
  conference_table: {
    type: "conference_table", name: "Conference Table", cat: "tables", w: 10, d: 4, round: false, padFt: 1.7,
    draw: (W, D, wFt, dFt) => [
      { t: "rect", x: -W / 2, y: -D / 2, w: W, h: D, r: D / 2 }, // racetrack top
      ...tableChairs(W, D, wFt, dFt),
    ],
  },
  round_table: {
    type: "round_table", name: "Round Table", cat: "tables", w: 5, d: 5, round: true, padFt: 1.7,
    draw: (W, D, wFt, dFt) => [
      { t: "circle", cx: 0, cy: 0, r: W * 0.5 * 0.86 },
      ...tableChairs(W, D, wFt, dFt, { round: true }),
    ],
  },
  cafe_table: {
    type: "cafe_table", name: "Café Table (2-top)", cat: "tables", w: 2.5, d: 2.5, round: true, padFt: 1.6,
    draw: (W, D, wFt, dFt) => [
      { t: "circle", cx: 0, cy: 0, r: W * 0.32 },
      ...tableChairs(W, D, wFt, dFt, { round: true, every: 3.9 }),
    ],
  },
  coffee_table: {
    type: "coffee_table", name: "Coffee Table", cat: "tables", w: 4, d: 2, round: false,
    draw: (W, D) => [inset(W, D, 0, Math.min(W, D) * 0.1)],
  },
  side_table: {
    type: "side_table", name: "Side Table", cat: "tables", w: 1.6, d: 1.6, round: false,
    draw: (W, D) => [inset(W, D, 0, Math.min(W, D) * 0.16)], // small square, no chairs
  },

  // ── Desks ────────────────────────────────────────────────────────────────
  desk: {
    type: "desk", name: "Desk", cat: "desks", w: 5, d: 2.5, round: false,
    draw: (W, D) => [
      inset(W, D, 0, Math.min(W, D) * 0.04),
      { t: "line", x1: -W / 2, y1: D / 2 - D * 0.28, x2: W / 2, y2: D / 2 - D * 0.28 },
    ],
  },
  l_desk: {
    type: "l_desk", name: "L-Desk", cat: "desks", w: 6, d: 6, round: false,
    draw: (W, D) => {
      const t = Math.min(W, D) * 0.4;
      return [
        { t: "rect", x: -W / 2, y: -D / 2, w: W, h: t, r: 2 },
        { t: "rect", x: W / 2 - t, y: -D / 2, w: t, h: D, r: 2 },
      ];
    },
  },

  // ── Storage ──────────────────────────────────────────────────────────────
  bookshelf: {
    type: "bookshelf", name: "Bookshelf", cat: "storage", w: 3, d: 1, round: false,
    draw: (W, D) => [inset(W, D, 0, 1), { t: "line", x1: -W / 2, y1: 0, x2: W / 2, y2: 0 }],
  },
  credenza: {
    type: "credenza", name: "Credenza", cat: "storage", w: 5, d: 1.5, round: false,
    draw: (W, D) => {
      const prims = [inset(W, D, 0, 2)];
      for (let i = 1; i < 3; i++) prims.push({ t: "line", x1: -W / 2 + (W / 3) * i, y1: -D / 2, x2: -W / 2 + (W / 3) * i, y2: D / 2 });
      return prims;
    },
  },
  file_cabinet: {
    type: "file_cabinet", name: "File Cabinet", cat: "storage", w: 1.5, d: 2, round: false,
    draw: (W, D) => [inset(W, D, 0, 2), { t: "line", x1: -W / 2, y1: -D / 6, x2: W / 2, y2: -D / 6 }, { t: "line", x1: -W / 2, y1: D / 6, x2: W / 2, y2: D / 6 }],
  },

  // ── Accessories ──────────────────────────────────────────────────────────
  floor_lamp: {
    type: "floor_lamp", name: "Floor Lamp", cat: "misc", w: 1.5, d: 1.5, round: true,
    draw: (W) => [{ t: "circle", cx: 0, cy: 0, r: W * 0.5 * 0.9 }, { t: "circle", cx: 0, cy: 0, r: W * 0.12 }],
  },
  plant: {
    type: "plant", name: "Plant", cat: "misc", w: 2, d: 2, round: true,
    draw: (W) => [{ t: "circle", cx: 0, cy: 0, r: W * 0.42 }, { t: "circle", cx: 0, cy: 0, r: W * 0.16 }],
  },
};

// Category display order + labels for the palette.
export const FURNITURE_CATEGORIES = [
  { key: "seating", label: "Seating" },
  { key: "tables", label: "Tables" },
  { key: "desks", label: "Desks" },
  { key: "storage", label: "Storage" },
  { key: "misc", label: "Accessories" },
];

// ─── Zone furnish plans ──────────────────────────────────────────────────────
// What placeable furniture a zone TYPE should get from the "Furnish this zone" button.
// Curated from src/data/zone-library.json's `items` programs, but mapped to the 2D catalog
// and de-duplicated: catalog TABLES already draw their own chairs (see tableChairs), so a
// table-based zone lists just the table(s) — its seats come with the footprint — never
// separate chairs. Zones whose program is all built-ins/appliances (kitchen, restroom, IT
// closet) get no plan and the button is disabled for them. Keyed by zoneLibrary type id.
export const ZONE_FURNISH_PLAN = {
  entry:       [{ type: "desk", qty: 1 }, { type: "lounge_chair", qty: 2 }, { type: "plant", qty: 1 }],
  softseating: [{ type: "sofa", qty: 1 }, { type: "lounge_chair", qty: 2 }, { type: "coffee_table", qty: 1 }, { type: "side_table", qty: 1 }, { type: "floor_lamp", qty: 2 }],
  cafe:        [{ type: "cafe_table", qty: 3 }],                 // 2-tops → the 6 stools are the tables' chairs
  clubroom:    [{ type: "conference_table", qty: 1 }],           // 8 meeting chairs come with the table
  library:     [{ type: "conference_table", qty: 1 }, { type: "bookshelf", qty: 2 }],
  outdoor:     [{ type: "round_table", qty: 2 }, { type: "plant", qty: 3 }],
  banquet:     [{ type: "conference_table", qty: 2 }],           // banquet 8-tops w/ their chairs
  ops:         [{ type: "desk", qty: 2 }, { type: "task_chair", qty: 2 }, { type: "file_cabinet", qty: 2 }],
  storage:     [{ type: "bookshelf", qty: 3 }],
  // kitchen / restroom / itcloset → no placeable 2D furniture (schedule only)
};

// Arrange a zone's furnish plan inside its bounding box (world px). Shelf/row packing,
// deepest pieces first; each piece reserves its FULL footprint (w/d + 2·padFt for tables
// that carry chairs) plus a gap, so nothing overlaps. Each row is centred horizontally and
// the whole block is centred in the zone. Pieces that overflow a too-small zone still
// place (spilling past the edge) — the user enlarges the zone or deletes extras. Returns
// [{ type, x, y, angle:0, w, d }] in world px. Pure (no ids/side-effects).
export function layoutZoneFurniture(bbox, plan, pxPerFoot, { marginFt = 1, gapFt = 0.9 } = {}) {
  const items = [];
  for (const { type, qty } of plan || []) {
    const spec = FURNITURE_CATALOG[type]; if (!spec) continue;
    for (let i = 0; i < (qty || 1); i++) items.push({ type, w: spec.w, d: spec.d, pad: spec.padFt || 0 });
  }
  if (!items.length) return [];
  items.forEach(it => { it.fw = it.w + 2 * it.pad + gapFt; it.fd = it.d + 2 * it.pad + gapFt; }); // footprint + gap (ft)
  items.sort((a, b) => b.fd - a.fd);
  const innerWft = Math.max(1, bbox.w / pxPerFoot - 2 * marginFt);
  const rows = [];
  let row = { items: [], w: 0, d: 0 };
  for (const it of items) {
    if (row.items.length && row.w + it.fw > innerWft) { rows.push(row); row = { items: [], w: 0, d: 0 }; }
    row.w += it.fw; row.d = Math.max(row.d, it.fd); row.items.push(it);
  }
  if (row.items.length) rows.push(row);
  const blockH = rows.reduce((s, r) => s + r.d, 0);
  const cx = bbox.x + bbox.w / 2, cy = bbox.y + bbox.h / 2;
  const out = [];
  let yft = -blockH / 2;
  for (const r of rows) {
    let xft = -r.w / 2;
    for (const it of r.items) {
      out.push({ type: it.type, x: cx + (xft + it.fw / 2) * pxPerFoot, y: cy + (yft + it.fd / 2) * pxPerFoot, angle: 0, w: it.w, d: it.d });
      xft += it.fw;
    }
    yft += r.d;
  }
  return out;
}

// A freshly-placed instance's default fields for a given catalog type.
export function newFurniture(type, x, y, id) {
  const spec = FURNITURE_CATALOG[type];
  if (!spec) return null;
  return { id, type, x, y, angle: 0, w: spec.w, d: spec.d, label: "" };
}

// Half-extents (px) of a piece's footprint given its live w,d (feet) and scale.
// Used for hit-testing and the selection outline (the TABLE/box, not chair overflow).
export function furnitureHalfExtents(f, pxPerFoot) {
  return { hw: (f.w * pxPerFoot) / 2, hd: (f.d * pxPerFoot) / 2 };
}

// Point-in-footprint test in WORLD px, honouring the piece's rotation (radians).
export function pointInFurniture(f, px, py, pxPerFoot, pad = 0) {
  const { hw, hd } = furnitureHalfExtents(f, pxPerFoot);
  const dx = px - f.x, dy = py - f.y, a = -(f.angle || 0);
  const lx = dx * Math.cos(a) - dy * Math.sin(a);
  const ly = dx * Math.sin(a) + dy * Math.cos(a);
  if (FURNITURE_CATALOG[f.type]?.round) {
    const rx = hw + pad, ry = hd + pad;
    return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
  }
  return Math.abs(lx) <= hw + pad && Math.abs(ly) <= hd + pad;
}
