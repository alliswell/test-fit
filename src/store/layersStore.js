import { create } from "zustand";

// ─── Layers store ────────────────────────────────────────────────────────────
// Per-layer visibility flags + lock state (the sidebar "Layers" panel). Pure session
// UI except `lockedLayers`, which is persisted at the project-file level.
//
// `visibleLayers` is the IT/MEP spec-layer map (power/av/it/mep/security). `lockedLayers`
// is keyed by layer id (zones/dims/labels/revClouds/flowPaths/floorRegions/itmep + spec
// layers). Setters mimic the `useState` value-or-updater contract so component call sites
// are unchanged.

const vou = (set, key) => (v) => set((s) => ({ [key]: typeof v === "function" ? v(s[key]) : v }));

export const useLayersStore = create((set) => ({
  visibleLayers: { power: true, av: true, it: true, mep: true, security: true },
  visibleBuildElectrical: true,
  visibleBuildLighting: true,
  visibleZones: true,
  visibleDims: true,
  visibleLabels: true,
  visibleRevClouds: true,
  visibleFlowPaths: true,
  visibleFloorRegions: true,
  visibleFurniture: true,
  visibleITMEP: true, // master IT/MEP marker visibility (all modes)
  visibleGuides: true, // elevation cut guides + their on-ruler camera markers
  lockedLayers: {},

  setVisibleLayers: vou(set, "visibleLayers"),
  setVisibleBuildElectrical: vou(set, "visibleBuildElectrical"),
  setVisibleBuildLighting: vou(set, "visibleBuildLighting"),
  setVisibleZones: vou(set, "visibleZones"),
  setVisibleDims: vou(set, "visibleDims"),
  setVisibleLabels: vou(set, "visibleLabels"),
  setVisibleRevClouds: vou(set, "visibleRevClouds"),
  setVisibleFlowPaths: vou(set, "visibleFlowPaths"),
  setVisibleFloorRegions: vou(set, "visibleFloorRegions"),
  setVisibleFurniture: vou(set, "visibleFurniture"),
  setVisibleITMEP: vou(set, "visibleITMEP"),
  setVisibleGuides: vou(set, "visibleGuides"),
  setLockedLayers: vou(set, "lockedLayers"),
}));
