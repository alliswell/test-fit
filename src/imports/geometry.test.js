import { describe, it, expect } from "vitest";
import {
  wallResizeCursor, applySmartGuides, lineInt, wallMiterPt, revCloudPath, traceOuterBoundary,
  insetFloorPolygon, computeWallFootprints, junctionCapPolys, boundaryOutwardNormals,
  cutawayHiddenWalls, wallSideSign, markerDrawPos,
  polyCarryStart, applyPolyCarry, carryPolyWithNodes,
  contentBounds, fitTransform, viewportRect, centerViewOn, gridStepFeet, traceRoomLoops,
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

  // Overlapping footprints are invisible in 2D (flat fill, caps painted behind) but in 3D
  // they extrude into coplanar solids that z-fight — the junction flicker on orbit. So the
  // invariant has to be checked by area, not by shared corner points.
  describe("junctions tile: no wall overlaps another, and caps fill the rest", () => {
    const inPoly = (p, q) => {
      let c = false;
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
        const u = q[i], v = q[j];
        if (((u.y > p.y) !== (v.y > p.y)) && (p.x < (v.x - u.x) * (p.y - u.y) / (v.y - u.y) + u.x)) c = !c;
      }
      return c;
    };
    // Sample the 10×10 block around the junction at (200,0), inset off the boundary.
    const tally = (nodes, walls) => {
      const fps = computeWallFootprints(walls, nodes, { halfTOf: hOf5 });
      const quads = [...fps.values()].map(e => e.quad);
      const caps = junctionCapPolys([...fps.entries()].map(([id, e]) => ({ id, ...e }))).map(c => c.pts);
      let overlap = 0, gap = 0;
      for (let x = 195.4; x <= 204.6; x += 0.4) for (let y = -4.6; y <= 4.6; y += 0.4) {
        const p = { x, y };
        if (quads.filter(q => inPoly(p, q)).length > 1) overlap++;
        if (!quads.some(q => inPoly(p, q)) && !caps.some(c => inPoly(p, c))) gap++;
      }
      return { overlap, gap };
    };

    const J = { id: "j", x: 200, y: 0 };
    const cases = {
      "T (through-wall + partition)": [
        [{ id: "a", x: 0, y: 0 }, J, { id: "b", x: 400, y: 0 }, { id: "c", x: 200, y: 200 }],
        [{ id: "A", n1: "a", n2: "j" }, { id: "B", n1: "j", n2: "b" }, { id: "C", n1: "j", n2: "c" }]],
      // same T with each wall's nodes reversed — the L/R side test must not depend on which
      // end of the wall the junction is at
      "T, walls drawn the other way": [
        [{ id: "a", x: 0, y: 0 }, J, { id: "b", x: 400, y: 0 }, { id: "c", x: 200, y: 200 }],
        [{ id: "A", n1: "j", n2: "a" }, { id: "B", n1: "b", n2: "j" }, { id: "C", n1: "c", n2: "j" }]],
      "X (four-way)": [
        [{ id: "a", x: 0, y: 0 }, J, { id: "b", x: 400, y: 0 }, { id: "c", x: 200, y: 200 }, { id: "d", x: 200, y: -200 }],
        [{ id: "A", n1: "a", n2: "j" }, { id: "B", n1: "j", n2: "b" }, { id: "C", n1: "j", n2: "c" }, { id: "D", n1: "j", n2: "d" }]],
      "Y (three-way, non-orthogonal)": [
        [J, { id: "p", x: 200, y: 200 }, { id: "q", x: 27, y: -100 }, { id: "r", x: 373, y: -100 }],
        [{ id: "P", n1: "j", n2: "p" }, { id: "Q", n1: "j", n2: "q" }, { id: "R", n1: "j", n2: "r" }]],
      "L (two-wall corner)": [
        [{ id: "a", x: 0, y: 0 }, J, { id: "c", x: 200, y: 200 }],
        [{ id: "A", n1: "a", n2: "j" }, { id: "C", n1: "j", n2: "c" }]],
    };

    for (const [name, [nodes, walls]] of Object.entries(cases)) {
      it(name, () => {
        const { overlap, gap } = tally(nodes, walls);
        expect(overlap).toBe(0);
        expect(gap).toBe(0);
      });
    }
  });
});

