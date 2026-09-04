// ─── Inspector ───────────────────────────────────────────────────────────────────
// The option panel for the CURRENT SELECTION: one block per selectable type (wall, door,
// window, column, furniture, zone, marker, label, rev cloud, flow path, room/floor…) plus the
// multi-select panels (align/distribute, batch edits). The `upd*` callbacks and `sel*`
// lookups come from testfit.jsx, which owns selection and the model.
// Props-only (never imports testfit.jsx): `S` is the shared style sheet, `T` the chrome
// theme; everything else is state and handlers threaded from TestfitTool.
import MarkerSymbol from "./MarkerSymbol";
import { AlignBtn, SliderInput } from "./ui";
import { DOOR_TYPES, FINISH_COLORS, FLOOR_MATERIALS, FLOW_PATH_COLORS, SPEC_COMPONENTS, SPEC_LAYERS, WINDOW_TYPES, isWallMounted } from "../constants/specs";
import { FURNITURE_CATALOG, ZONE_FURNISH_PLAN } from "../constants/furniture";
import { WALL_MATERIALS, WALL_MATERIAL_HATCHES } from "../constants/theme";
import { defaultMountHeightIn } from "../imports/markerMount";
import { polyArea } from "../imports/model";

function Inspector({
  $, S, T, alignDistribute, ceilingHeight, chromeT, clearInsideSf, cv, delSel, floorEditId, floorHoles, floorMaterial, ft, ftN, furnishZone, inspSel, inspectorOpen, inspectorToggle, mode, multiSelItems, multiSelType, newToggle, pxPerFoot, selColumn, selDoor, selElevLabel, selElevRevCloud, selFloorRegion, selFlowPath, selFurniture, selLabel, selMarker, selNode, selRevCloud, selType, selWall, selWindow, selZone, selectedIds, setAddingLeaderToId, setEditingLabelId, setEditingLabelText, setFloorEditId, setFloorMaterial, setRoomZone, themeMode, tool, updColumn, updDoor, updElevLabel, updElevRevCloud, updFloorRegion, updFlowPath, updFurniture, updLabel, updMarker, updRevCloud, updWall, updWindow, updZone, wallKinds, wallsAt, wl, zoneForFloor, zoneLibrary,
}) {
  return (
    <>
      {/* Detail panel */}
      {inspSel && inspectorOpen && <div style={S.det}>
        {inspectorToggle}
        {selectedIds.length <= 1 && selNode && <><div style={{ fontSize: 11, color: T.textBright, marginBottom: 6, fontWeight: 600 }}>Node · {wallsAt(selNode.id).length} walls</div><button style={S.del} onClick={delSel}>Delete Node + Walls</button></>}
        {selectedIds.length <= 1 && selWall && (() => { const wk = wallKinds[selWall.kind || "existing"]; return <>
          <div style={{ fontSize: 12, color: wk.color, marginBottom: 10, fontWeight: 600 }}>{wk.label} Wall · {ft(wl(selWall))}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            {Object.entries(wallKinds).map(([k, v]) => <button key={k} style={{ padding: "6px 8px", background: (selWall.kind || "existing") === k ? v.color + "40" : "transparent", color: (selWall.kind || "existing") === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}
              onClick={() => updWall({ kind: k })}>{v.label}</button>)}
          </div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Material</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {WALL_MATERIALS.map(value => {
                const isSel = (selWall.material || "Drywall") === value;
                const patId = WALL_MATERIAL_HATCHES[value];
                return <button key={value} onClick={() => updWall({ material: value })}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 4px", background: isSel ? T.border + "60" : "transparent", border: "1.5px solid " + (isSel ? T.accent : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>
                  <svg width="32" height="14" style={{ display: "block", borderRadius: 2, overflow: "hidden" }}>
                    <defs>
                      <clipPath id={"mc-" + value.replace(/\s|\/|\*/g, "")}><rect width="32" height="14"/></clipPath>
                    </defs>
                    <rect width="32" height="14" fill={T.bg2}/>
                    {patId && <rect width="32" height="14" fill={`url(#${patId})`} clipPath={`url(#mc-${value.replace(/\s|\/|\*/g, "")})`}/>}
                    <rect width="32" height="14" fill="none" stroke={isSel ? T.accent : T.border} strokeWidth="1"/>
                  </svg>
                  <span style={{ fontSize: 8, color: isSel ? T.textBright : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{value}</span>
                </button>;
              })}
            </div>
          </div>
          {(selWall.kind === "pony") && <>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div>
              <SliderInput value={selWall.ponyHeight || 42} min={12} max={60} onChange={v => updWall({ ponyHeight: v })} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
            </div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Depth (inches)</div>
              <SliderInput value={selWall.ponyDepth || 6} min={3} max={12} onChange={v => updWall({ ponyDepth: v })} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
            </div>
          </>}
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Ceiling Height</div>
            <select value={selWall.ceilingHeight ?? ceilingHeight} onChange={e => updWall({ ceilingHeight: Number(e.target.value) })} style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }}>
              {[84, 96, 108, 120, 132, 144].map(h => <option key={h} value={h}>{Math.floor(h / 12)}'-{h % 12 ? h % 12 + '"' : '0"'}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 72, resize: "vertical" }} value={selWall.notes || ""} onChange={e => updWall({ notes: e.target.value })} placeholder="Load-bearing, plumbing chase..." /></div>
        </>; })()}
        {selectedIds.length <= 1 && selDoor && <>
          <div style={{ fontSize: 12, color: T.uiDoor, marginBottom: 10, fontWeight: 600 }}>{selDoor.doorType || "Wood"} Door · {selDoor.width}"</div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {DOOR_TYPES.map(t => <button key={t} style={{ padding: "6px 8px", background: (selDoor.doorType || "Wood") === t ? T.border + "60" : "transparent", color: (selDoor.doorType || "Wood") === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}
                onClick={() => updDoor({ doorType: t })}>{t}</button>)}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}><SliderInput value={selDoor.width} min={24} max={96} onChange={w => updDoor({ width: w })} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          {(selDoor.doorType || "Wood") !== "Case Opening" && <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ flipped: !selDoor.flipped })}>In/Out (F)</button>
            <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ hingeRight: !selDoor.hingeRight })}>Hinge (R)</button>
          </div>}
          {(selDoor.doorType || "Wood") !== "Case Opening" && <div style={{ marginTop: 4, marginBottom: 6, padding: "6px 8px", background: T.panelBg, borderRadius: 6, border: "1px solid " + T.border }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={!!selDoor.accessControl} onChange={e => updDoor({ accessControl: e.target.checked, accessSide: selDoor.accessSide || "latch" })} style={{ width: 14, height: 14, accentColor: T.brand, cursor: "pointer" }} />
              <span style={{ fontSize: 10, color: T.textMuted }}>Access Control (reader)</span>
            </label>
            {selDoor.accessControl && <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {["latch", "hinge"].map(s => <button key={s} onClick={() => updDoor({ accessSide: s })}
                style={{ flex: 1, padding: "5px 0", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: 9, fontWeight: 500, textTransform: "capitalize", border: "1.5px solid " + ((selDoor.accessSide || "latch") === s ? T.brand : T.border), background: (selDoor.accessSide || "latch") === s ? T.brand + "22" : "transparent", color: (selDoor.accessSide || "latch") === s ? T.textBright : T.textMuted }}>{s} side</button>)}
            </div>}
          </div>}
          {newToggle(!!selDoor.isNew, v => updDoor({ isNew: v }), T.uiDoor)}
          <button style={S.del} onClick={delSel}>Delete</button>
        </>}
        {selectedIds.length <= 1 && selWindow && (() => { const isCut = selWindow.type === "Cut Opening"; const accent = isCut ? "#A09068" : "#60A0C8"; return <>
          <div style={{ fontSize: 12, color: accent, marginBottom: 10, fontWeight: 600 }}>{selWindow.type || "Window"} · {selWindow.width}"</div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
            <div style={{ display: "flex", gap: 6 }}>
              {WINDOW_TYPES.map(t => <button key={t} style={{ padding: "6px 10px", background: (selWindow.type || "Window") === t ? T.border + "60" : "transparent", color: (selWindow.type || "Window") === t ? T.textBright : T.textMuted, border: "1.5px solid " + T.border, borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", flex: 1, fontWeight: 500, transition: "all 0.12s ease" }}
                onClick={() => updWindow({ type: t })}>{t}</button>)}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}><SliderInput value={selWindow.width} min={12} max={96} onChange={w => updWindow({ width: w })} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Height (inches)</div><SliderInput value={selWindow.height || 48} min={12} max={96} onChange={v => updWindow({ height: v })} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Sill Height (inches)</div><SliderInput value={selWindow.sill ?? 30} min={0} max={60} onChange={v => updWindow({ sill: v })} accent={accent} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          {newToggle(!!selWindow.isNew, v => updWindow({ isNew: v }), accent)}
          <button style={S.del} onClick={delSel}>Delete</button>
        </>; })()}
        {selectedIds.length <= 1 && selLabel && (() => {
          const LABEL_COLORS = [
            { hex: "#F0EDE6", name: "White" },
            { hex: "#E05252", name: "Red" },
            { hex: "#4EBA78", name: "Green" },
            { hex: "#4A8FE8", name: "Blue" },
          ];
          const stepFont = (d) => updLabel({ fontSize: Math.min(72, Math.max(8, selLabel.fontSize + d)) });
          const btnActive = (on) => ({ flex: 1, padding: "5px 0", background: on ? T.accent + "25" : "transparent", border: "1px solid " + (on ? T.accent : T.border), borderRadius: 4, color: on ? T.textBright : T.textMuted, cursor: "pointer", fontFamily: "inherit" });
          return <>
            <div style={{ fontSize: 12, color: T.textBright, marginBottom: 10, fontWeight: 600 }}>
              {selLabel.lx != null ? "Callout" : "Label"}
            </div>
            {/* Edit text */}
            <button style={{ ...S.inp, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: T.textMuted, fontSize: 11, marginBottom: 10 }}
              onClick={() => { setEditingLabelId(selLabel.id); setEditingLabelText(selLabel.text); }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M8.5 1.5L11.5 4.5L4.5 11.5H1.5V8.5L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round"/>
                <path d="M7 3L10 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Edit Text
            </button>
            {/* Font size + Bold + Italic on one row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1px solid " + T.border, borderRadius: 4, overflow: "hidden", flex: 1 }}>
                <button style={{ padding: "5px 10px", background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
                  onClick={() => stepFont(-1)}>−</button>
                <span style={{ flex: 1, textAlign: "center", fontSize: 11, color: T.textBright, userSelect: "none", borderLeft: "1px solid " + T.border, borderRight: "1px solid " + T.border, padding: "5px 0" }}>{selLabel.fontSize}</span>
                <button style={{ padding: "5px 10px", background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
                  onClick={() => stepFont(1)}>+</button>
              </div>
              <button style={{ ...btnActive(selLabel.bold), flex: "0 0 32px", fontWeight: 700, fontSize: 13 }} onClick={() => updLabel({ bold: !selLabel.bold })}>B</button>
              <button style={{ ...btnActive(selLabel.italic), flex: "0 0 32px", fontStyle: "italic", fontSize: 13 }} onClick={() => updLabel({ italic: !selLabel.italic })}>I</button>
            </div>
            {/* Color swatches */}
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Color</div>
              <div style={{ display: "flex", gap: 6 }}>
                {LABEL_COLORS.map(({ hex, name }) => (
                  <button key={hex} title={name}
                    style={{ width: 22, height: 22, borderRadius: 4, background: hex, cursor: "pointer", flexShrink: 0,
                      boxShadow: selLabel.color === hex ? "0 0 0 2px " + T.accent : "0 0 0 1.5px rgba(255,255,255,0.12)",
                      border: "none", outline: "none" }}
                    onClick={() => updLabel({ color: hex })} />
                ))}
              </div>
            </div>
            {/* Leader line */}
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Leader Line</div>
              {selLabel.lx != null
                ? <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", fontSize: 10, color: T.textMuted }}
                    onClick={() => updLabel({ lx: null, ly: null, anchorId: null, anchorType: null })}>Remove Leader</button>
                : <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", fontSize: 10, color: T.accent }}
                    onClick={() => setAddingLeaderToId(selLabel.id)}>Add Leader…</button>}
            </div>
            <button style={S.del} onClick={delSel}>Delete Label</button>
          </>;
        })()}
        {selectedIds.length <= 1 && selElevLabel && (() => {
          // Elevation label/callout — same styling controls as plan labels (text editing
          // stays in-pane: double-click the label in its elevation).
          const LABEL_COLORS = [
            { hex: "#F0EDE6", name: "White" },
            { hex: "#E05252", name: "Red" },
            { hex: "#4EBA78", name: "Green" },
            { hex: "#4A8FE8", name: "Blue" },
          ];
          const fs = selElevLabel.fontSize ?? 11;
          const stepFont = (d) => updElevLabel({ fontSize: Math.min(72, Math.max(8, fs + d)) });
          const btnActive = (on) => ({ flex: 1, padding: "5px 0", background: on ? T.accent + "25" : "transparent", border: "1px solid " + (on ? T.accent : T.border), borderRadius: 4, color: on ? T.textBright : T.textMuted, cursor: "pointer", fontFamily: "inherit" });
          return <>
            <div style={{ fontSize: 12, color: T.textBright, marginBottom: 10, fontWeight: 600 }}>
              Elevation {selElevLabel.lx != null ? "Callout" : "Label"}
            </div>
            <div style={{ fontSize: 9, color: T.textDim, marginBottom: 10 }}>Double-click the label in its elevation to edit the text.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1px solid " + T.border, borderRadius: 4, overflow: "hidden", flex: 1 }}>
                <button style={{ padding: "5px 10px", background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
                  onClick={() => stepFont(-1)}>−</button>
                <span style={{ flex: 1, textAlign: "center", fontSize: 11, color: T.textBright, userSelect: "none", borderLeft: "1px solid " + T.border, borderRight: "1px solid " + T.border, padding: "5px 0" }}>{fs}</span>
                <button style={{ padding: "5px 10px", background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, fontFamily: "inherit" }}
                  onClick={() => stepFont(1)}>+</button>
              </div>
              <button style={{ ...btnActive(selElevLabel.bold), flex: "0 0 32px", fontWeight: 700, fontSize: 13 }} onClick={() => updElevLabel({ bold: !selElevLabel.bold })}>B</button>
              <button style={{ ...btnActive(selElevLabel.italic), flex: "0 0 32px", fontStyle: "italic", fontSize: 13 }} onClick={() => updElevLabel({ italic: !selElevLabel.italic })}>I</button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Color</div>
              <div style={{ display: "flex", gap: 6 }}>
                {LABEL_COLORS.map(({ hex, name }) => (
                  <button key={hex} title={name}
                    style={{ width: 22, height: 22, borderRadius: 4, background: hex, cursor: "pointer", flexShrink: 0,
                      boxShadow: selElevLabel.color === hex ? "0 0 0 2px " + T.accent : "0 0 0 1.5px rgba(255,255,255,0.12)",
                      border: "none", outline: "none" }}
                    onClick={() => updElevLabel({ color: hex })} />
                ))}
              </div>
            </div>
            {selElevLabel.lx != null && <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Leader Line</div>
              <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", fontSize: 10, color: T.textMuted }}
                onClick={() => updElevLabel({ lx: null, ly: null })}>Remove Leader</button>
            </div>}
            <button style={S.del} onClick={delSel}>Delete Label</button>
          </>;
        })()}
        {selectedIds.length <= 1 && selRevCloud && (() => {
          const RC_COLORS = [{ hex: "#E05252", name: "Red" }, { hex: "#E0A030", name: "Amber" },
            { hex: "#4A8FE8", name: "Blue" }, { hex: "#50A070", name: "Green" }];
          return <>
            <div style={{ fontSize: 12, color: selRevCloud.color, marginBottom: 10, fontWeight: 600 }}>Revision Cloud</div>
            <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Label</div>
              <input style={S.inp} value={selRevCloud.label} onChange={e => updRevCloud({ label: e.target.value })} placeholder="Rev A…" />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Arc Size</div>
              <SliderInput value={selRevCloud.arcR ?? 8} min={4} max={20} onChange={v => updRevCloud({ arcR: v })}
                accent={selRevCloud.color} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Color</div>
              <div style={{ display: "flex", gap: 6 }}>
                {RC_COLORS.map(({ hex, name }) =>
                  <button key={hex} title={name}
                    style={{ width: 22, height: 22, borderRadius: 4, background: hex, cursor: "pointer",
                      border: "none", outline: "none",
                      boxShadow: selRevCloud.color === hex ? "0 0 0 2px " + T.accent : "0 0 0 1.5px rgba(255,255,255,0.12)" }}
                    onClick={() => updRevCloud({ color: hex })} />)}
              </div>
            </div>
            <button style={S.del} onClick={delSel}>Delete Cloud</button>
          </>;
        })()}
        {selectedIds.length <= 1 && selElevRevCloud && (() => {
          // Elevation revision cloud — same controls as the plan's (label, arc size, color).
          const RC_COLORS = [{ hex: "#E05252", name: "Red" }, { hex: "#E0A030", name: "Amber" },
            { hex: "#4A8FE8", name: "Blue" }, { hex: "#50A070", name: "Green" }];
          return <>
            <div style={{ fontSize: 12, color: selElevRevCloud.color, marginBottom: 10, fontWeight: 600 }}>Elevation Revision Cloud</div>
            <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Label</div>
              <input style={S.inp} value={selElevRevCloud.label} onChange={e => updElevRevCloud({ label: e.target.value })} placeholder="Rev A…" />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Arc Size</div>
              <SliderInput value={selElevRevCloud.arcR ?? 8} min={4} max={20} onChange={v => updElevRevCloud({ arcR: v })}
                accent={selElevRevCloud.color} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Color</div>
              <div style={{ display: "flex", gap: 6 }}>
                {RC_COLORS.map(({ hex, name }) =>
                  <button key={hex} title={name}
                    style={{ width: 22, height: 22, borderRadius: 4, background: hex, cursor: "pointer",
                      border: "none", outline: "none",
                      boxShadow: selElevRevCloud.color === hex ? "0 0 0 2px " + T.accent : "0 0 0 1.5px rgba(255,255,255,0.12)" }}
                    onClick={() => updElevRevCloud({ color: hex })} />)}
              </div>
            </div>
            <button style={S.del} onClick={delSel}>Delete Cloud</button>
          </>;
        })()}
        {selectedIds.length <= 1 && selFlowPath && <>
          <div style={{ fontSize: 12, color: selFlowPath.color, marginBottom: 10, fontWeight: 600 }}>Flow Path</div>
          <div style={{ marginBottom: 8 }}>
            <div style={S.lbl}>Clearance Preset</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 6 }}>
              {[
                { w: 36, label: "Walkway", sub: "36\"" , tip: "Main walking path (minimum)" },
                { w: 48, label: "Tight", sub: "48\"" , tip: "Tighter spaces / behind seated chairs" },
                { w: 60, label: "Dining", sub: "60\"", tip: "Dining: scoot out + walk behind" },
              ].map(({ w, label, sub, tip }) => {
                const isSel = selFlowPath.width === w;
                return <button key={w} title={tip} onClick={() => updFlowPath({ width: w })}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "5px 4px",
                    background: isSel ? selFlowPath.color + "30" : "transparent",
                    border: "1.5px solid " + (isSel ? selFlowPath.color : T.border),
                    borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                    color: isSel ? T.textBright : T.textMuted }}>
                  <span style={{ fontSize: 10, fontWeight: isSel ? 600 : 500 }}>{label}</span>
                  <span style={{ fontSize: 9, color: isSel ? selFlowPath.color : T.textDim }}>{sub}</span>
                </button>;
              })}
            </div>
            <div style={S.lbl}>Custom Width</div>
            <SliderInput value={selFlowPath.width} min={18} max={96} step={6} onChange={v => updFlowPath({ width: v })}
              accent={selFlowPath.color} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
            <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>{ft(selFlowPath.width / 12 * pxPerFoot)} wide</div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={S.lbl}>Label (optional)</div>
            <input style={S.inp} value={selFlowPath.label || ""} onChange={e => updFlowPath({ label: e.target.value })} placeholder="Main aisle…" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={S.lbl}>Color</div>
            <div style={{ display: "flex", gap: 6 }}>
              {FLOW_PATH_COLORS.map(c =>
                <button key={c} title={c}
                  style={{ width: 22, height: 22, borderRadius: 4, background: c, cursor: "pointer", border: "none", outline: "none",
                    boxShadow: selFlowPath.color === c ? "0 0 0 2px " + T.accent : "0 0 0 1.5px rgba(255,255,255,0.12)" }}
                  onClick={() => updFlowPath({ color: c })} />)}
            </div>
          </div>
          <button style={S.del} onClick={delSel}>Delete Flow Path</button>
        </>}
        {selectedIds.length <= 1 && selFloorRegion && (() => {
          const FR_COLORS = { "Wood": "#C8A878", "Concrete": "#AEABA4", "Vinyl": "#BFA889", "Carpet": "#786758" };
          // A room built inside this one is carved out of it, so it can't be counted here
          // either — the sf has to agree with the hatch the canvas actually paints.
          const frCarved = floorHoles.get(selFloorRegion.id);
          const frSf = selFloorRegion.points?.length >= 3
            ? Math.round((polyArea(selFloorRegion.points)
                - (frCarved || []).reduce((s, h) => s + polyArea(h), 0)) / (pxPerFoot * pxPerFoot))
            : 0;
          const frClearSf = clearInsideSf(selFloorRegion.points, frCarved);
          const zHex = zoneForFloor ? zoneLibrary[zoneForFloor.type]?.color : null;
          return <>
            <div data-testid="room-title" style={{ fontSize: 12, color: T.textBright, marginBottom: 10, fontWeight: 600 }}>
              Room · {frSf.toLocaleString()} sf
            </div>
            {/* The floor is inert until double-clicked. Say so, and offer a click-path
                to the same state — the gesture alone isn't discoverable. */}
            <button data-testid="room-shape-lock"
              onClick={() => setFloorEditId(floorEditId === selFloorRegion.id ? null : selFloorRegion.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "6px 9px",
                background: floorEditId === selFloorRegion.id ? T.accent + "20" : T.bg2,
                border: "1px solid " + (floorEditId === selFloorRegion.id ? T.accent : T.border), borderRadius: 5,
                cursor: "pointer", fontFamily: "inherit", fontSize: 10, textAlign: "left",
                color: floorEditId === selFloorRegion.id ? T.textBright : T.textMuted }}>
              <span style={{ fontSize: 11 }}>{floorEditId === selFloorRegion.id ? "◇" : "🔒"}</span>
              {floorEditId === selFloorRegion.id
                ? "Editing shape — click elsewhere to lock"
                : "Locked in place — double-click the floor to move or reshape"}
            </button>
            <div style={{ marginBottom: 10, padding: "6px 9px", background: T.bg2, borderRadius: 5 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: T.textMuted }}>Area (to wall centerline)</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textBright }}>{frSf.toLocaleString()} sf</span>
              </div>
              {frClearSf != null && frClearSf !== frSf && (
                <div data-testid="floor-clear-sf" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 3 }}>
                  <span style={{ fontSize: 10, color: T.textMuted }}>Clear inside walls</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{frClearSf.toLocaleString()} sf</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Floor</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {FLOOR_MATERIALS.map(m => { const isSel = selFloorRegion.material === m; const hex = FR_COLORS[m];
                  return <button key={m} data-testid={"room-floor-" + m} onClick={() => updFloorRegion({ material: m })}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", background: isSel ? hex + "30" : "transparent",
                      border: "1.5px solid " + (isSel ? hex : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                      color: isSel ? T.textBright : T.textMuted, fontSize: 10, fontWeight: isSel ? 600 : 400 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: hex, flexShrink: 0 }} />{m}
                  </button>; })}
              </div>
              {/* "No floor" is deleting the region itself — the room keeps its walls and
                  stays a room, it just draws bare. Auto-floor only fires on the
                  transition to enclosed, so this sticks instead of coming straight back. */}
              <button data-testid="room-floor-none" onClick={delSel}
                style={{ width: "100%", marginTop: 6, padding: "7px 9px", background: "transparent",
                  border: "1.5px dashed " + T.border, borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                  color: T.textMuted, fontSize: 10 }}>None — no floor</button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Zone</div>
              <select data-testid="room-zone" style={S.inp} value={zoneForFloor?.type || ""}
                onChange={e => setRoomZone(e.target.value)}>
                <option value="">None — no zone</option>
                {Object.entries(zoneLibrary).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
              </select>
              {zoneForFloor && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10, color: T.textMuted }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: zHex, flexShrink: 0 }} />
                  {zoneForFloor.label}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Label (optional)</div>
              <input style={S.inp} value={selFloorRegion.label || ""} onChange={e => updFloorRegion({ label: e.target.value })} placeholder="Bathroom, Kitchen…" />
            </div>
            <button style={S.del} onClick={delSel}>Delete Floor Region</button>
          </>;
        })()}
        {selectedIds.length <= 1 && selType === "floor" && (() => {
          const FR_COLORS = { "Wood": "#C8A878", "Concrete": "#AEABA4", "Vinyl": "#BFA889", "Carpet": "#786758" };
          return <>
            <div style={{ fontSize: 12, color: T.textBright, marginBottom: 10, fontWeight: 600 }}>Floor · {floorMaterial}</div>
            <div style={{ marginBottom: 10 }}>
              <div style={S.lbl}>Material</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {FLOOR_MATERIALS.map(m => { const isSel = floorMaterial === m; const hex = FR_COLORS[m];
                  return <button key={m} onClick={() => setFloorMaterial(m)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", background: isSel ? hex + "30" : "transparent",
                      border: "1.5px solid " + (isSel ? hex : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                      color: isSel ? T.textBright : T.textMuted, fontSize: 10, fontWeight: isSel ? 600 : 400 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: hex, flexShrink: 0 }} />{m}
                  </button>; })}
              </div>
            </div>
            <div style={{ fontSize: 10, color: T.textDim, fontStyle: "italic" }}>Visible in Detailed 3D view. Click elsewhere to deselect.</div>
          </>;
        })()}
        {selectedIds.length <= 1 && selColumn && <>
          <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>Column · {selColumn.size}"</div>
          <div style={{ marginBottom: 8 }}>
            <div style={S.lbl}>Shape</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: selColumn.shape === "circle" ? T.textBright : T.textMuted, background: selColumn.shape === "circle" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "circle" })}>● Circle</button>
              <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: selColumn.shape === "square" ? T.textBright : T.textMuted, background: selColumn.shape === "square" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "square" })}>■ Square</button>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Size (inches)</div><SliderInput value={selColumn.size} min={6} max={48} onChange={v => updColumn({ size: v })} accent="#9A9488" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selColumn.label || ""} onChange={e => updColumn({ label: e.target.value })} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={selColumn.notes || ""} onChange={e => updColumn({ notes: e.target.value })} /></div>
          {newToggle(!!selColumn.isNew, v => updColumn({ isNew: v }), "#9A9488")}
          <button style={S.del} onClick={delSel}>Delete Column</button>
        </>}
        {selectedIds.length <= 1 && selFurniture && (() => {
          const spec = FURNITURE_CATALOG[selFurniture.type];
          const deg = Math.round((selFurniture.angle || 0) * 180 / Math.PI);
          return <>
            <div style={{ fontSize: 12, color: "#C07840", marginBottom: 10, fontWeight: 600 }}>{spec?.name || selFurniture.type}</div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Width (ft)</div><SliderInput value={selFurniture.w} min={1} max={20} step={0.5} unit="'" onChange={v => updFurniture({ w: v })} accent="#C07840" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Depth (ft)</div><SliderInput value={selFurniture.d} min={1} max={20} step={0.5} unit="'" onChange={v => updFurniture({ d: v })} accent="#C07840" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Rotation</div><SliderInput value={deg} min={0} max={345} step={15} unit="°" onChange={v => updFurniture({ angle: v * Math.PI / 180 })} accent="#C07840" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} /></div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selFurniture.label || ""} placeholder={spec?.name || ""} onChange={e => updFurniture({ label: e.target.value })} /></div>
            <button style={S.del} onClick={delSel}>Delete Furniture</button>
          </>;
        })()}
        {selectedIds.length <= 1 && selZone && (() => {
          const pts = selZone.points || [];
          const sf = pts.length ? Math.round(polyArea(pts) / (pxPerFoot * pxPerFoot)) : Math.round(ftN(selZone.w) * ftN(selZone.h));
          const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          const wFt = Math.round((maxX - minX) / pxPerFoot * 10) / 10;
          const hFt = Math.round((maxY - minY) / pxPerFoot * 10) / 10;
          const lib = zoneLibrary[selZone.type] ?? {};
          const items = lib.items ?? [];
          const estCost = items.reduce((s, i) => s + i.qty * i.unitCost, 0);
          const zoneClearSf = clearInsideSf(pts.length ? pts
            : [{ x: selZone.x, y: selZone.y }, { x: selZone.x + selZone.w, y: selZone.y }, { x: selZone.x + selZone.w, y: selZone.y + selZone.h }, { x: selZone.x, y: selZone.y + selZone.h }]);
          return <>
          <div style={{ fontSize: 12, marginBottom: 10, fontWeight: 600, color: lib.color }}>{lib.name} · {sf} sf</div>
          {zoneClearSf != null && zoneClearSf !== sf && (
            <div data-testid="zone-clear-sf" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: -6, marginBottom: 10, padding: "5px 9px", background: T.bg2, borderRadius: 5 }}>
              <span style={{ fontSize: 10, color: T.textMuted }}>Clear inside walls</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{zoneClearSf.toLocaleString()} sf</span>
            </div>
          )}
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
            <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={selZone.type}
              onChange={e => { const newType = e.target.value; const l = zoneLibrary[newType]; updZone({ type: newType, label: selZone.label === lib.name ? l.name : selZone.label }); }}>
              {Object.entries(zoneLibrary).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selZone.label} onChange={e => updZone({ label: e.target.value })} /></div>
          <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={selZone.notes ?? ""} onChange={e => updZone({ notes: e.target.value })} /></div>
          {/* Dimensions */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={S.lbl}>Width (ft)</div>
                <input type="number" step="0.5" min="1" value={wFt} style={S.inp}
                  onChange={e => {
                    const newW = Math.max(1, Number(e.target.value)) * pxPerFoot;
                    const oldW = maxX - minX || 1;
                    const scale = newW / oldW;
                    updZone({ points: pts.map(p => ({ ...p, x: minX + (p.x - minX) * scale })) });
                  }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={S.lbl}>Height (ft)</div>
                <input type="number" step="0.5" min="1" value={hFt} style={S.inp}
                  onChange={e => {
                    const newH = Math.max(1, Number(e.target.value)) * pxPerFoot;
                    const oldH = maxY - minY || 1;
                    const scale = newH / oldH;
                    updZone({ points: pts.map(p => ({ ...p, y: minY + (p.y - minY) * scale })) });
                  }} />
              </div>
            </div>
          </div>
          {/* FF&E Items */}
          {items.length > 0 && <div style={{ marginBottom: 10 }}>
            <div style={S.lbl}>FF&amp;E Items</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "4px 0", borderBottom: "1px solid " + T.border + "55" }}>
                  <span style={{ color: T.textMuted }}>{item.qty > 1 ? `${item.qty}× ` : ""}{item.name}</span>
                  <span style={{ color: T.text, whiteSpace: "nowrap", paddingLeft: 8 }}>{$(item.qty * item.unitCost)}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: T.accentDim ?? "#8A8478", marginTop: 5, textAlign: "right", fontWeight: 600 }}>Est. {$(estCost)}</div>
            </div>
          </div>}
          {(() => {
            const plan = ZONE_FURNISH_PLAN[selZone.type];
            const n = plan ? plan.reduce((s, p) => s + p.qty, 0) : 0;
            if (!n) return <div style={{ fontSize: 10, color: T.textFaint, fontStyle: "italic", margin: "6px 0 10px" }}>No furniture preset for this zone type.</div>;
            return <div style={{ marginBottom: 10 }}>
              <button data-testid="furnish-zone" onClick={() => furnishZone(selZone)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, border: "1.5px solid #C0784088", background: "#C0784022", color: T.textBright, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <span style={S.dot("#C07840")} />Furnish this zone
              </button>
              <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4, textAlign: "center" }}>Drops {n} pieces · arrange them in Furnish (4)</div>
            </div>;
          })()}
          <button style={S.del} onClick={delSel}>Delete Zone</button>
        </>; })()}
        {selectedIds.length <= 1 && selMarker && (() => {
          const compData = SPEC_COMPONENTS[selMarker.layer]?.[selMarker.componentType];
          const layerData = SPEC_LAYERS[selMarker.layer];
          return <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <svg width="30" height="30" viewBox="0 0 28 28" style={{ flexShrink: 0, overflow: "visible" }}>
                {/* A glyph's designation letter sits ~18px out, past this 28-unit box, so the
                    swatch lets it overflow (same as the palette buttons). `side` is dropped —
                    on the plan it stands the symbol off its wall, which here just shoves it
                    out of frame entirely. */}
                <MarkerSymbol marker={{ ...selMarker, side: undefined, x: 14, y: 14 }} selected={false} T={chromeT} themeMode={themeMode} tool={tool} mode={mode} pxPerFoot={pxPerFoot} />
              </svg>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: layerData?.color || "#9A9488" }}>{compData?.name || "Component"}{selMarker.finish ? ` (${selMarker.finish[0].toUpperCase() + selMarker.finish.slice(1)})` : ""}</div>
                {compData?.product && <div style={{ fontSize: 9, color: T.textFaint }}>≈ {compData.product}</div>}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={selMarker.label} onChange={e => updMarker({ label: e.target.value })} /></div>
            {compData?.finish && <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Finish</div>
              <div style={{ display: "flex", gap: 6 }}>
                {compData.finish.map(f => <button key={f} onClick={() => updMarker({ finish: f })}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 600, textTransform: "capitalize", border: "1.5px solid " + (selMarker.finish === f ? T.brand : T.border), background: selMarker.finish === f ? FINISH_COLORS[f].fill : "transparent", color: selMarker.finish === f ? FINISH_COLORS[f].line : T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: FINISH_COLORS[f].fill, border: "1px solid " + FINISH_COLORS[f].line }} />{f}
                </button>)}
              </div>
            </div>}
            {compData?.directional && <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Aim</div>
              <SliderInput value={((Math.round((selMarker.angle || 0) * 180 / Math.PI) % 360) + 360) % 360} min={0} max={359} step={5} unit="°" onChange={v => updMarker({ angle: v * Math.PI / 180 })} accent={T.brand} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
              <div style={{ fontSize: 9, color: T.textMuted, fontStyle: "italic", marginTop: 2 }}>Press R to rotate 15°</div>
            </div>}
            {/* Wall-mounted devices carry a mount height (AFF). It starts at the industry
                standard from the M3D catalog and drives BOTH the elevation view and 3D. */}
            {isWallMounted(compData) && (() => {
              const std = defaultMountHeightIn(selMarker.componentType) ?? 48;
              const cur = typeof selMarker.mountY === "number" ? selMarker.mountY : std;
              return <div style={{ marginBottom: 8 }}>
                <div style={S.lbl}>Mount Height (AFF)</div>
                <SliderInput value={cur} min={0} max={Math.max(std, Math.round(ceilingHeight) - 2)} step={1} unit='"'
                  onChange={v => updMarker({ mountY: v })} accent={T.brand} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: T.textMuted, fontStyle: "italic", flex: 1 }}>
                    {ft(cur / 12 * pxPerFoot)} · standard {std}"
                  </span>
                  {cur !== std && <button onClick={() => updMarker({ mountY: undefined })}
                    style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: T.accent, border: "1px solid " + T.border }}>Reset</button>}
                </div>
              </div>;
            })()}
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={selMarker.notes || ""} onChange={e => updMarker({ notes: e.target.value })} /></div>
            <div style={{ fontSize: 10, color: "#8A8478", marginBottom: 6 }}>Est: {$(compData?.unitCost || 0)}</div>
            {selMarker.layer === "power" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 8px", background: T.panelBg, borderRadius: 6, border: "1px solid " + T.border }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1 }}>
                  <input type="checkbox" checked={!!selMarker.isNew}
                    onChange={e => updMarker({ isNew: e.target.checked })}
                    style={{ width: 14, height: 14, accentColor: "#50A0E0", cursor: "pointer" }} />
                  <span style={{ fontSize: 10, color: T.textMuted }}>New / Planned</span>
                </label>
              </div>
            )}
            <button style={S.del} onClick={delSel}>Delete Component</button>
          </>;
        })()}
        {/* Multi-select panels */}
        {selectedIds.length > 1 && multiSelType && multiSelType !== "wall" && (
          <div style={{ marginBottom: 10 }}>
            <div style={S.lbl}>Align & Distribute</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <AlignBtn action="alignLeft"    label="⬤◌◌" tip="Align Left"       onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
              <AlignBtn action="alignCenterH" label="◌⬤◌" tip="Align Center (H)" onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
              <AlignBtn action="alignRight"   label="◌◌⬤" tip="Align Right"      onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <AlignBtn action="alignTop"     label="▲" tip="Align Top"        onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
              <AlignBtn action="alignMiddleV" label="↕" tip="Align Middle (V)" onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
              <AlignBtn action="alignBottom"  label="▼" tip="Align Bottom"     onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
            </div>
            {selectedIds.length > 2 && <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <AlignBtn action="distributeH" label="⇔ Space H" tip="Distribute Horizontally" onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
              <AlignBtn action="distributeV" label="⇕ Space V" tip="Distribute Vertically"   onAction={alignDistribute} border={T.border} accent={T.accent} textMuted={T.textMuted} textBright={T.textBright} />
            </div>}
          </div>
        )}
        {selectedIds.length > 1 && multiSelType === "wall" && (() => {
          const items = multiSelItems;
          const kind = cv(items, "kind") || "existing";
          const wk = wallKinds[kind];
          return <>
            <div style={{ fontSize: 12, color: wk?.color || "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Walls Selected</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {Object.entries(wallKinds).map(([k, v]) => <button key={k} style={{ padding: "6px 8px", background: kind === k ? v.color + "40" : "transparent", color: kind === k ? T.textBright : v.color, border: "1.5px solid " + v.color + "50", borderRadius: 5, fontSize: 9, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.12s ease" }}
                onClick={() => updWall({ kind: k })}>{v.label}</button>)}
            </div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Material</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                {WALL_MATERIALS.map(value => {
                  const isSel = (cv(items, "material") ?? "Drywall") === value;
                  const patId = WALL_MATERIAL_HATCHES[value];
                  return <button key={value} onClick={() => updWall({ material: value })}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 4px", background: isSel ? T.border + "60" : "transparent", border: "1.5px solid " + (isSel ? T.accent : T.border), borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>
                    <svg width="32" height="14" style={{ display: "block", borderRadius: 2, overflow: "hidden" }}>
                      <rect width="32" height="14" fill={T.bg2}/>
                      {patId && <rect width="32" height="14" fill={`url(#${patId})`}/>}
                      <rect width="32" height="14" fill="none" stroke={isSel ? T.accent : T.border} strokeWidth="1"/>
                    </svg>
                    <span style={{ fontSize: 8, color: isSel ? T.textBright : T.textMuted, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{value}</span>
                  </button>;
                })}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Ceiling Height</div>
              <select value={cv(items, "ceilingHeight") ?? ceilingHeight} onChange={e => updWall({ ceilingHeight: Number(e.target.value) })} style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }}>
                {cv(items, "ceilingHeight") === undefined && <option value="">Mixed</option>}
                {[84, 96, 108, 120, 132, 144].map(h => <option key={h} value={h}>{Math.floor(h / 12)}'-{h % 12 ? h % 12 + '"' : '0"'}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 72, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updWall({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
            <button style={S.del} onClick={delSel}>Delete {items.length} Walls</button>
          </>;
        })()}
        {selectedIds.length > 1 && multiSelType === "door" && (() => {
          const items = multiSelItems;
          const w = cv(items, "width");
          return <>
            <div style={{ fontSize: 12, color: T.uiDoor, marginBottom: 10, fontWeight: 600 }}>{items.length} Doors Selected</div>
            <div style={{ marginBottom: 10 }}><SliderInput value={w} min={24} max={96} onChange={dw => updDoor({ width: dw })} accent={T.uiDoor} textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} disabled={w === undefined} /></div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ flipped: !items[0]?.flipped })}>In/Out (F)</button>
              <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiDoor, fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updDoor({ hingeRight: !items[0]?.hingeRight })}>Hinge (R)</button>
            </div>
            <button style={S.del} onClick={delSel}>Delete {items.length} Doors</button>
          </>;
        })()}
        {selectedIds.length > 1 && multiSelType === "window" && (() => {
          const items = multiSelItems;
          const w = cv(items, "width");
          return <>
            <div style={{ fontSize: 12, color: "#60A0C8", marginBottom: 10, fontWeight: 600 }}>{items.length} Windows Selected</div>
            <div style={{ marginBottom: 10 }}><SliderInput value={w} min={12} max={96} onChange={ww => updWindow({ width: ww })} accent="#60A0C8" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} disabled={w === undefined} /></div>
            <button style={S.del} onClick={delSel}>Delete {items.length} Windows</button>
          </>;
        })()}
        {selectedIds.length > 1 && multiSelType === "column" && (() => {
          const items = multiSelItems;
          const shape = cv(items, "shape");
          const size = cv(items, "size");
          return <>
            <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Columns Selected</div>
            <div style={{ marginBottom: 8 }}>
              <div style={S.lbl}>Shape</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: shape === "circle" ? T.textBright : T.textMuted, background: shape === "circle" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "circle" })}>● Circle</button>
                <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: shape === "square" ? T.textBright : T.textMuted, background: shape === "square" ? T.border + "60" : "transparent", fontSize: 10, flex: 1, fontWeight: 500 }} onClick={() => updColumn({ shape: "square" })}>■ Square</button>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Size (inches)</div><SliderInput value={size} min={6} max={48} onChange={v => updColumn({ size: v })} accent="#9A9488" textColor={T.textBright} bgColor={T.bg2} borderColor={T.border} disabled={size === undefined} /></div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Label</div><input style={S.inp} value={cv(items, "label") ?? ""} onChange={e => updColumn({ label: e.target.value })} placeholder={cv(items, "label") === undefined ? "Mixed" : ""} /></div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updColumn({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
            <button style={S.del} onClick={delSel}>Delete {items.length} Columns</button>
          </>;
        })()}
        {selectedIds.length > 1 && multiSelType === "zone" && (() => {
          const items = multiSelItems;
          const type = cv(items, "type");
          return <>
            <div style={{ fontSize: 12, color: type ? zoneLibrary[type]?.color : "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Zones Selected</div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Type</div>
              <select style={{ ...S.inp, padding: "6px 10px", fontSize: 10 }} value={type ?? ""}
                onChange={e => { const nt = e.target.value; const lib = zoneLibrary[nt]; updZone({ type: nt, label: lib.name }); }}>
                {!type && <option value="">Mixed</option>}
                {Object.entries(zoneLibrary).map(([k, z]) => <option key={k} value={k}>{z.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updZone({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Paint</div><div style={{ display: "flex", gap: 6 }}>
              <input type="color" value={cv(items, "paintColor") ?? "#E8E0D0"} onChange={e => updZone({ paintColor: e.target.value })} style={{ width: 28, height: 28, border: "1.5px solid " + T.border, background: "none", cursor: "pointer", borderRadius: 5 }} />
              <input style={{ ...S.inp, flex: 1 }} value={cv(items, "paintFinish") ?? ""} onChange={e => updZone({ paintFinish: e.target.value })} placeholder={cv(items, "paintFinish") === undefined ? "Mixed" : "Finish"} />
            </div></div>
            <button style={S.del} onClick={delSel}>Delete {items.length} Zones</button>
          </>;
        })()}
        {selectedIds.length > 1 && multiSelType === "marker" && (() => {
          const items = multiSelItems;
          return <>
            <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>{items.length} Components Selected</div>
            <div style={{ marginBottom: 8 }}><div style={S.lbl}>Notes</div><textarea style={{ ...S.inp, height: 40, resize: "vertical" }} value={cv(items, "notes") ?? ""} onChange={e => updMarker({ notes: e.target.value })} placeholder={cv(items, "notes") === undefined ? "Mixed" : ""} /></div>
            <button style={S.del} onClick={delSel}>Delete {items.length} Components</button>
          </>;
        })()}
        {selectedIds.length > 1 && multiSelType === "mixed" && <>
          <div style={{ fontSize: 12, color: "#9A9488", marginBottom: 10, fontWeight: 600 }}>{selectedIds.length} Items Selected (Mixed Types)</div>
          <button style={S.del} onClick={delSel}>Delete {selectedIds.length} Items</button>
        </>}
      </div>}
    </>
  );
}

export default Inspector;
