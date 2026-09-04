// ─── MarkerSymbol ────────────────────────────────────────────────────────────
// IT/MEP plan symbol, keyed on the catalog entry's `symbol`. Props-only (extracted from
// testfit.jsx): `T` is the CHROME theme (its ui* colour tokens are what uiColor maps to),
// `tool`/`mode` drive the cursor, pxPerFoot scales the real-size glyphs (H-track, cans).
// Power/lighting glyphs follow the classic architectural electrical-plan convention —
// see CLAUDE.md → MarkerSymbol for the conventions to keep when adding variants.
import { SPEC_COMPONENTS, FINISH_COLORS } from "../constants/specs";
import { markerDrawPos } from "../imports/geometry";

// Maps bright "schematic" colors to readable equivalents in light mode.
export const uiColor = (c, themeMode, T) => themeMode === 'dark' ? c : ({
  '#E8D070': T.uiLighting, '#C8A060': T.uiDoor, '#E0A050': T.uiConduit,
  '#C87840': T.uiPrewire,  '#50C878': T.uiElec,  '#E05050': T.uiPanel,
  '#E8C840': T.uiBudget,   '#60B0E0': '#2060A0',  '#4080E0': '#1A50A0',
}[c] ?? c);

export default function MarkerSymbol({ marker, selected, T, themeMode, tool, mode, pxPerFoot }) {
  const compData = SPEC_COMPONENTS[marker.layer]?.[marker.componentType];
  if (!compData) return null;

  const { symbol, letter } = compData;
  const color = uiColor(compData.color, themeMode, T);
  const r = selected ? 11 : 9;
  const strokeW = selected ? 2.5 : 1.5;
  // Wall devices (outlets/switches) are stored on the wall centerline but DRAWN standing
  // off it into the room they serve. Identity for every other component.
  const { x, y } = markerDrawPos(marker, marker.x, marker.y, pxPerFoot);
  const cur = tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit";
  // Device finish (white/black) drives the body fill + outline; otherwise the spec color.
  const fin = marker.finish && FINISH_COLORS[marker.finish];
  const fill = fin ? fin.fill : color;
  const line = fin ? fin.line : color;
  // Coverage wedge (local coords; caller rotates the group to the aim direction).
  const wedge = (halfDeg, len, col) => {
    const h = halfDeg * Math.PI / 180;
    const p1x = Math.cos(-h) * len, p1y = Math.sin(-h) * len, p2x = Math.cos(h) * len, p2y = Math.sin(h) * len;
    return <path d={`M 0 0 L ${p1x} ${p1y} A ${len} ${len} 0 0 1 ${p2x} ${p2y} Z`}
      fill={(col || color) + "1E"} stroke={(col || color) + "66"} strokeWidth={0.75} style={{ pointerEvents: "none" }} />;
  };
  // Wi-Fi fan arc of radius R centered above source dot (dx,dy) — robust polyline.
  const wifiArc = (dx, dy, R) => {
    let p = "";
    for (let k = 0; k <= 8; k++) { const th = (220 + 12.5 * k) * Math.PI / 180; p += (k ? " L " : "M ") + (dx + R * Math.cos(th)).toFixed(1) + " " + (dy + R * Math.sin(th)).toFixed(1); }
    return p;
  };
  // Ceiling-light "sunburst" glyph (architectural convention: filled disc + radiating rays).
  const sunburst = (cx, cy, rCore, rTip, n = 8) => Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return <line key={k} x1={cx + Math.cos(a) * rCore} y1={cy + Math.sin(a) * rCore}
      x2={cx + Math.cos(a) * rTip} y2={cy + Math.sin(a) * rTip}
      stroke={color} strokeWidth={1.2} style={{ pointerEvents: "none" }} />;
  });

  if (symbol === "circle") {
    return <g>
      <circle cx={marker.x} cy={marker.y} r={r} fill={color} stroke={color} strokeWidth={strokeW} />
      {letter && <text x={marker.x} y={marker.y + 4} textAnchor="middle" fontSize={10} fill="#FFFFFF" fontWeight="bold" style={{ pointerEvents: "none" }}>{letter}</text>}
    </g>;
  } else if (symbol === "crosshair") {
    return <g>
      <circle cx={marker.x} cy={marker.y} r={r} fill="none" stroke={color} strokeWidth={strokeW} />
      <line x1={marker.x - r} y1={marker.y} x2={marker.x + r} y2={marker.y} stroke={color} strokeWidth={strokeW} />
      <line x1={marker.x} y1={marker.y - r} x2={marker.x} y2={marker.y + r} stroke={color} strokeWidth={strokeW} />
    </g>;
  } else if (symbol === "rect") {
    // H-track: render at actual scale (4ft or 8ft long)
    const isHtrack = marker.componentType === "htrack_4" || marker.componentType === "htrack_8" || marker.componentType === "htrack";
    if (isHtrack) {
      const ftLen = marker.componentType === "htrack_8" ? 8 : 4;
      const trackLen = ftLen * pxPerFoot;
      const trackW = pxPerFoot * 0.25; // ~3" wide
      const angle = marker.angle || 0;
      const hw = trackLen / 2;
      const hh = trackW / 2;
      // Rectangle centered at origin, then rotated
      return <g transform={`translate(${marker.x},${marker.y}) rotate(${angle * 180 / Math.PI})`}>
        <rect x={-hw} y={-hh} width={trackLen} height={trackW}
              fill={color + "22"} stroke={color} strokeWidth={selected ? 2 : 1.5} rx={1} />
        {/* tick marks every foot */}
        {Array.from({ length: ftLen - 1 }, (_, i) => {
          const tx = -hw + (i + 1) * pxPerFoot;
          return <line key={i} x1={tx} y1={-hh} x2={tx} y2={hh} stroke={color} strokeWidth={0.75} opacity={0.6} />;
        })}
        <text x={0} y={4} textAnchor="middle" fontSize={9} fill={color} fontWeight="bold"
              style={{ pointerEvents: "none" }}>{ftLen}'</text>
      </g>;
    }
    return <g>
      <rect x={marker.x - r * 1.2} y={marker.y - r * 0.6} width={r * 2.4} height={r * 1.2} fill="none" stroke={color} strokeWidth={strokeW} rx={1} />
      {letter && <text x={marker.x} y={marker.y + 4} textAnchor="middle" fontSize={10} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>{letter}</text>}
    </g>;
  }
  if (symbol === "outlet") {
    const angleDeg = (marker.angle || 0) * 180 / Math.PI;
    const isSurface = compData.mount === "surface";
    const isQuad = compData.outletCount === 4;
    return <g transform={`translate(${x},${y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit" }}>
      <circle cx={0} cy={0} r={r + 6} fill="transparent" />
      {isSurface && <rect x={-(r+4)} y={-(r+4)} width={(r+4)*2} height={(r+4)*2} fill="none" stroke={color} strokeWidth={1} strokeDasharray="3 2" rx={2} style={{ pointerEvents: "none" }} />}
      <circle cx={0} cy={0} r={r} fill={color + "18"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      {/* Duplex/quad receptacle slots (architectural convention) */}
      {isQuad ? <>
        <line x1={-3} y1={-r * 0.62} x2={-3} y2={r * 0.62} stroke={color} strokeWidth={1.4} style={{ pointerEvents: "none" }} />
        <line x1={3} y1={-r * 0.62} x2={3} y2={r * 0.62} stroke={color} strokeWidth={1.4} style={{ pointerEvents: "none" }} />
        <line x1={-r * 0.62} y1={-3} x2={r * 0.62} y2={-3} stroke={color} strokeWidth={1.4} style={{ pointerEvents: "none" }} />
        <line x1={-r * 0.62} y1={3} x2={r * 0.62} y2={3} stroke={color} strokeWidth={1.4} style={{ pointerEvents: "none" }} />
      </> : <>
        <line x1={-2.6} y1={-r * 0.62} x2={-2.6} y2={r * 0.62} stroke={color} strokeWidth={1.4} style={{ pointerEvents: "none" }} />
        <line x1={2.6} y1={-r * 0.62} x2={2.6} y2={r * 0.62} stroke={color} strokeWidth={1.4} style={{ pointerEvents: "none" }} />
      </>}
      <text x={0} y={r + 9} textAnchor="middle" fontSize={selected ? 8 : 7} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>{isQuad ? "Q" : "D"}</text>
    </g>;
  }
  if (symbol === "outlet_ceiling") {
    return <g style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit" }}>
      <circle cx={marker.x} cy={marker.y} r={r + 6} fill="transparent" />
      <circle cx={marker.x} cy={marker.y} r={r} fill="none" stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <line x1={marker.x - r} y1={marker.y} x2={marker.x + r} y2={marker.y} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <line x1={marker.x} y1={marker.y - r} x2={marker.x} y2={marker.y + r} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <circle cx={marker.x} cy={marker.y} r={3} fill={color} style={{ pointerEvents: "none" }} />
    </g>;
  }
  if (symbol === "switch") {
    const angleDeg = (marker.angle || 0) * 180 / Math.PI;
    const lbl = compData?.letter || "S";
    return <g transform={`translate(${x},${y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit" }}>
      <circle cx={0} cy={0} r={r + 6} fill="transparent" />
      {/* Minimal wall-switch dot + designation letter (architectural convention) */}
      <circle cx={0} cy={0} r={2.2} fill={color} style={{ pointerEvents: "none" }} />
      {selected && <circle cx={0} cy={0} r={r * 0.85} fill="none" stroke={color} strokeWidth={1} opacity={0.35} style={{ pointerEvents: "none" }} />}
      <text x={r * 0.65} y={-r * 0.15} textAnchor="start" fontSize={selected ? 9 : 8} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>{lbl}</text>
    </g>;
  }
  if (symbol === "panel") {
    const angleDeg = (marker.angle || 0) * 180 / Math.PI;
    const pw = r * 2.2, ph = r * 3;
    return <g transform={`translate(${marker.x},${marker.y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "inherit" }}>
      <rect x={-(pw / 2) - 4} y={-(ph / 2) - 4} width={pw + 8} height={ph + 8} fill="transparent" />
      {/* Panel body */}
      <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} fill={color + "18"} stroke={color} strokeWidth={selected ? 2 : 1.5} rx={2} style={{ pointerEvents: "none" }} />
      {/* Breaker rows */}
      {[-.55, -.18, .18, .55].map((yf, i) => (
        <rect key={i} x={-pw * 0.3} y={ph * yf / 2 - 2} width={pw * 0.6} height={4} fill={color + "55"} rx={1} style={{ pointerEvents: "none" }} />
      ))}
      <text x={0} y={ph / 2 + 9} textAnchor="middle" fontSize={selected ? 8 : 7} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>PANEL</text>
    </g>;
  }
  if (symbol === "recessed") {
    const sz = compData.size || 4; // inches
    const rPx = (sz / 12) * pxPerFoot / 2;
    const rv = Math.max(rPx, selected ? 10 : 8);
    const core = rv * 0.62;
    return <g style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "default" }}>
      <circle cx={marker.x} cy={marker.y} r={rv + 6} fill="transparent" />
      {sunburst(marker.x, marker.y, core * 1.05, rv * 1.35)}
      <circle cx={marker.x} cy={marker.y} r={core} fill={color} stroke={color} strokeWidth={0.5} style={{ pointerEvents: "none" }} />
    </g>;
  }
  if (symbol === "pendant") {
    const core = r * 0.62;
    const tip = r * 1.35;
    return <g style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "default" }}>
      <circle cx={marker.x} cy={marker.y} r={tip + 6} fill="transparent" />
      {sunburst(marker.x, marker.y, core * 1.05, tip)}
      <circle cx={marker.x} cy={marker.y} r={core} fill={color} stroke={color} strokeWidth={0.5} style={{ pointerEvents: "none" }} />
      {/* Suspension stem to ceiling mount — distinguishes pendant from flush recessed */}
      <line x1={marker.x} y1={marker.y - tip} x2={marker.x} y2={marker.y - tip - 7} stroke={color} strokeWidth={1} style={{ pointerEvents: "none" }} />
      <line x1={marker.x - 4} y1={marker.y - tip - 7} x2={marker.x + 4} y2={marker.y - tip - 7} stroke={color} strokeWidth={1.5} style={{ pointerEvents: "none" }} />
    </g>;
  }
  if (symbol === "sconce") {
    const angleDeg = (marker.angle || 0) * 180 / Math.PI;
    // `angle` is the WALL direction (local +x runs along the wall) and `side` is which
    // room it serves, so the plate lies flat on the wall and the throw fans into that
    // room — you can read the mounting wall AND the direction straight off the plan.
    const s = marker.side || 1;
    return <g transform={`translate(${x},${y}) rotate(${angleDeg})`} style={{ cursor: tool === "select" && (mode === "itmep" || (mode === "build" && marker.layer === "power")) ? "pointer" : "default" }}>
      <circle cx={0} cy={0} r={r + 5} fill="transparent" />
      {/* Wall plate, lying along the wall */}
      <rect x={-r * 0.8} y={-r * 0.34} width={r * 1.6} height={r * 0.68} fill={color + "18"} stroke={color} strokeWidth={strokeW} rx={1} style={{ pointerEvents: "none" }} />
      {/* Light throw, fanning into the room */}
      <line x1={-r * 0.55} y1={r * 0.34 * s} x2={-r * 1.15} y2={r * 1.3 * s} stroke={color} strokeWidth={0.75} style={{ pointerEvents: "none" }} />
      <line x1={r * 0.55} y1={r * 0.34 * s} x2={r * 1.15} y2={r * 1.3 * s} stroke={color} strokeWidth={0.75} style={{ pointerEvents: "none" }} />
      <circle cx={0} cy={r * 0.12 * s} r={2.5} fill={color} style={{ pointerEvents: "none" }} />
    </g>;
  }
  // ── Thermostat ──────────────────────────────────────────────────────────
  if (symbol === "tstat") {
    const angleDeg = (marker.angle || 0) * 180 / Math.PI;
    return <g transform={`translate(${x},${y}) rotate(${angleDeg})`} style={{ cursor: cur }}>
      <rect x={-r - 4} y={-r - 4} width={(r + 4) * 2} height={(r + 4) * 2} fill="transparent" />
      <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={3} fill={color + "18"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <circle cx={0} cy={-r * 0.15} r={r * 0.42} fill="none" stroke={color} strokeWidth={1} style={{ pointerEvents: "none" }} />
      <text x={0} y={r * 0.78} textAnchor="middle" fontSize={6.5} fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>T</text>
    </g>;
  }
  // ── Wall speaker (directional: body along wall, dispersion toward room) ────
  if (symbol === "speaker") {
    const angleDeg = (marker.angle || 0) * 180 / Math.PI;
    return <g transform={`translate(${x},${y}) rotate(${angleDeg})`} style={{ cursor: cur }}>
      <rect x={-r - 6} y={-r - 6} width={(r + 6) * 2} height={(r + 6) * 2} fill="transparent" />
      {wedge(55, selected ? 8 * pxPerFoot : 28)}
      <rect x={-r * 0.6} y={-r} width={r * 1.2} height={r * 2} rx={2} fill={fill} stroke={line} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <circle cx={0} cy={0} r={r * 0.62} fill="none" stroke={line} strokeWidth={1} opacity={0.55} style={{ pointerEvents: "none" }} />
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.2} fontWeight={700} fill={line} fontFamily="inherit" style={{ pointerEvents: "none" }}>S</text>
    </g>;
  }
  // ── Subwoofer (bold box, dual driver) ─────────────────────────────────────
  if (symbol === "sub") {
    return <g style={{ cursor: cur }}>
      <rect x={x - r * 1.2} y={y - r * 1.4} width={r * 2.4} height={r * 2.8} fill="transparent" />
      <rect x={x - r * 1.05} y={y - r * 1.3} width={r * 2.1} height={r * 2.6} rx={2} fill={fill} stroke={line} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <circle cx={x} cy={y - r * 0.55} r={r * 0.52} fill="none" stroke={line} strokeWidth={1.2} style={{ pointerEvents: "none" }} />
      <circle cx={x} cy={y + r * 0.55} r={r * 0.52} fill="none" stroke={line} strokeWidth={1.2} style={{ pointerEvents: "none" }} />
    </g>;
  }
  // ── Pendant speaker (down-firing: concentric rings) ───────────────────────
  if (symbol === "pendant_spkr") {
    return <g style={{ cursor: cur }}>
      <circle cx={x} cy={y} r={r + 5} fill="transparent" />
      <circle cx={x} cy={y} r={r} fill={fill} stroke={line} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <circle cx={x} cy={y} r={r * 0.58} fill="none" stroke={line} strokeWidth={1} opacity={0.55} style={{ pointerEvents: "none" }} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={r} fontWeight={700} fill={line} fontFamily="inherit" style={{ pointerEvents: "none" }}>S</text>
    </g>;
  }
  // ── Speaker drop (cable + 1/4" TS plug) ───────────────────────────────────
  if (symbol === "speaker_drop") {
    return <g style={{ cursor: cur }}>
      <rect x={x - 7} y={y - r - 4} width={14} height={(r + 4) * 2} fill="transparent" />
      <circle cx={x} cy={y - r} r={2.6} fill={color} style={{ pointerEvents: "none" }} />
      <path d={`M ${x} ${y - r + 2} q 6 4 0 8 q -6 4 0 8`} fill="none" stroke={color} strokeWidth={1.4} style={{ pointerEvents: "none" }} />
      <rect x={x - 2.6} y={y + r - 3} width={5.2} height={8} rx={2} fill={color} style={{ pointerEvents: "none" }} />
      <line x1={x - 2.6} y1={y + r} x2={x + 2.6} y2={y + r} stroke={T.canvas} strokeWidth={0.8} style={{ pointerEvents: "none" }} />
      <rect x={x - 1.2} y={y + r + 5} width={2.4} height={5} fill={color} style={{ pointerEvents: "none" }} />
    </g>;
  }
  // ── IT rack (open-frame, horizontal rails) ────────────────────────────────
  if (symbol === "rack") {
    const w = r * 1.8, h = r * 2.4;
    return <g style={{ cursor: cur }}>
      <rect x={x - w / 2 - 4} y={y - h / 2 - 4} width={w + 8} height={h + 8} fill="transparent" />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={1.5} fill={color + "18"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      {[-0.5, -0.17, 0.17, 0.5].map((f, i) => (
        <line key={i} x1={x - w / 2 + 2} y1={y + h * f / 2} x2={x + w / 2 - 2} y2={y + h * f / 2} stroke={color} strokeWidth={1} opacity={0.7} style={{ pointerEvents: "none" }} />
      ))}
      {[-1, 1].map(s => <line key={s} x1={x + s * w / 2} y1={y - h / 2} x2={x + s * (w / 2 + 3)} y2={y - h / 2} stroke={color} strokeWidth={1.5} style={{ pointerEvents: "none" }} />)}
    </g>;
  }
  // ── Router / AP (disc + Wi-Fi fan) ────────────────────────────────────────
  if (symbol === "router") {
    const dy = y + r * 0.5; // source dot near the bottom, waves fan upward
    return <g style={{ cursor: cur }}>
      <circle cx={x} cy={y} r={r + 4} fill="transparent" />
      <circle cx={x} cy={y} r={r} fill={fill} stroke={line} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      {[r * 0.42, r * 0.72, r * 1.02].map((R, i) => <path key={i} d={wifiArc(x, dy, R)} fill="none" stroke={line} strokeWidth={1.1} strokeLinecap="round" style={{ pointerEvents: "none" }} />)}
      <circle cx={x} cy={dy} r={1.7} fill={line} style={{ pointerEvents: "none" }} />
    </g>;
  }
  // ── Floor drain (grate) ───────────────────────────────────────────────────
  if (symbol === "drain") {
    return <g style={{ cursor: cur }}>
      <circle cx={x} cy={y} r={r + 4} fill="transparent" />
      <circle cx={x} cy={y} r={r} fill={color + "22"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      {[-0.5, 0, 0.5].map((f, i) => (
        <line key={i} x1={x - r * 0.7} y1={y + r * f} x2={x + r * 0.7} y2={y + r * f} stroke={color} strokeWidth={1} style={{ pointerEvents: "none" }} />
      ))}
      <circle cx={x} cy={y} r={r * 0.28} fill="none" stroke={color} strokeWidth={1} style={{ pointerEvents: "none" }} />
    </g>;
  }
  // ── Water line (stub + droplet) ───────────────────────────────────────────
  if (symbol === "water") {
    return <g style={{ cursor: cur }}>
      <circle cx={x} cy={y} r={r + 4} fill="transparent" />
      <circle cx={x} cy={y} r={r} fill={color + "1E"} stroke={color} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <path d={`M ${x} ${y - r * 0.55} q ${r * 0.5} ${r * 0.7} 0 ${r * 1.1} q ${-r * 0.5} ${-r * 0.4} 0 ${-r * 1.1} Z`} fill={color} style={{ pointerEvents: "none" }} />
    </g>;
  }
  // ── Security camera / floodlight (directional, FOV cone toward room) ───────
  if (symbol === "camera" || symbol === "floodlight") {
    const angleDeg = (marker.angle || 0) * 180 / Math.PI;
    const isFlood = symbol === "floodlight";
    return <g transform={`translate(${x},${y}) rotate(${angleDeg})`} style={{ cursor: cur }}>
      <rect x={-r - 6} y={-r - 6} width={(r + 6) * 2} height={(r + 6) * 2} fill="transparent" />
      {wedge(isFlood ? 60 : 40, selected ? (isFlood ? 12 : 10) * pxPerFoot : (isFlood ? 40 : 32), isFlood ? "#E8C840" : color)}
      <rect x={-r * 0.55} y={-r * 0.72} width={r * 1.1} height={r * 1.44} rx={2} fill={fill} stroke={line} strokeWidth={strokeW} style={{ pointerEvents: "none" }} />
      <circle cx={r * 0.5} cy={0} r={r * 0.34} fill="#141414" stroke={line} strokeWidth={1} style={{ pointerEvents: "none" }} />
      {isFlood && [-1, 1].map(s => (
        <rect key={s} x={-r * 0.18} y={s > 0 ? r * 0.74 : -r * 1.12} width={r * 0.36} height={r * 0.38} rx={1} fill={fill} stroke={line} strokeWidth={1} style={{ pointerEvents: "none" }} />
      ))}
      <text x={-r * 0.12} y={0} textAnchor="middle" dominantBaseline="central" fontSize={r * 0.95} fontWeight={700} fill={line} fontFamily="inherit" style={{ pointerEvents: "none" }}>C</text>
    </g>;
  }
  return null;
}
