import { describe, it, expect } from "vitest";
import {
  wallResizeCursor, applySmartGuides, lineInt, wallMiterPt, revCloudPath, traceOuterBoundary,
  insetFloorPolygon, computeWallFootprints, junctionCapPolys,
} from "./geometry";
import { polyArea } from "./model";

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

describe("insetFloorPolygon — clear inside-face outline", () => {
  // 10'×10' room at 20 px/ft, nodes on the wall centerlines; 7"-thick walls → halfT 5.8333px.
  const halfT = ((7 / 12) * 20) / 2;
  const nodes = [
    { id: "a", x: 0, y: 0 }, { id: "b", x: 200, y: 0 },
    { id: "c", x: 200, y: 200 }, { id: "d", x: 0, y: 200 },
  ];
  const square = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];
  const wallsAll = [
    { id: "w1", n1: "a", n2: "b" }, { id: "w2", n1: "b", n2: "c" },
    { id: "w3", n1: "c", n2: "d" }, { id: "w4", n1: "d", n2: "a" },
  ];
  const hOf = () => halfT;

  it("insets every walled edge by its half-thickness (4 walls → (W−t)×(H−t))", () => {
    const out = insetFloorPolygon(square, wallsAll, nodes, hOf);
    expect(polyArea(out)).toBeCloseTo((200 - 2 * halfT) ** 2, 1);
    // corners land exactly halfT in from both directions
    expect(out[0].x).toBeCloseTo(halfT, 3); expect(out[0].y).toBeCloseTo(halfT, 3);
    expect(out[2].x).toBeCloseTo(200 - halfT, 3); expect(out[2].y).toBeCloseTo(200 - halfT, 3);
  });

  it("only edges with a wall move — two opposite walls shrink one axis only", () => {
    const twoWalls = [{ id: "w2", n1: "b", n2: "c" }, { id: "w4", n1: "d", n2: "a" }]; // left + right
    const out = insetFloorPolygon(square, twoWalls, nodes, hOf);
    expect(polyArea(out)).toBeCloseTo((200 - 2 * halfT) * 200, 1);
  });

  it("no walls → polygon unchanged; reversed winding gives the same clear area", () => {
    const out = insetFloorPolygon(square, [], nodes, hOf);
    out.forEach((p, i) => { expect(p.x).toBeCloseTo(square[i].x, 6); expect(p.y).toBeCloseTo(square[i].y, 6); });
    const rev = [...square].reverse();
    expect(polyArea(insetFloorPolygon(rev, wallsAll, nodes, hOf))).toBeCloseTo((200 - 2 * halfT) ** 2, 1);
  });

  it("a wall split into collinear segments still insets its edge; missing nodes are skipped", () => {
    const nodes2 = [...nodes, { id: "m", x: 100, y: 0 }];
    const split = [
      { id: "wA", n1: "a", n2: "m" }, { id: "wB", n1: "m", n2: "b" }, // top edge in two pieces
      { id: "wX", n1: "ghost", n2: "b" },                             // dangling ref — ignored
    ];
    const out = insetFloorPolygon(square, split, nodes2, hOf);
    expect(polyArea(out)).toBeCloseTo(200 * (200 - halfT), 1); // only the top edge moved
  });
});