describe("boundaryOutwardNormals — exterior normals from the loop, not the centroid", () => {
  // (nx,ny) close to a target — tolerant of −0 vs +0 from the perpendicular's sign flip.
  const isNormal = (n, x, y) => Math.abs(n.nx - x) < 1e-9 && Math.abs(n.ny - y) < 1e-9;

  // Square: every wall's outward normal points away from the middle (convex, so a
  // centroid test would also pass here — this pins the easy case).
  it("convex rectangle: normals point straight out on each side", () => {
    const nodes = [{ id: "tl", x: 0, y: 0 }, { id: "tr", x: 100, y: 0 }, { id: "br", x: 100, y: 100 }, { id: "bl", x: 0, y: 100 }];
    const walls = [{ id: "N", n1: "tl", n2: "tr" }, { id: "E", n1: "tr", n2: "br" }, { id: "S", n1: "br", n2: "bl" }, { id: "W", n1: "bl", n2: "tl" }];
    const nm = boundaryOutwardNormals(nodes, walls);
    expect(isNormal(nm.get("N"), 0, -1)).toBe(true); // up = out
    expect(isNormal(nm.get("S"), 0, 1)).toBe(true);
    expect(isNormal(nm.get("E"), 1, 0)).toBe(true);
    expect(isNormal(nm.get("W"), -1, 0)).toBe(true);
  });

  // L-shaped plan with a notch: the re-entrant wall's exterior side faces SOUTH, but the
  // node centroid sits to its south — the old centroid heuristic flipped it NORTH, which
  // hid it from the wrong corners in the isometric cutaway (a door happened to be on it).
  it("L-shape re-entrant wall: outward is the loop's outside, not away-from-centroid", () => {
    const nodes = [
      { id: "tl", x: 120, y: 80 }, { id: "bl", x: 120, y: 560 }, { id: "br", x: 420, y: 560 },
      { id: "in1", x: 420, y: 240 }, { id: "in2", x: 500, y: 240 }, { id: "tr", x: 500, y: 80 },
    ];
    const walls = [
      { id: "W", n1: "tl", n2: "bl" }, { id: "S", n1: "bl", n2: "br" }, { id: "E1", n1: "br", n2: "in1" },
      { id: "NOTCH", n1: "in1", n2: "in2" }, { id: "E2", n1: "in2", n2: "tr" }, { id: "N", n1: "tr", n2: "tl" },
    ];
    const nm = boundaryOutwardNormals(nodes, walls);
    // the notch's underside faces the outdoors to the south → +y, NOT −y
    expect(isNormal(nm.get("NOTCH"), 0, 1)).toBe(true);
    // and it must match the true south wall, so the cutaway hides them from the same corners
    expect(isNormal(nm.get("S"), 0, 1)).toBe(true);
    expect(isNormal(nm.get("N"), 0, -1)).toBe(true);
  });

  // Interior partitions are not on the boundary loop and so get no normal (only shell
  // walls are ever hidden by the cutaway).
  it("interior partition is skipped (not on the boundary)", () => {
    const nodes = [
      { id: "a", x: 0, y: 0 }, { id: "b", x: 200, y: 0 }, { id: "c", x: 200, y: 200 }, { id: "d", x: 0, y: 200 },
      { id: "m", x: 100, y: 0 }, { id: "n", x: 100, y: 200 },
    ];
    const walls = [
      { id: "N1", n1: "a", n2: "m" }, { id: "N2", n1: "m", n2: "b" }, { id: "E", n1: "b", n2: "c" },
      { id: "S", n1: "c", n2: "n" }, { id: "S2", n1: "n", n2: "d" }, { id: "W", n1: "d", n2: "a" },
      { id: "PART", n1: "m", n2: "n" },
    ];
    const nm = boundaryOutwardNormals(nodes, walls);
    expect(nm.has("PART")).toBe(false);
    expect(nm.has("N1")).toBe(true);
  });
});

