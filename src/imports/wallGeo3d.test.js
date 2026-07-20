import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { footprintToLocal, buildWallSolidGeometry, isSimpleConvexQuad, applyBoxUVs, solidEdgesGeometry } from "./wallGeo3d";

// Pins three-bvh-csg@0.0.17 against three ^0.184 — the 3D wall solids depend on this
// exact pairing (drei 9.x locks three-mesh-bvh to 0.7.x, which rules out csg >=0.0.18).
describe("three-bvh-csg smoke", () => {
  it("subtracts a box from a box and yields a pierced solid", () => {
    const evaluator = new Evaluator();
    evaluator.attributes = ["position", "normal", "uv"];
    evaluator.useGroups = false;
    const wall = new Brush(new THREE.BoxGeometry(10, 8, 0.6));
    wall.updateMatrixWorld();
    const hole = new Brush(new THREE.BoxGeometry(3, 6.8, 2));
    hole.position.set(0, -0.6, 0); // door-like: cut reaches below the floor line
    hole.updateMatrixWorld();
    const out = evaluator.evaluate(wall, hole, SUBTRACTION);
    const pos = out.geometry.getAttribute("position");
    expect(pos.count).toBeGreaterThan(36); // more triangles than the plain box
    out.geometry.computeBoundingBox();
    const bb = out.geometry.boundingBox;
    expect(bb.max.x).toBeCloseTo(5, 3); // outer shell intact
    expect(out.geometry.getAttribute("uv")).toBeTruthy();
  });
});

describe("footprintToLocal", () => {
  it("maps plan-px quad into the wall-local frame (x along wall, feet)", () => {
    // horizontal wall (100,200)→(300,200), pxPerFoot 20, mid (200,200); quad = ±5px rect
    const quad = [
      { x: 100, y: 195 }, { x: 300, y: 195 }, { x: 300, y: 205 }, { x: 100, y: 205 },
    ];
    const loc = footprintToLocal(quad, { x: 200, y: 200 }, 0, 20);
    expect(loc[0].x).toBeCloseTo(-5); expect(loc[0].z).toBeCloseTo(-0.25);
    expect(loc[2].x).toBeCloseTo(5);  expect(loc[2].z).toBeCloseTo(0.25);
  });
  it("a rotated wall lands on the same local frame (endpoints at ±len/2, z=±halfT)", () => {
    // 45° wall (0,0)→(200,200); angle = atan2(200,200)
    const ang = Math.atan2(200, 200);
    const halfPx = 5, nx = -Math.SQRT1_2, ny = Math.SQRT1_2; // left normal of (1,1)/√2
    const quad = [
      { x: 0 + nx * halfPx, y: 0 + ny * halfPx }, { x: 200 + nx * halfPx, y: 200 + ny * halfPx },
      { x: 200 - nx * halfPx, y: 200 - ny * halfPx }, { x: 0 - nx * halfPx, y: 0 - ny * halfPx },
    ];
    const loc = footprintToLocal(quad, { x: 100, y: 100 }, ang, 20);
    const L = Math.hypot(200, 200) / 20 / 2;
    expect(loc[0].x).toBeCloseTo(-L, 4); expect(Math.abs(loc[0].z)).toBeCloseTo(0.25, 4);
    expect(loc[1].x).toBeCloseTo(L, 4);
  });
});

describe("buildWallSolidGeometry", () => {
  const rect = [{ x: -5, z: -0.3 }, { x: 5, z: -0.3 }, { x: 5, z: 0.3 }, { x: -5, z: 0.3 }];

  it("extrudes the footprint up +y with outward normals and exact bounds", () => {
    const geo = buildWallSolidGeometry(rect, 9);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    expect(bb.min.x).toBeCloseTo(-5); expect(bb.max.x).toBeCloseTo(5);
    expect(bb.min.y).toBeCloseTo(0);  expect(bb.max.y).toBeCloseTo(9);
    expect(Math.abs(bb.min.z)).toBeCloseTo(0.3); expect(Math.abs(bb.max.z)).toBeCloseTo(0.3);
    // outward normals: every +z-face vertex must sit on the +z side (winding pinned)
    const pos = geo.getAttribute("position"), nrm = geo.getAttribute("normal");
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      if (nrm.getZ(i) > 0.9) { expect(pos.getZ(i)).toBeGreaterThan(0); checked++; }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("reversed winding input yields the same outward normals", () => {
    const geo = buildWallSolidGeometry([...rect].reverse(), 9);
    const pos = geo.getAttribute("position"), nrm = geo.getAttribute("normal");
    for (let i = 0; i < pos.count; i++) {
      if (nrm.getZ(i) > 0.9) expect(pos.getZ(i)).toBeGreaterThan(0);
    }
  });

  it("CSG-cuts a door opening through the full thickness", () => {
    const geo = buildWallSolidGeometry(rect, 9, [{ x0: -1.5, x1: 1.5, y0: 0, y1: 6.8 }], { cutDepth: 4 });
    geo.computeBoundingBox();
    expect(geo.boundingBox.max.x).toBeCloseTo(5, 3); // shell intact
    // no surface point inside the doorway air (strictly inside the cut, away from its faces)
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      expect(Math.abs(x) < 1.45 && y > 0.05 && y < 6.75 && Math.abs(pos.getZ(i)) < 0.25).toBe(false);
    }
  });

  it("butterfly quad falls back to the bounding rect", () => {
    const butterfly = [{ x: -5, z: -0.3 }, { x: 5, z: 0.3 }, { x: 5, z: -0.3 }, { x: -5, z: 0.3 }];
    expect(isSimpleConvexQuad(butterfly)).toBe(false);
    const geo = buildWallSolidGeometry(butterfly, 9);
    geo.computeBoundingBox();
    expect(geo.boundingBox.max.x).toBeCloseTo(5);
    expect(geo.boundingBox.max.z).toBeCloseTo(0.3);
  });

  it("applyBoxUVs writes real-world-feet UVs per dominant axis", () => {
    const geo = buildWallSolidGeometry(rect, 9, [], { tileFt: { x: 2, y: 1 } });
    const uv = geo.getAttribute("uv"), pos = geo.getAttribute("position"), nrm = geo.getAttribute("normal");
    expect(uv).toBeTruthy();
    for (let i = 0; i < pos.count; i++) {
      if (nrm.getZ(i) > 0.9) { // long face: u=x/2, v=y/1
        expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / 2, 4);
        expect(uv.getY(i)).toBeCloseTo(pos.getY(i), 4);
        break;
      }
    }
  });

  it("solidEdgesGeometry welds CSG output before edge extraction", () => {
    const geo = buildWallSolidGeometry(rect, 9, [{ x0: -1, x1: 1, y0: 0, y1: 6.8 }]);
    const edges = solidEdgesGeometry(geo);
    expect(edges.getAttribute("position").count).toBeGreaterThan(0);
    expect(edges.getAttribute("position").count % 2).toBe(0); // line segments
  });
});
