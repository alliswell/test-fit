import { create } from "zustand";
import { uid } from "../imports/model";
import { dropSlideList } from "../utils/docs";

// ─── Docs / presentation store ───────────────────────────────────────────────
// The slide deck for the Docs workflow stage: saved views (plan / elevation / 3D)
// that live-render from model state onto printable sheets.
//
// Slides are a PROJECT-level artifact like `snapshots` — persisted via
// getProjectData()/applyProjectData(), deliberately NOT part of captureModel(), so
// switching snapshots never clobbers the deck (and snapshots don't bloat with decks).
// Slides always render the LIVE model: switching snapshots changes what every slide
// shows, by design.
//
// Slide shape:
//   { id, name, view: "plan"|"front"|"back"|"left"|"right"|"3d"|"budget"|"ffe"|"title",
//     rect: {x,y,w,h}|null,          // plan: world px; elevations: projected u/v px
//     cam3d: {position:[3], target:[3], style3d}|null,  // 3d; feet rel. node centroid —
//                                     // heavy geometry edits shift the framing
//     image: dataURL|null,           // 3d only: deck-strip/print capture (≤1280px JPEG)
//     notes: [{id,text,x,y,lx,ly,color,fontSize,bold,italic}],  // sheet-logical px
//     vis: null | {<layer>: bool},   // per-slide layer visibility (null = inherit editor)
//     parentId: id|null,             // one-level deck nesting (child of a section slide)
//     collapsed: bool,               // section slide: children hidden in the deck strip
//     subtitle,                      // "title" section-divider slides only
//     title, scaleText, ts }

// Skips the write when the value is unchanged: zustand allocates a new state object on
// every set, which re-renders every wholesale `useStore()` subscriber even for a no-op.
const vou = (set, key) => (v) => set((s) => {
  const next = typeof v === "function" ? v(s[key]) : v;
  return Object.is(next, s[key]) ? {} : { [key]: next };
});

export const DEFAULT_DOC_SETTINGS = { size: "letter", orientation: "landscape" };

export const useDocsStore = create((set) => ({
  slides: [],
  docSettings: { ...DEFAULT_DOC_SETTINGS },
  activeSlideId: null, // session-only (not persisted)

  setSlides: vou(set, "slides"),
  setDocSettings: vou(set, "docSettings"),
  setActiveSlideId: vou(set, "activeSlideId"),

  addSlide: (slide) => set((s) => {
    const sl = { id: uid(), notes: [], title: slide.name || "", subtitle: "", scaleText: "", vis: null, parentId: null, collapsed: false, ts: Date.now(), ...slide };
    return { slides: [...s.slides, sl], activeSlideId: sl.id };
  }),
  updateSlide: (id, patch) => set((s) => ({ slides: s.slides.map(x => x.id === id ? { ...x, ...patch } : x) })),
  // Deleting a parent promotes its children to top level (they keep their order).
  removeSlide: (id) => set((s) => ({
    slides: s.slides.filter(x => x.id !== id).map(x => x.parentId === id ? { ...x, parentId: null } : x),
    activeSlideId: s.activeSlideId === id ? null : s.activeSlideId,
  })),
  // Deck-strip drag & drop: reorder next to a target or nest into it (one level).
  dropSlide: (dragId, targetId, zone) => set((s) => {
    const next = dropSlideList(s.slides, dragId, targetId, zone);
    return next === s.slides ? {} : { slides: next };
  }),
}));
