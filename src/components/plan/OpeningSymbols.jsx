// ─── Door / window plan symbols ──────────────────────────────────────────────
// Props-only: `T` is the CANVAS theme (mono-aware) so openings follow the drawing style,
// not the app chrome — call sites inside renderPlanCanvas pass the shadowed T. `tool` and
// `mode` only drive the cursor.
import { tierOf } from "../../constants/theme";

// Door SVG: arc swing + line
// `tt` is the CANVAS theme (mono-aware); call sites inside renderPlanCanvas pass the
// shadowed T so openings follow the drawing style, not the app chrome.
export function DoorSvg({ d, sel, T, tool, mode, pxPerFoot }) {
  const wpx = (d.width / 12) * pxPerFoot;
  const wallRad = (d.angle * Math.PI) / 180;
  // Wall direction unit vector
  const wdx = Math.cos(wallRad), wdy = Math.sin(wallRad);
  // Perpendicular (into room / out of room)
  const pdx = -wdy, pdy = wdx;
  // Hinge side: left or right edge of opening
  const hingeSide = d.hingeRight ? 1 : -1;
  const hx = d.x + wdx * (wpx / 2) * hingeSide;
  const hy = d.y + wdy * (wpx / 2) * hingeSide;
  // Swing direction: in or out (perpendicular to wall)
  const swingDir = d.flipped ? -1 : 1;
  // Door leaf end point (swings perpendicular from hinge)
  const ex = hx + pdx * wpx * swingDir;
  const ey = hy + pdy * wpx * swingDir;
  // Arc: from wall-flush position to open position
  // Wall-flush end (opposite side of opening from hinge)
  const fx = hx - wdx * wpx * hingeSide;
  const fy = hy - wdy * wpx * hingeSide;
  // Determine arc sweep
  const cross = (fx - hx) * (ey - hy) - (fy - hy) * (ex - hx);
  const sweep = cross > 0 ? 1 : 0;
  const isCaseOpening = d.doorType === "Case Opening";
  return <g style={{ cursor: tool === "select" && mode === "build" ? "pointer" : "inherit" }}>
    <circle cx={d.x} cy={d.y} r={wpx / 2 + 8} fill="transparent" />
    {isCaseOpening ? <>
      <line x1={d.x - wdx * wpx / 2} y1={d.y - wdy * wpx / 2} x2={d.x + wdx * wpx / 2} y2={d.y + wdy * wpx / 2} stroke={sel ? T.nodeFill : T.uiDoor + "80"} strokeWidth={2} strokeDasharray="4 3" />
      <circle cx={d.x - wdx * wpx / 2} cy={d.y - wdy * wpx / 2} r={2.5} fill={sel ? T.nodeFill : T.uiDoor} />
      <circle cx={d.x + wdx * wpx / 2} cy={d.y + wdy * wpx / 2} r={2.5} fill={sel ? T.nodeFill : T.uiDoor} />
    </> : <>
      {/* Mono: the leaf is joinery (T3) and the swing is entourage (T4) — the arc must
          sit a tier below the thing it describes or it competes with the opening. */}
      <line x1={hx} y1={hy} x2={ex} y2={ey} stroke={sel ? T.nodeFill : T.uiDoor} strokeWidth={tierOf(T, 2)?.w ?? 2} />
      <path d={`M ${fx} ${fy} A ${wpx} ${wpx} 0 0 ${sweep} ${ex} ${ey}`}
        fill="none" stroke={sel ? T.nodeFill : (tierOf(T, 3)?.color ?? T.uiDoor + "88")} strokeWidth={tierOf(T, 3)?.w ?? 1} strokeDasharray="4 2" />
      <circle cx={hx} cy={hy} r={3} fill={sel ? T.nodeFill : T.uiDoor} />
    </>}
    {/* Access reader (Openpath) at the jamb, on the approach side */}
    {d.accessControl && !isCaseOpening && (() => {
      const side = d.accessSide === "hinge" ? 1 : -1;
      const jx = d.x + wdx * (wpx / 2) * hingeSide * side, jy = d.y + wdy * (wpx / 2) * hingeSide * side;
      const offDir = hingeSide * side;
      const bx = jx + wdx * 5 * offDir - pdx * 6 * swingDir, by = jy + wdy * 5 * offDir - pdy * 6 * swingDir;
      return <g style={{ pointerEvents: "none" }}>
        <line x1={bx - wdx * 5} y1={by - wdy * 5} x2={bx + wdx * 5} y2={by + wdy * 5} stroke={sel ? T.nodeFill : T.brand} strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={bx} cy={by} r={1.5} fill={T.canvas} />
      </g>;
    })()}
  </g>;
}

