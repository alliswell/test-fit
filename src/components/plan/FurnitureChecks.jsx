import { furnitureCorners } from "../../imports/geometry";
import { FONT } from "./Dims";

// ─── Furnish-stage check overlays (props-only) ───────────────────────────────
// Both say what is wrong in TEXT, never in colour alone: FurnitureFlag draws a dashed
// outline plus an "overlaps 2" / "through wall" tag over a placed piece the furnitureFlags
// memo caught; FurnitureApron draws the clearance zone around the selected piece with the
// count of neighbours inside it. `warn` is the theme's demo-wall red — the one "problem"
// hue the drawing already uses — and `halo` the canvas colour behind the type.
const pts = (c) => c.map(p => `${p.x},${p.y}`).join(" ");
const tag = (x, y, fs, fill, halo, children, extra = {}) => (
  <text x={x} y={y} fontSize={fs} fontFamily={FONT} fontWeight={600} fill={fill}
    paintOrder="stroke" stroke={halo} strokeWidth={fs * 0.35} strokeLinejoin="round" {...extra}>{children}</text>
);

export function FurnitureFlag({ f, flag, pxPerFoot, warn, halo = "#fff", textZoom = 1 }) {
  if (!flag || (!flag.overlap && !flag.wall)) return null;
  const c = furnitureCorners(f, pxPerFoot, 2);
  const label = [flag.overlap ? `overlaps ${flag.overlap}` : null, flag.wall ? "through wall" : null].filter(Boolean).join(" · ");
  const fs = 9 * textZoom;
  return (
    <g style={{ pointerEvents: "none" }} data-testid="furniture-flag">
      <polygon points={pts(c)} fill="none" stroke={warn} strokeWidth={2} strokeDasharray="5 3" />
      {tag(c[0].x + 3 * textZoom, c[0].y - 4 * textZoom, fs, warn, halo, label)}
    </g>
  );
}

export function FurnitureApron({ f, clearanceFt, hits, pxPerFoot, warn, ok, halo = "#fff", textZoom = 1 }) {
  if (!(clearanceFt > 0)) return null;
  const c = furnitureCorners(f, pxPerFoot, clearanceFt * pxPerFoot);
  const bad = hits > 0, col = bad ? warn : ok;
  const fs = 9 * textZoom;
  return (
    <g style={{ pointerEvents: "none" }} data-testid="furniture-apron" data-hits={hits}>
      <polygon points={pts(c)} fill={col + "12"} stroke={col} strokeWidth={bad ? 1.5 : 1} strokeDasharray={bad ? "6 3" : "2 3"} />
      {tag(c[3].x + 3 * textZoom, c[3].y + fs + 2 * textZoom, fs, col, halo, `${Math.round(clearanceFt * 12)}″ clearance${bad ? ` · ${hits} inside` : ""}`)}
    </g>
  );
}
