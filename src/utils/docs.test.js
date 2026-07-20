import { describe, it, expect } from "vitest";
import { sheetDims, sheetInches, sheetBodyDims, fitRectToViewport, defaultSlideName, formatSheetNo, viewTitle, fitStandardScale, scaledRectCam, STANDARD_SCALES, SLIDE_LAYER_DEFS, DEFAULT_SLIDE_VIS, SLIDE_VIS_PRESETS, resolveSlideVis, matchSlidePreset, dropSlideList, sanitizeSlideTree } from "./docs";

describe("sheetDims", () => {
  it("all four size × orientation combos", () => {
    expect(sheetDims({ size: "letter", orientation: "landscape" })).toEqual({ w: 1056, h: 816 });
    expect(sheetDims({ size: "letter", orientation: "portrait" })).toEqual({ w: 816, h: 1056 });
    expect(sheetDims({ size: "tabloid", orientation: "landscape" })).toEqual({ w: 1632, h: 1056 });
    expect(sheetDims({ size: "tabloid", orientation: "portrait" })).toEqual({ w: 1056, h: 1632 });
  });
  it("defaults + unknown size fall back to letter landscape", () => {
    expect(sheetDims()).toEqual({ w: 1056, h: 816 });
    expect(sheetDims({ size: "a0", orientation: "landscape" })).toEqual({ w: 1056, h: 816 });
  });
  it("sheetInches maps logical px back to physical inches", () => {
    expect(sheetInches({ size: "letter", orientation: "landscape" })).toEqual({ w: 11, h: 8.5 });
    expect(sheetInches({ size: "tabloid", orientation: "portrait" })).toEqual({ w: 11, h: 17 });
  });
});

describe("fitRectToViewport", () => {
  it("contain-fits a wide rect into a tall viewport (width-bound) and centers it", () => {
    const { zoom, viewOff } = fitRectToViewport({ x: 0, y: 0, w: 200, h: 100 }, 100, 400);
    expect(zoom).toBe(0.5); // width-bound: 100/200
    // rect center (100,50) maps to viewport center (50,200)
    expect(100 * zoom + viewOff.x).toBeCloseTo(50);
    expect(50 * zoom + viewOff.y).toBeCloseTo(200);
  });
  it("contain-fits a tall rect into a wide viewport (height-bound)", () => {
    const { zoom } = fitRectToViewport({ x: 10, y: 10, w: 100, h: 200 }, 400, 100);
    expect(zoom).toBe(0.5); // height-bound: 100/200
  });
  it("respects padding", () => {
    const { zoom } = fitRectToViewport({ x: 0, y: 0, w: 100, h: 100 }, 120, 120, 10);
    expect(zoom).toBe(1); // 100 avail / 100 rect
  });
  it("degenerate rect / viewport → identity fallback; zoom clamped", () => {
    expect(fitRectToViewport(null, 100, 100)).toEqual({ zoom: 1, viewOff: { x: 0, y: 0 } });
    expect(fitRectToViewport({ x: 0, y: 0, w: 0, h: 10 }, 100, 100)).toEqual({ zoom: 1, viewOff: { x: 0, y: 0 } });
    expect(fitRectToViewport({ x: 0, y: 0, w: 10, h: 10 }, 100, 0)).toEqual({ zoom: 1, viewOff: { x: 0, y: 0 } });
    expect(fitRectToViewport({ x: 0, y: 0, w: 1, h: 1 }, 10000, 10000).zoom).toBe(20); // clamp hi
    expect(fitRectToViewport({ x: 0, y: 0, w: 1e6, h: 1e6 }, 100, 100).zoom).toBe(0.01); // clamp lo
  });
});

