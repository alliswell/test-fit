// ─── Furniture2D ─────────────────────────────────────────────────────────────
// One placed furniture piece as a top-down parametric symbol. Props-only (never imports
// testfit.jsx). The piece is positioned at (f.x, f.y) and rotated by f.angle; its footprint
// is f.w × f.d feet scaled by pxPerFoot. The catalog entry's draw(W,D) supplies detail
// primitives in a LOCAL frame centred at 0,0 (+x = width, +y = depth, px). We draw the base
// footprint (rect or ellipse) first, then the details, then — when selected — a bounding
// outline. A transparent oversized hit-target sits underneath so it's easy to grab.
//
// `tt` is the active CANVAS theme (mono when on), passed explicitly so this leaf never
// closes over the chrome theme — same convention as DoorSvg/WindowSvg.
import { FURNITURE_CATALOG } from "../constants/furniture";

export default function Furniture2D({ f, pxPerFoot, sel = false, tt, tier = null, moveCursor = "inherit" }) {
  const spec = FURNITURE_CATALOG[f.type];
  if (!spec) return null;
  const W = f.w * pxPerFoot, D = f.d * pxPerFoot;
  const stroke = tier?.color || tt.furniture || tt.text;
  const line = sel ? tt.selBorder : stroke;
  const lw = sel ? 2 : 1.25;
  const fill = (tier?.color || tt.furniture || tt.text) + "14"; // faint tint
  const prims = spec.draw(W, D, f.w, f.d) || [];
  // Stroke weight follows the canvas policy set by the zoomed group's .tf-const-stroke
  // class (pinned to the 100% weight below 100% zoom, magnified above it) — no per-element
  // vector-effect here, or furniture would stay hairline-thin while the walls it sits by
  // grow with the zoom. Docs sheets, which never pin, scale it with the drawing.

  const shape = (p, i) => {
    // key is passed directly (never spread — React warns on a key inside {...props}).
    const common = { stroke: line, strokeWidth: lw, fill: p.fill === false ? "none" : fill, strokeLinejoin: "round" };
    switch (p.t) {
      case "rect": return <rect key={i} {...common} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r || 0} />;
      case "circle": return <circle key={i} {...common} cx={p.cx} cy={p.cy} r={p.r} />;
      case "ellipse": return <ellipse key={i} {...common} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} />;
      case "line": return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={line} strokeWidth={lw} strokeLinecap="round" />;
      case "path": return <path key={i} {...common} d={p.d} />;
      default: return null;
    }
  };

  const hit = spec.round
    ? <ellipse cx={0} cy={0} rx={W / 2 + 6} ry={D / 2 + 6} fill="transparent" style={{ cursor: moveCursor }} />
    : <rect x={-W / 2 - 6} y={-D / 2 - 6} width={W + 12} height={D + 12} fill="transparent" style={{ cursor: moveCursor }} />;

  const outline = spec.round
    ? <ellipse cx={0} cy={0} rx={W / 2} ry={D / 2} fill="none" stroke={line} strokeWidth={lw} strokeDasharray={sel ? "4 3" : undefined} />
    : <rect x={-W / 2} y={-D / 2} width={W} height={D} fill="none" stroke={line} strokeWidth={lw} strokeDasharray={sel ? "4 3" : undefined} rx={2} />;

  return (
    <g transform={`translate(${f.x},${f.y}) rotate(${(f.angle || 0) * 180 / Math.PI})`}>
      {hit}
      <g style={{ pointerEvents: "none" }}>
        {outline}
        {prims.map(shape)}
      </g>
    </g>
  );
}
