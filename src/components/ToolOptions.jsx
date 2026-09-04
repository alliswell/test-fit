// ─── ToolOptions ─────────────────────────────────────────────────────────────────
// The option panel for the ACTIVE PLACEMENT TOOL (no selection): wall kind/material, door,
// window and column settings, outlet/lighting/component pickers, zone type/paint.
// Props-only (never imports testfit.jsx): `S` is the shared style sheet, `T` the chrome
// theme; everything else is state and handlers threaded from TestfitTool.
import MarkerSymbol from "./MarkerSymbol";
import { DOOR_TYPES, FINISH_COLORS, SPEC_COMPONENTS, SPEC_LAYERS, WINDOW_TYPES } from "../constants/specs";
import { SliderInput } from "./ui";
import { WALL_MATERIALS, WALL_MATERIAL_HATCHES } from "../constants/theme";

const isWallTool = (t) => t === "wall";

function ToolOptions({
  $, S, T, activeComponentType, activeSpecLayer, activeZoneType, chromeT, columnLabel, columnNotes, columnShape, columnSize, doorFlipped, doorHingeRight, doorType, doorWidth, htrackAngle, inspTool, inspectorOpen, inspectorToggle, lightingIsNew, lightingType, markerFinish, markerNotes, mode, outletIsNew, outletType, ponyDepth, ponyHeight, pxPerFoot, setActiveComponentType, setActiveZoneType, setColumnLabel, setColumnNotes, setColumnShape, setColumnSize, setDoorFlipped, setDoorHingeRight, setDoorType, setDoorWidth, setLightingIsNew, setLightingType, setMarkerFinish, setMarkerNotes, setOutletIsNew, setOutletType, setPonyDepth, setPonyHeight, setT, setWallKind, setWallMaterial, setWallNotes, setWindowHeight, setWindowSill, setWindowType, setWindowWidth, setZoneNotes, setZonePaintColor, setZonePaintFinish, themeMode, tool, wallKind, wallKinds, wallMaterial, wallNotes, windowHeight, windowSill, windowType, windowWidth, zoneLibrary, zoneNotes, zonePaintColor, zonePaintFinish,
}) {
  return (
    <>
      {/* Tool options panel — shown when a placement tool is active */}
      {inspTool && inspectorOpen && <div style={S.det}>
        {inspectorToggle}
        {mode === "build" && isWallTool(tool) && (() => { const wk = wallKinds[wallKind]; return <>
          {/* Header */}
          <div style={{ fontSize: 12, color: wk.color, marginBottom: 10, fontWeight: 600 }}>{wk.label} Wall</div>

          {/* Type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            {Object.entries(wallKinds).map(([k, v]) => <button key={k} onClick={() => setWallKind(k)}
              style={{ padding: "6px 8px", background: wallKind === k ? v.color + "40" : "transparent", color: wallKind === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}>
              {v.label}
            </button>)}
          </div>

          {/* Material */}
          <div style={{ marginBottom: 10 }}><div style={S.lbl}>Material</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {WALL_MATERIALS.map(mat => {
                const isSel = wallMaterial === mat;
                const patId = WALL_MATERIAL_HATCHES[mat];
                return <button key={mat} onClick={() => setWallMaterial(mat)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 4px", background: isSel ? T.border + "60" : "transparent", border: "1.5px solid " + (isSel ? T.accent : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>
                  <svg width="32" height="14" style={{ display: "block", borderRadius: 2, overflow: "hidden" }}>
                    <defs><clipPath id={"tc-" + mat.replace(/\s|\/|\*/g, "")}><rect width="32" height="14"/></clipPath></defs>
                    <rect width="32" height="14" fill={T.bg2}/>
                    {patId && <rect width="32" height="14" fill={`url(#${patId})`} clipPath={`url(#tc-${mat.replace(/\s|\/|\*/g, "")})`}/>}
                    <rect width="32" height="14" fill="none" stroke={isSel ? T.accent : T.border} strokeWidth="1"/>
                  </svg>
                  <span style={{ fontSize: 8, color: isSel ? T.textBright : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{mat}</span>
                </button>;
              })}
            </div>
          </div>

          {wallKind === "pony" && <>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div>
              <SliderInput value={ponyHeight} min={12} max={60} onChange={setPonyHeight} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
            </div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Depth (inches)</div>
              <SliderInput value={ponyDepth} min={3} max={12} onChange={setPonyDepth} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
            </div>
          </>}
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div>
            <textarea style={{ ...S.inp, height: 72, resize: "vertical" }} value={wallNotes} onChange={e => setWallNotes(e.target.value)} placeholder="Load-bearing, plumbing chase..." />
          </div>
          <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
        </>; })()}
        {mode === "build" && tool === "door" && <>
          <div style={{ fontSize: 12, color: T.uiDoor, marginBottom: 10, fontWeight: 600 }}>{doorType} Door · {doorWidth}"</div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {DOOR_TYPES.map(t => <button key={t} style={{ padding: "6px 8px", background: doorType === t ? T.border + "60" : "transparent", color: doorType === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}
                onClick={() => setDoorType(t)}>{t}</button>)}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}><SliderInput value={doorWidth} min={24} max={96} onChange={setDoorWidth} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          {doorType !== "Case Opening" && <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setDoorFlipped(f => !f)}>In/Out {doorFlipped ? "✓" : ""}</button>
            <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setDoorHingeRight(h => !h)}>Hinge {doorHingeRight ? "R" : "L"}</button>
          </div>}
          <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
        </>}
        {mode === "build" && tool === "window" && (() => { const isCut = windowType === "Cut Opening"; const accent = isCut ? "#A09068" : "#60A0C8"; return <>
          <div style={{ fontSize: 12, color: accent, marginBottom: 10, fontWeight: 600 }}>{windowType} · {windowWidth}"</div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
            <div style={{ display: "flex", gap: 6 }}>
              {WINDOW_TYPES.map(t => <button key={t} style={{ padding: "6px 10px", background: windowType === t ? T.border + "60" : "transparent", color: windowType === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                onClick={() => setWindowType(t)}>{t}</button>)}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}><SliderInput value={windowWidth} min={12} max={96} onChange={setWindowWidth} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div><SliderInput value={windowHeight} min={12} max={96} onChange={setWindowHeight} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Sill Height (inches)</div><SliderInput value={windowSill} min={0} max={60} onChange={setWindowSill} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
        </>; })()}
        {mode === "build" && tool === "column" && <>
          <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>Column · {columnSize}"</div>
          <div style={{ marginBottom: 8 }}>
            <div style={S.lbl}>Shape</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: columnShape === "circle" ? T.textBright : T.textMuted, background: columnShape === "circle" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setColumnShape("circle")}>● Circle</button>
              <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: columnShape === "square" ? T.textBright : T.textMuted, background: columnShape === "square" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => setColumnShape("square")}>■ Square</button>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Size (inches)</div><SliderInput value={columnSize} min={6} max={48} onChange={setColumnSize} accent="#9A9488" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={columnLabel} onChange={e => setColumnLabel(e.target.value)} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={columnNotes} onChange={e => setColumnNotes(e.target.value)} /></div>
          <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
        </>}
        {mode === "itmep" && tool === "outlet" && (() => {
          const active = SPEC_COMPONENTS.power[outletType];
          const isSwitch = outletType.startsWith("switch_");
          const isPanel = outletType === "panel_board";
          const sectionColor = isPanel ? T.uiPanel : isSwitch ? T.uiSwitch : T.uiElec;

          const OUTLET_OPTS = [
            { key: "outlet_duplex",         label: "Duplex",    color: T.uiElec },
            { key: "outlet_quad",           label: "Quad",      color: T.uiElec },
            { key: "outlet_duplex_surface", label: "Conduit D", color: T.uiConduit },
            { key: "outlet_quad_surface",   label: "Conduit Q", color: T.uiConduit },
            { key: "outlet_ceiling",        label: "Ceiling",   color: "#60B0E0" },
          ];
          const SWITCH_OPTS = [
            { key: "switch_single",  label: "Single\nPole",  color: T.uiSwitch },
            { key: "switch_double",  label: "Double\nPole",  color: T.uiSwitch },
            { key: "switch_dimmer", label: "Dimmer",        color: T.uiSwitch },
          ];

          return <>
            <div style={{ fontSize: 12, color: sectionColor, marginBottom: 10, fontWeight: 600 }}>Electrical · {active?.name}</div>

            {/* New vs As-Built toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 8px", background: T.panelBg, borderRadius: 6, border: "1px solid " + T.border }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1 }}>
                <input type="checkbox" checked={outletIsNew} onChange={e => setOutletIsNew(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: "#50A0E0", cursor: "pointer" }} />
                <span style={{ fontSize: 10, color: T.textMuted }}>New / Planned</span>
              </label>
            </div>

            {/* Outlets section */}
            <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Outlets</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
              {OUTLET_OPTS.map(({ key: oKey, label, color }) => {
                const isSel = outletType === oKey;
                const isQuad = oKey.includes("quad");
                const isSurf = oKey.includes("surface");
                const isCeil = oKey === "outlet_ceiling";
                return <button key={oKey} onClick={() => { setOutletType(oKey); setT("outlet"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    {isSurf && <rect x="2" y="2" width="24" height="24" rx="2" stroke={color} strokeWidth="1" strokeDasharray="3 2" />}
                    {isCeil ? <>
                      <circle cx="14" cy="14" r="9" stroke={color} strokeWidth="1.5" />
                      <line x1="5" y1="14" x2="23" y2="14" stroke={color} strokeWidth="1.5" />
                      <line x1="14" y1="5" x2="14" y2="23" stroke={color} strokeWidth="1.5" />
                      <circle cx="14" cy="14" r="3" fill={color} />
                    </> : <>
                      <circle cx="14" cy="14" r="9" stroke={color} strokeWidth="1.5" />
                      <line x1="5" y1="14" x2="23" y2="14" stroke={color} strokeWidth="2" />
                      <text x="14" y="12" textAnchor="middle" fontSize="7" fill={color} fontWeight="bold">{isQuad ? "Q" : "D"}</text>
                    </>}
                  </svg>
                  <span style={{ fontSize: 8, color: isSel ? color : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
                </button>;
              })}
            </div>

            {/* Switches section */}
            <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Switches</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
              {SWITCH_OPTS.map(({ key: oKey, label, color }) => {
                const isSel = outletType === oKey;
                return <button key={oKey} onClick={() => { setOutletType(oKey); setT("outlet"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="5" y="5" width="18" height="18" rx="2" fill={color + "18"} stroke={color} strokeWidth="1.5" />
                    <line x1="9" y1="19" x2="17" y2="8" stroke={color} strokeWidth="2" />
                    <circle cx="17" cy="8" r="2.5" fill={color} />
                  </svg>
                  <span style={{ fontSize: 8, color: isSel ? color : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
                </button>;
              })}
            </div>

            {/* Panel Board section */}
            <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Panel</div>
            <div style={{ marginBottom: 14 }}>
              {(() => {
                const isSel = outletType === "panel_board";
                const pcolor = T.uiPanel;
                return <button onClick={() => { setOutletType("panel_board"); setT("outlet"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", width: "100%", background: isSel ? pcolor + "22" : "transparent", border: "1.5px solid " + (isSel ? pcolor : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                  <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                    <rect x="3" y="2" width="22" height="32" rx="2" fill={pcolor + "18"} stroke={pcolor} strokeWidth="1.5" />
                    {[6, 12, 18, 24].map(y => <rect key={y} x="9" y={y - 2} width="10" height="4" rx="1" fill={pcolor + "55"} />)}
                  </svg>
                  <span style={{ fontSize: 8, color: isSel ? pcolor : T.textMuted, textAlign: "center", lineHeight: 1.3 }}>Elec. Panel</span>
                </button>;
              })()}
            </div>

            {/* T-Stat / Controls section */}
            <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Controls</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
              {[{ key: "tstat", label: "T-Stat", color: "#E8C0A0" }].map(({ key: oKey, label, color }) => {
                const isSel = outletType === oKey;
                return <button key={oKey} onClick={() => { setOutletType(oKey); setT("outlet"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="5" y="5" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" />
                    <text x="14" y="17" textAnchor="middle" fontSize="10" fill={color} fontWeight="bold">T</text>
                  </svg>
                  <span style={{ fontSize: 8, color: isSel ? color : T.textMuted }}>{label}</span>
                </button>;
              })}
            </div>

            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>Est. {$(active?.unitCost || 0)}{outletType.startsWith("outlet_") ? " / outlet" : ""}</div>
            <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
            {outletType !== "outlet_ceiling" && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Snaps to nearest wall</div>}
            {outletType === "outlet_ceiling" && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Ceiling mount · free placement</div>}
          </>;
        })()}
        {mode === "itmep" && tool === "lighting" && (() => {
          const active = SPEC_COMPONENTS.power[lightingType];
          const lightColor = T.uiLighting;
          const LIGHT_OPTS = [
            { key: "light_can_4",    label: '4" Can',    color: T.uiLighting, sym: "can"    },
            { key: "light_can_6",    label: '6" Can',    color: T.uiLighting, sym: "can6"   },
            { key: "light_pendant",  label: "Pendant",   color: T.uiLighting, sym: "pend"   },
            { key: "light_sconce",   label: "Sconce",    color: T.uiLighting, sym: "sconce" },
          ];
          return <>
            <div style={{ fontSize: 12, color: lightColor, marginBottom: 10, fontWeight: 600 }}>Lighting · {active?.name}</div>
            {/* New vs As-Built toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 8px", background: T.panelBg, borderRadius: 6, border: "1px solid " + T.border }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1 }}>
                <input type="checkbox" checked={lightingIsNew} onChange={e => setLightingIsNew(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: "#50A0E0", cursor: "pointer" }} />
                <span style={{ fontSize: 10, color: T.textMuted }}>New / Planned</span>
              </label>
            </div>
            <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>Fixtures</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
              {LIGHT_OPTS.map(({ key: lKey, label, color, sym }) => {
                const isSel = lightingType === lKey;
                const isCan = sym === "can" || sym === "can6";
                const isPend = sym === "pend";
                const isSconce = sym === "sconce";
                const bigCan = sym === "can6";
                return <button key={lKey} onClick={() => { setLightingType(lKey); setT("lighting"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    {isCan && <>
                      <circle cx="14" cy="14" r={bigCan ? 9 : 7} stroke={color} strokeWidth="1.5"/>
                      <circle cx="14" cy="14" r={bigCan ? 5 : 3.5} stroke={color} strokeWidth="1"/>
                      <line x1="10" y1="10" x2="18" y2="18" stroke={color} strokeWidth="1"/>
                      <line x1="18" y1="10" x2="10" y2="18" stroke={color} strokeWidth="1"/>
                    </>}
                    {isPend && <>
                      <line x1="14" y1="2" x2="14" y2="8" stroke={color} strokeWidth="1.5"/>
                      <line x1="8" y1="2" x2="20" y2="2" stroke={color} strokeWidth="1.5"/>
                      <circle cx="14" cy="14" r="6" stroke={color} strokeWidth="1.5"/>
                      <circle cx="14" cy="14" r="2" fill={color}/>
                    </>}
                    {isSconce && <>
                      <rect x="10" y="6" width="8" height="16" rx="1" stroke={color} strokeWidth="1.5"/>
                      <line x1="10" y1="10" x2="4" y2="7"  stroke={color} strokeWidth="1"/>
                      <line x1="10" y1="14" x2="3" y2="14" stroke={color} strokeWidth="1"/>
                      <line x1="10" y1="18" x2="4" y2="21" stroke={color} strokeWidth="1"/>
                    </>}
                  </svg>
                  <span style={{ fontSize: 8, color: isSel ? color : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{label}</span>
                </button>;
              })}
            </div>
            {/* H-Track */}
            <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontWeight: 600 }}>H-Track</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 14 }}>
              {[
                { key: "htrack_4", label: "4' Track", color: T.uiLighting },
                { key: "htrack_8", label: "8' Track", color: T.uiLighting },
              ].map(({ key: lKey, label, color }) => {
                const isSel = lightingType === lKey;
                return <button key={lKey} onClick={() => { setLightingType(lKey); setT("lighting"); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "8px 4px", background: isSel ? color + "22" : "transparent", border: "1.5px solid " + (isSel ? color : T.border), borderRadius: 6, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s ease" }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="3" y="10" width="22" height="8" rx="1" stroke={color} strokeWidth="1.5" />
                    <text x="14" y="17" textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">{lKey === "htrack_4" ? "4'" : "8'"}</text>
                  </svg>
                  <span style={{ fontSize: 8, color: isSel ? color : T.textMuted }}>{label}</span>
                </button>;
              })}
            </div>
            {htrackAngle > 0 && lightingType.startsWith("htrack_") && <div style={{ fontSize: 9, color: T.uiLighting, marginTop: -8, marginBottom: 10, fontStyle: "italic" }}>Press R to rotate 45° · {htrackAngle}°</div>}

            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>Est. {$(active?.unitCost || 0)}</div>
            <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
            {(lightingType === "light_sconce" || lightingType === "sconce_prewire") && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Snaps to nearest wall</div>}
            {lightingType !== "light_sconce" && lightingType !== "sconce_prewire" && <div style={{ fontSize: 9, color: "#5A5448", marginTop: 3, fontStyle: "italic" }}>Ceiling mount · free placement</div>}
          </>;
        })()}
        {mode === "zone" && tool === "zone" && (() => { const zt = zoneLibrary[activeZoneType]; return <>
          <div style={{ fontSize: 12, color: zt.color, marginBottom: 10, fontWeight: 600 }}>{zt.name}</div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
            <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={activeZoneType}
              onChange={e => setActiveZoneType(e.target.value)}>
              {Object.entries(zoneLibrary).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={zoneNotes} onChange={e => setZoneNotes(e.target.value)} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Paint</div><div style={{ display: "flex", gap: 6 }}>
            <input type="color" value={zonePaintColor} onChange={e => setZonePaintColor(e.target.value)} style={{ width: 28, height: 28, border: "1.5px solid " + T.border, background: "none", cursor: "pointer", borderRadius: 5 }} />
            <input style={{ ...S.inp, flex: 1 }} value={zonePaintFinish} onChange={e => setZonePaintFinish(e.target.value)} placeholder="Finish" />
          </div></div>
          <div style={{ fontSize: 10, color: "#8A8478", marginBottom: 6 }}>Est: {$(zt.items.reduce((s, i) => s + i.qty * i.unitCost, 0))}</div>
          <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
        </>; })()}
        {mode === "itmep" && tool === "marker" && (() => {
          const compData = SPEC_COMPONENTS[activeSpecLayer]?.[activeComponentType];
          const layerData = SPEC_LAYERS[activeSpecLayer];
          return <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <svg width="30" height="30" viewBox="0 0 28 28" style={{ flexShrink: 0, overflow: "visible" }}>
                <MarkerSymbol marker={{ x: 14, y: 14, layer: activeSpecLayer, componentType: activeComponentType, finish: compData?.finish ? markerFinish : undefined, angle: -Math.PI / 2 }} selected={false} T={chromeT} themeMode={themeMode} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
              </svg>
              <div>
                <div style={{ fontSize: 12, color: layerData?.color || "#9A9488", fontWeight: 600 }}>{compData?.name || "Component"}</div>
                {compData?.product && <div style={{ fontSize: 9, color: T.textFaint }}>≈ {compData.product}</div>}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Component</div>
              <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={activeComponentType}
                onChange={e => setActiveComponentType(e.target.value)}>
                {Object.entries(SPEC_COMPONENTS[activeSpecLayer] || {}).map(([k, c]) => <option key={k} value={k}>{c.name}</option>)}
              </select>
            </div>
            {compData?.finish && <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Finish</div>
              <div style={{ display: "flex", gap: 6 }}>
                {compData.finish.map(f => <button key={f} onClick={() => setMarkerFinish(f)}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 600, textTransform: "capitalize", border: "1.5px solid " + (markerFinish === f ? T.brand : T.border), background: markerFinish === f ? FINISH_COLORS[f].fill : "transparent", color: markerFinish === f ? FINISH_COLORS[f].line : T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: FINISH_COLORS[f].fill, border: "1px solid " + FINISH_COLORS[f].line }} />{f}
                </button>)}
              </div>
            </div>}
            {compData?.directional && <div style={{ fontSize: 9, color: T.textMuted, fontStyle: "italic", marginBottom: 6 }}>Snaps to wall · aims into room · select + R to rotate</div>}
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={markerNotes} onChange={e => setMarkerNotes(e.target.value)} /></div>
            <div style={{ fontSize: 10, color: "#8A8478", marginBottom: 6 }}>Est: {$(compData?.unitCost || 0)}</div>
            <div style={{ fontSize: 10, color: "#5A5448", fontStyle: "italic" }}>Click to place · Shift+click to keep placing</div>
          </>;
        })()}
      </div>}
    </>
  );
}

export default ToolOptions;
