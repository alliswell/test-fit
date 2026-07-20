import { describe, it, expect } from "vitest";
import {
  sn, dst, ptSeg, polyArea, polyCentroid, pointInPoly, orthoSnap,
  isLightComponent, parseDimInput, migrateProjectData, PROJECT_VERSION, dedupeWalls,
  splitWallAtNode, mergeNode, splitWallThroughNodes, weldWallCrossings,
} from "./model";

describe("geometry", () => {
  it("dst — euclidean distance", () => {
    expect(dst(0, 0, 3, 4)).toBe(5);
    expect(dst(1, 1, 1, 1)).toBe(0);
  });

  it("ptSeg — distance from point to segment (clamped to endpoints)", () => {
    // point above the middle of a horizontal segment
    expect(ptSeg(5, 3, 0, 0, 10, 0)).toBe(3);
    // point beyond an endpoint clamps to that endpoint
    expect(ptSeg(-4, 0, 0, 0, 10, 0)).toBe(4);
    // degenerate segment (both ends equal) → distance to the point
    expect(ptSeg(3, 4, 0, 0, 0, 0)).toBe(5);
  });

  it("polyArea — shoelace, orientation-independent", () => {
    const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    expect(polyArea(square)).toBe(16);
    // reversed winding → same (absolute) area
    expect(polyArea([...square].reverse())).toBe(16);
  });

  it("polyCentroid — vertex average", () => {
    expect(polyCentroid([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]))
      .toEqual({ x: 2, y: 2 });
  });

  it("pointInPoly — ray casting", () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPoly(5, 5, square)).toBe(true);
    expect(pointInPoly(15, 5, square)).toBe(false);
    expect(pointInPoly(-1, 5, square)).toBe(false);
  });

  it("orthoSnap — locks to the dominant axis", () => {
    // mostly-horizontal drag → snaps Y to the anchor
    expect(orthoSnap(0, 0, 100, 12)).toEqual({ x: 100, y: 0 });
    // mostly-vertical drag → snaps X to the anchor
    expect(orthoSnap(0, 0, 12, 100)).toEqual({ x: 0, y: 100 });
    // exactly diagonal → horizontal wins (>= tie-break)
    expect(orthoSnap(0, 0, 50, 50)).toEqual({ x: 50, y: 0 });
  });

  it("sn — snap to grid", () => {
    expect(sn(7, 5)).toBe(5);
    expect(sn(8, 5)).toBe(10);
  });
});

describe("isLightComponent", () => {
  it("classifies lighting vs electrical component types", () => {
    expect(isLightComponent("light_recessed")).toBe(true);
    expect(isLightComponent("htrack_4")).toBe(true);
    expect(isLightComponent("light_sconce")).toBe(true);
    expect(isLightComponent("outlet_duplex")).toBeFalsy();
    expect(isLightComponent(undefined)).toBeFalsy();
  });
});

describe("dedupeWalls", () => {
  it("collapses a reversed-duplicate wall (same node pair) to one", () => {
    const walls = [
      { id: "a", n1: "p", n2: "q", kind: "existing" },
      { id: "b", n1: "q", n2: "p", kind: "existing" }, // reverse duplicate
      { id: "c", n1: "q", n2: "r", kind: "existing" },
    ];
    const out = dedupeWalls(walls);
    expect(out.map(w => w.id)).toEqual(["a", "c"]);
  });
  it("drops zero-length and malformed walls; keeps distinct segments", () => {
    expect(dedupeWalls([{ id: "z", n1: "p", n2: "p" }, { id: "x" }, null]).length).toBe(0);
    const ok = [{ id: "1", n1: "a", n2: "b" }, { id: "2", n1: "b", n2: "c" }];
    expect(dedupeWalls(ok)).toEqual(ok);
  });
  it("migrateProjectData dedupes walls", () => {
    const m = migrateProjectData({ walls: [{ id: "a", n1: "p", n2: "q" }, { id: "b", n1: "q", n2: "p" }] });
    expect(m.walls.length).toBe(1);
  });
});

