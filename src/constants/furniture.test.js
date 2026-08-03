import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES, ZONE_FURNISH_PLAN, layoutZoneFurniture, tableChairs, newFurniture, furnitureHalfExtents, pointInFurniture } from "./furniture";

describe("furniture catalog", () => {
  it("every entry is well-formed and every category has members", () => {
    for (const [key, spec] of Object.entries(FURNITURE_CATALOG)) {
      expect(spec.type).toBe(key);
      expect(typeof spec.name).toBe("string");
      expect(spec.w).toBeGreaterThan(0);
      expect(spec.d).toBeGreaterThan(0);
      expect(typeof spec.draw).toBe("function");
      expect(FURNITURE_CATEGORIES.some(c => c.key === spec.cat)).toBe(true);
    }
    for (const c of FURNITURE_CATEGORIES) {
      expect(Object.values(FURNITURE_CATALOG).some(s => s.cat === c.key)).toBe(true);
    }
  });

  it("no beds remain in the system, and a floor lamp exists", () => {
    expect(Object.keys(FURNITURE_CATALOG).some(k => k.includes("bed"))).toBe(false);
    expect(FURNITURE_CATALOG.floor_lamp).toBeTruthy();
    expect(FURNITURE_CATALOG.floor_lamp.cat).toBe("misc");
  });

  it("draw() returns primitives scaled to the given W×D and never NaN", () => {
    for (const spec of Object.values(FURNITURE_CATALOG)) {
      const prims = spec.draw(spec.w * 20, spec.d * 20, spec.w, spec.d);
      expect(Array.isArray(prims)).toBe(true);
      expect(prims.length).toBeGreaterThan(0);
      const nums = JSON.stringify(prims).match(/-?\d+(\.\d+)?/g).map(Number);
      expect(nums.every(Number.isFinite)).toBe(true);
    }
  });

  it("parametric width: a wider sofa grows its seat count", () => {
    const narrow = FURNITURE_CATALOG.sofa.draw(6 * 20, 3 * 20, 6, 3).length;
    const wide = FURNITURE_CATALOG.sofa.draw(12 * 20, 3 * 20, 12, 3).length;
    expect(wide).toBeGreaterThan(narrow);
  });
});

describe("tableChairs — one seat per ~4 feet of table", () => {
  it("rectangular table: ~1 chair per 4' on each long side (+ ends when deep)", () => {
    // 12' × 4' → 3 per long side (×2 = 6) + 2 end chairs = 8 rect seats
    const chairs = tableChairs(12 * 20, 4 * 20, 12, 4);
    expect(chairs.every(c => c.t === "rect")).toBe(true);
    expect(chairs.length).toBe(8);
    // a 20' table seats more than a 8' one
    expect(tableChairs(20 * 20, 4 * 20, 20, 4).length).toBeGreaterThan(tableChairs(8 * 20, 4 * 20, 8, 4).length);
  });
  it("shallow rect table skips end chairs", () => {
    // 12' × 2.5' (ends too shallow to seat) → 3 per side × 2 = 6, no ends
    expect(tableChairs(12 * 20, 2.5 * 20, 12, 2.5).length).toBe(6);
  });
  it("round table: seats placed around the circle as circles", () => {
    const chairs = tableChairs(6 * 20, 6 * 20, 6, 6, { round: true });
    expect(chairs.every(c => c.t === "circle")).toBe(true);
    expect(chairs.length).toBeGreaterThanOrEqual(3);
  });
  it("returns nothing without real feet (px-only draw calls stay chair-free)", () => {
    expect(tableChairs(200, 80).length).toBe(0);
  });
});

describe("newFurniture", () => {
  it("stamps catalog defaults + given position", () => {
    const f = newFurniture("desk", 100, 200, "id1");
    expect(f).toMatchObject({ id: "id1", type: "desk", x: 100, y: 200, angle: 0, w: 5, d: 2.5 });
  });
  it("returns null for an unknown type", () => {
    expect(newFurniture("nope", 0, 0, "x")).toBeNull();
  });
});

