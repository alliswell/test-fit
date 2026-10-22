import { describe, it, expect } from "vitest";
import { anchorViewOff, clampZoom, pinchStep, tapCount } from "./touch";

describe("tapCount", () => {
  it("starts at 1 and counts quick, close taps", () => {
    const t1 = { t: 1000, x: 10, y: 10 };
    expect(tapCount(null, t1)).toBe(1);
    expect(tapCount({ ...t1, count: 1 }, { t: 1300, x: 14, y: 8 })).toBe(2);
    expect(tapCount({ t: 1300, x: 14, y: 8, count: 2 }, { t: 1500, x: 12, y: 9 })).toBe(3);
  });
  it("resets when the tap is slow or far", () => {
    const prev = { t: 1000, x: 10, y: 10, count: 1 };
    expect(tapCount(prev, { t: 1500, x: 10, y: 10 })).toBe(1);   // 500 ms > 400
    expect(tapCount(prev, { t: 1100, x: 40, y: 10 })).toBe(1);   // 30 px > 14
  });
});

describe("pinchStep + anchorViewOff", () => {
  it("scales by the change in finger spread and reports the midpoints", () => {
    const prev = [{ x: 100, y: 200 }, { x: 200, y: 200 }];
    const next = [{ x: 50, y: 220 }, { x: 250, y: 220 }];
    const s = pinchStep(prev, next);
    expect(s.ratio).toBeCloseTo(2, 6);
    expect(s.mid0).toEqual({ x: 150, y: 200 });
    expect(s.mid1).toEqual({ x: 150, y: 220 });
  });
  it("keeps the paper under the fingers' midpoint under it after the zoom", () => {
    const viewOff = { x: 30, y: -40 }, zoom = 1;
    const mid0 = { x: 150, y: 200 }, mid1 = { x: 160, y: 230 };
    const p = { x: (mid0.x - viewOff.x) / zoom, y: (mid0.y - viewOff.y) / zoom }; // the model point under mid0
    const newZoom = 1.6, scale = newZoom / zoom;
    const v = anchorViewOff(viewOff, mid0, mid1, scale);
    expect(v.x + newZoom * p.x).toBeCloseTo(mid1.x, 9);
    expect(v.y + newZoom * p.y).toBeCloseTo(mid1.y, 9);
  });
  it("a pure pan (no spread change) is a translation by the midpoint delta", () => {
    const prev = [{ x: 0, y: 0 }, { x: 100, y: 0 }], next = [{ x: 20, y: 5 }, { x: 120, y: 5 }];
    const s = pinchStep(prev, next);
    expect(s.ratio).toBe(1);
    expect(anchorViewOff({ x: 7, y: 7 }, s.mid0, s.mid1, 1)).toEqual({ x: 27, y: 12 });
  });
  it("tolerates a degenerate first spread", () => {
    expect(pinchStep([{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 0, y: 0 }, { x: 10, y: 0 }]).ratio).toBe(1);
  });
  it("clampZoom holds the wheel's range", () => {
    expect(clampZoom(0.01)).toBe(0.15); expect(clampZoom(9)).toBe(4); expect(clampZoom(1.3)).toBe(1.3);
  });
});