describe("splitWallAtNode", () => {
  const ids = (() => { let i = 0; return () => "id" + (++i); })();
  it("splits a wall into two halves sharing the junction, copying props", () => {
    const walls = [{ id: "w", n1: "a", n2: "b", kind: "existing", material: "Brick" }];
    const out = splitWallAtNode(walls, "w", "j", ids);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ n1: "a", n2: "j", kind: "existing", material: "Brick" });
    expect(out[1]).toMatchObject({ n1: "j", n2: "b", kind: "existing", material: "Brick" });
    expect(out[0].id).not.toBe(out[1].id);     // fresh ids
    expect(out.find(w => w.id === "w")).toBeUndefined(); // original replaced
  });
  it("is a no-op when the junction is already an endpoint, or the wall is missing", () => {
    const walls = [{ id: "w", n1: "a", n2: "b" }];
    expect(splitWallAtNode(walls, "w", "a")).toBe(walls);
    expect(splitWallAtNode(walls, "nope", "j")).toBe(walls);
  });
});

describe("splitWallThroughNodes", () => {
  // "m" is on w's span and used by another wall; "orphan" is on the span but unused;
  // "far" is used but off the line.
  const nodes = [
    { id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 },
    { id: "m", x: 60, y: 0 }, { id: "far", x: 50, y: 30 }, { id: "orphan", x: 40, y: 0 },
  ];
  const base = [
    { id: "w", n1: "a", n2: "b", kind: "existing", material: "Brick" },
    { id: "other", n1: "m", n2: "far" },
  ];
  it("splits at a mid-span node, copying props; skips orphan and off-line nodes", () => {
    const out = splitWallThroughNodes(base, nodes, "w");
    expect(out).toHaveLength(3);
    const segs = out.filter(x => x.id !== "other");
    expect(segs[0]).toMatchObject({ n1: "a", n2: "m", kind: "existing", material: "Brick" });
    expect(segs[1]).toMatchObject({ n1: "m", n2: "b", kind: "existing", material: "Brick" });
    expect(out.some(x => x.n1 === "orphan" || x.n2 === "orphan")).toBe(false);
  });
  it("no-op (same identity) when nothing qualifies or the wall is missing", () => {
    const solo = [{ id: "w", n1: "a", n2: "b" }]; // "m" unused here → no split
    expect(splitWallThroughNodes(solo, nodes, "w")).toBe(solo);
    expect(splitWallThroughNodes(base, nodes, "nope")).toBe(base);
  });
  it("splits through multiple nodes in span order", () => {
    const ns = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 100, y: 0 }, { id: "p", x: 70, y: 0 }, { id: "q", x: 30, y: 0 }];
    const ws = [{ id: "w", n1: "a", n2: "b" }, { id: "x1", n1: "p", n2: "q" }];
    const chain = splitWallThroughNodes(ws, ns, "w").filter(x => x.id !== "x1").map(x => x.n1 + ">" + x.n2);
    expect(chain).toEqual(["a>q", "q>p", "p>b"]);
  });
});

