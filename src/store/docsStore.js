import { create } from "zustand";
import { uid } from "../imports/model";

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
//   { id, name, view: "plan"|"front"|"back"|"left"|"right"|"3d",
//     rect: {x,y,w,h}|null,          // plan: world px; elevations: projected u/v px
//     cam3d: {position:[3], target:[3], style3d}|null,  // 3d; feet rel. node centroid —
//                                     // heavy geometry edits shift the framing
//     image: dataURL|null,           // 3d only: deck-strip/print capture (≤1280px JPEG)
//     notes: [{id,text,x,y,lx,ly,color,fontSize,bold,italic}],  // sheet-logical px
//     title, scaleText, ts }

const vou = (set, key) => (v) => set((s) => ({ [key]: typeof v === "function" ? v(s[key]) : v }));

export const DEFAULT_DOC_SETTINGS = { size: "letter", orientation: "landscape" };

export const useDocsStore = create((set) => ({
  slides: [],
  docSettings: { ...DEFAULT_DOC_SETTINGS },
  activeSlideId: null, // session-only (not persisted)

  setSlides: vou(set, "slides"),
  setDocSettings: vou(set, "docSettings"),
  setActiveSlideId: vou(set, "activeSlideId"),

  addSlide: (slide) => set((s) => {
    const sl = { id: uid(), notes: [], title: slide.name || "", scaleText: "", ts: Date.now(), ...slide };
    return { slides: [...s.slides, sl], activeSlideId: sl.id };
  }),
  updateSlide: (id, patch) => set((s) => ({ slides: s.slides.map(x => x.id === id ? { ...x, ...patch } : x) })),
  removeSlide: (id) => set((s) => ({
    slides: s.slides.filter(x => x.id !== id),
    activeSlideId: s.activeSlideId === id ? null : s.activeSlideId,
  })),
  // Move slide by delta positions (−1 up / +1 down), clamped.
  moveSlide: (id, delta) => set((s) => {
    const i = s.slides.findIndex(x => x.id === id);
    if (i < 0) return {};
    const j = Math.max(0, Math.min(s.slides.length - 1, i + delta));
    if (i === j) return {};
    const next = [...s.slides];
    const [sl] = next.splice(i, 1);
    next.splice(j, 0, sl);
    return { slides: next };
  }),
}));
