// ─── Touch input helpers ──────────────────────────────────────────────────────
// Pure (no React, no DOM): the bits of a finger-driven canvas that are worth pinning with
// a test. testfit.jsx routes pointer events from touch and pen through the same canvas
// handlers the mouse uses; these decide what a gesture MEANS.

export const ZOOM_MIN = 0.15, ZOOM_MAX = 4;
export const clampZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

// PointerEvent.detail is always 0, so a double-tap has to be reconstructed: a tap within
// `ms` and `px` of the previous one counts up (1, 2, 3…), anything else starts over at 1.
// `prev` is the previous tap {t, x, y, count} or null; `now` is {t, x, y}.
export function tapCount(prev, now, { ms = 400, px = 14 } = {}) {
  if (!prev) return 1;
  if (now.t - prev.t > ms) return 1;
  if (Math.hypot(now.x - prev.x, now.y - prev.y) > px) return 1;
  return (prev.count || 1) + 1;
}

const mid = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const span = ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y);

// One frame of a two-finger gesture: the fingers moved from `prev` to `next` (two points
// each, in the canvas viewport's own pixels). `ratio` is how much the view should scale,
// `mid0`/`mid1` where the fingers' midpoint was and is — the point of paper under it must
// stay under it (the same anchoring wheel-zoom does about the cursor).
export function pinchStep(prev, next) {
  const d0 = span(prev), d1 = span(next);
  return { ratio: d0 > 1 ? d1 / d0 : 1, mid0: mid(prev), mid1: mid(next) };
}

// The view offset that keeps the paper under mid0 under mid1 once the zoom has been
// multiplied by `scale` (newZoom / oldZoom): a model point p sits at screen
// viewOff + zoom·p, so holding s(p) = mid1 for the p that was at mid0 gives this.
export function anchorViewOff(viewOff, mid0, mid1, scale) {
  return { x: mid1.x - scale * (mid0.x - viewOff.x), y: mid1.y - scale * (mid0.y - viewOff.y) };
}
