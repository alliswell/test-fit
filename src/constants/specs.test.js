import { describe, it, expect } from "vitest";
import { SPEC_COMPONENTS, SPEC_LAYERS, COMPONENT_FINISHES, FINISH_COLORS, ACCESS_READER_COST } from "./specs";
import { isWallMounted } from "./specs";
import { M3D, markerMountYFt, defaultMountHeightIn } from "../imports/markerMount";

// Symbol keys that MarkerSymbol (testfit.jsx) knows how to draw. Adding a component with a
// symbol not in this set means the 2D plan can't render it — keep the two in sync.
const KNOWN_SYMBOLS = new Set([
  "circle", "crosshair", "rect", "outlet", "outlet_ceiling", "switch", "panel", "recessed",
  "pendant", "sconce", "tstat",
  "speaker", "sub", "pendant_spkr", "speaker_drop", "rack", "router", "drain", "water",
  "camera", "floodlight",
]);

const allComponents = Object.entries(SPEC_COMPONENTS).flatMap(([layer, comps]) =>
  Object.entries(comps).map(([key, c]) => ({ layer, key, c })));

describe("SPEC_COMPONENTS catalog", () => {
  it("every component has a name, a known symbol, and a numeric unitCost", () => {
    for (const { layer, key, c } of allComponents) {
      expect(c.name, `${layer}.${key} needs a name`).toBeTruthy();
      expect(KNOWN_SYMBOLS.has(c.symbol), `${layer}.${key} has unknown symbol "${c.symbol}"`).toBe(true);
      expect(typeof c.unitCost, `${layer}.${key} needs unitCost`).toBe("number");
    }
  });

  it("every component belongs to a declared layer", () => {
    for (const layer of Object.keys(SPEC_COMPONENTS)) expect(SPEC_LAYERS[layer]).toBeDefined();
  });

  it("finish-capable components declare a valid finish list and have FINISH_COLORS", () => {
    for (const { layer, key, c } of allComponents) {
      if (!c.finish) continue;
      expect(Array.isArray(c.finish), `${layer}.${key} finish must be an array`).toBe(true);
      for (const f of c.finish) {
        expect(COMPONENT_FINISHES.includes(f), `${layer}.${key} has invalid finish "${f}"`).toBe(true);
        expect(FINISH_COLORS[f]?.fill, `FINISH_COLORS missing "${f}"`).toBeTruthy();
      }
    }
  });

  it("expected finish + directional components are configured", () => {
    expect(SPEC_COMPONENTS.av.wall_speaker.finish).toEqual(["white", "black"]);
    expect(SPEC_COMPONENTS.av.wall_speaker.directional).toBe(true);
    expect(SPEC_COMPONENTS.security.camera_indoor.finish).toEqual(["white", "black"]);
    expect(SPEC_COMPONENTS.it.router.finish).toEqual(["white", "black"]);
    expect(ACCESS_READER_COST).toBeGreaterThan(0);
  });

  it("retired legacy components are gone", () => {
    expect(SPEC_COMPONENTS.power.duplex_outlet).toBeUndefined();
    expect(SPEC_COMPONENTS.power.ceiling_quad).toBeUndefined();
    expect(SPEC_COMPONENTS.power.htrack).toBeUndefined();
    expect(SPEC_COMPONENTS.power.sconce_prewire).toBeUndefined();
    expect(SPEC_COMPONENTS.it.access_point).toBeUndefined();
    expect(SPEC_COMPONENTS.av.speaker_line).toBeUndefined();
    expect(SPEC_COMPONENTS.security.white_camera).toBeUndefined();
  });
});

describe("wall-device mount height (AFF)", () => {
  it("every wall-mounted component ships an industry-standard default height", () => {
    for (const { layer, key, c } of allComponents) {
      if (!isWallMounted(c)) continue;
      const std = defaultMountHeightIn(key);
      expect(std, `${layer}.${key} is wall-mounted but has no standard height`).toBeTypeOf("number");
      expect(std).toBeGreaterThan(0);
      expect(std).toBeLessThanOrEqual(120);   // within a 10' wall
    }
  });

  it("pins the standards the sliders start at", () => {
    expect(defaultMountHeightIn("outlet_duplex")).toBe(18);   // receptacle
    expect(defaultMountHeightIn("switch_single")).toBe(48);   // switch / ADA reach
    expect(defaultMountHeightIn("light_sconce")).toBe(66);    // sconce
    expect(defaultMountHeightIn("tstat")).toBe(60);
    expect(defaultMountHeightIn("panel_board")).toBe(60);
  });

  it("ceiling-relative components have no fixed inch standard", () => {
    for (const key of ["light_can_4", "light_pendant", "outlet_ceiling", "htrack_4", "router"]) {
      expect(defaultMountHeightIn(key)).toBeNull();
    }
  });

  it("a per-marker override (inches) wins over the catalog default", () => {
    expect(markerMountYFt("outlet_duplex", 9)).toBe(1.5);        // standard 18"
    expect(markerMountYFt("outlet_duplex", 9, 42)).toBe(3.5);    // slider → 42"
    expect(markerMountYFt("light_can_4", 9)).toBe(9);            // "ceil" → ceiling height
    expect(markerMountYFt("light_can_4", 9, 84)).toBe(7);        // override beats "ceil" too
  });

  it("clamps an override to the room so elevation and 3D agree after a ceiling change", () => {
    expect(markerMountYFt("outlet_duplex", 8, 200)).toBe(8);   // above a lowered ceiling
    expect(markerMountYFt("outlet_duplex", 9, -12)).toBe(0);   // never below the floor
  });

  it("ignores a non-numeric override rather than dropping the device to the floor", () => {
    for (const bad of [undefined, null, NaN, "48"]) {
      expect(markerMountYFt("switch_single", 9, bad)).toBe(4);
    }
  });

  it("the retired linear fixtures are gone from the catalog and the mount table", () => {
    for (const key of ["light_linear_2", "light_linear_4"]) {
      expect(SPEC_COMPONENTS.power[key]).toBeUndefined();
      expect(M3D[key]).toBeUndefined();
    }
  });
});