describe("computeWallFootprints — mitered wall quads", () => {
  const hOf5 = () => 5;
  const sameSet = (A, B, tol = 1e-6) =>
    A.length === B.length && A.every(p => B.some(q => Math.abs(p.x - q.x) < tol && Math.abs(p.y - q.y) < tol));

  it("L-corner: both walls agree on the same two shared corner points", () => {
    const nodes = [{ id: "a", x: 0, y: 0 }, { id: "j", x: 200, y: 0 }, { id: "b", x: 200, y: 200 }];
    const walls = [{ id: "A", n1: "a", n2: "j" }, { id: "B", n1: "j", n2: "b" }];
    const fps = computeWallFootprints(walls, nodes, { halfTOf: hOf5 });
    const aEnd = [fps.get("A").mN2.L, fps.get("A").mN2.R];
    const bStart = [fps.get("B").mN1.L, fps.get("B").mN1.R];
    expect(sameSet(aEnd, bStart)).toBe(true);
    // inner + outer diagonal pair of the 90° miter at (200,0), halfT 5
    aEnd.forEach(p => { expect([195, 205]).toContain(Math.round(p.x)); expect([-5, 5]).toContain(Math.round(p.y)); });
    expect(Math.round(aEnd[0].x) !== Math.round(aEnd[1].x) && Math.round(aEnd[0].y) !== Math.round(aEnd[1].y)).toBe(true);
  });

  it("45° corner and mixed thickness still yield shared points", () => {
    const nodes = [{ id: "a", x: 0, y: 0 }, { id: "j", x: 200, y: 0 }, { id: "b", x: 340, y: 140 }];
    const walls = [{ id: "A", n1: "a", n2: "j" }, { id: "B", n1: "j", n2: "b" }];
    const hOf = w => (w.id === "A" ? 5 : 3); // 7"-ish meets pony-ish
    const fps = computeWallFootprints(walls, nodes, { halfTOf: hOf });
    const aEnd = [fps.get("A").mN2.L, fps.get("A").mN2.R];
    const bStart = [fps.get("B").mN1.L, fps.get("B").mN1.R];
    expect(sameSet(aEnd, bStart, 1e-4)).toBe(true);
    aEnd.forEach(p => { expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true); });
  });

  it("collinear pass-through: no miter — plain rect ends, and no junction cap", () => {
    const nodes = [{ id: "a", x: 0, y: 0 }, { id: "j", x: 200, y: 0 }, { id: "b", x: 400, y: 0 }];
    const walls = [{ id: "A", n1: "a", n2: "j" }, { id: "B", n1: "j", n2: "b" }];
    const fps = computeWallFootprints(walls, nodes, { halfTOf: hOf5 });
    const m = fps.get("A").mN2;
    expect(Math.abs(m.L.x - 200) < 1e-6 && Math.abs(Math.abs(m.L.y) - 5) < 1e-6).toBe(true);
    expect(Math.abs(m.R.x - 200) < 1e-6 && Math.abs(Math.abs(m.R.y) - 5) < 1e-6).toBe(true);
    const caps = junctionCapPolys([{ id: "A", ...fps.get("A") }, { id: "B", ...fps.get("B") }]);
    expect(caps).toHaveLength(0);
  });

  it("open end: square cap at ±halfT, flagged free", () => {
    const nodes = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }];
    const fps = computeWallFootprints([{ id: "A", n1: "a", n2: "b" }], nodes, { halfTOf: hOf5 });
    const m = fps.get("A").mN2;
    expect(m.free).toBe(true);
    expect(m.L).toEqual({ x: 100, y: 5 });
    expect(m.R).toEqual({ x: 100, y: -5 });
  });

  it("coincident-but-unshared nodes within prox still miter", () => {
    const nodes = [
      { id: "a", x: 0, y: 0 }, { id: "j1", x: 200, y: 0 },
      { id: "j2", x: 204, y: 0 }, { id: "b", x: 204, y: 200 }, // 4px away, separate node
    ];
    const walls = [{ id: "A", n1: "a", n2: "j1" }, { id: "B", n1: "j2", n2: "b" }];
    const fps = computeWallFootprints(walls, nodes, { halfTOf: hOf5 });
    expect(fps.get("A").mN2.free).toBe(false); // neighbour found by proximity
    // mitered: at least one corner departs from the plain ±halfT rect end
    const m = fps.get("A").mN2;
    const plain = [{ x: 200, y: 5 }, { x: 200, y: -5 }];
    expect(sameSet([m.L, m.R], plain)).toBe(false);
  });

  it("T-junction: finite miters and a 3-wall junction cap wedge", () => {
    const nodes = [
      { id: "a", x: 0, y: 0 }, { id: "j", x: 200, y: 0 },
      { id: "b", x: 400, y: 0 }, { id: "c", x: 200, y: 200 },
    ];
    const walls = [
      { id: "A", n1: "a", n2: "j" }, { id: "B", n1: "j", n2: "b" }, { id: "C", n1: "j", n2: "c" },
    ];
    const fps = computeWallFootprints(walls, nodes, { halfTOf: hOf5 });
    for (const id of ["A", "B", "C"]) fps.get(id).quad.forEach(p => {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    });
    const caps = junctionCapPolys([...fps.entries()].map(([id, e]) => ({ id, ...e })));
    const tCap = caps.find(cp => Math.abs(cp.x - 200) <= 6 && Math.abs(cp.y) <= 6);
    expect(tCap).toBeTruthy();
    expect(tCap.wallIds.length).toBe(3);
    expect(tCap.pts.length).toBeGreaterThanOrEqual(3);
  });

  it("degenerate walls (missing node, <1px) are omitted", () => {
    const nodes = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 0.5, y: 0 }];
    const fps = computeWallFootprints(
      [{ id: "A", n1: "a", n2: "b" }, { id: "B", n1: "a", n2: "ghost" }],
      nodes, { halfTOf: hOf5 });
    expect(fps.size).toBe(0);
  });
});
