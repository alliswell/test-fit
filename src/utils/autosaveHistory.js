// ─── Autosave history ────────────────────────────────────────────────────────
// A short ring of earlier autosaves, so a bad edit that outruns undo (or a reload that
// baked one in) can be rolled back from the Load menu. The live autosave still writes
// every ~800 ms; this keeps a copy only when the newest one is older than HISTORY_MIN_GAP
// and the content actually changed, so five entries span a working session rather than
// the last four seconds. Slides drop their 3D capture images here (they re-capture when
// the slide is opened) so five copies of a big deck can't blow the localStorage quota.
// Pure: every function takes the storage as a parameter (vitest passes a Map-backed stub).
export const AUTOSAVE_HISTORY_KEY = "testfit-autosave-history";
export const AUTOSAVE_HISTORY_TS_KEY = "testfit-autosave-history-ts"; // newest entry's ts, cheap gap check
export const HISTORY_MAX = 5;
export const HISTORY_MIN_GAP_MS = 90 * 1000;

const store = () => (typeof localStorage !== "undefined" ? localStorage : null);

export function slimForHistory(data) {
  if (!data?.slides?.length) return data;
  return { ...data, slides: data.slides.map(s => (s.image ? { ...s, image: null } : s)) };
}

export function readHistory(storage = store()) {
  if (!storage) return [];
  try {
    const list = JSON.parse(storage.getItem(AUTOSAVE_HISTORY_KEY) || "[]");
    return Array.isArray(list) ? list.filter(e => e && typeof e.ts === "number" && e.data) : [];
  } catch { return []; }
}

// Returns the new list (newest first) when an entry was recorded, else null.
//   force: record even inside the gap (used right before a restore, so the state being
//          replaced is itself recoverable).
export function pushHistory(data, { now = Date.now(), minGapMs = HISTORY_MIN_GAP_MS, max = HISTORY_MAX, force = false, storage = store() } = {}) {
  if (!storage || !data) return null;
  const lastTs = Number(storage.getItem(AUTOSAVE_HISTORY_TS_KEY) || 0);
  if (!force && lastTs && now - lastTs < minGapMs) return null;
  const list = readHistory(storage);
  const json = JSON.stringify(slimForHistory(data));
  if (list.length && JSON.stringify(list[0].data) === json) return null; // unchanged
  const next = [{ ts: now, data: JSON.parse(json) }, ...list].slice(0, max);
  // Best effort under quota: drop the oldest entries until it fits, else give up.
  for (let keep = next.length; keep >= 1; keep--) {
    try {
      storage.setItem(AUTOSAVE_HISTORY_KEY, JSON.stringify(next.slice(0, keep)));
      storage.setItem(AUTOSAVE_HISTORY_TS_KEY, String(now));
      return next.slice(0, keep);
    } catch { /* quota — try with fewer */ }
  }
  return null;
}

export function clearHistory(storage = store()) {
  if (!storage) return;
  storage.removeItem(AUTOSAVE_HISTORY_KEY); storage.removeItem(AUTOSAVE_HISTORY_TS_KEY);
}

// "3 walls · 2 zones · 14 elements" — what the Load menu shows next to the time.
export function historySummary(data) {
  const n = (k) => (Array.isArray(data?.[k]) ? data[k].length : 0);
  const elements = ["nodes", "walls", "doors", "windows", "columns", "zones", "furniture", "markers", "labels", "dims", "revClouds", "flowPaths", "floorRegions"].reduce((s, k) => s + n(k), 0);
  const parts = [`${n("walls")} wall${n("walls") === 1 ? "" : "s"}`];
  if (n("zones")) parts.push(`${n("zones")} zone${n("zones") === 1 ? "" : "s"}`);
  if (n("slides")) parts.push(`${n("slides")} slide${n("slides") === 1 ? "" : "s"}`);
  parts.push(`${elements} el`);
  return parts.join(" · ");
}

export function relativeTime(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}
