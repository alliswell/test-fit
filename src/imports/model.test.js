import { describe, it, expect } from "vitest";
import {
  sn, dst, ptSeg, polyArea, polyCentroid, pointInPoly, orthoSnap,
  isLightComponent, parseDimInput, migrateProjectData, PROJECT_VERSION,
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
    expect(isLightComponent("sconce_prewire")).toBe(true);
    expect(isLightComponent("outlet_duplex")).toBeFalsy();
    expect(isLightComponent(undefined)).toBeFalsy();
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
});
