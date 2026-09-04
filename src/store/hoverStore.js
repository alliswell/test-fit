import { create } from "zustand";

// ─── Hover store ─────────────────────────────────────────────────────────────
// Per-mouse-move canvas feedback: the cursor ghost, the proximity-hover ring, smart
// guides, the hovered node. These change on EVERY mousemove, so they deliberately live
// apart from interactionStore: the main editor (TestfitTool) never subscribes to this
// store. Only the small <HoverSubscriber> render islands inside the plan SVG do, so a
// hover repaints a handful of SVG nodes instead of the whole 6k-line editor.
//
// Handlers READ these via useHoverStore.getState() (event-time), never through the
// hook, so they stay out of every dependency array. Setters keep the useState
// value-or-updater contract and skip the write when the value is unchanged, so an
// idle mouse over empty canvas notifies nobody.

const vou = (set, key) => (v) => set((s) => {
  const next = typeof v === "function" ? v(s[key]) : v;
  return Object.is(next, s[key]) ? {} : { [key]: next };
});

export const useHoverStore = create((set) => ({
  cursorPos: null,     // wall/rect tools: snapped cursor {x,y,snap}
  ghostPos: null,      // placement preview {x,y,snapped?,angle?,side?,closing?}
  proxHover: null,     // { type, id, x, y, dist, sub } nearest hoverable within PROX_R
  smartGuides: [],     // [{ axis, pos, points }] alignment guides while dragging
  hoverNid: null,      // hovered wall node id

  setCursorPos: vou(set, "cursorPos"),
  setGhostPos: vou(set, "ghostPos"),
  setProxHover: vou(set, "proxHover"),
  setSmartGuides: vou(set, "smartGuides"),
  setHoverNid: vou(set, "hoverNid"),
}));

// Empty-array sentinel so "no guides" compares equal between writes.
export const NO_GUIDES = [];