describe("pointInFurniture (rotation-aware hit test)", () => {
  const ppf = 20;
  it("rect: inside vs outside", () => {
    const f = { type: "desk", x: 0, y: 0, angle: 0, w: 5, d: 2.5 }; // 100 × 50 px
    expect(pointInFurniture(f, 0, 0, ppf)).toBe(true);
    expect(pointInFurniture(f, 45, 20, ppf)).toBe(true);
    expect(pointInFurniture(f, 80, 0, ppf)).toBe(false); // past the 50px half-width
  });
  it("honours rotation: a point off the long axis is inside once rotated 90°", () => {
    const p = { x: 20, y: 45 }; // beyond half-depth (25px) but within half-width (50px)
    const flat = { type: "desk", x: 0, y: 0, angle: 0, w: 5, d: 2.5 };
    const turned = { ...flat, angle: Math.PI / 2 };
    expect(pointInFurniture(flat, p.x, p.y, ppf)).toBe(false);
    expect(pointInFurniture(turned, p.x, p.y, ppf)).toBe(true);
  });
  it("round pieces use an elliptical footprint", () => {
    const f = { type: "round_table", x: 0, y: 0, angle: 0, w: 5, d: 5 }; // r = 50px
    expect(pointInFurniture(f, 0, 49, ppf)).toBe(true);
    expect(pointInFurniture(f, 36, 36, ppf)).toBe(false); // corner is outside the circle
  });
  it("furnitureHalfExtents scales feet by pxPerFoot", () => {
    expect(furnitureHalfExtents({ w: 5, d: 2.5 }, 20)).toEqual({ hw: 50, hd: 25 });
  });
});

describe("ZONE_FURNISH_PLAN + layoutZoneFurniture", () => {
  const ppf = 20;
  it("every plan references only real catalog types", () => {
    for (const plan of Object.values(ZONE_FURNISH_PLAN))
      for (const { type, qty } of plan) { expect(FURNITURE_CATALOG[type]).toBeTruthy(); expect(qty).toBeGreaterThan(0); }
  });

  it("table-based zones list the table only (no separate chairs — chairs come with the table)", () => {
    for (const key of ["clubroom", "banquet"]) {
      const types = ZONE_FURNISH_PLAN[key].map(p => p.type);
      expect(types).toContain("conference_table");
      expect(types).not.toContain("task_chair"); // seats are drawn on the table
    }
  });

  it("lays out the plan's pieces with the right count and no overlaps", () => {
    const bbox = { x: 100, y: 100, w: 24 * ppf, h: 18 * ppf }; // a roomy 24'×18' zone
    const plan = ZONE_FURNISH_PLAN.softseating; // 1+2+1+1+2 = 7 pieces
    const placed = layoutZoneFurniture(bbox, plan, ppf);
    expect(placed.length).toBe(plan.reduce((s, p) => s + p.qty, 0));
    // no two pieces' w×d boxes overlap (packing reserves footprint + gap)
    const rect = (f) => ({ l: f.x - f.w * ppf / 2, r: f.x + f.w * ppf / 2, t: f.y - f.d * ppf / 2, b: f.y + f.d * ppf / 2 });
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      const a = rect(placed[i]), b = rect(placed[j]);
      const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      expect(overlap).toBe(false);
    }
    // the block is centred in the zone (centroid near the zone centre)
    const mx = placed.reduce((s, f) => s + f.x, 0) / placed.length;
    const my = placed.reduce((s, f) => s + f.y, 0) / placed.length;
    expect(Math.abs(mx - (bbox.x + bbox.w / 2))).toBeLessThan(bbox.w * 0.35);
    expect(Math.abs(my - (bbox.y + bbox.h / 2))).toBeLessThan(bbox.h * 0.35);
  });

  it("empty/unknown plan yields nothing", () => {
    expect(layoutZoneFurniture({ x: 0, y: 0, w: 200, h: 200 }, [], ppf)).toEqual([]);
    expect(layoutZoneFurniture({ x: 0, y: 0, w: 200, h: 200 }, undefined, ppf)).toEqual([]);
  });
});