describe("standard scales", () => {
  it("sheetBodyDims subtracts pads + title block", () => {
    expect(sheetBodyDims({ size: "letter", orientation: "landscape" })).toEqual({ w: 1016, h: 720 });
  });
  it("scales are sorted largest-first and include the drafting staples", () => {
    for (let i = 1; i < STANDARD_SCALES.length; i++) expect(STANDARD_SCALES[i].s).toBeLessThan(STANDARD_SCALES[i - 1].s);
    expect(STANDARD_SCALES.map(x => x.label)).toContain("1/4\" = 1'-0\"");
    expect(STANDARD_SCALES.map(x => x.label)).toContain("1/8\" = 1'-0\"");
  });
  it("picks the largest standard scale that still fits", () => {
    // 40 ft of world (800 world px @ ppf 20) across a letter-landscape body (1016 px wide):
    // raw fit ≈ (1016-16)/800 = 1.25 px/worldpx → 1.25*20/96 ≈ 0.26 in/ft → 1/4" fits, 3/8" doesn't.
    const r = fitStandardScale({ x: 0, y: 0, w: 800, h: 100 }, 1016, 720, 20);
    expect(r.label).toBe("1/4\" = 1'-0\"");
    expect(r.zoom).toBeCloseTo(0.25 * 96 / 20); // 1.2 logical px per world px
  });
  it("exact-boundary fit keeps the exact scale (epsilon guard)", () => {
    // Craft a viewport where the raw fit is EXACTLY 1/4": zoom 1.2 → vw = 800*1.2 + 16
    const r = fitStandardScale({ x: 0, y: 0, w: 800, h: 100 }, 800 * 1.2 + 16, 720, 20);
    expect(r.label).toBe("1/4\" = 1'-0\"");
  });
  it("returns null when even 1/32\" overflows, or on degenerate input", () => {
    expect(fitStandardScale({ x: 0, y: 0, w: 200000, h: 100 }, 1016, 720, 20)).toBeNull();
    expect(fitStandardScale(null, 1016, 720, 20)).toBeNull();
    expect(fitStandardScale({ x: 0, y: 0, w: 0, h: 5 }, 1016, 720, 20)).toBeNull();
  });
  it("scaledRectCam centers the rect at the exact zoom", () => {
    const cam = scaledRectCam({ x: 100, y: 50, w: 800, h: 400 }, 1016, 720, 1.2);
    expect(cam.zoom).toBe(1.2);
    expect((100 + 400) * cam.zoom + cam.viewOff.x).toBeCloseTo(1016 / 2); // rect center → viewport center
    expect((50 + 200) * cam.zoom + cam.viewOff.y).toBeCloseTo(720 / 2);
  });
});

describe("per-slide layer visibility", () => {
  it("resolveSlideVis: null inherits (returns null); object merges over defaults", () => {
    expect(resolveSlideVis(null)).toBeNull();
    const r = resolveSlideVis({ dims: false, elec: true });
    expect(r.dims).toBe(false);        // explicit override
    expect(r.elec).toBe(true);
    expect(r.zones).toBe(DEFAULT_SLIDE_VIS.zones); // untouched key falls back to default
    // every layer key present
    expect(Object.keys(r).sort()).toEqual(SLIDE_LAYER_DEFS.map(d => d.key).sort());
  });
  it("defaults: grid + elevation rulers off, everything else on", () => {
    expect(DEFAULT_SLIDE_VIS.grid).toBe(false);
    expect(DEFAULT_SLIDE_VIS.guides).toBe(false);
    expect(DEFAULT_SLIDE_VIS.zones).toBe(true);
    expect(DEFAULT_SLIDE_VIS.elec).toBe(true);
  });
  it("presets are complete boolean maps and cover the electrical/zone guides", () => {
    const keys = SLIDE_LAYER_DEFS.map(d => d.key);
    for (const p of SLIDE_VIS_PRESETS) expect(Object.keys(p.vis).sort()).toEqual([...keys].sort());
    const elec = SLIDE_VIS_PRESETS.find(p => p.id === "electrical").vis;
    expect(elec.elec).toBe(true); expect(elec.dims).toBe(false); expect(elec.zones).toBe(false);
    const zoning = SLIDE_VIS_PRESETS.find(p => p.id === "zoning").vis;
    expect(zoning.zones).toBe(true); expect(zoning.elec).toBe(false);
  });
  it("matchSlidePreset: null → live, exact preset → its id, custom → null", () => {
    expect(matchSlidePreset(null)).toBe("live");
    expect(matchSlidePreset(SLIDE_VIS_PRESETS.find(p => p.id === "electrical").vis)).toBe("electrical");
    expect(matchSlidePreset({ ...DEFAULT_SLIDE_VIS, dims: false, zones: false })).toBeNull();
  });
});

