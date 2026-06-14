import { describe, it, expect } from "vitest";
import { DOOR_TYPE_STYLES, WINDOW_TYPE_STYLES } from "./theme";
import { DOOR_TYPES, WINDOW_TYPES } from "./specs";

// The style catalogs are keyed by the type strings in specs.js. These tests pin
// the two files together so adding a type without a style (or vice versa) fails fast.
describe("DOOR_TYPE_STYLES", () => {
  it("has an entry with elevation styling for every DOOR_TYPES string", () => {
    for (const t of DOOR_TYPES) {
      expect(DOOR_TYPE_STYLES[t], `missing style for door type "${t}"`).toBeDefined();
      expect(DOOR_TYPE_STYLES[t].elev?.stroke, `door type "${t}" needs elev.stroke`).toBeTruthy();
    }
  });

  it("has 3D clay + pbr params and a knob for every real door (everything but Case Opening)", () => {
    for (const t of DOOR_TYPES.filter(t => t !== "Case Opening")) {
      expect(DOOR_TYPE_STYLES[t].clay?.color, `door type "${t}" needs clay.color`).toBeTruthy();
      expect(DOOR_TYPE_STYLES[t].pbr?.color, `door type "${t}" needs pbr.color`).toBeTruthy();
      expect(DOOR_TYPE_STYLES[t].elev?.knob, `door type "${t}" needs elev.knob`).toBe(true);
    }
    expect(DOOR_TYPE_STYLES["Case Opening"].elev.knob).toBeUndefined(); // an opening has no hardware
  });

  it("Glass carries the extra pane/frame params its 3D composition needs", () => {
    const g = DOOR_TYPE_STYLES.Glass;
    expect(g.pbr.transmission).toBeGreaterThan(0);
    expect(g.pbr.opacity).toBeGreaterThan(0);
    expect(g.frame?.clay).toBeTruthy();
    expect(g.frame?.pbr?.color).toBeTruthy();
  });

  it("has no orphan styles for types that don't exist", () => {
    for (const k of Object.keys(DOOR_TYPE_STYLES)) expect(DOOR_TYPES).toContain(k);
  });
});

describe("WINDOW_TYPE_STYLES", () => {
  it("has an entry with a stroke for every WINDOW_TYPES string", () => {
    for (const t of WINDOW_TYPES) {
      expect(WINDOW_TYPE_STYLES[t], `missing style for window type "${t}"`).toBeDefined();
      expect(WINDOW_TYPE_STYLES[t].stroke, `window type "${t}" needs stroke`).toBeTruthy();
    }
  });

  it("has no orphan styles for types that don't exist", () => {
    for (const k of Object.keys(WINDOW_TYPE_STYLES)) expect(WINDOW_TYPES).toContain(k);
  });
});