// Window SVG: double line with gap (or dashed line for Cut Opening)
export function WindowSvg({ w, sel, T, tool, mode, pxPerFoot, themeMode }) {
  const wpx = (w.width / 12) * pxPerFoot;
  const rad = (w.angle * Math.PI) / 180;
  const dx = Math.cos(rad) * wpx / 2, dy = Math.sin(rad) * wpx / 2;
  if (w.type === "Cut Opening") {
    const col = sel ? T.nodeFill : "#A09068";
    // Normal perpendicular to opening direction (for wall thickness)
    const nx = -Math.sin(rad) * 3, ny = Math.cos(rad) * 3;
    // Jamb hatch length along the opening direction
    const jx = Math.cos(rad) * 4, jy = Math.sin(rad) * 4;
    return <g style={{ cursor: tool === "select" && mode === "build" ? "pointer" : "inherit" }}>
      <line x1={w.x - dx} y1={w.y - dy} x2={w.x + dx} y2={w.y + dy} stroke="transparent" strokeWidth={12} />
      {/* Top and bottom lines of opening rectangle */}
      <line x1={w.x - dx + nx} y1={w.y - dy + ny} x2={w.x + dx + nx} y2={w.y + dy + ny} stroke={col} strokeWidth={1.5} />
      <line x1={w.x - dx - nx} y1={w.y - dy - ny} x2={w.x + dx - nx} y2={w.y + dy - ny} stroke={col} strokeWidth={1.5} />
      {/* Left jamb end caps + diagonal hatch */}
      <line x1={w.x - dx + nx} y1={w.y - dy + ny} x2={w.x - dx - nx} y2={w.y - dy - ny} stroke={col} strokeWidth={1.5} />
      <line x1={w.x - dx - nx} y1={w.y - dy - ny} x2={w.x - dx + nx + jx} y2={w.y - dy + ny + jy} stroke={col} strokeWidth={1} />
      {/* Right jamb end caps + diagonal hatch */}
      <line x1={w.x + dx + nx} y1={w.y + dy + ny} x2={w.x + dx - nx} y2={w.y + dy - ny} stroke={col} strokeWidth={1.5} />
      <line x1={w.x + dx + nx} y1={w.y + dy + ny} x2={w.x + dx - nx - jx} y2={w.y + dy - ny - jy} stroke={col} strokeWidth={1} />
    </g>;
  }
  const nx = -Math.sin(rad) * 3, ny = Math.cos(rad) * 3;
  // Print keeps glazing monochrome (dark gray line + faint gray fill) so the sheet
  // stays ink-light; other themes use the schematic window blue.
  // Mono: glazing is joinery — T3 ink and T3 weight, with the glass band a faint wash
  // of the same ink so no second hue enters the drawing.
  const t3 = tierOf(T, 2);
  const winLine = sel ? T.nodeFill : (t3?.color ?? (themeMode === "print" ? "#3A3A3A" : "#60A0C8"));
  const winFill = sel ? "#E8E0D088" : (t3 ? t3.color + "26" : themeMode === "print" ? "#0000000F" : "#60A0C844");
  return <g style={{ cursor: tool === "select" && mode === "build" ? "pointer" : "inherit" }}>
    <line x1={w.x - dx} y1={w.y - dy} x2={w.x + dx} y2={w.y + dy} stroke="transparent" strokeWidth={12} />
    <line x1={w.x - dx + nx} y1={w.y - dy + ny} x2={w.x + dx + nx} y2={w.y + dy + ny} stroke={winLine} strokeWidth={t3?.w ?? 1.5} />
    <line x1={w.x - dx - nx} y1={w.y - dy - ny} x2={w.x + dx - nx} y2={w.y + dy - ny} stroke={winLine} strokeWidth={t3?.w ?? 1.5} />
    <line x1={w.x - dx} y1={w.y - dy} x2={w.x + dx} y2={w.y + dy} stroke={winFill} strokeWidth={6} style={{ vectorEffect: "none" }} />
  </g>;
}
