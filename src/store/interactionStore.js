import { create } from "zustand";

// ─── Interaction store ───────────────────────────────────────────────────────
// Transient canvas-interaction state owned by the event handlers but also read by
// render (marquee rect, in-progress draws). Per-mousemove feedback (cursor ghost,
// proximity ring, smart guides, hovered node) lives in hoverStore instead — see there. Lives in a store — not
// component useState — so the handlers can move into a `useCanvasEvents` hook while
// render and the keyboard handler still read/reset the same values.
//
// Setters mimic the `useState` value-or-updater contract; the main component
// destructures these to the same local names it used for useState. Session-only
// (never persisted).

// Skips the write when the value is unchanged: zustand allocates a new state object on
// every set, which re-renders every wholesale `useStore()` subscriber even for a no-op.
const vou = (set, key) => (v) => set((s) => {
  const next = typeof v === "function" ? v(s[key]) : v;
  return Object.is(next, s[key]) ? {} : { [key]: next };
});

export const useInteractionStore = create((set) => ({
  drawChain: null,        // in-progress wall chain
  drawRect: null,         // in-progress rect room: { x1, y1 } (first corner)
  drawDim: null,          // null | {x1,y1} | {x1,y1,x2,y2}
  drawPolyZone: null,     // { points:[{x,y}], type }
  drawRevCloud: null,     // null | {points:[{x,y}]}
  drawFlowPath: null,     // null | { points:[{x,y}] }
  drawFloorRegion: null,  // null | { points:[{x,y}] }
  drag: null,
  resize: null,
  marquee: null,          // { startX, startY, endX, endY }
  rotatingMarker: null,   // { id, cx, cy }
  rotatingFurniture: null, // { id, cx, cy } — furniture rotate-handle drag
  furnitureResize: null,   // { id, sx, sy, ax, ay, ux:[x,y], uy:[x,y] } — furniture scale-handle drag
  calibrationLine: null,  // { p1:{x,y}, p2:{x,y} }
  floorEditId: null,      // floor region unlocked for move/vertex editing (double-click)
  guideDraft: null,       // { dir, pos } while pulling a new elevation guide
  addingLeaderToId: null, // label id awaiting a leader-tip click
  panning: false,
  panSt: null,
  spaceHeld: false,

  setDrawChain: vou(set, "drawChain"),
  setDrawRect: vou(set, "drawRect"),
  setDrawDim: vou(set, "drawDim"),
  setDrawPolyZone: vou(set, "drawPolyZone"),
  setDrawRevCloud: vou(set, "drawRevCloud"),
  setDrawFlowPath: vou(set, "drawFlowPath"),
  setDrawFloorRegion: vou(set, "drawFloorRegion"),
  setDrag: vou(set, "drag"),
  setResize: vou(set, "resize"),
  setMarquee: vou(set, "marquee"),
  setRotatingMarker: vou(set, "rotatingMarker"),
  setRotatingFurniture: vou(set, "rotatingFurniture"),
  setFurnitureResize: vou(set, "furnitureResize"),
  setCalibrationLine: vou(set, "calibrationLine"),
  setFloorEditId: vou(set, "floorEditId"),
  setGuideDraft: vou(set, "guideDraft"),
  setAddingLeaderToId: vou(set, "addingLeaderToId"),
  setPanning: vou(set, "panning"),
  setPanSt: vou(set, "panSt"),
  setSpaceHeld: vou(set, "spaceHeld"),
}));