describe("cutawayHiddenWalls — dollhouse cutaway on concave plans", () => {
  const CAM = { ne: [1, 1, -1], se: [1, 1, 1], sw: [-1, 1, 1], nw: [-1, 1, -1] };
  // L-shape with a door on the notch wall (DOOR) and windows on E1.
  const nodes = [
    { id: "tl", x: 120, y: 80 }, { id: "bl", x: 120, y: 560 }, { id: "br", x: 420, y: 560 },
    { id: "in1", x: 420, y: 240 }, { id: "in2", x: 500, y: 240 }, { id: "tr", x: 500, y: 80 },
  ];
  const walls = [
    { id: "W", n1: "tl", n2: "bl" }, { id: "S", n1: "bl", n2: "br" }, { id: "E1", n1: "br", n2: "in1" },
    { id: "DOOR", n1: "in1", n2: "in2" }, { id: "E2", n1: "in2", n2: "tr" }, { id: "N", n1: "tr", n2: "tl" },
  ];

  // "nearness" rule: hide a boundary wall whose midpoint is on the camera's side of the
  // node centroid. At the notch this drops a foreground wall even when its outward face
  // points away — which is what the user wanted for the door wall.
  it("drops the notch door wall when it is in the foreground (NE), keeps it when far (SW)", () => {
    // The door wall sits on the north side of the plan. From NE it is foreground → hidden;
    // from SW it is the far backdrop → shown. (A pure face-normal test did the opposite.)
    expect(cutawayHiddenWalls(nodes, walls, CAM.ne).has("DOOR")).toBe(true);
    expect(cutawayHiddenWalls(nodes, walls, CAM.sw).has("DOOR")).toBe(false);
  });

  it("hides the two walls actually facing the camera (SW → W & S)", () => {
    const h = cutawayHiddenWalls(nodes, walls, CAM.sw);
    expect(h.has("W")).toBe(true);
    expect(h.has("S")).toBe(true);
    expect(h.has("N")).toBe(false);  // far → stays
    expect(h.has("E2")).toBe(false); // far → stays
  });

  it("accepted trade-off: a perpendicular side wall can drop when its midpoint is near (SW window wall)", () => {
    // E1's midpoint is south-of-centre, so from SW it reads as foreground and drops — the
    // consequence the user chose (nearness over face-facing).
    expect(cutawayHiddenWalls(nodes, walls, CAM.sw).has("E1")).toBe(true);
  });

  it("only hides boundary walls; an interior partition always stays", () => {
    const pn = [...nodes, { id: "p1", x: 120, y: 320 }, { id: "p2", x: 420, y: 320 }];
    const pw = [...walls, { id: "PART", n1: "p1", n2: "p2" }];
    for (const v of Object.values(CAM)) {
      expect(cutawayHiddenWalls(pn, pw, v).has("PART")).toBe(false);
    }
  });
});