describe("deck ordering + nesting", () => {
  const S = (id, parentId = null) => ({ id, parentId });
  const order = (a) => a.map(s => s.id + (s.parentId ? "<" + s.parentId : "")).join(",");

  it("reorders a top-level slide before/after another", () => {
    const list = [S("a"), S("b"), S("c")];
    expect(order(dropSlideList(list, "c", "a", "before"))).toBe("c,a,b");
    expect(order(dropSlideList(list, "a", "c", "after"))).toBe("b,c,a");
  });
  it("nests a slide into a top-level target (end of its group)", () => {
    const list = [S("a"), S("x", "a"), S("b")];
    expect(order(dropSlideList(list, "b", "a", "into"))).toBe("a,x<a,b<a");
  });
  it("into is rejected for child targets, parents-with-children, and self", () => {
    const list = [S("a"), S("x", "a"), S("b"), S("y", "b")];
    expect(dropSlideList(list, "b", "x", "into")).toBe(list);  // target is a child
    expect(dropSlideList(list, "a", "b", "into")).toBe(list);  // drag has children
    expect(dropSlideList(list, "a", "a", "into")).toBe(list);  // self
  });
  it("un-nests: dropping a child before/after a top-level row clears its parent", () => {
    const list = [S("a"), S("x", "a"), S("b")];
    expect(order(dropSlideList(list, "x", "b", "after"))).toBe("a,b,x");
    expect(order(dropSlideList(list, "x", "a", "before"))).toBe("x,a,b");
  });
  it("dropping next to a child keeps the group's parent (sibling reorder)", () => {
    const list = [S("a"), S("x", "a"), S("y", "a"), S("b")];
    expect(order(dropSlideList(list, "y", "x", "before"))).toBe("a,y<a,x<a,b");
    expect(order(dropSlideList(list, "b", "x", "after"))).toBe("a,x<a,b<a,y<a");
  });
  it("a parent drags its children with it; after a grouped target lands after the group", () => {
    const list = [S("a"), S("x", "a"), S("b"), S("c")];
    expect(order(dropSlideList(list, "a", "c", "after"))).toBe("b,c,a,x<a");
    expect(order(dropSlideList(list, "c", "a", "after"))).toBe("a,x<a,c,b");
  });
  it("a parent dropped next to a child stays top-level relative to that group", () => {
    const list = [S("a"), S("x", "a"), S("b"), S("y", "b"), S("z", "b")];
    expect(order(dropSlideList(list, "a", "y", "after"))).toBe("b,y<b,z<b,a,x<a");
  });
  it("no-ops keep the same array identity", () => {
    const list = [S("a"), S("b")];
    expect(dropSlideList(list, "a", "b", "before")).toBe(list);
    expect(dropSlideList(list, "a", "a", "after")).toBe(list);
  });
  it("sanitizeSlideTree drops bad parents and regroups children after parents", () => {
    const messy = [S("x", "a"), S("a"), S("b"), S("q", "missing"), S("r", "x"), S("s", "s")];
    const out = sanitizeSlideTree(messy);
    expect(order(out)).toBe("a,x<a,b,q,r,s");
  });
});

describe("naming", () => {
  it("defaultSlideName + viewTitle", () => {
    expect(defaultSlideName("plan", 0)).toBe("Plan 01");
    expect(defaultSlideName("front", 4)).toBe("Front Elevation 05");
    expect(defaultSlideName("3d", 11)).toBe("3D View 12");
    expect(defaultSlideName("title", 2)).toBe("Section 03");
    expect(viewTitle("title")).toBe("Section");
    expect(viewTitle("nope")).toBe("View");
  });
  it("formatSheetNo pads both sides", () => {
    expect(formatSheetNo(0, 7)).toBe("01 / 07");
    expect(formatSheetNo(11, 12)).toBe("12 / 12");
  });
});
