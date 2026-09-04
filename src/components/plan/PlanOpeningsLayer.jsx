// ─── Plan openings layer ─────────────────────────────────────────────────────
// Doors, windows and columns — the Build-stage objects that sit on/inside walls.
// Memoized; `T` is the CANVAS theme (mono-aware), `tool`/`mode` only drive cursors.
import { memo } from "react";
import { DoorSvg, WindowSvg } from "./OpeningSymbols";

function PlanOpeningsLayer({ doors, windows, columns, T, tool, mode, themeMode, pxPerFoot, selectedId, selType, selectedIds, resolvePos, phaseVisible }) {
  const inToPx = (inches) => (inches / 12) * pxPerFoot;
  return <>
    {doors.map(d => {
      if (!phaseVisible(d.phase)) return null;
      const rp = resolvePos(d);
      const sel = (selectedId === d.id && selType === "door") || selectedIds.includes(d.id);
      const glowEffect = mode === "budget" && sel;
      return <g key={d.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
        <DoorSvg d={{ ...d, ...rp }} sel={sel} T={T} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
      </g>;
    })}
    {windows.map(w => {
      if (!phaseVisible(w.phase)) return null;
      const rp = resolvePos(w);
      const sel = (selectedId === w.id && selType === "window") || selectedIds.includes(w.id);
      const glowEffect = mode === "budget" && sel;
      return <g key={w.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
        <WindowSvg w={{ ...w, ...rp }} sel={sel} T={T} tool={tool} mode={mode} pxPerFoot={pxPerFoot} themeMode={themeMode} />
      </g>;
    })}
    {columns.map(col => {
      if (!phaseVisible(col.phase)) return null;
      const rp = resolvePos(col);
      const sel = (selectedId === col.id && selType === "column") || selectedIds.includes(col.id);
      const r = inToPx(col.size) / 2;
      const glowEffect = mode === "budget" && sel;
      return <g key={col.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
        {col.shape === "circle" ? (
          <>
            <circle cx={rp.x} cy={rp.y} r={r + 8} fill="transparent" style={{ cursor: tool === "select" && mode === "build" ? "move" : "inherit" }} />
            <circle cx={rp.x} cy={rp.y} r={r} fill={sel ? "#9A9488" : T.nodeStroke} stroke={sel ? T.nodeFill : "#9A9488"} strokeWidth={sel ? 2.5 : 1.5} style={{ pointerEvents: "none" }} />
          </>
        ) : (
          <>
            <rect x={rp.x - r - 8} y={rp.y - r - 8} width={(r + 8) * 2} height={(r + 8) * 2} fill="transparent" style={{ cursor: tool === "select" && mode === "build" ? "move" : "inherit" }} />
            <rect x={rp.x - r} y={rp.y - r} width={r * 2} height={r * 2} fill={sel ? "#9A9488" : T.nodeStroke} stroke={sel ? T.nodeFill : "#9A9488"} strokeWidth={sel ? 2.5 : 1.5} rx={2} style={{ pointerEvents: "none" }} />
          </>
        )}
      </g>;
    })}
  </>;
}

export default memo(PlanOpeningsLayer);
