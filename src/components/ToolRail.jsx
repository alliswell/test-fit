// ─── ToolRail ────────────────────────────────────────────────────────────────────
// Vertical tool rail between the sidebar and the canvas: the universal tools (select,
// dimension, label, rev cloud) plus the current stage's placement tools. Hidden in Docs.
// Props-only (never imports testfit.jsx): `S` is the shared style sheet, `T` the chrome
// theme; everything else is state and handlers threaded from TestfitTool.
import { memo } from "react";
import MarkerSymbol from "./MarkerSymbol";
import { ColumnIcon, RectRoomIcon, WallIcon, WindowIcon } from "./icons";
import { DoorOpen, MousePointer2, Ruler } from "lucide-react";
import { SPEC_COMPONENTS, SPEC_LAYERS } from "../constants/specs";
import { Tooltip, TooltipContent, TooltipTrigger } from "../app/components/ui/tooltip";

function ToolRail({
  S, T, activeComponentType, activeSpecLayer, bgImage, chromeT, markerFinish, mode, pxPerFoot, setActiveComponentType, setT, themeMode, tool, wallKind, wallKinds,
}) {
  return (
    <>
      {/* ── Left tool rail (planning modes — Docs has its own slide tools) ── */}
        {mode !== "docs" && <div style={S.toolRail}>

          {/* ── Universal tools (Select · Dim · Label · RevCloud) ── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button style={S.toolBtn(tool === "select")} onClick={() => setT("select")}>
                <MousePointer2 size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Select (V)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button style={S.toolBtn(tool === "dim", T.dimText)} onClick={() => setT("dim")}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <line x1="3" y1="10" x2="17" y2="10" stroke={T.dimText} strokeWidth="1" />
                  <line x1="3" y1="6" x2="3" y2="14" stroke={T.dimText} strokeWidth="1.5" />
                  <line x1="17" y1="6" x2="17" y2="14" stroke={T.dimText} strokeWidth="1.5" />
                  <line x1="3" y1="7" x2="5.5" y2="10" stroke={T.dimText} strokeWidth="1" />
                  <line x1="3" y1="13" x2="5.5" y2="10" stroke={T.dimText} strokeWidth="1" />
                  <line x1="17" y1="7" x2="14.5" y2="10" stroke={T.dimText} strokeWidth="1" />
                  <line x1="17" y1="13" x2="14.5" y2="10" stroke={T.dimText} strokeWidth="1" />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Dimension (M)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button style={S.toolBtn(tool === "label", T.textBright)} onClick={() => setT("label")}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <text x="10" y="15" textAnchor="middle" fontSize="15" fontWeight="700"
                    fill={tool === "label" ? T.textBright : T.textMuted} fontFamily="sans-serif">T</text>
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Label / Callout (T)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button style={S.toolBtn(tool === "revcloud", "#E05252")} onClick={() => setT("revcloud")}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 16 A3 3 0 0 1 4 16 A3 3 0 0 1 2 11 A3 3 0 0 1 5 6 A3 3 0 0 1 10 5 A3 3 0 0 1 15 6 A3 3 0 0 1 18 11 A3 3 0 0 1 16 16 Z"
                    stroke={tool === "revcloud" ? "#E05252" : T.textMuted} strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>Revision Cloud (N)</TooltipContent>
          </Tooltip>

          {/* Flow Path + Floor Region draw on top of the built plan, so — like the rest of
              the Build-mode tools below — they only make sense while building. */}
          {mode === "build" && <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button data-testid="tool-flowpath" style={S.toolBtn(tool === "flowPath", "#4A90D9")} onClick={() => setT("flowPath")}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 15 L8 7 L13 12 L17 5" stroke={tool === "flowPath" ? "#4A90D9" : T.textMuted} strokeWidth="3.5" strokeOpacity="0.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 15 L8 7 L13 12 L17 5" stroke={tool === "flowPath" ? "#4A90D9" : T.textMuted} strokeWidth="1" strokeDasharray="2 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Flow Path (K)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button data-testid="tool-floorregion" style={S.toolBtn(tool === "floorRegion", "#7A9E5A")} onClick={() => setT("floorRegion")}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="3" width="14" height="14" rx="1.5" stroke={tool === "floorRegion" ? "#7A9E5A" : T.textMuted} strokeWidth="1.5" />
                    <line x1="3" y1="8"  x2="17" y2="8"  stroke={tool === "floorRegion" ? "#7A9E5A" : T.textMuted} strokeWidth="0.8" opacity="0.6" />
                    <line x1="3" y1="12" x2="17" y2="12" stroke={tool === "floorRegion" ? "#7A9E5A" : T.textMuted} strokeWidth="0.8" opacity="0.6" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Floor Region (A)</TooltipContent>
            </Tooltip>
          </>}

          {/* ── Build-mode tools ───────────────────────────────────── */}
          {mode === "build" && <>
            <div style={S.toolSepH} />

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "wall", wallKinds[wallKind].color)} onClick={() => setT("wall")}>
                  <WallIcon />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Wall <kbd style={{ background:"#333", border:"1px solid #555", borderRadius:3, padding:"1px 4px", fontSize:10 }}>W</kbd></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "rect", wallKinds[wallKind].color)} onClick={() => setT("rect")}>
                  <RectRoomIcon />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Rect Room <kbd style={{ background:"#333", border:"1px solid #555", borderRadius:3, padding:"1px 4px", fontSize:10 }}>R</kbd></TooltipContent>
            </Tooltip>

            <div style={S.toolSepH} />

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "door")} onClick={() => setT("door")}>
                  <DoorOpen size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Door</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "window")} onClick={() => setT("window")}>
                  <WindowIcon />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Window</TooltipContent>
            </Tooltip>

            <div style={S.toolSepH} />

            <Tooltip>
              <TooltipTrigger asChild>
                <button style={S.toolBtn(tool === "column")} onClick={() => setT("column")}>
                  <ColumnIcon />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Column (C)</TooltipContent>
            </Tooltip>

            {bgImage && <>
              <div style={S.toolSepH} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "calibrate", T.uiConduit)} onClick={() => setT("calibrate")}>
                    <Ruler size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>Calibrate Scale</TooltipContent>
              </Tooltip>
            </>}
          </>}

          {/* ── ITMEP-mode tools ── */}
          {mode === "itmep" && <>
            <div style={S.toolSepH} />

            {/* Power layer: Outlet + Lighting */}
            {activeSpecLayer === "power" && <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "outlet", T.uiElec)} onClick={() => setT("outlet")}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="7" stroke="#50C878" strokeWidth="1.5" />
                      <line x1="3" y1="10" x2="17" y2="10" stroke="#50C878" strokeWidth="2" />
                      <text x="10" y="9" textAnchor="middle" fontSize="5.5" fill="#50C878" fontWeight="bold">D</text>
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>Outlet (E)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "lighting", T.uiLighting)} onClick={() => setT("lighting")}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="5" stroke={T.uiLighting} strokeWidth="1.5" />
                      <circle cx="10" cy="10" r="2" fill={T.uiLighting} />
                      <line x1="10" y1="1" x2="10" y2="4" stroke={T.uiLighting} strokeWidth="1.5" />
                      <line x1="10" y1="16" x2="10" y2="19" stroke={T.uiLighting} strokeWidth="1.5" />
                      <line x1="1" y1="10" x2="4" y2="10" stroke={T.uiLighting} strokeWidth="1.5" />
                      <line x1="16" y1="10" x2="19" y2="10" stroke={T.uiLighting} strokeWidth="1.5" />
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>Lighting (L)</TooltipContent>
              </Tooltip>
            </>}

            {/* AV / IT / MEP / Security — data-driven from the catalog, real symbols */}
            {activeSpecLayer !== "power" && Object.entries(SPEC_COMPONENTS[activeSpecLayer] || {}).map(([key, c]) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <button style={S.toolBtn(tool === "marker" && activeComponentType === key, SPEC_LAYERS[activeSpecLayer].color)}
                    onClick={() => { setActiveComponentType(key); setT("marker"); }}>
                    <svg width="24" height="24" viewBox="0 0 28 28" style={{ overflow: "visible" }}>
                      <MarkerSymbol marker={{ x: 14, y: 14, layer: activeSpecLayer, componentType: key, finish: c.finish ? markerFinish : undefined, angle: -Math.PI / 2 }} selected={false} T={chromeT} themeMode={themeMode} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>{c.name}</TooltipContent>
              </Tooltip>
            ))}
          </>}

        </div>}
    </>
  );
}

export default memo(ToolRail);
