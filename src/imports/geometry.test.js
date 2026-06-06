import { describe, it, expect } from "vitest";
import {
  wallResizeCursor, applySmartGuides, lineInt, wallMiterPt, revCloudPath, traceOuterBoundary,
} from "./geometry";

describe("wallResizeCursor", () => {
  // The cursor points along the drag direction, which is PERPENDICULAR to the wall.
  it("maps a wall angle to its perpendicular resize cursor", () => {
    expect(wallResizeCursor(0, 0, 10, 0)).toBe("ns-resize");    // horizontal wall → drag N/S
    expect(wallResizeCursor(0, 0, 0, 10)).toBe("ew-resize");    // vertical wall → drag E/W
    expect(wallResizeCursor(0, 0, 10, 10)).toBe("nesw-resize"); // ↘ wall
    expect(wallResizeCursor(0, 0, 10, -10)).toBe("nwse-resize"); // ↗ wall
  });
  it("is direction-agnostic (angle mod 180)", () => {
    expect(wallResizeCursor(10, 0, 0, 0)).toBe("ns-resize");
  });
});

describe("applySmartGuides", () => {
  it("snaps to an aligned target within threshold and reports a guide", () => {
    const r = applySmartGuides(103, 50, [{ x: 100, y: 20 }, { x: 100, y: 80 }]);
    expect(r.x).toBe(100);                       // x snapped to the shared column
    expect(r.guides.some(g => g.axis === "v" && g.pos === 100)).toBe(true);
  });
  it("does not snap when no target is within threshold", () => {
    const r = applySmartGuides(50, 50, [{ x: 200, y: 200 }]);
    expect(r.x).toBe(50);
    expect(r.y).toBe(50);
    expect(r.guides).toHaveLength(0);
  });
  it("snaps both axes independently", () => {
    const r = applySmartGuides(102, 198, [{ x: 100, y: 0 }, { x: 0, y: 200 }]);
    expect(r.x).toBe(100);
    expect(r.y).toBe(200);
    expect(r.guides).toHaveLength(2);
  });
});

describe("lineInt", () => {
  it("intersects two crossing lines", () => {
    // horizontal line through (0,0) dir +x  ×  vertical line through (5,0) dir +y
    expect(lineInt(0, 0, 1, 0, 5, 0, 0, 1)).toEqual({ x: 5, y: 0 });
  });
  it("falls back to P when the lines are parallel", () => {
    expect(lineInt(0, 0, 1, 0, 0, 5, 1, 0)).toEqual({ x: 0, y: 0 });
  });
  it("falls back to P when |t| exceeds the cap", () => {
    // intersection would be far away; cap forces fallback
    expect(lineInt(0, 0, 1, 0, 1000, 0, 0.001, 1, 5)).toEqual({ x: 0, y: 0 });
  });
});

describe("wallMiterPt", () => {
  it("returns the miter corner of two perpendicular wall edges", () => {
    // Wall 1 runs +x, left-normal +y, half 5; Wall 2 runs +y, left-normal -x, half 5.
    // Left edges (side +1): wall1 offset +y to (0,5) heading +x; wall2 offset -x to (-5,0) heading +y.
    const p = wallMiterPt(0, 0, 1, 0, 0, 1, 5, 0, 1, -1, 0, 5, 1);
    expect(p.x).toBeCloseTo(-5);
    expect(p.y).toBeCloseTo(5);
  });
});

describe("revCloudPath", () => {
  it("returns empty for fewer than 3 points", () => {
    expect(revCloudPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 8)).toBe("");
  });
  it("builds a closed scalloped path with arc segments", () => {
    const d = revCloudPath([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }], 8);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
    expect(d).toContain(" A 8 8 ");        // arc bumps at the given radius
    expect((d.match(/ A /g) || []).length).toBeGreaterThan(4); // multiple bumps per edge
  });
});

describe("traceOuterBoundary", () => {
  const rect = {
    nodes: [
      { id: "a", x: 0, y: 0 }, { id: "b", x: 10, y: 0 },
      { id: "c", x: 10, y: 10 }, { id: "d", x: 0, y: 10 },
    ],
    walls: [
      { n1: "a", n2: "b" }, { n1: "b", n2: "c" },
      { n1: "c", n2: "d" }, { n1: "d", n2: "a" },
    ],
  };

  it("returns the ordered perimeter of a closed loop", () => {
    const out = traceOuterBoundary(rect.nodes, rect.walls);
    expect(out).not.toBeNull();
    expect(out).toHaveLength(4);
    expect(new Set(out.map(n => n.id))).toEqual(new Set(["a", "b", "c", "d"]));
  });
  it("returns null for an open chain (no closed loop)", () => {
    const out = traceOuterBoundary(
      [{ id: "a", x: 0, y: 0 }, { id: "b", x: 10, y: 0 }, { id: "c", x: 20, y: 0 }],
      [{ n1: "a", n2: "b" }, { n1: "b", n2: "c" }],
    );
    expect(out).toBeNull();
  });
  it("returns null for empty input", () => {
    expect(traceOuterBoundary([], [])).toBeNull();
    expect(traceOuterBoundary(null, null)).toBeNull();
  });
});