describe("wall-device display offset — outlets stand off the wall, into the room", () => {
  const PPF = 20;                       // plan px per foot
  const OFF = (3.5 / 12) * PPF + 12;    // half a 7" wall + the glyph radius
  const outlet = (over) => ({ componentType: "outlet_duplex", angle: 0, ...over });

  it("side sign follows which side of the wall the point is on", () => {
    // Horizontal wall through (100,100): local +y normal is (0,+1) = screen-down.
    expect(wallSideSign(100, 140, 100, 100, 0)).toBe(1);   // below → +1
    expect(wallSideSign(100, 60, 100, 100, 0)).toBe(-1);   // above → -1
    // Vertical wall (angle 90°): normal is (-1, 0), so a point to the LEFT is +1.
    const a = Math.PI / 2;
    expect(wallSideSign(60, 100, 100, 100, a)).toBe(1);
    expect(wallSideSign(140, 100, 100, 100, a)).toBe(-1);
  });

  it("offsets perpendicular to the wall, toward the stored side", () => {
    const below = markerDrawPos(outlet({ side: 1 }), 100, 100, PPF);
    expect(below.x).toBeCloseTo(100);       // no drift along the wall
    expect(below.y).toBeCloseTo(100 + OFF);
    const above = markerDrawPos(outlet({ side: -1 }), 100, 100, PPF);
    expect(above.y).toBeCloseTo(100 - OFF);
  });

  it("rotates the offset with the wall", () => {
    const p = markerDrawPos(outlet({ angle: Math.PI / 2, side: 1 }), 100, 100, PPF);
    expect(p.x).toBeCloseTo(100 - OFF);     // vertical wall pushes along -x
    expect(p.y).toBeCloseTo(100);
  });

  it("the click side round-trips: sign it, then draw toward the same point", () => {
    const side = wallSideSign(100, 130, 100, 100, 0); // clicked below the wall
    const p = markerDrawPos(outlet({ side }), 100, 100, PPF);
    expect(p.y).toBeGreaterThan(100);                // drawn below too
  });

  it("is identity without a side (markers placed before the offset existed)", () => {
    expect(markerDrawPos(outlet({}), 100, 100, PPF)).toEqual({ x: 100, y: 100 });
  });

  it("is identity for components that stay drawn on the wall", () => {
    for (const componentType of ["outlet_ceiling", "panel_board", "tstat", "it_rack", "light_can_4"]) {
      expect(markerDrawPos({ componentType, angle: 0, side: 1 }, 100, 100, PPF)).toEqual({ x: 100, y: 100 });
    }
  });

  it("sconces offset too — their symbol shows the wall AND the room they light", () => {
    const p = markerDrawPos({ componentType: "light_sconce", angle: 0, side: -1 }, 100, 100, PPF);
    expect(p.y).toBeCloseTo(100 - OFF);
  });

  it("scales the wall half-thickness with the plan, keeping the glyph clearance fixed", () => {
    const at20 = markerDrawPos(outlet({ side: 1 }), 0, 0, 20).y;
    const at40 = markerDrawPos(outlet({ side: 1 }), 0, 0, 40).y;
    expect(at40 - at20).toBeCloseTo((3.5 / 12) * 20); // only the wall term grew
  });
});

