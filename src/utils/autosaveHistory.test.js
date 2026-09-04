import { describe, it, expect } from "vitest";
import { pushHistory, readHistory, clearHistory, historySummary, relativeTime, slimForHistory, HISTORY_MIN_GAP_MS, AUTOSAVE_HISTORY_KEY } from "./autosaveHistory";

const stub = (quotaBytes = Infinity) => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (String(v).length > quotaBytes) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  };
};
const proj = (walls) => ({ version: "testfit-v17", nodes: [], walls: Array.from({ length: walls }, (_, i) => ({ id: "w" + i })), zones: [], slides: [] });

describe("autosave history", () => {
  it("records the first save, then skips saves inside the gap and unchanged content", () => {
    const st = stub(); const t0 = 1_000_000;
    expect(pushHistory(proj(1), { now: t0, storage: st })).toHaveLength(1);
    expect(pushHistory(proj(2), { now: t0 + 1000, storage: st })).toBeNull();             // inside the gap
    expect(pushHistory(proj(1), { now: t0 + HISTORY_MIN_GAP_MS + 1, storage: st })).toBeNull(); // unchanged
    expect(pushHistory(proj(2), { now: t0 + HISTORY_MIN_GAP_MS + 2, storage: st })).toHaveLength(2);
    expect(readHistory(st)[0].data.walls).toHaveLength(2); // newest first
  });
  it("force records inside the gap and caps the ring at HISTORY_MAX", () => {
    const st = stub(); let t = 5_000_000;
    for (let i = 1; i <= 8; i++) expect(pushHistory(proj(i), { now: t += 10, force: true, storage: st })).not.toBeNull();
    const list = readHistory(st);
    expect(list).toHaveLength(5);
    expect(list.map(e => e.data.walls.length)).toEqual([8, 7, 6, 5, 4]);
  });
  it("strips slide images and survives a quota squeeze by keeping fewer entries", () => {
    const withImg = { ...proj(1), slides: [{ id: "s", image: "data:image/jpeg;base64,AAAA", name: "Plan" }] };
    expect(slimForHistory(withImg).slides[0].image).toBeNull();
    const st = stub(400); let t = 9_000_000;
    pushHistory(proj(1), { now: t += 10, force: true, storage: st });
    const out = pushHistory(proj(2), { now: t += 10, force: true, storage: st });
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(st.getItem(AUTOSAVE_HISTORY_KEY).length).toBeLessThanOrEqual(400);
    clearHistory(st);
    expect(readHistory(st)).toEqual([]);
  });
  it("summarises and formats", () => {
    expect(historySummary({ walls: [1, 2, 3], zones: [1], nodes: [1, 2], slides: [1, 2] })).toBe("3 walls · 1 zone · 2 slides · 6 el");
    expect(relativeTime(0, 20_000)).toBe("just now");
    expect(relativeTime(0, 5 * 60_000)).toBe("5 min ago");
    expect(relativeTime(0, 3 * 3600_000)).toBe("3 hr ago");
    expect(readHistory({ getItem: () => "not json" })).toEqual([]);
  });
});
