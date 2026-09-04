import { create } from "zustand";

// ─── Geometry store ──────────────────────────────────────────────────────────
// The persistent plan geometry (the arrays that make up a project and get
// captured/persisted/undone). Held in a store — rather than component useState —
// so the canvas event handlers can be extracted into a hook that reads/writes
// geometry via the store instead of through a large prop surface.
//
// Setters mimic the `useState` value-or-updater contract, so existing call sites
// (`setWalls(prev => ...)` or `setWalls(arr)`) are unchanged. The main component
// destructures these to the same local names it used for useState.

// Skips the write when the value is unchanged: zustand allocates a new state object on
// every set, which re-renders every wholesale `useStore()` subscriber even for a no-op.
const vou = (set, key) => (v) => set((s) => {
  const next = typeof v === "function" ? v(s[key]) : v;
  return Object.is(next, s[key]) ? {} : { [key]: next };
});

export const useGeometryStore = create((set) => ({
  nodes: [],
  walls: [],        // {id, n1, n2, kind:"existing"|"demo"|"new"|"pony"}
  zones: [],
  furniture: [],    // {id, type, x, y, angle, w, d, label} — Furnish stage (2D parametric)
  markers: [],
  doors: [],        // {id, x, y, angle, width, flipped, hingeRight, doorType, accessControl?, accessSide?}
  windows: [],      // {id, x, y, angle, width, height, sill, type}
  columns: [],      // {id, x, y, size, shape:"circle"|"box"}
  dims: [],         // [{id, x1, y1, x2, y2, offset}]
  labels: [],       // [{id, x, y, text, fontSize, bold, italic, color, phase, lx, ly, anchorId, anchorType}]
  revClouds: [],    // [{id, points:[{x,y}], arcR, label, color, phase}]
  flowPaths: [],    // [{id, points:[{x,y,anchorId?}], width, color, phase, label?}]
  floorRegions: [], // [{id, points:[{x,y}], material, phase, label?}]
  guides: [],       // elevation cut-line guides: [{id, dir:"front"|"back"|"left"|"right", pos}]

  setNodes: vou(set, "nodes"),
  setWalls: vou(set, "walls"),
  setZones: vou(set, "zones"),
  setFurniture: vou(set, "furniture"),
  setMarkers: vou(set, "markers"),
  setDoors: vou(set, "doors"),
  setWindows: vou(set, "windows"),
  setColumns: vou(set, "columns"),
  setDims: vou(set, "dims"),
  setLabels: vou(set, "labels"),
  setRevClouds: vou(set, "revClouds"),
  setFlowPaths: vou(set, "flowPaths"),
  setFloorRegions: vou(set, "floorRegions"),
  setGuides: vou(set, "guides"),
}));
