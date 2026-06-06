import { create } from "zustand";

// ─── Selection store ─────────────────────────────────────────────────────────
// What's currently selected on the canvas:
//   selectedId  — primary selected entity id (null = none)
//   selType     — its kind ("wall" | "door" | "zone" | "marker" | "floor" | ...)
//   selectedIds — full set for multi-select (marquee / shift-click)
// Read pervasively across hit-testing, rendering, the inspector, nudge/delete, and copy.
// Setters mimic the useState value-or-updater contract so call sites are unchanged.

const vou = (set, key) => (v) => set((s) => ({ [key]: typeof v === "function" ? v(s[key]) : v }));

export const useSelectionStore = create((set) => ({
  selectedId: null,
  selType: null,
  selectedIds: [],
  setSelectedId: vou(set, "selectedId"),
  setSelType: vou(set, "selType"),
  setSelectedIds: vou(set, "selectedIds"),
}));
