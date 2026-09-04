import { create } from "zustand";

// ─── View / layout store ─────────────────────────────────────────────────────
// First slice of the state extraction out of the monster component. Holds the pane
// layout: `panes` (1 / 2 / 4 entries; pane 0 is always the interactive Plan in
// multi-pane), and the divider fractions `splitPos` (vertical) / `splitPosV` (quad
// horizontal).
//
// The plain setters (`setPanes` / `setSplitPos` / `setSplitPosV`) deliberately mimic
// React's `useState` setter API — they accept a value OR an updater function — so the
// component's existing call sites work unchanged. Higher-level actions (`setLayout`,
// `setPaneView`) own the layout invariants.

// value-or-updater setter, matching the useState contract.
// Skips the write when the value is unchanged: zustand allocates a new state object on
// every set, which re-renders every wholesale `useStore()` subscriber even for a no-op.
const vou = (set, key) => (v) => set((s) => {
  const next = typeof v === "function" ? v(s[key]) : v;
  return Object.is(next, s[key]) ? {} : { [key]: next };
});

export const useViewStore = create((set) => ({
  panes: [{ view: "plan" }],
  splitPos: 0.5,
  splitPosV: 0.5,

  setPanes: vou(set, "panes"),
  setSplitPos: vou(set, "splitPos"),
  setSplitPosV: vou(set, "splitPosV"),

  // 1 → single, 2 → split, 4 → quad. Single-pane preserves the current view (so toggling
  // back to 1 doesn't clobber a 3D/elevation the user picked); multi-pane forces pane 0 to
  // Plan so there's always a drawable canvas.
  setLayout: (n) => set((s) => {
    const aux = s.panes.slice(1);
    if (n <= 1) return { panes: s.panes.length === 1 ? s.panes : [{ view: "plan" }] };
    if (n === 2) return { panes: [{ view: "plan" }, aux[0] || { view: "3d" }] };
    return { panes: [{ view: "plan" }, aux[0] || { view: "3d" }, aux[1] || { view: "front" }, aux[2] || { view: "left" }] };
  }),
  setPaneView: (i, view) => set((s) => ({ panes: s.panes.map((p, idx) => (idx === i ? { ...p, view } : p)) })),
}));