describe("weldWallCrossings", () => {
  it("X-crossing: adds a node at the intersection and splits the crossed wall", () => {
    const nodes = [
      { id: "a", x: 0, y: 50 }, { id: "b", x: 100, y: 50 },   // horizontal (the new wall)
      { id: "c", x: 60, y: 0 }, { id: "d", x: 60, y: 100 },   // vertical (crossed)
    ];
    const walls = [{ id: "H", n1: "a", n2: "b" }, { id: "V", n1: "c", n2: "d" }];
    const out = weldWallCrossings(nodes, walls, "H");
    expect(out.nodes).toHaveLength(5);
    const j = out.nodes[4];
    expect([j.x, j.y]).toEqual([60, 50]);
    // V split into c–j and j–d; H untouched here (caller splits it through j)
    const vSegs = out.walls.filter(w => w.id !== "H");
    expect(vSegs.map(w => w.n1 + ">" + w.n2)).toEqual(["c>" + j.id, j.id + ">d"]);
    // then the standard through-nodes pass splits H at j
    const final = splitWallThroughNodes(out.walls, out.nodes, "H");
    expect(final).toHaveLength(4);
  });
  it("skips walls sharing a node, parallel walls, and end-touching (T) contacts", () => {
    const nodes = [
      { id: "a", x: 0, y: 50 }, { id: "b", x: 100, y: 50 },
      { id: "p", x: 0, y: 80 }, { id: "q", x: 100, y: 80 },  // parallel
      { id: "t", x: 40, y: 50 }, { id: "u", x: 40, y: 120 }, // T: touches H's line at its own END
    ];
    const walls = [
      { id: "H", n1: "a", n2: "b" },
      { id: "corner", n1: "b", n2: "q" },  // shares node b
      { id: "par", n1: "p", n2: "q" },
      { id: "tee", n1: "t", n2: "u" },
    ];
    const out = weldWallCrossings(nodes, walls, "H");
    expect(out.nodes).toBe(nodes);
    expect(out.walls).toBe(walls);
  });
});

describe("mergeNode", () => {
  it("re-points walls from src to tgt, drops the src node, and collapses degenerate/dup walls", () => {
    const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const walls = [
      { id: "1", n1: "a", n2: "c" }, // becomes b–c
      { id: "2", n1: "a", n2: "b" }, // becomes b–b → dropped (zero length)
      { id: "3", n1: "b", n2: "c" }, // duplicate of remapped #1 → deduped
    ];
    const out = mergeNode(nodes, walls, "a", "b");
    expect(out.nodes.map(n => n.id)).toEqual(["b", "c"]);
    expect(out.walls).toHaveLength(1);
    expect(out.walls[0]).toMatchObject({ n1: "b", n2: "c" });
  });
});

describe("parseDimInput", () => {
  it("parses feet-inches / inches / bare-feet to pixels", () => {
    const ppf = 20;
    expect(parseDimInput("1'0\"", ppf)).toBe(20);      // 1 ft
    expect(parseDimInput("3'6\"", ppf)).toBe(70);      // 3.5 ft
    expect(parseDimInput("6\"", ppf)).toBe(10);        // 6 in = 0.5 ft
    expect(parseDimInput("2", ppf)).toBe(40);          // bare number = feet
  });
  it("rejects empty / invalid / non-positive", () => {
    expect(parseDimInput("", 20)).toBeNull();
    expect(parseDimInput("abc", 20)).toBeNull();
    expect(parseDimInput("0", 20)).toBeNull();
  });
});

