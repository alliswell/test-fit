// ─── Plan floors layer ───────────────────────────────────────────────────────
// Floor regions: material hatch (with nested rooms carved out via fillRule evenodd — see
// nestedFloorHoles), selection outline, label, and — only once a floor is UNLOCKED by a
// double-click (`floorEditId`) — its edge and vertex handles. Memoized; props are the
// store arrays + stable callbacks, so it re-renders only when floors/selection change.
import { memo } from "react";
import { polyCentroid } from "../../imports/model";
import { wallResizeCursor } from "../../imports/geometry";
import { FLOOR_MATERIAL_HATCHES } from "../../constants/specs";

function PlanFloorsLayer({ floorRegions, floorPaths, T, tool, mode, selectedId, selType, selectedIds, floorEditId, layerLocked, setSelectedId, setSelType, setSelectedIds }) {
  return floorRegions.map(fr => {
    // Same path the grid mask is cut from — a floor and the hole it punches in
    // the grid have to be the same shape, or the grid shows in the seam.
    const d = floorPaths.get(fr.id);
    if (!d) return null;
    const sel = (selectedId === fr.id && selType === "floorRegion") || selectedIds.includes(fr.id);
    // Handles appear only once the floor is UNLOCKED by a double-click. Selected-
    // but-locked still reads as selected (dashed outline + Room card) — it just
    // can't be dragged, which is the whole point of the gate.
    const editing = floorEditId === fr.id;
    const hatchId = FLOOR_MATERIAL_HATCHES[fr.material] || FLOOR_MATERIAL_HATCHES.Wood;
    const c = polyCentroid(fr.points);
    return <g key={fr.id} style={{ cursor: tool !== "select" ? "inherit" : editing ? "move" : "pointer", pointerEvents: (layerLocked("floorRegions") || mode !== "build") ? "none" : undefined }}
      onClick={() => { if (tool === "select") { setSelectedId(fr.id); setSelType("floorRegion"); setSelectedIds([fr.id]); } }}>
      <path data-testid={"floor-path-" + fr.id} d={d} fillRule="evenodd" fill={`url(#${hatchId})`} stroke={sel ? T.accent : "transparent"} strokeWidth={sel ? 1.5 : 0} strokeDasharray={editing ? "none" : sel ? "4 3" : "none"} />
      {editing && fr.points.map((a, ei) => {
        const b = fr.points[(ei + 1) % fr.points.length];
        return <line key={"e" + ei} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={10} strokeLinecap="round" style={{ cursor: wallResizeCursor(a.x, a.y, b.x, b.y) }} />;
      })}
      {fr.label && <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={T.textMuted} fontFamily="inherit" style={{ pointerEvents: "none" }}>{fr.label}</text>}
      {editing && fr.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5} fill={T.accent} stroke={T.nodeFill} strokeWidth={1.5} style={{ cursor: "move" }} />)}
    </g>;
  });
}

export default memo(PlanFloorsLayer);
