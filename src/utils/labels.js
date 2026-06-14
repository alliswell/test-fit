// ─── Label layout helpers ─────────────────────────────────────────────────────
// Shared label bounding box — single source of truth for both rendering and
// hit-testing. Pure functions (no React/DOM).

import { LABEL_MAX_W } from "../constants/specs";

export function wrapLabelLines(text, fontSize) {
  const charW = fontSize * 0.6;
  const maxChars = Math.max(1, Math.floor((LABEL_MAX_W - 16) / charW));
  const result = [];
  for (const rawLine of (text || "").split("\n")) {
    if (!rawLine) { result.push(""); continue; }
    const words = rawLine.split(" ");
    let cur = "";
    for (const word of words) {
      const next = cur ? cur + " " + word : word;
      if (next.length <= maxChars || !cur) { cur = next; }
      else { result.push(cur); cur = word; }
    }
    if (cur) result.push(cur);
  }
  return result.length ? result : [""];
}

export function labelBounds(lbl) {
  const lineH = Math.round(lbl.fontSize * 1.4);
  const lines = wrapLabelLines(lbl.text, lbl.fontSize);
  const charW = lbl.fontSize * 0.6;
  const w = Math.min(Math.max(...lines.map(l => l.length * charW), 20) + 16, LABEL_MAX_W);
  const h = lines.length * lineH + 8;
  return { w: Math.max(w, 36), h: Math.max(h, lbl.fontSize + 8), lines, lineH };
}
