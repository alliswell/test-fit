import { describe, it, expect } from "vitest";
import { buildDxf, formatFtIn, DXF_LAYERS } from "./dxf";

const ppf = 20;
// A 20×10 ft room: 4 nodes, 4 walls, a door on the south wall, a window on the north,
// a column, a zone, a label with a leader, and a dimension string along the north wall.
const model = {
  pxPerFoot: ppf,
  nodes: [{ id: "a", x: 0, y: 0 }, { id: "b", x: 400, y: 0 }, { id: "c", x: 400, y: 200 }, { id: "d", x: 0, y: 200 }],
  walls: [
    { id: "w1", n1: "a", n2: "b", kind: "existing" }, { id: "w2", n1: "b", n2: "c", kind: "existing" },
    { id: "w3", n1: "c", n2: "d", kind: "new" }, { id: "w4", n1: "d", n2: "a", kind: "existing" },
  ],
  doors: [{ id: "d1", x: 200, y: 200, angle: 0, width: 36, flipped: false, hingeRight: false, doorType: "Wood" }],
  windows: [{ id: "n1", x: 100, y: 0, angle: 0, width: 48, height: 48, sill: 30, type: "Window" }],
  columns: [{ id: "c1", x: 200, y: 100, size: 12, shape: "circle" }, { id: "c2", x: 300, y: 100, size: 12, shape: "square", label: "C2" }],
  zones: [{ id: "z1", type: "lounge", points: [{ x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 180 }, { x: 20, y: 180 }], label: "Lounge" }],
  floorRegions: [{ id: "f1", points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 200 }, { x: 0, y: 200 }], material: "Wood", label: "" }],
  furniture: [{ id: "u1", type: "desk", x: 300, y: 50, angle: Math.PI / 2, w: 5, d: 2.5, label: "" }],
  markers: [{ id: "m1", layer: "power", componentType: "outlet_duplex", x: 0, y: 100 }],
  labels: [{ id: "l1", x: 250, y: 150, text: "Coffee bar\nself-serve", fontSize: 12, lx: 220, ly: 120 }],
  dims: [{ id: "dm1", x1: 0, y1: 0, x2: 400, y2: 0, offset: -30 }],
  revClouds: [{ id: "r1", points: [{ x: 50, y: 50 }, { x: 90, y: 50 }, { x: 90, y: 90 }], arcR: 8, label: "Rev A" }],
  flowPaths: [{ id: "p1", points: [{ x: 10, y: 190 }, { x: 390, y: 190 }], width: 36, label: "aisle" }],
};
const opts = { wallHalfT: () => 5, zoneLibrary: { lounge: { name: "Lounge" } } };

const entityCount = (dxf, type) => dxf.split("\r\n").filter((l, i, a) => l === type && a[i - 1] === "0").length;

describe("formatFtIn", () => {
  it("prints feet and inches", () => {
    expect(formatFtIn(200, 20)).toBe(`10'-0"`);
    expect(formatFtIn(210, 20)).toBe(`10'-6"`);
    expect(formatFtIn(219.9, 20)).toBe(`11'-0"`); // 11.995 ft rounds up cleanly
  });
});

describe("buildDxf", () => {
  const { dxf, counts } = buildDxf(model, opts);
  const lines = dxf.split("\r\n");

  it("is a well-formed R12 file: header, tables, entities, EOF", () => {
    expect(lines[0]).toBe("0"); expect(lines[1]).toBe("SECTION");
    expect(dxf).toContain("$ACADVER\r\n1\r\nAC1009");
    expect(dxf).toContain("2\r\nENTITIES");
    expect(lines[lines.length - 2]).toBe("EOF");
    for (const name of Object.keys(DXF_LAYERS)) expect(dxf).toContain(`LAYER\r\n2\r\n${name}`);
  });

  it("writes every entity type the model needs, on its layer", () => {
    expect(counts.LINE).toBeGreaterThan(8);      // wall edges + centerlines + jambs + dims
    expect(counts.ARC).toBe(1);                   // the door swing
    expect(counts.CIRCLE).toBe(2);                // round column + marker
    expect(counts.POLYLINE).toBe(6);              // square column, zone, floor, furniture, revcloud, flow path
    expect(counts.TEXT).toBeGreaterThanOrEqual(9); // zone name + sf, C2, marker letter, 2 label lines, dim, rev, aisle
    expect(entityCount(dxf, "SEQEND")).toBe(counts.POLYLINE);
    expect(dxf).toContain("8\r\nA-DOOR");
    expect(dxf).toContain("8\r\nA-GLAZ");
    expect(dxf).toContain("8\r\nE-POWR");
  });

  it("converts to feet with y flipped (plan y-down → DXF y-up)", () => {
    // Node c sits at (400,200)px = (20,-10)ft: the east wall centerline ends there.
    expect(dxf).toMatch(/A-WALL-CNTR\r\n10\r\n20\r\n20\r\n0\r\n30\r\n0\r\n11\r\n20\r\n21\r\n-10/);
    // Extents cover the plan.
    expect(dxf).toContain("$EXTMAX");
    const i = lines.indexOf("$EXTMAX");
    expect(Number(lines[i + 2])).toBeGreaterThanOrEqual(20);
    expect(Number(lines[i + 4])).toBeGreaterThanOrEqual(0);
  });

  it("cuts wall runs at openings and adds jamb lines", () => {
    const uncut = buildDxf({ ...model, doors: [], windows: [] }, opts);
    expect(counts.LINE).toBeGreaterThan(uncut.counts.LINE); // door + window jambs
  });

  it("splits multi-line labels and formats dimension text", () => {
    expect(dxf).toContain("1\r\nCoffee bar");
    expect(dxf).toContain("1\r\nself-serve");
    expect(dxf).toContain(`1\r\n20'-0"`);
    expect(dxf).toContain("1\r\n64 SF"); // 8ft × 8ft zone
  });

  it("handles an empty model", () => {
    const { dxf: empty, counts: c } = buildDxf({ pxPerFoot: 20 }, opts);
    expect(empty).toContain("EOF");
    expect(Object.keys(c)).toEqual([]);
  });
});
