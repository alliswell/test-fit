// ─── ToolRail ────────────────────────────────────────────────────────────────────
// Vertical tool rail between the sidebar and the canvas: the universal tools (select,
// dimension, label, rev cloud) plus the current stage's placement tools. Hidden in Docs.
// Props-only (never imports testfit.jsx): `S` is the shared style sheet, `T` the chrome
// theme; everything else is state and handlers threaded from TestfitTool.
//
// YARDSTICK: each group of tools is a vertical SEGMENTED CONTROL — one 1px ink frame,
// hairline dividers, and the pressed tool filled ink with a paper glyph ("a pressed tool
// stays ink: blue is for the thing you selected, not the control you used"). The glyphs
// are the Yardstick icon set (components/icons.jsx — 1.25 stroke, square caps) or, for the
// AV/IT/MEP/Security catalogs, the real plan symbol (MarkerSymbol). Every button carries an
// aria-label; the tooltip repeats it with the key.
import { memo } from "react";
import MarkerSymbol from "./MarkerSymbol";
import { CalibrateIcon, ColumnIcon, DimIcon, DoorIcon, FloorIcon, FlowPathIcon, LabelIcon, LightingIcon, OutletIcon, RectRoomIcon, RevCloudIcon, SelectIcon, WallIcon, WindowIcon } from "./icons";
import { SPEC_COMPONENTS, SPEC_LAYERS } from "../constants/specs";
import { Tooltip, TooltipContent, TooltipTrigger } from "../app/components/ui/tooltip";

const Tool = ({ active, label, keyHint, onClick, testid, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="ys-tool" aria-pressed={!!active} aria-label={label} data-testid={testid} onClick={onClick}>
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={8}>{label}{keyHint && <kbd>{keyHint}</kbd>}</TooltipContent>
  </Tooltip>
);

const Group = ({ children }) => <div className="ys-rail__group">{children}</div>;

function ToolRail({
  S, T, activeComponentType, activeSpecLayer, bgImage, chromeT, markerFinish, mode, pxPerFoot, setActiveComponentType, setT, themeMode, tool, wallKind, wallKinds,
}) {
  // A plan symbol drawn on the pressed (ink-filled) button needs the OTHER theme's colour
  // mapping to keep its contrast: uiColor darkens hues for paper and brightens them for ink.
  const glyphTheme = (pressed) => pressed ? (themeMode === "dark" ? "light" : "dark") : themeMode;
  return (
    <>
      {/* ── Left tool rail (planning modes — Docs has its own slide tools) ── */}
      {mode !== "docs" && <div style={S.toolRail} className="ys-rail" role="toolbar" aria-label="Tools" aria-orientation="vertical">

        {/* ── Universal tools (Select · Dim · Label · RevCloud) ── */}
        <Group>
          <Tool active={tool === "select"} label="Select" keyHint="V" onClick={() => setT("select")}><SelectIcon /></Tool>
          <Tool active={tool === "dim"} label="Dimension" keyHint="M" onClick={() => setT("dim")}><DimIcon /></Tool>
          <Tool active={tool === "label"} label="Label / callout" keyHint="T" onClick={() => setT("label")}><LabelIcon /></Tool>
          <Tool active={tool === "revcloud"} label="Revision cloud" keyHint="N" onClick={() => setT("revcloud")}><RevCloudIcon /></Tool>
        </Group>

        {/* Flow Path + Floor Region draw on top of the built plan, so — like the rest of
            the Build-mode tools below — they only make sense while building. */}
        {mode === "build" && <>
          <Group>
            <Tool active={tool === "flowPath"} label="Flow path" keyHint="K" testid="tool-flowpath" onClick={() => setT("flowPath")}><FlowPathIcon /></Tool>
            <Tool active={tool === "floorRegion"} label="Floor region" keyHint="A" testid="tool-floorregion" onClick={() => setT("floorRegion")}><FloorIcon /></Tool>
          </Group>

          {/* ── Build-mode tools ───────────────────────────────────── */}
          <Group>
            <Tool active={tool === "wall"} label={`${wallKinds[wallKind]?.label || ""} wall`.trim()} keyHint="W" onClick={() => setT("wall")}><WallIcon /></Tool>
            <Tool active={tool === "rect"} label="Rect room" keyHint="R" onClick={() => setT("rect")}><RectRoomIcon /></Tool>
          </Group>
          <Group>
            <Tool active={tool === "door"} label="Door" onClick={() => setT("door")}><DoorIcon /></Tool>
            <Tool active={tool === "window"} label="Window" onClick={() => setT("window")}><WindowIcon /></Tool>
            <Tool active={tool === "column"} label="Column" keyHint="C" onClick={() => setT("column")}><ColumnIcon /></Tool>
          </Group>
          {bgImage && <Group>
            <Tool active={tool === "calibrate"} label="Calibrate scale" onClick={() => setT("calibrate")}><CalibrateIcon /></Tool>
          </Group>}
        </>}

        {/* ── ITMEP-mode tools ── */}
        {mode === "itmep" && <>
          {/* Power layer: Outlet + Lighting */}
          {activeSpecLayer === "power" && <Group>
            <Tool active={tool === "outlet"} label="Outlet" keyHint="E" onClick={() => setT("outlet")}><OutletIcon /></Tool>
            <Tool active={tool === "lighting"} label="Lighting" keyHint="L" onClick={() => setT("lighting")}><LightingIcon /></Tool>
          </Group>}

          {/* AV / IT / MEP / Security — data-driven from the catalog, real symbols */}
          {activeSpecLayer !== "power" && <Group>
            {Object.entries(SPEC_COMPONENTS[activeSpecLayer] || {}).map(([key, c]) => {
              const pressed = tool === "marker" && activeComponentType === key;
              return (
                <Tool key={key} active={pressed} label={c.name} onClick={() => { setActiveComponentType(key); setT("marker"); }}>
                  <svg width="24" height="24" viewBox="0 0 28 28" style={{ overflow: "visible", width: 24, height: 24 }}>
                    <MarkerSymbol marker={{ x: 14, y: 14, layer: activeSpecLayer, componentType: key, finish: c.finish ? markerFinish : undefined, angle: -Math.PI / 2 }} selected={false} T={chromeT} themeMode={glyphTheme(pressed)} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
                  </svg>
                </Tool>
              );
            })}
          </Group>}
        </>}

      </div>}
    </>
  );
}

export default memo(ToolRail);
