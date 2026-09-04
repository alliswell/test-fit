// ─── Plan dimension primitives ───────────────────────────────────────────────
// Props-only SVG pieces shared by the plan layers: DimLbl (a rotated dimension label),
// WallDim (auto-dimension along a wall centerline) and DimString (a placed dimension).
// `textZoom` is the parent's 1/zoom-below-100% factor that keeps annotation type readable
// when zoomed out; `T` is the CANVAS theme (mono-aware), never the chrome theme.
import { dst } from "../../imports/model";

export const FONT = "'IBM Plex Mono','SF Mono','Consolas','Monaco',monospace";

export function DimLbl({ cx, cy, text, angle, off = -14, color, textZoom = 1, font = FONT }) {
  let a = angle; if (a > 90) a -= 180; if (a < -90) a += 180;
  // The standoff scales with the type, or an enlarged label would sit on top of its wall.
  const offZ = off * textZoom;
  const r = (angle * Math.PI) / 180, ox = -Math.sin(r) * offZ, oy = Math.cos(r) * offZ;
  return <text x={cx + ox} y={cy + oy} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={10 * textZoom}
    fontFamily={font} fontWeight={500} transform={`rotate(${a},${cx + ox},${cy + oy})`} style={{ pointerEvents: "none" }}>{text}</text>;
}

export function WallDim({ c, hi, T, ft, font = FONT, textZoom = 1 }) {
if (!c) return null;
  const len = dst(c.x1, c.y1, c.x2, c.y2); if (len < 20) return null;
  const mid = { x: (c.x1 + c.x2) / 2, y: (c.y1 + c.y2) / 2 };
  const ang = (Math.atan2(c.y2 - c.y1, c.x2 - c.x1) * 180) / Math.PI;
  const r = (ang * Math.PI) / 180, tk = 6, px = -Math.sin(r), py = Math.cos(r);
  const col = hi ? "#E8E0D0CC" : "#E8E0D044";
  return <g style={{ pointerEvents: "none" }}>
    <line x1={c.x1 + px * tk} y1={c.y1 + py * tk} x2={c.x1 - px * tk} y2={c.y1 - py * tk} stroke={col} strokeWidth={0.8} />
    <line x1={c.x2 + px * tk} y1={c.y2 + py * tk} x2={c.x2 - px * tk} y2={c.y2 - py * tk} stroke={col} strokeWidth={0.8} />
    <line x1={c.x1 + px * tk} y1={c.y1 + py * tk} x2={c.x2 + px * tk} y2={c.y2 + py * tk} stroke={col} strokeWidth={0.5} strokeDasharray="3 2" />
    <DimLbl cx={mid.x} cy={mid.y} text={ft(len)} angle={ang} color={hi ? T.nodeFill : T.dimText} textZoom={textZoom} font={font} />
  </g>;
}

// Permanent dimension string
export function DimString({ d, sel, T, ft, font = FONT, tool }) {
  const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux; // perpendicular (left of p1→p2)
  const off = d.offset;
  const sign = off >= 0 ? 1 : -1;
  const absOff = Math.abs(off);
  // Dim line
  const dlx1 = d.x1 + nx * off, dly1 = d.y1 + ny * off;
  const dlx2 = d.x2 + nx * off, dly2 = d.y2 + ny * off;
  // Extension lines: gap from anchor, overshoot past dim line
  const gap = 4, overshoot = 6;
  const ext1s = { x: d.x1 + nx * sign * gap, y: d.y1 + ny * sign * gap };
  const ext1e = { x: d.x1 + nx * sign * (absOff + overshoot), y: d.y1 + ny * sign * (absOff + overshoot) };
  const ext2s = { x: d.x2 + nx * sign * gap, y: d.y2 + ny * sign * gap };
  const ext2e = { x: d.x2 + nx * sign * (absOff + overshoot), y: d.y2 + ny * sign * (absOff + overshoot) };
  // Diagonal ticks at dim line endpoints (45° between dim direction and perpendicular)
  const tk = 5;
  const diagX = (ux + nx * sign) / Math.SQRT2, diagY = (uy + ny * sign) / Math.SQRT2;
  // Label
  const mid = { x: (dlx1 + dlx2) / 2, y: (dly1 + dly2) / 2 };
  const label = ft(len);
  let ang = Math.atan2(dly2 - dly1, dlx2 - dlx1) * 180 / Math.PI;
  if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  const textW = label.length * 5.5 + 6, textH = 11;
  const color = sel ? T.nodeFill : T.dimText;
  const sw = sel ? 1.2 : 0.75;
  return <g style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
    {/* Transparent hit area along dim line */}
    <line x1={dlx1} y1={dly1} x2={dlx2} y2={dly2} stroke="transparent" strokeWidth={10} />
    {/* Extension lines */}
    <line x1={ext1s.x} y1={ext1s.y} x2={ext1e.x} y2={ext1e.y} stroke={color} strokeWidth={sw} style={{ pointerEvents: "none" }} />
    <line x1={ext2s.x} y1={ext2s.y} x2={ext2e.x} y2={ext2e.y} stroke={color} strokeWidth={sw} style={{ pointerEvents: "none" }} />
    {/* Dim line */}
    <line x1={dlx1} y1={dly1} x2={dlx2} y2={dly2} stroke={color} strokeWidth={sw} style={{ pointerEvents: "none" }} />
    {/* Diagonal ticks */}
    <line x1={dlx1 - diagX * tk} y1={dly1 - diagY * tk} x2={dlx1 + diagX * tk} y2={dly1 + diagY * tk} stroke={color} strokeWidth={sw + 0.25} style={{ pointerEvents: "none" }} />
    <line x1={dlx2 - diagX * tk} y1={dly2 - diagY * tk} x2={dlx2 + diagX * tk} y2={dly2 + diagY * tk} stroke={color} strokeWidth={sw + 0.25} style={{ pointerEvents: "none" }} />
    {/* Text with canvas background */}
    <rect x={mid.x - textW / 2} y={mid.y - textH / 2} width={textW} height={textH} fill={T.canvas}
      transform={`rotate(${ang},${mid.x},${mid.y})`} style={{ pointerEvents: "none" }} />
    <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle" fontSize={9}
      fill={color} fontFamily={font} fontWeight={600}
      transform={`rotate(${ang},${mid.x},${mid.y})`} style={{ pointerEvents: "none" }}>{label}</text>
    {sel && <>
      {/* Draggable endpoint handles — grab to resize/move the measured span */}
      <circle cx={d.x1} cy={d.y1} r={7} fill={color} stroke={T.nodeFill} strokeWidth={2} style={{ cursor: "move" }} />
      <circle cx={d.x1} cy={d.y1} r={3} fill={T.nodeFill} style={{ cursor: "move", pointerEvents: "none" }} />
      <circle cx={d.x2} cy={d.y2} r={7} fill={color} stroke={T.nodeFill} strokeWidth={2} style={{ cursor: "move" }} />
      <circle cx={d.x2} cy={d.y2} r={3} fill={T.nodeFill} style={{ cursor: "move", pointerEvents: "none" }} />
    </>}
  </g>;
}
