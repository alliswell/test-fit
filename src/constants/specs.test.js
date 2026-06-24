import { describe, it, expect } from "vitest";
import { SPEC_COMPONENTS, SPEC_LAYERS, COMPONENT_FINISHES, FINISH_COLORS, ACCESS_READER_COST } from "./specs";

// Symbol keys that MarkerSymbol (testfit.jsx) knows how to draw. Adding a component with a
// symbol not in this set means the 2D plan can't render it — keep the two in sync.
const KNOWN_SYMBOLS = new Set([
  "circle", "crosshair", "rect", "outlet", "outlet_ceiling", "switch", "panel", "recessed",
  "pendant", "linear_lt", "sconce", "tstat",
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