describe("migrateProjectData — the persistence seam", () => {
  it("normalizes an empty/garbage blob to a full default project", () => {
    const m = migrateProjectData(null);
    expect(m.version).toBe(PROJECT_VERSION);
    expect(m.projectName).toBe("Untitled");
    expect(m.nodes).toEqual([]);
    expect(m.walls).toEqual([]);
    expect(m.floorMaterial).toBe("Wood");
    expect(m.pxPerFoot).toBe(20);
    expect(m.showDims).toBe(true);
    expect(m.panes).toEqual([{ view: "plan" }]);
    expect(m.elevAnnotations).toEqual({});
    expect(m.lockedLayers).toEqual({});
    expect(m.snapshots).toEqual([]);
    expect(m.guides).toEqual([]);
  });

  it("defaults missing guides to [] and round-trips elevation cut guides", () => {
    expect(migrateProjectData({ nodes: [] }).guides).toEqual([]); // pre-v9 blob
    const guides = [{ id: "g1", dir: "front", pos: 120 }, { id: "g2", dir: "left", pos: -40 }];
    expect(migrateProjectData({ guides }).guides).toEqual(guides);
  });

  it("preserves a current-version payload round-trip", () => {
    const src = {
      projectName: "Lincoln park", nodes: [{ id: "a", x: 1, y: 2 }],
      walls: [{ id: "w", n1: "a", n2: "b", kind: "new" }],
      pxPerFoot: 24, showDims: false, panes: [{ view: "plan" }, { view: "3d" }],
      splitPos: 0.4, snapshots: [{ id: "s1", name: "A", ts: 1, data: {} }],
    };
    const m = migrateProjectData(src);
    expect(m.projectName).toBe("Lincoln park");
    expect(m.nodes).toEqual(src.nodes);
    expect(m.walls).toEqual(src.walls);
    expect(m.pxPerFoot).toBe(24);
    expect(m.showDims).toBe(false);
    expect(m.panes).toHaveLength(2);
    expect(m.splitPos).toBe(0.4);
    expect(m.snapshots).toHaveLength(1);
  });

  it("legacy: folds standalone `cutouts` into windows as Cut Openings", () => {
    const m = migrateProjectData({
      windows: [{ id: "win1", type: "Window" }],
      cutouts: [{ id: "cut1" }, { id: "cut2" }],
    });
    expect(m.windows).toHaveLength(3);
    expect(m.windows.filter(w => w.type === "Cut Opening")).toHaveLength(2);
    expect(m.windows[0]).toEqual({ id: "win1", type: "Window" });
  });

  it("legacy: migrates named `versions` → `snapshots`", () => {
    const m = migrateProjectData({
      versions: [{ id: "v1", name: "Schematic", ts: 100, data: { nodes: [] } }],
    });
    expect(m.snapshots).toHaveLength(1);
    expect(m.snapshots[0]).toMatchObject({ id: "v1", name: "Schematic", ts: 100 });
  });

  it("prefers existing snapshots over legacy versions when both present", () => {
    const m = migrateProjectData({
      snapshots: [{ id: "new", name: "Current", ts: 5, data: {} }],
      versions: [{ id: "old", name: "Legacy", ts: 1, data: {} }],
    });
    expect(m.snapshots).toHaveLength(1);
    expect(m.snapshots[0].id).toBe("new");
  });

  it("coerces wrong-typed scalar fields to safe defaults", () => {
    const m = migrateProjectData({ pxPerFoot: "nope", panes: [], bgOffset: 5, lockedLayers: "x" });
    expect(m.pxPerFoot).toBe(20);
    expect(m.panes).toEqual([{ view: "plan" }]);
    expect(m.bgOffset).toEqual({ x: 0, y: 0 });
    expect(m.lockedLayers).toEqual({});
  });

  it("docs (v10): defaults slides to [] and docSettings to letter/landscape", () => {
    const m = migrateProjectData({ nodes: [] }); // pre-v10 blob
    expect(m.slides).toEqual([]);
    expect(m.docSettings).toEqual({ size: "letter", orientation: "landscape" });
  });

  it("docs (v14): parentId round-trips; bad refs cleared; children regroup after parents", () => {
    const m = migrateProjectData({ slides: [
      { id: "x", view: "plan", parentId: "a" },        // child listed before parent → regrouped
      { id: "a", view: "plan" },
      { id: "q", view: "plan", parentId: "missing" },  // orphan → top level
    ] });
    expect(m.slides.map(s => s.id)).toEqual(["a", "x", "q"]);
    expect(m.slides[1].parentId).toBe("a");
    expect(m.slides[2].parentId).toBeNull();
  });

  it("docs (v12/v13): budget + ffe data slides pass the view whitelist", () => {
    const m = migrateProjectData({ slides: [{ id: "b1", view: "budget", rect: null, cam3d: null }, { id: "f1", view: "ffe" }] });
    expect(m.slides).toHaveLength(2);
    expect(m.slides[0]).toMatchObject({ view: "budget", rect: null, cam3d: null });
    expect(m.slides[1]).toMatchObject({ view: "ffe", rect: null, cam3d: null });
  });

  it("docs (v15): title section slide round-trips subtitle + persisted collapsed state", () => {
    const m = migrateProjectData({ slides: [
      { id: "t1", view: "title", title: "Level 2", subtitle: "Tenant Improvements", collapsed: true },
      { id: "p1", view: "plan", parentId: "t1" },
    ] });
    expect(m.slides[0]).toMatchObject({ view: "title", title: "Level 2", subtitle: "Tenant Improvements", collapsed: true });
    expect(m.slides[1].parentId).toBe("t1"); // a real slide nests under the section
    // non-string subtitle → ""; collapsed defaults to false and only true persists as true
    expect(migrateProjectData({ slides: [{ id: "t2", view: "title", subtitle: 42 }] }).slides[0].subtitle).toBe("");
    expect(migrateProjectData({ slides: [{ id: "t3", view: "title" }] }).slides[0].collapsed).toBe(false);
    expect(migrateProjectData({ slides: [{ id: "t4", view: "title", collapsed: "yes" }] }).slides[0].collapsed).toBe(false);
  });

  it("elevation dims (v16): tagged dims scope to their cut; legacy untagged dims are dropped", () => {
    const m = migrateProjectData({ elevAnnotations: { front: {
      dims: [
        { id: "d1", x1: 0, y1: 0, x2: 100, y2: 0, offset: 10, cut: 700 }, // tagged → kept
        { id: "d2", x1: 0, y1: 0, x2: 50, y2: 0, offset: 10, cut: null }, // no-cut view → kept
        { id: "d3", x1: 0, y1: 0, x2: 30, y2: 0, offset: 10 },            // legacy untagged → dropped
      ],
      labels: [{ id: "l1", x: 5, y: 5, text: "keep" }],
    } } });
    const front = m.elevAnnotations.front;
    expect(front.dims.map(d => d.id)).toEqual(["d1", "d2"]);
    expect(front.labels).toHaveLength(1); // labels pass through untouched
  });

  it("docs (v11): preserves an explicit per-slide layer visibility object", () => {
    const m = migrateProjectData({ slides: [{ id: "s1", view: "plan", vis: { dims: false, elec: true } }] });
    expect(m.slides[0].vis).toEqual({ dims: false, elec: true });
    // non-object vis coerced to null (inherit)
    expect(migrateProjectData({ slides: [{ id: "s2", view: "plan", vis: "nope" }] }).slides[0].vis).toBeNull();
  });

  it("docs (v10): round-trips a populated slide and sanitizes junk", () => {
    const good = {
      id: "s1", name: "Plan 01", view: "plan", rect: { x: 0, y: 0, w: 400, h: 300 },
      cam3d: null, image: null, notes: [{ id: "n1", text: "hi", x: 10, y: 10 }],
      title: "Ground Floor", scaleText: "1/8\" = 1'-0\"", ts: 123,
    };
    const cam = { id: "s2", view: "3d", cam3d: { position: [1, 2, 3], target: [0, 0, 0], style3d: "detailed" }, image: "data:image/jpeg;base64,x" };
    const m = migrateProjectData({
      slides: [good, cam, { view: "sideways" }, "junk", null],
      docSettings: { size: "a0", orientation: "diagonal" },
    });
    expect(m.slides).toHaveLength(2); // invalid view + junk dropped
    expect(m.slides[0]).toMatchObject(good);
    expect(m.slides[0].vis).toBeNull(); // v11: missing vis → inherit
    expect(m.slides[1]).toMatchObject({ view: "3d", rect: null, cam3d: { style3d: "detailed" }, image: "data:image/jpeg;base64,x" });
    expect(typeof m.slides[1].ts).toBe("number");
    // invalid enums normalized
    expect(m.docSettings).toEqual({ size: "letter", orientation: "landscape" });
  });
});
