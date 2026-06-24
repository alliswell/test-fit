import { create } from "zustand";

// ─── Interaction store ───────────────────────────────────────────────────────
// Transient canvas-interaction state owned by the event handlers but also read by
// render (ghost previews, marquee rect, in-progress draws). Lives in a store — not
// component useState — so the handlers can move into a `useCanvasEvents` hook while
// render and the keyboard handler still read/reset the same values.
//
// Setters mimic the `useState` value-or-updater contract; the main component
// destructures these to the same local names it used for useState. Session-only
// (never persisted).

const vou = (set, key) => (v) => set((s) => ({ [key]: typeof v === "function" ? v(s[key]) : v }));

export const useInteractionStore = create((set) => ({
  drawChain: null,        // in-progress wall chain
  drawDim: null,          // null | {x1,y1} | {x1,y1,x2,y2}
  drawPolyZone: null,     // { points:[{x,y}], type }
  drawRevCloud: null,     // null | {points:[{x,y}]}
  drawFlowPath: null,     // null | { points:[{x,y}] }
  drawFloorRegion: null,  // null | { points:[{x,y}] }
  drag: null,
  resize: null,
  marquee: null,          // { startX, startY, endX, endY }
  ghostPos: null,         // hover preview position
  rotatingMarker: null,   // { id, cx, cy }
  calibrationLine: null,  // { p1:{x,y}, p2:{x,y} }
  hoverNid: null,         // hovered node id
  guideDraft: null,       // { dir, pos } while pulling a new elevation guide
  addingLeaderToId: null, // label id awaiting a leader-tip click
  panning: false,
  panSt: null,
  spaceHeld: false,

  setDrawChain: vou(set, "drawChain"),
  setDrawDim: vou(set, "drawDim"),
  setDrawPolyZone: vou(set, "drawPolyZone"),
  setDrawRevCloud: vou(set, "drawRevCloud"),
  setDrawFlowPath: vou(set, "drawFlowPath"),
  setDrawFloorRegion: vou(set, "drawFloorRegion"),
  setDrag: vou(set, "drag"),
  setResize: vou(set, "resize"),
  setMarquee: vou(set, "marquee"),
  setGhostPos: vou(set, "ghostPos"),
  setRotatingMarker: vou(set, "rotatingMarker"),
  setCalibrationLine: vou(set, "calibrationLine"),
  setHoverNid: vou(set, "hoverNid"),
  setGuideDraft: vou(set, "guideDraft"),
  setAddingLeaderToId: vou(set, "addingLeaderToId"),
  setPanning: vou(set, "panning"),
  setPanSt: vou(set, "panSt"),
  setSpaceHeld: vou(set, "spaceHeld"),
}));