describe("polygon carry — a room's floor/zone follows the nodes it sits on", () => {
  // 10'×10' room at 20 px/ft; the floor's corners coincide with the wall nodes, which is
  // exactly what the rect-room tool produces (same scalars for both).
  const A = { id: "a", x: 0, y: 0 }, B = { id: "b", x: 200, y: 0 };
  const C = { id: "c", x: 200, y: 200 }, D = { id: "d", x: 0, y: 200 };
  const floor = () => ({ id: "f1", material: "Wood", phase: "existing", label: "",
    points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }] });
  const TOL = 20 / 48; // ¼" at 20 px/ft

  it("captures the vertices on the two nodes a wall drag moves", () => {
    const got = polyCarryStart([floor()], [B, C], TOL);
    expect(got).toHaveLength(2);
    expect(got.map(c => c.vertexIndex)).toEqual([1, 2]);
    expect(got.map(c => c.nodeId)).toEqual(["b", "c"]);
    expect(got[0]).toMatchObject({ polyId: "f1", x: 200, y: 0 }); // the vertex's OWN start
  });

  it("matches within tolerance and refuses anything a grid step away", () => {
    const near = { id: "b", x: 200.3, y: 0 }, far = { id: "b", x: 200.9, y: 0 };
    expect(polyCarryStart([floor()], [near], 0.5)).toHaveLength(1);
    expect(polyCarryStart([floor()], [far], 0.5)).toHaveLength(0);
    // one inch — the finest snap step — must never fuse at the ¼" tolerance
    expect(polyCarryStart([floor()], [{ id: "b", x: 200 + 20 / 12, y: 0 }], TOL)).toHaveLength(0);
  });

  it("carries every polygon sharing a vertex — two rooms on a shared wall both deform", () => {
    const right = { id: "f2", points: [{ x: 200, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 200 }, { x: 200, y: 200 }] };
    const got = polyCarryStart([floor(), right], [B], TOL);
    expect(got).toHaveLength(2);
    expect(got.map(c => c.polyId)).toEqual(["f1", "f2"]);
    expect(new Set(got.map(c => c.nodeId))).toEqual(new Set(["b"]));
  });

  it("honours excludeIds so a polygon being dragged wholesale doesn't move twice", () => {
    expect(polyCarryStart([floor()], [B, C], TOL, ["f1"])).toEqual([]);
    expect(polyCarryStart([floor()], [B, C], TOL, new Set(["f1"]))).toEqual([]);
  });

  it("returns nothing for an empty room or a polygon nowhere near the nodes", () => {
    expect(polyCarryStart([], [B], TOL)).toEqual([]);
    expect(polyCarryStart([floor()], [], TOL)).toEqual([]);
    expect(polyCarryStart([{ id: "far", points: [{ x: 900, y: 900 }] }], [B], TOL)).toEqual([]);
  });

  it("moves only the matched vertices, by each node's own delta (the trapezoid case)", () => {
    const polys = [floor()];
    const carry = polyCarryStart(polys, [B, C], TOL);
    const out = applyPolyCarry(polys, carry, (id) => id === "b" ? { dx: 10, dy: 0 } : { dx: 10, dy: 20 });
    expect(out[0].points[0]).toEqual({ x: 0, y: 0 });      // untouched
    expect(out[0].points[1]).toEqual({ x: 210, y: 0 });
    expect(out[0].points[2]).toEqual({ x: 210, y: 220 });
    expect(out[0].points[3]).toEqual({ x: 0, y: 200 });    // untouched
  });

  it("is idempotent — a TOTAL delta, never a per-frame increment", () => {
    const polys = [floor()];
    const carry = polyCarryStart(polys, [B, C], TOL);
    const d = () => ({ dx: 30, dy: 0 });
    expect(applyPolyCarry(applyPolyCarry(polys, carry, d), carry, d)).toEqual(applyPolyCarry(polys, carry, d));
  });

  it("returns the same array when nothing actually moves", () => {
    const polys = [floor()];
    expect(applyPolyCarry(polys, [], () => ({ dx: 5, dy: 5 }))).toBe(polys);
    const carry = polyCarryStart(polys, [B], TOL);
    expect(applyPolyCarry(polys, carry, () => ({ dx: 0, dy: 0 }))).toBe(polys);
    expect(applyPolyCarry(polys, carry, () => null)).toBe(polys);
  });

  it("leaves untouched polygons with their original identity, and preserves fields", () => {
    const keep = { id: "other", points: [{ x: 900, y: 900 }] };
    const polys = [floor(), keep];
    const out = applyPolyCarry(polys, polyCarryStart(polys, [B], TOL), () => ({ dx: 4, dy: 0 }));
    expect(out[1]).toBe(keep);                       // same reference
    expect(out[0]).not.toBe(polys[0]);
    expect(out[0]).toMatchObject({ id: "f1", material: "Wood", phase: "existing", label: "" });
    expect(out[0].points).toHaveLength(4);
  });

  it("carryPolyWithNodes composes the two halves", () => {
    const polys = [floor()];
    const d = () => ({ dx: 7, dy: -3 });
    expect(carryPolyWithNodes(polys, [B, C], d, TOL))
      .toEqual(applyPolyCarry(polys, polyCarryStart(polys, [B, C], TOL), d));
  });
});

