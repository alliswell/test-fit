// ─── Plan grid layer ─────────────────────────────────────────────────────────
// The paper grid under the plan, clipped to the visible viewport and masked out under
// every floor (see CLAUDE.md → "The grid stops at the floor" for why the mask carries
// explicit x/y/width/height and an extent-keyed id). Memoized: it only re-renders when the
// camera, the canvas size, the theme or the floor outlines change.
//
//   vw/vh     viewport size in CSS px (the caller reads the SVG's box once per render)
//   floorPaths  Map<floorId, path d> — the SAME memo the floor hatch is cut from, so the
//               hole in the grid and the floor never disagree by a hair
import { memo } from "react";
import { gridStepFeet } from "../../imports/geometry";

function PlanGridLayer({ vw, vh, viewOff, zoom, pxPerFoot, T, floorPaths, gridMasked }) {
  const pad = pxPerFoot * 2;
  const minX = -viewOff.x / zoom - pad, maxX = (-viewOff.x + vw) / zoom + pad;
  const minY = -viewOff.y / zoom - pad, maxY = (-viewOff.y + vh) / zoom + pad;
  // Coarser spacing when zoomed out, so the grid stays a scale reference
  // instead of dissolving into a wash of 1' lines.
  const gridStep = gridStepFeet(zoom);
  const stepPx = pxPerFoot * gridStep;
  const startI = Math.floor(minX / stepPx), endI = Math.ceil(maxX / stepPx);
  const startJ = Math.floor(minY / stepPx), endJ = Math.ceil(maxY / stepPx);
  // Subdivisions below are always relative to whole feet, so they need their
  // own 1'-pitch indices — same as startI/startJ except when gridStep coarsens.
  const subI = Math.floor(minX / pxPerFoot), subJ = Math.floor(minY / pxPerFoot);
  const subEndI = Math.ceil(maxX / pxPerFoot), subEndJ = Math.ceil(maxY / pxPerFoot);
  // Mask extent, padded a full step: the lines round OUTWARD off startI/endI, so
  // they overrun minX..maxX by up to one step and a mask cut to the nominal
  // bounds shaves a strip of grid off the right and bottom edges.
  const mPad = stepPx;
  const mx = minX - mPad, my = minY - mPad;
  const mw = (maxX - minX) + mPad * 2, mh = (maxY - minY) + mPad * 2;
  // Keyed by the very numbers that define it, so an identical canvas shares the
  // mask and a differently-framed one gets its own.
  const gridMaskId = "grid-floor-mask-" +
    [mx, my, mw, mh].map(Math.round).join("_").replace(/-/g, "n");

  return <>
    {/* x/y/width/height are REQUIRED here, not optional tidiness: a mask region
        defaults to -10%,-10%,120%,120%, and under maskUnits="userSpaceOnUse"
        those percentages resolve against the SVG viewport but apply in the
        ZOOMED model space this group lives in. Pan past that window and the
        grid falls outside the region, where a mask reads as zero — so the grid
        vanished from most of the canvas instead of just under the floors. */}
    {gridMasked && (
      <mask id={gridMaskId} maskUnits="userSpaceOnUse" x={mx} y={my} width={mw} height={mh}>
        <rect x={mx} y={my} width={mw} height={mh} fill="#fff" />
        {[...floorPaths].map(([id, d]) => <path key={id} d={d} fillRule="evenodd" fill="#000" />)}
      </mask>
    )}
    <g data-testid="plan-grid" mask={gridMasked ? `url(#${gridMaskId})` : undefined}>
    {/* Base grid lines, `gridStep` feet apart */}
    <g data-testid="plan-grid-base" data-grid-step={gridStep} opacity={0.25}>
      {Array.from({ length: endI - startI + 1 }, (_, i) => {
        const pos = (startI + i) * stepPx;
        const isTenFoot = Math.abs(pos % (pxPerFoot * 10)) < 0.1;
        return <line key={"v1f" + (startI + i)} x1={pos} y1={minY} x2={pos} y2={maxY}
          stroke={isTenFoot ? T.gridSub : T.accentDim} strokeWidth={isTenFoot ? 1.2 : 0.6} />;
      })}
      {Array.from({ length: endJ - startJ + 1 }, (_, i) => {
        const pos = (startJ + i) * stepPx;
        const isTenFoot = Math.abs(pos % (pxPerFoot * 10)) < 0.1;
        return <line key={"h1f" + (startJ + i)} x1={minX} y1={pos} x2={maxX} y2={pos}
          stroke={isTenFoot ? T.gridSub : T.accentDim} strokeWidth={isTenFoot ? 1.2 : 0.6} />;
      })}
    </g>

    {/* 3" (quarter-foot) subdivisions at 150%+ */}
    {zoom >= 1.5 && <g opacity={0.15}>
      {Array.from({ length: (subEndI - subI) * 4 + 1 }, (_, i) => {
        const pos = (subI * 4 + i) * (pxPerFoot / 4);
        if (Math.abs(pos % pxPerFoot) < 0.1) return null;
        return <line key={"vi3" + (startI * 4 + i)} x1={pos} y1={minY} x2={pos} y2={maxY}
          stroke={T.gridSub} strokeWidth={0.4} />;
      })}
      {Array.from({ length: (endJ - startJ) * 4 + 1 }, (_, i) => {
        const pos = (startJ * 4 + i) * (pxPerFoot / 4);
        if (Math.abs(pos % pxPerFoot) < 0.1) return null;
        return <line key={"hi3" + (startJ * 4 + i)} x1={minX} y1={pos} x2={maxX} y2={pos}
          stroke={T.gridSub} strokeWidth={0.4} />;
      })}
    </g>}

    {/* 1" subdivisions at 300%+ */}
    {zoom >= 3 && <g opacity={0.1}>
      {Array.from({ length: (endI - startI) * 12 + 1 }, (_, i) => {
        const pos = (startI * 12 + i) * (pxPerFoot / 12);
        if (Math.abs(pos % (pxPerFoot / 4)) < 0.1) return null;
        return <line key={"vi1" + (startI * 12 + i)} x1={pos} y1={minY} x2={pos} y2={maxY}
          stroke={T.gridSub} strokeWidth={0.25} />;
      })}
      {Array.from({ length: (endJ - startJ) * 12 + 1 }, (_, i) => {
        const pos = (startJ * 12 + i) * (pxPerFoot / 12);
        if (Math.abs(pos % (pxPerFoot / 4)) < 0.1) return null;
        return <line key={"hi1" + (startJ * 12 + i)} x1={minX} y1={pos} x2={maxX} y2={pos}
          stroke={T.gridSub} strokeWidth={0.25} />;
      })}
    </g>}
    </g>
  </>;
}

export default memo(PlanGridLayer);
