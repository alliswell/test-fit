// ─── Plan zones layer ────────────────────────────────────────────────────────
// Programme areas: polygon (or legacy rect) + name + square footage, and for the
// selected zone the clear-inside overlay and its vertex/edge handles. Memoized.
//
// clearInsideOverlay: wall dims label CENTERLINES, so this dashes the true inside-face
// outline (each edge with a wall along it inset by that wall's half-thickness) and
// dimensions every edge with what a tape measure would read between finished faces.
// Renders nothing when no edge has a wall (free-floating zone).
//
// `lod`: 1 hides the zone name (the sf stays — it's the number people zoom out to
// compare), 2 hides all zone text.
import { memo } from "react";
import { polyArea, polyCentroid, dst } from "../../imports/model";
import { insetFloorPolygon, wallResizeCursor } from "../../imports/geometry";
import { DimLbl } from "./Dims";

function clearInsideOverlay(pts, color, { walls, nodes, wallHalfT, ft, font, textZoom }) {
  if (!pts || pts.length < 3) return null;
  const inset = insetFloorPolygon(pts, walls, nodes, wallHalfT);
  const moved = inset.some((p, i) => Math.abs(p.x - pts[i].x) > 0.25 || Math.abs(p.y - pts[i].y) > 0.25);
  if (!moved) return null;
  const nI = inset.length;
  let a2 = 0; for (let i = 0; i < nI; i++) { const j = (i + 1) % nI; a2 += inset[i].x * inset[j].y - inset[j].x * inset[i].y; }
  const inSign = a2 > 0 ? 1 : -1; // DimLbl's off direction is (−sinθ,cosθ) = this polygon's inward normal × inSign
  const dIn = "M " + inset.map(p => `${p.x},${p.y}`).join(" L ") + " Z";
  return <g style={{ pointerEvents: "none" }}>
    <path d={dIn} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray="5 3" opacity={0.9} />
    {inset.map((p, i) => {
      const q = inset[(i + 1) % nI];
      const len = dst(p.x, p.y, q.x, q.y);
      if (len < 24) return null;
      const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      return <DimLbl key={"cd" + i} cx={(p.x + q.x) / 2} cy={(p.y + q.y) / 2} text={ft(len)} angle={ang} off={12 * inSign} color={color} textZoom={textZoom} font={font} />;
    })}
  </g>;
}

function PlanZonesLayer({ zones, zoneLibrary, T, selectedId, selType, selectedIds, mode, pxPerFoot, showZoneDims, textZoom, ft, ftN, resolvePoints, phaseVisible, walls, nodes, wallHalfT, font, lod = 0 }) {
  const ctx = { walls, nodes, wallHalfT, ft, font, textZoom };
  return zones.map(z => { if (!phaseVisible(z.phase)) return null;
    // Mono: zones are programme, not construction — the lightest tier, and the
    // library hue is dropped so the drawing stays one ink.
    const zLib = zoneLibrary[z.type];
    const lib = T.mono ? { ...zLib, color: T.tiers[3].color } : zLib;
    const sel = (selectedId === z.id && selType === "zone") || selectedIds.includes(z.id);
    const glowEffect = mode === "budget" && sel;
    if (z.points) { const rpts = resolvePoints(z); const pts = rpts.map(p => `${p.x},${p.y}`).join(" "); const c = polyCentroid(rpts); const sf = Math.round(polyArea(rpts) / (pxPerFoot * pxPerFoot));
      return <g key={z.id} filter={glowEffect ? "url(#glow-budget)" : undefined}><polygon points={pts} fill={lib.color + "25"} stroke={sel ? T.nodeFill : lib.color + "88"} strokeWidth={sel ? 2 : 1} strokeDasharray={sel ? "none" : "4 2"} strokeLinejoin="round" />
        {lod < 1 && <text x={c.x} y={c.y - 4} textAnchor="middle" fill={lib.color + "CC"} fontSize={10} fontFamily="inherit" fontWeight={500} style={{ pointerEvents: "none" }}>{z.label}</text>}
        {lod < 2 && <text x={c.x} y={c.y + 14} textAnchor="middle" fill={lib.color + "BB"} fontSize={13} fontFamily="inherit" fontWeight={700} style={{ pointerEvents: "none" }}>{sf} sf</text>}
        {sel && clearInsideOverlay(rpts, lib.color, ctx)}
        {sel && rpts.map((p, i) => { const j = (i + 1) % rpts.length; const p2 = rpts[j]; return <line key={"e" + i} x1={p.x} y1={p.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={10} style={{ cursor: wallResizeCursor(p.x, p.y, p2.x, p2.y) }} />; })}
        {sel && rpts.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={7} fill={lib.color} stroke={T.nodeFill} strokeWidth={2} style={{ cursor: "move" }} /><circle cx={p.x} cy={p.y} r={3} fill={T.nodeFill} style={{ cursor: "move", pointerEvents: "none" }} /></g>)}
      </g>; }
    return <g key={z.id} filter={glowEffect ? "url(#glow-budget)" : undefined}><rect x={z.x} y={z.y} width={z.w} height={z.h} fill={lib.color + "25"} stroke={sel ? T.nodeFill : lib.color + "88"} strokeWidth={sel ? 2 : 1} strokeDasharray={sel ? "none" : "4 2"} rx={3} />
      {lod < 1 && <text x={z.x + 8} y={z.y + 16} fill={lib.color + "CC"} fontSize={10} fontFamily="inherit" fontWeight={500} style={{ pointerEvents: "none" }}>{z.label}</text>}
      {lod < 2 && <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 7} textAnchor="middle" fill={lib.color + "BB"} fontSize={13} fontFamily="inherit" fontWeight={700} style={{ pointerEvents: "none" }}>{Math.round(ftN(z.w) * ftN(z.h))} sf</text>}
      {showZoneDims && lod < 2 && <><text x={z.x + z.w / 2} y={z.y + z.h + 14 * textZoom} textAnchor="middle" fill={T.dimText} fontSize={9 * textZoom} fontFamily="inherit" style={{ pointerEvents: "none" }}>{ft(z.w)}</text>
        <text x={z.x + z.w + 14 * textZoom} y={z.y + z.h / 2} textAnchor="middle" dominantBaseline="middle" fill={T.dimText} fontSize={9 * textZoom} fontFamily="inherit" transform={`rotate(90,${z.x + z.w + 14 * textZoom},${z.y + z.h / 2})`} style={{ pointerEvents: "none" }}>{ft(z.h)}</text></>}
      {sel && clearInsideOverlay([{ x: z.x, y: z.y }, { x: z.x + z.w, y: z.y }, { x: z.x + z.w, y: z.y + z.h }, { x: z.x, y: z.y + z.h }], lib.color, ctx)}
    </g>;
  });
}

export default memo(PlanZonesLayer);