describe("minimap — fitting the model into a box and locating the viewport", () => {
  const pts = [{ x: 100, y: 50 }, { x: 500, y: 50 }, { x: 500, y: 250 }, { x: 100, y: 250 }];

  it("bounds a point cloud, and reports nothing for an empty model", () => {
    expect(contentBounds(pts)).toMatchObject({ minX: 100, minY: 50, maxX: 500, maxY: 250, w: 400, h: 200 });
    expect(contentBounds([])).toBeNull();
    expect(contentBounds(null)).toBeNull();
  });

  it("fits with a UNIFORM scale so the overview keeps the model's proportions", () => {
    const b = contentBounds(pts);                       // 400×200, wider than tall
    const { s, ox, oy } = fitTransform(b, 200, 200, 10);
    expect(s).toBeCloseTo(180 / 400, 6);                // limited by width, not height
    // corners land inside the box, and the short axis is centred
    const at = (p) => ({ x: p.x * s + ox, y: p.y * s + oy });
    expect(at(pts[0]).x).toBeCloseTo(10, 6);
    expect(at(pts[1]).x).toBeCloseTo(190, 6);
    const top = at(pts[0]).y, bot = at(pts[2]).y;
    expect(top + bot).toBeCloseTo(200, 6);              // equal margin above and below
  });

  it("survives a degenerate model — a single point, or one straight wall", () => {
    expect(fitTransform(contentBounds([{ x: 5, y: 5 }]), 100, 100).s).toBe(1);
    const line = contentBounds([{ x: 0, y: 0 }, { x: 100, y: 0 }]);   // zero height
    const f = fitTransform(line, 100, 100, 10);
    expect(Number.isFinite(f.s)).toBe(true);
    expect(f.s).toBeCloseTo(80 / 100, 6);
    expect(contentBounds([])).toBeNull();
    expect(fitTransform(null, 100, 100)).toEqual({ s: 1, ox: 0, oy: 0 });
  });

  it("locates the on-screen rectangle in content space", () => {
    // The canvas draws content as p*zoom + viewOff, so the visible content starts where
    // that maps back to screen 0 and spans canvasSize/zoom.
    expect(viewportRect({ x: -200, y: -100 }, 2, 800, 600)).toEqual({ x: 100, y: 50, w: 400, h: 300 });
    expect(viewportRect({ x: 0, y: 0 }, 1, 800, 600)).toEqual({ x: 0, y: 0, w: 800, h: 600 });
    expect(viewportRect({ x: 0, y: 0 }, 0, 800, 600).w).toBe(800);   // zoom 0 doesn't divide by zero
  });

  it("centring is the exact inverse of locating — click a spot, it lands mid-canvas", () => {
    const zoom = 1.75, W = 900, H = 700, cx = 640, cy = 310;
    const vo = centerViewOn(cx, cy, zoom, W, H);
    const r = viewportRect(vo, zoom, W, H);
    expect(r.x + r.w / 2).toBeCloseTo(cx, 6);
    expect(r.y + r.h / 2).toBeCloseTo(cy, 6);
  });
});

