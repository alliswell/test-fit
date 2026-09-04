// ─── Plan walls layer ────────────────────────────────────────────────────────
// Two-pass wall render — fills first, then all edge lines on top — which prevents
// double-hatching at overlaps and keeps edges always visible. The GEOMETRY (mitered
// footprints, opening cuts, segment corner points, junction cap wedges) arrives
// precomputed in `wallGeom` (the `wallGeom` memo in testfit.jsx, shared with the DXF
// export and the 3D solids); only the STYLE — selection, mono tier, phase colour — is
// resolved here, so this layer is cheap to re-run and, being memoized, is skipped
// entirely while you pan, zoom or hover.
//
// `lod` (level of detail, 0 = full) is the caller's zoom-out simplification: at 1 the
// material hatch is dropped for a flat tint, at 2 the auto-dimensions go too.
import { memo } from "react";
import { tierOf } from "../../constants/theme";
import { wallResizeCursor } from "../../imports/geometry";
import { WallDim } from "./Dims";

function PlanWallsLayer({ wallGeom, T, wallKinds, exteriorWallIds, selectedId, selType, selectedIds, mode, tool, showWallDims, ft, font, textZoom, lod = 0 }) {
  const wallData = wallGeom.walls.map(g => {
    const { w } = g;
    const sel = (selectedId === w.id && selType === "wall") || selectedIds.includes(w.id);
    const wk = wallKinds[w.kind || "existing"];
    // Mono: the wall's tier comes from its ROLE (envelope vs partition), not
    // its phase — phase stays legible through the dash pattern. Cut walls are
    // poché'd solid in the tier ink, which is what makes a mono plan read.
    const mTier = tierOf(T, exteriorWallIds.has(w.id) ? 0 : 1);
    const edgeColor = sel ? T.nodeFill : (mTier?.color ?? wk.color);
    const edgeW = sel ? 2 : (mTier?.w ?? 1.5);
    return { ...g, sel, wk, mTier, edgeColor, edgeW, glowEffect: mode === "budget" && sel };
  });
  const byId = new Map(wallData.map(d => [d.w.id, d]));

  // Junction fill caps — where ≥2 walls meet, the per-wall mitered quads can leave a
  // small uncovered wedge (worst at odd / T-junction angles). Drawn BEHIND the wall
  // pass so it shows only where no wall fill already covers. The first-touch wall
  // styles the wedge; in mono it takes the HEAVIEST tier meeting here, so an envelope
  // corner stays T1 rather than being lightened by a partition landing on it.
  const capPolys = wallGeom.caps.map(cp => {
    const d0 = byId.get(cp.wallIds[0]);
    if (!d0) return null;
    const monoColor = T.mono
      ? (cp.wallIds.some(id => exteriorWallIds.has(id)) ? T.tiers[0] : T.tiers[1]).color
      : null;
    return { nid: cp.nid, points: cp.points, hatchId: d0.hatchId, color: d0.wk.color, monoColor };
  }).filter(Boolean);

  // Terminators (more open ends) render first; through-walls render last so their
  // canvas fill buries any junction edge bleed from the walls they cross.
  const openCount = d => (d.mN1.openL ? 1 : 0) + (d.mN1.openR ? 1 : 0) + (d.mN2.openL ? 1 : 0) + (d.mN2.openR ? 1 : 0);
  const fillOrder = [...wallData].sort((a, b) => openCount(a) - openCount(b));
  const hatch = lod < 1;
  const dims = showWallDims && lod < 2;

  return <>
    {capPolys.map(c => <g key={"cap" + c.nid} style={{ pointerEvents: "none" }}>
      <polygon points={c.points} fill={T.canvas} stroke="none" />
      {T.mono
        ? <polygon points={c.points} fill={c.monoColor} stroke="none" />
        : <>
            <polygon points={c.points} fill={c.color + "18"} stroke="none" />
            {hatch && <polygon points={c.points} fill={`url(#${c.hatchId})`} stroke="none" />}
          </>}
    </g>)}
    {fillOrder.map(({ w, wk, sel, hatchId, edgeColor, edgeW, mTier, mN1, mN2, segPts, glowEffect }) =>
      <g key={"f" + w.id} style={{ pointerEvents: "none" }} filter={glowEffect ? "url(#glow-budget)" : undefined}>
        {segPts.map((sp, i) => <g key={i}>
          <polygon points={sp.pts} fill={T.canvas} stroke="none" />
          <line x1={sp.sL.x} y1={sp.sL.y} x2={sp.eL.x} y2={sp.eL.y} stroke={edgeColor} strokeWidth={edgeW} strokeLinecap="butt" strokeDasharray={sel ? undefined : wk.dash} />
          <line x1={sp.sR.x} y1={sp.sR.y} x2={sp.eR.x} y2={sp.eR.y} stroke={edgeColor} strokeWidth={edgeW} strokeLinecap="butt" strokeDasharray={sel ? undefined : wk.dash} />
          {sp.isFirst && mN1.free && <line x1={sp.sL.x} y1={sp.sL.y} x2={sp.sR.x} y2={sp.sR.y} stroke={edgeColor} strokeWidth={edgeW} strokeLinecap="square" />}
          {sp.isLast && mN2.free && <line x1={sp.eL.x} y1={sp.eL.y} x2={sp.eR.x} y2={sp.eR.y} stroke={edgeColor} strokeWidth={edgeW} strokeLinecap="square" />}
          {/* Mono poché: the cut is filled solid in the wall's own tier ink —
              no material hatch, since hue/pattern would break the one-ink rule. */}
          {mTier
            ? <polygon points={sp.pts} fill={sel ? edgeColor + "55" : mTier.color} stroke="none" />
            : <>
                {!sel && <polygon points={sp.pts} fill={wk.color + "18"} stroke="none" />}
                {(sel || hatch) && <polygon points={sp.pts} fill={sel ? edgeColor + "22" : `url(#${hatchId})`} stroke="none" />}
              </>}
        </g>)}
      </g>
    )}
    {/* Pass 2: hit-detection + dims only */}
    {wallData.map(({ w, c, sel, halfT, glowEffect }) =>
      <g key={"s" + w.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
        <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="transparent" strokeWidth={Math.max(9, halfT * 2 + 2)} style={{ cursor: tool === "select" && mode === "build" ? wallResizeCursor(c.x1, c.y1, c.x2, c.y2) : "inherit" }} />
        {dims && <WallDim c={c} hi={sel} T={T} ft={ft} font={font} textZoom={textZoom} />}
      </g>
    )}
  </>;
}

export default memo(PlanWallsLayer);
