// ─── Plan IT/MEP markers layer ───────────────────────────────────────────────
// Every placed component symbol, its selected-state label, NEW badge and rotate handle.
// Memoized. `chromeT` is the CHROME theme (MarkerSymbol's ui* colour tokens come from
// the chrome, not the drawing style) — the caller passes the theme captured OUTSIDE
// renderPlanCanvas, where `T` is shadowed by the canvas theme.
//
// Visibility rules (unchanged from the inline render): in Build/IT-MEP the power layer's
// electrical and lighting items follow their own toggles; every other layer follows
// visibleLayers unless we're in Budget (which shows everything) or the item is a power
// item in a stage that owns power.
//
// `lod` 2 (far zoomed out) draws each unselected marker as a plain dot — a plan full of
// duplex-slot glyphs at 25% zoom is noise, and the dots still show where devices cluster.
import { memo } from "react";
import MarkerSymbol from "../MarkerSymbol";
import { SPEC_COMPONENTS, SPEC_LAYERS } from "../../constants/specs";
import { markerDrawPos } from "../../imports/geometry";

function PlanMarkersLayer({ markers, chromeT, themeMode, tool, mode, pxPerFoot, zoom, selectedId, selType, selectedIds, markerVisible, visibleLayers, visibleBuildElectrical, visibleBuildLighting, resolvePos, setRotatingMarker, lod = 0 }) {
  return markers.map(p => {
    if (!markerVisible(p)) return null;
    const rp = resolvePos(p);
    const p_r = rp.x !== p.x || rp.y !== p.y ? { ...p, x: rp.x, y: rp.y } : p;
    const l = SPEC_LAYERS[p_r.layer];
    const ct = p_r.componentType;
    const isBuildLighting = ct?.startsWith("light_") || ct?.startsWith("htrack_") || ct === "sconce_prewire" || ct === "pendent_prewire";
    const isBuildElec = !isBuildLighting && (ct?.startsWith("outlet_") || ct?.startsWith("switch_") || ct === "panel_board" || ct === "tstat");
    const isPowerMode = (mode === "build" || mode === "itmep") && p.layer === "power" && (isBuildElec || isBuildLighting);
    // In build/itmep mode, power items are hidden by their own visibility flags
    if ((mode === "build" || mode === "itmep") && p.layer === "power") {
      if (isBuildElec && !visibleBuildElectrical) return null;
      if (isBuildLighting && !visibleBuildLighting) return null;
    }
    if (!l || (!visibleLayers[p.layer] && mode !== "budget" && !isPowerMode)) return null;
    const compData = SPEC_COMPONENTS[p.layer]?.[p.componentType];
    const sel = (selectedId === p.id && selType === "marker") || selectedIds.includes(p.id);
    const glowEffect = sel && (mode === "budget" || mode === "itmep" || (mode === "build" && selectedIds.length > 1));

    // Where the symbol actually lands — wall devices stand off their wall. The
    // handle, label and NEW badge all hang off this, not the stored centerline.
    const dp = markerDrawPos(p_r, p_r.x, p_r.y, pxPerFoot);
    if (lod >= 2 && !sel) {
      return <circle key={p.id} cx={dp.x} cy={dp.y} r={3.5} fill={compData?.color || l.color} opacity={0.85} />;
    }
    const rotHandle = sel && selectedIds.length <= 1 && tool === "select" ? (() => {
      const HANDLE_R = 22 / zoom;
      const angle = p_r.angle || 0;
      // Swing to the room side for offset devices; otherwise it lands back on
      // the wall line the symbol just stepped away from, and can't be grabbed.
      const hAng = angle + (dp.x === p_r.x && dp.y === p_r.y ? -1 : p_r.side) * Math.PI / 2;
      const hx = dp.x + Math.cos(hAng) * HANDLE_R;
      const hy = dp.y + Math.sin(hAng) * HANDLE_R;
      return <g
        onMouseDown={ev => {
          ev.stopPropagation();
          setRotatingMarker({ id: p.id, cx: p_r.x, cy: p_r.y });
        }}>
        <line x1={dp.x} y1={dp.y} x2={hx} y2={hy} stroke="#50A0E0" strokeWidth={1.5} strokeDasharray="3 2" style={{ pointerEvents: "none" }} />
        <circle cx={hx} cy={hy} r={5 / zoom} fill="#50A0E0" stroke="#fff" strokeWidth={1.5} style={{ cursor: "grab" }} />
      </g>;
    })() : null;

    // Use custom symbol if available, otherwise use icon
    if (compData?.symbol) {
      return <g key={p.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
        <MarkerSymbol marker={p_r} selected={sel} T={chromeT} themeMode={themeMode} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
        {sel && <text x={dp.x} y={dp.y + 24} textAnchor="middle" fontSize={9} fill={compData.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{p_r.label}</text>}
        {p.isNew && <g style={{ pointerEvents: "none" }}>
          <rect x={dp.x - 10} y={dp.y - 22} width={20} height={9} rx={2.5} fill="#50A0E0" opacity={0.92} />
          <text x={dp.x} y={dp.y - 15} textAnchor="middle" fontSize={5.5} fill="#fff" fontWeight="bold" letterSpacing="0.04em" style={{ pointerEvents: "none" }}>NEW</text>
        </g>}
        {rotHandle}
      </g>;
    }

    // Fallback to icon rendering
    const icon = compData?.icon || "📍";
    return <g key={p.id} filter={glowEffect ? "url(#glow-budget)" : undefined}>
      <circle cx={p_r.x} cy={p_r.y} r={sel ? 11 : 9} fill={l.color + "30"} stroke={l.color} strokeWidth={sel ? 2.5 : 1.5} />
      <text x={p_r.x} y={p_r.y + 4} textAnchor="middle" fontSize={11} fill={l.color} style={{ pointerEvents: "none" }}>{icon}</text>
      {sel && <text x={p_r.x} y={p_r.y + 24} textAnchor="middle" fontSize={9} fill={l.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{p_r.label}</text>}
      {p.isNew && <g style={{ pointerEvents: "none" }}>
        <rect x={p_r.x - 10} y={p_r.y - 22} width={20} height={9} rx={2.5} fill="#50A0E0" opacity={0.92} />
        <text x={p_r.x} y={p_r.y - 15} textAnchor="middle" fontSize={5.5} fill="#fff" fontWeight="bold" letterSpacing="0.04em" style={{ pointerEvents: "none" }}>NEW</text>
      </g>}
      {rotHandle}
    </g>;
  });
}

export default memo(PlanMarkersLayer);