describe("traceRoomLoops — every enclosed room, not just the outline", () => {
  // Helper: nodes from {id: [x,y]}, walls from ["a-b", …].
  const build = (npos, edges) => ({
    nodes: Object.entries(npos).map(([id, [x, y]]) => ({ id, x, y })),
    walls: edges.map((e, i) => ({ id: "w" + i, n1: e.split("-")[0], n2: e.split("-")[1] })),
  });
  const signed = (pts) => {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j].x * pts[i].y) - (pts[i].x * pts[j].y);
    return a / 2;
  };
  const areaOf = (pts) => Math.abs(signed(pts));

  it("a closed square is exactly one room — the outer face is dropped", () => {
    const { nodes, walls } = build(
      { a: [0, 0], b: [200, 0], c: [200, 200], d: [0, 200] },
      ["a-b", "b-c", "c-d", "d-a"],
    );
    const rooms = traceRoomLoops(nodes, walls);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].nodeIds.slice().sort()).toEqual(["a", "b", "c", "d"]);
    expect(areaOf(rooms[0].points)).toBeCloseTo(40000, 6);
    // A square's interior and exterior faces share a node set AND an absolute area, so the
    // winding is the only thing that distinguishes them — assert it, or this test passes
    // just as happily when the traversal hands back the outdoors.
    expect(signed(rooms[0].points)).toBeGreaterThan(0);
  });

  it("an open run of walls encloses nothing", () => {
    const { nodes, walls } = build(
      { a: [0, 0], b: [200, 0], c: [200, 200], d: [0, 200] },
      ["a-b", "b-c", "c-d"],            // missing d-a
    );
    expect(traceRoomLoops(nodes, walls)).toEqual([]);
  });

  it("a partition wall splits one outline into two rooms", () => {
    // Two 200x200 bays sharing the vertical m-n wall.
    const { nodes, walls } = build(
      { a: [0, 0], m: [200, 0], b: [400, 0], c: [400, 200], n: [200, 200], d: [0, 200] },
      ["a-m", "m-b", "b-c", "c-n", "n-d", "d-a", "m-n"],
    );
    const rooms = traceRoomLoops(nodes, walls);
    expect(rooms).toHaveLength(2);
    expect(rooms.map(r => areaOf(r.points)).sort((x, y) => x - y)).toEqual([40000, 40000]);
  });

  it("two separate wall groups each keep their own room, and neither outer face survives", () => {
    const { nodes, walls } = build(
      { a: [0, 0], b: [100, 0], c: [100, 100], d: [0, 100],
        e: [500, 500], f: [700, 500], g: [700, 700], h: [500, 700] },
      ["a-b", "b-c", "c-d", "d-a", "e-f", "f-g", "g-h", "h-e"],
    );
    const rooms = traceRoomLoops(nodes, walls);
    expect(rooms).toHaveLength(2);
    expect(rooms.map(r => areaOf(r.points)).sort((x, y) => x - y)).toEqual([10000, 40000]);
  });

  it("an L-shaped room traces as one face with all six corners", () => {
    const { nodes, walls } = build(
      { a: [0, 0], b: [200, 0], c: [200, 100], d: [100, 100], e: [100, 200], f: [0, 200] },
      ["a-b", "b-c", "c-d", "d-e", "e-f", "f-a"],
    );
    const rooms = traceRoomLoops(nodes, walls);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].points).toHaveLength(6);
    expect(areaOf(rooms[0].points)).toBeCloseTo(30000, 6);   // 200x100 + 100x100
  });

  it("a spur wall hanging off a room doesn't add or distort a room", () => {
    const { nodes, walls } = build(
      { a: [0, 0], b: [200, 0], c: [200, 200], d: [0, 200], s: [300, 0] },
      ["a-b", "b-c", "c-d", "d-a", "b-s"],   // b-s dangles outside
    );
    const rooms = traceRoomLoops(nodes, walls);
    expect(rooms).toHaveLength(1);
    expect(areaOf(rooms[0].points)).toBeCloseTo(40000, 6);
  });

  it("slivers below the area floor are ignored, and empty input is safe", () => {
    const { nodes, walls } = build(
      { a: [0, 0], b: [2, 0], c: [2, 1], d: [0, 1] },
      ["a-b", "b-c", "c-d", "d-a"],
    );
    expect(traceRoomLoops(nodes, walls, 100)).toEqual([]);   // 2sq px < 100
    expect(traceRoomLoops([], [])).toEqual([]);
    expect(traceRoomLoops(null, null)).toEqual([]);
  });
});

describe("gridStepFeet — plan grid coarsens as you zoom out", () => {
  it("is a 1' grid at normal and higher zoom", () => {
    expect(gridStepFeet(1)).toBe(1);
    expect(gridStepFeet(0.6)).toBe(1);
    expect(gridStepFeet(4)).toBe(1);
  });

  it("steps to 5' just below 60% zoom", () => {
    expect(gridStepFeet(0.59)).toBe(5);
    expect(gridStepFeet(0.4)).toBe(5);
  });

  it("steps to 10' below 40% zoom", () => {
    expect(gridStepFeet(0.39)).toBe(10);
    expect(gridStepFeet(0.15)).toBe(10); // the canvas's minimum zoom
  });
});
