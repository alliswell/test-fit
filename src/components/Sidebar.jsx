// ─── Sidebar ─────────────────────────────────────────────────────────────────────
// Left sidebar: project name, the per-stage panel (reference image + summary in Build,
// zone types in Zones, furniture catalog in Furnish, component layers in IT/MEP, the deck
// strip in Docs, the cost breakdown in Budget) and the LAYERS visibility/lock panel.
// Props-only (never imports testfit.jsx): `S` is the shared style sheet, `T` the chrome
// theme; everything else is state and handlers threaded from TestfitTool.
import { memo } from "react";
import { DeckStrip } from "./DocsView";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { FINISH_COLORS, SPEC_COMPONENTS, SPEC_LAYERS } from "../constants/specs";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES } from "../constants/furniture";
import { SLIDE_VIS_PRESETS, defaultSlideName, matchSlidePreset } from "../utils/docs";
import { isLightComponent, polyArea } from "../imports/model";

function Sidebar({
  $, S, T, activeFurnitureType, activeSlideId, activeSpecLayer, activeZoneType, addSlide, bgImage, bgOpacity, bgScale, calibrationFeet, calibrationLine, columns, cost, dims, docSettings, doors, dropSlide, fRef, floorRegions, flowPaths, font, ft, furniture, guides, labels, layerLocked, lockedLayers, markers, mode, projectName, pxPerFoot, removeSlide, revClouds, selectedId, selectedIds, setActiveComponentType, setActiveFurnitureType, setActiveSlideId, setActiveSpecLayer, setActiveZoneType, setBgImage, setBgOffset, setBgOpacity, setBgScale, setCalibrationFeet, setCalibrationLine, setLockedLayers, setProjectName, setSelType, setSelectedId, setSelectedIds, setShowGrid, setT, setTool, setVisibleBuildElectrical, setVisibleBuildLighting, setVisibleDims, setVisibleFloorRegions, setVisibleFlowPaths, setVisibleFurniture, setVisibleGuides, setVisibleITMEP, setVisibleLabels, setVisibleLayers, setVisibleRevClouds, setVisibleZones, showGrid, slides, tool, uiColor, updateSlide, visibleBuildElectrical, visibleBuildLighting, visibleDims, visibleFloorRegions, visibleFlowPaths, visibleFurniture, visibleGuides, visibleITMEP, visibleLabels, visibleLayers, visibleRevClouds, visibleZones, wallKinds, walls, windows, wl, zoneLibrary, zones,
}) {
  return (
    <>
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div style={S.side}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid " + T.bg3, background: T.bg0 }}>
          <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 600 }}>Project</div>
          <input data-testid="project-name" style={{ background: "none", border: "none", color: T.textBright, fontSize: 14, fontFamily: "inherit", fontWeight: 600, width: "100%", outline: "none" }} value={projectName} onChange={e => setProjectName(e.target.value)} />
        </div>
        <div style={S.body}>
          {/* Mono skin controls now live in the topbar Mono split-button dropdown. */}

          {/* ── BUILD ─────────────────────────────────────────── */}
          {mode === "build" && <>
            <div style={S.sec}>
              <div style={S.sh}>Reference Image</div>
              <button onClick={() => fRef.current?.click()} style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: bgImage ? T.textBright : T.textMuted, fontSize: 10, fontWeight: 500 }}>
                {bgImage ? "Replace Image" : "Upload Floorplan"}
              </button>
              <input ref={fRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setBgImage(ev.target.result); r.readAsDataURL(f); } }} />
              {bgImage && <>
                <div style={{ marginTop: 10 }}><div style={S.lbl}>Opacity</div><input type="range" min="0" max="100" value={bgOpacity * 100} onChange={e => setBgOpacity(e.target.value / 100)} style={{ width: "100%", accentColor: "#9A9488", height: 4 }} /></div>
                <div style={{ marginTop: 8 }}><div style={S.lbl}>Scale</div><input type="range" min="20" max="300" value={bgScale * 100} onChange={e => setBgScale(e.target.value / 100)} style={{ width: "100%", accentColor: "#9A9488", height: 4 }} /></div>
                <div style={{ fontSize: 9, color: T.textDim, marginTop: 6, fontStyle: "italic" }}>Alt + drag to reposition</div>
                <button onClick={() => { setBgImage(null); setBgOpacity(0.35); setBgScale(1); setBgOffset({ x: 0, y: 0 }); }} style={{ ...S.del, marginTop: 10, width: "100%", textAlign: "center" }}>Delete Reference Image</button>
              </>}
            </div>
            {bgImage && calibrationLine && calibrationLine.p1 && calibrationLine.p2 && (
              <div style={S.sec}>
                <div style={S.sh}>Calibrate Scale</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={S.lbl}>Known Distance (feet)</div>
                  <input 
                    style={S.inp} 
                    type="number" 
                    value={calibrationFeet} 
                    onChange={e => setCalibrationFeet(e.target.value)} 
                    placeholder="10"
                    step="0.5"
                  />
                </div>
                <button 
                  style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiConduit, fontSize: 10, fontWeight: 500, marginBottom: 6 }}
                  onClick={() => {
                    const feet = parseFloat(calibrationFeet);
                    if (feet > 0 && calibrationLine.p1 && calibrationLine.p2) {
                      const pixelDist = Math.sqrt(
                        Math.pow(calibrationLine.p2.x - calibrationLine.p1.x, 2) + 
                        Math.pow(calibrationLine.p2.y - calibrationLine.p1.y, 2)
                      );
                      const targetPixels = feet * pxPerFoot;
                      const newScale = targetPixels / pixelDist;
                      setBgScale(prevScale => prevScale * newScale);
                      setCalibrationLine(null);
                      setT("select");
                    }
                  }}
                >
                  Apply Calibration
                </button>
                <button 
                  style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.textMuted, fontSize: 10, fontWeight: 500 }}
                  onClick={() => setCalibrationLine(null)}
                >
                  Clear Line
                </button>
              </div>
            )}
            {/* Drawing Scale — hidden, state + functionality preserved */}
            <div style={S.sec}>
              <div style={S.sh}>Summary</div>
              {Object.entries(cost.wallFt).map(([k, v]) => <div key={k} style={S.cr}><span style={{ color: v.color, fontWeight: 500 }}>{v.label}</span><span style={{ fontWeight: 500 }}>{ft(v.ft)}</span></div>)}
              {Object.keys(cost.wallFt).length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>No walls yet</div>}
              <div style={{ ...S.cr, color: T.accent, borderBottom: "none" }}><span>Doors</span><span>{doors.length}</span></div>
              <div style={{ ...S.cr, color: T.accent, borderBottom: "none" }}><span>Windows</span><span>{windows.length}</span></div>
              <div style={{ ...S.cr, color: T.accent, borderBottom: "none", paddingBottom: 0 }}><span>Columns</span><span>{columns.length}</span></div>
              {(() => {
                const pm = markers.filter(m => m.layer === "power");
                if (!pm.length) return null;

                // Group by componentType + isNew
                const groups = {};
                pm.forEach(m => {
                  const compData = SPEC_COMPONENTS.power[m.componentType];
                  if (!compData) return;
                  const isLighting = m.componentType?.startsWith("light_") || m.componentType?.startsWith("htrack_") || m.componentType === "sconce_prewire" || m.componentType === "pendent_prewire";
                  const key = m.componentType + (m.isNew ? "_new" : "_ab");
                  if (!groups[key]) groups[key] = { name: compData.name, isNew: !!m.isNew, isLighting, color: isLighting ? T.uiLighting : T.uiElec, ids: [] };
                  groups[key].ids.push(m.id);
                });

                const elecGroups = Object.values(groups).filter(g => !g.isLighting);
                const ltGroups   = Object.values(groups).filter(g =>  g.isLighting);

                const SummaryRow = ({ group }) => {
                  const isGroupSel = group.ids.length > 0 && group.ids.every(id => selectedIds.includes(id));
                  const rowColor = group.isNew ? "#50A0E0" : group.color;
                  return <div
                    style={{ ...S.cr, cursor: "pointer", background: isGroupSel ? T.selBg : "transparent", borderRadius: 4, transition: "all 0.12s ease" }}
                    onClick={() => { setSelectedIds(group.ids); setSelectedId(group.ids[0]); setSelType("marker"); setT("select"); }}>
                    <span style={{ color: rowColor, fontWeight: 500 }}>{group.ids.length}× {group.name}</span>
                    <span style={{ fontSize: 9, color: group.isNew ? "#50A0E0" : T.textMuted, fontStyle: "italic" }}>{group.isNew ? "new" : "existing"}</span>
                  </div>;
                };

                return <>
                  {elecGroups.length > 0 && <>
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid " + T.border, fontSize: 8, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 600 }}>Electrical</div>
                    {elecGroups.map((g, i) => <SummaryRow key={i} group={g} />)}
                  </>}
                  {ltGroups.length > 0 && <>
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid " + T.border, fontSize: 8, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 600 }}>Lighting</div>
                    {ltGroups.map((g, i) => <SummaryRow key={i} group={g} />)}
                  </>}
                </>;
              })()}
            </div>
          </>}

          {/* ── ZONE ────��──────────────────────────────────────── */}
          {mode === "zone" && <>
            <div style={S.sec}>
              <div style={S.sh}>Zone Types</div>
            </div>
            <div style={S.sec}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(zoneLibrary).map(([k, z]) => <button key={k} style={S.btn(activeZoneType === k, z.color)}
                  onClick={() => { setActiveZoneType(k); if (tool !== "zone") setT("zone"); }}>
                  <span style={S.dot(z.color)} />{z.name}
                </button>)}
              </div>
            </div>
            <div style={S.sec}>
              <div style={S.sh}>Placed Zones ({zones.length})</div>
              {zones.length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>No zones placed yet</div>}
              {zones.map(z => <div key={z.id} style={{ padding: "6px 10px", background: selectedId === z.id ? T.selBg : "transparent", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 10, marginBottom: 3, border: selectedId === z.id ? "1.5px solid " + T.selBorder : "1.5px solid transparent", transition: "all 0.12s ease" }}
                onClick={() => { setSelectedId(z.id); setSelType("zone"); setT("select"); }}>
                <span style={S.dot(zoneLibrary[z.type].color)} />
                <span style={{ flex: 1, fontWeight: selectedId === z.id ? 500 : 400 }}>{z.label}</span>
                <span style={{ color: T.accentDim, fontSize: 9 }}>{z.points ? Math.round(polyArea(z.points) / (pxPerFoot * pxPerFoot)) + " sf" : ft(z.w) + "×" + ft(z.h)}</span>
              </div>)}
              {cost.totalSf > 0 && <div style={{ ...S.cr, fontWeight: 600, marginTop: 8, borderTop: "1.5px solid " + T.selBorder, paddingTop: 8, borderBottom: "none" }}><span>Total Area</span><span>{cost.totalSf} sf</span></div>}
            </div>
          </>}

          {/* ── FURNISH (zone editor) ──────────────────────────── */}
          {mode === "furnish" && <>
            {FURNITURE_CATEGORIES.map(cat => {
              const items = Object.values(FURNITURE_CATALOG).filter(s => s.cat === cat.key);
              if (!items.length) return null;
              return <div style={S.sec} key={cat.key}>
                <div style={S.sh}>{cat.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {items.map(s => <button key={s.type} style={S.btn(tool === "furniture" && activeFurnitureType === s.type, "#C07840")}
                    onClick={() => { setActiveFurnitureType(s.type); setT("furniture"); }}>
                    <span style={S.dot("#C07840")} />
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{ color: T.accentDim, fontSize: 9 }}>{ft(s.w * pxPerFoot)}×{ft(s.d * pxPerFoot)}</span>
                  </button>)}
                </div>
              </div>;
            })}
            <div style={S.sec}>
              <div style={S.sh}>Placed Furniture ({furniture.length})</div>
              {furniture.length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>Pick a piece above, then click in a zone to place it.</div>}
              {furniture.map(f => <div key={f.id} style={{ padding: "6px 10px", background: selectedId === f.id ? T.selBg : "transparent", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 10, marginBottom: 3, border: selectedId === f.id ? "1.5px solid " + T.selBorder : "1.5px solid transparent", transition: "all 0.12s ease" }}
                onClick={() => { setSelectedId(f.id); setSelType("furniture"); setT("select"); }}>
                <span style={S.dot("#C07840")} />
                <span style={{ flex: 1, fontWeight: selectedId === f.id ? 500 : 400 }}>{f.label || FURNITURE_CATALOG[f.type]?.name || f.type}</span>
                <span style={{ color: T.accentDim, fontSize: 9 }}>{ft(f.w * pxPerFoot)}×{ft(f.d * pxPerFoot)}</span>
              </div>)}
            </div>
          </>}

          {/* ── IT / MEP ───────────────────────────────────────── */}
          {mode === "itmep" && <>
            <div style={S.sec}>
              <div style={S.sh}>Component Layers</div>
              {Object.entries(SPEC_LAYERS).filter(([k]) => k !== "power").map(([k, l]) => <div key={k} style={{
                ...S.lr, 
                background: activeSpecLayer === k ? uiColor(l.color) + "20" : "transparent",
                border: activeSpecLayer === k ? "2px solid " + uiColor(l.color) + "60" : "2px solid transparent",
                borderRadius: "6px",
                padding: "8px 6px",
                margin: "2px 0",
                transition: "all 0.15s ease"
              }} onClick={() => { setActiveSpecLayer(k); const firstComp = Object.keys(SPEC_COMPONENTS[k])[0]; setActiveComponentType(firstComp); setT("marker"); }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: uiColor(l.color), opacity: visibleLayers[k] ? 1 : 0.3, flexShrink: 0 }} />
                <span style={{ color: activeSpecLayer === k ? T.textBright : T.accent, flex: 1, fontWeight: activeSpecLayer === k ? 600 : 400 }}>{l.name}</span>
                <span style={{ color: activeSpecLayer === k ? uiColor(l.color) : T.accentDim, fontSize: 10, fontWeight: 500 }}>{markers.filter(p => p.layer === k).length}</span>
              </div>)}
            </div>
            <div style={S.sec}>
              <div style={S.sh}>Placed Components ({markers.length})</div>
              {markers.length === 0 && <div style={{ color: T.textFaint, fontSize: 10, padding: "8px 0", fontStyle: "italic" }}>No components placed yet</div>}
              {Object.entries(SPEC_LAYERS).filter(([k]) => k !== "power").map(([layerKey, layer]) => {
                const layerMarkers = markers.filter(m => m.layer === layerKey);
                if (layerMarkers.length === 0) return null;
                // Group by componentType + finish so white/black list separately.
                const groups = {};
                layerMarkers.forEach(m => {
                  const gkey = `${m.componentType}|${m.finish || ""}`;
                  if (!groups[gkey]) groups[gkey] = [];
                  groups[gkey].push(m);
                });
                return <div key={layerKey} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, color: layer.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontWeight: 600 }}>{layer.name}</div>
                  {Object.entries(groups).map(([gkey, groupMarkers]) => {
                    const [compType, finish] = gkey.split("|");
                    const compData = SPEC_COMPONENTS[layerKey]?.[compType];
                    const fin = finish && FINISH_COLORS[finish];
                    const swFill = fin ? fin.fill : (compData?.color || layer.color);
                    const swLine = fin ? fin.line : (compData?.color || layer.color);
                    const finLabel = finish ? ` (${finish[0].toUpperCase() + finish.slice(1)})` : "";
                    const groupIds = groupMarkers.map(m => m.id);
                    const isGroupSelected = groupIds.some(id => selectedId === id || selectedIds.includes(id));
                    return <div key={gkey} style={{ padding: "4px 8px", background: isGroupSelected ? T.selBg : "transparent", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 10, marginBottom: 2, border: isGroupSelected ? "1.5px solid " + T.selBorder : "1.5px solid transparent", transition: "all 0.12s ease" }}
                      onClick={() => { setSelectedId(null); setSelType(null); setSelectedIds(groupIds); setTool("select"); }}>
                      <span style={{ width: 12, height: 12, borderRadius: compData?.symbol === "rack" ? 2 : 6, background: swFill, border: "1.5px solid " + swLine, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: isGroupSelected ? 500 : 400 }}>{(compData?.name || compType) + finLabel}</span>
                      {groupMarkers.length > 1 && <span style={{ color: layer.color, fontSize: 9, fontWeight: 600, background: layer.color + "18", padding: "1px 5px", borderRadius: 8 }}>{groupMarkers.length}</span>}
                    </div>;
                  })}
                </div>;
              })}
            </div>
          </>}

          {/* ── BUDGET ─────────────────────────────────────────── */}
          {mode === "docs" && <>
            <div style={S.sec}>
              <div style={S.sh}>Documentation</div>
              <div style={S.cr}><span>Sheet</span><span style={{ fontWeight: 500, textTransform: "capitalize" }}>{docSettings.size} · {docSettings.orientation}</span></div>
              <div style={{ fontSize: 9, color: T.textMuted, lineHeight: 1.6, marginTop: 8 }}>
                Slides live-render the current model — edits in stages 1–5 update the deck automatically. Use the camera button on any pane to add a slide.
              </div>
            </div>
            <div style={S.sec}>
              <DeckStrip T={T} font={font} slides={slides} activeSlideId={activeSlideId}
                onSelectSlide={setActiveSlideId} onUpdateSlide={updateSlide} onDeleteSlide={removeSlide}
                onDropSlide={dropSlide}
                onAddTemplate={(view) => addSlide({ name: defaultSlideName(view, slides.length), view, rect: null, cam3d: null, image: null })} />
            </div>
          </>}
          {mode === "budget" && <>
            <div style={S.sec}>
              <div style={S.sh}>Cost Breakdown</div>
              {cost.construction.walls.map((v) => {
                const k = v.kind;
                const matchingWalls = walls.filter(w => (w.kind || "existing") === k);
                const isSelected = matchingWalls.length > 0 && matchingWalls.every(w => selectedIds.includes(w.id));
                return <div key={k} style={{ ...S.cr, cursor: "pointer", transition: "all 0.12s ease", background: isSelected ? T.selBg : "transparent" }}
                  onClick={() => {
                    const wallIds = matchingWalls.map(w => w.id);
                    setSelectedIds(wallIds);
                    if (wallIds.length > 0) {
                      setSelectedId(wallIds[0]);
                      setSelType("wall");
                    }
                  }}
                >
                  <span style={{ color: v.color, fontWeight: 500 }}>{v.label} wall · {ft(v.ft)}</span><span style={{ fontWeight: 500 }}>{v.cost ? $(v.cost) : "—"}</span>
                </div>;
              })}
              {cost.construction.doors.map(d => <div key={"cd" + d.type} style={S.cr}><span>{d.count}× Door · {d.type}</span><span style={{ fontWeight: 500 }}>{d.cost ? $(d.cost) : "—"}</span></div>)}
              {cost.construction.windows.map(w => <div key={"cw" + w.type} style={S.cr}><span>{w.count}× {w.type}</span><span style={{ fontWeight: 500 }}>{w.cost ? $(w.cost) : "—"}</span></div>)}
              {cost.zones.map(z => <div key={z.id} style={{ ...S.cr, cursor: "pointer", transition: "all 0.12s ease", background: selectedId === z.id ? T.selBg : "transparent" }}
                onClick={() => {
                  setSelectedId(z.id);
                  setSelType("zone");
                  setSelectedIds([z.id]);
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={S.dot(zoneLibrary[z.type].color)} />{z.label}</span>
                <span style={{ fontWeight: 500 }}>{$(z.total)}</span>
              </div>)}
              {Object.entries(cost.markers).map(([k, p]) => {
                const [layer, componentType, finish] = k.split('|');
                const matchingMarkers = markers.filter(m => m.layer === layer && m.componentType === componentType && (m.finish || "") === (finish || ""));
                const isSelected = matchingMarkers.length > 0 && matchingMarkers.every(m => selectedIds.includes(m.id));
                return <div key={k} style={{ ...S.cr, cursor: "pointer", transition: "all 0.12s ease", background: isSelected ? T.selBg : "transparent" }}
                  onClick={() => {
                    const markerIds = matchingMarkers.map(m => m.id);
                    setSelectedIds(markerIds);
                    if (markerIds.length > 0) {
                      setSelectedId(markerIds[0]);
                      setSelType("marker");
                    }
                  }}
                >
                  <span>{p.count}× {p.name}</span><span style={{ fontWeight: 500 }}>{$(p.count * p.unitCost)}</span>
                </div>;
              })}
              {cost.totalSf > 0 && <div style={S.cr}><span>Total area</span><span style={{ fontWeight: 500 }}>{cost.totalSf} sf</span></div>}
              <div style={S.ct}><span>Total Estimate</span><span>{$(cost.total)}</span></div>
              <button style={{ ...S.inp, cursor: "pointer", textAlign: "center", color: T.uiBudget, marginTop: 10, fontSize: 10, fontWeight: 500 }}
                onClick={() => {
                  const lines = [`${projectName} — Testfit Summary`, ""];
                  if (Object.keys(cost.wallFt).length) {
                    lines.push("WALLS");
                    Object.entries(cost.wallFt).forEach(([k, v]) => lines.push(`  ${v.label}: ${ft(v.ft)}`));
                    // Wall details
                    const wallsWithInfo = walls.filter(w => w.material || w.paintFinish || w.notes);
                    if (wallsWithInfo.length) {
                      lines.push("  —");
                      wallsWithInfo.forEach(w => {
                        const wk = wallKinds[w.kind || "existing"];
                        const parts = [`${wk.label} · ${ft(wl(w))}`];
                        if (w.material) parts.push(w.material);
                        if (w.paintFinish) parts.push(`Paint: ${w.paintFinish}`);
                        if (w.notes) parts.push(`(${w.notes})`);
                        lines.push(`  ${parts.join(" · ")}`);
                      });
                    }
                    lines.push("");
                  }
                  if (cost.zones.length) {
                    lines.push("ZONES");
                    cost.zones.forEach(z => lines.push(`  ${z.label} — ${z.sf} sf — ${$(z.total)}`));
                    lines.push(`  Total: ${cost.totalSf} sf`);
                    lines.push("");
                  }
                  const markerEntries = Object.entries(cost.markers);
                  if (markerEntries.length) {
                    lines.push("MARKERS");
                    markerEntries.forEach(([k, p]) => lines.push(`  ${p.count}× ${p.name} — ${$(p.count * p.unitCost)}`));
                    lines.push("");
                  }
                  if (doors.length) lines.push(`DOORS: ${doors.length}`);
                  if (windows.length) lines.push(`WINDOWS: ${windows.length}`);
                  lines.push(""); lines.push(`TOTAL ESTIMATE: ${$(cost.total)}`);
                  
                  // Fallback clipboard copy with error handling
                  const text = lines.join("\n");
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(() => {
                      // Fallback: create a temporary textarea
                      const textarea = document.createElement("textarea");
                      textarea.value = text;
                      textarea.style.position = "fixed";
                      textarea.style.opacity = "0";
                      document.body.appendChild(textarea);
                      textarea.select();
                      try {
                        document.execCommand("copy");
                      } catch (err) {
                        console.error("Copy failed:", err);
                      }
                      document.body.removeChild(textarea);
                    });
                  } else {
                    // Fallback for browsers without clipboard API
                    const textarea = document.createElement("textarea");
                    textarea.value = text;
                    textarea.style.position = "fixed";
                    textarea.style.opacity = "0";
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                      document.execCommand("copy");
                    } catch (err) {
                      console.error("Copy failed:", err);
                    }
                    document.body.removeChild(textarea);
                  }
                }}>Copy Summary to Clipboard</button>
            </div>
          </>}
        </div>
        {/* ── Visibility panel — planning modes only. Docs uses the per-slide Layers
            panel in the slide inspector instead, so the live-layer toggles here would
            be redundant (and misleading — they don't drive the deck's rendering). ── */}
        {mode !== "docs" && (() => {
          const isLightComp = isLightComponent;
          const rows = [
            // Universal items (lockable = items can be locked from selection/editing)
            { key: "grid",       label: "Grid",           color: T.textMuted,            visible: showGrid,              toggle: () => setShowGrid(v => !v),              count: null, lockable: false },
            { key: "zones",      label: "Zones",          color: T.uiZone ?? "#6A9BCC", visible: visibleZones,          toggle: () => setVisibleZones(v => !v),          count: zones.length, lockable: true },
            { key: "dims",       label: "Dimensions",     color: T.dimText,              visible: visibleDims,           toggle: () => setVisibleDims(v => !v),           count: dims.length, lockable: true },
            { key: "labels",     label: "Labels",         color: T.textBright,           visible: visibleLabels,         toggle: () => setVisibleLabels(v => !v),         count: labels.length, lockable: true },
            { key: "revClouds",  label: "Rev Clouds",     color: "#E05252",              visible: visibleRevClouds,      toggle: () => setVisibleRevClouds(v => !v),      count: revClouds.length, lockable: true },
            { key: "flowPaths",  label: "Flow Paths",     color: "#4A90D9",              visible: visibleFlowPaths,      toggle: () => setVisibleFlowPaths(v => !v),      count: flowPaths.length, lockable: true },
            { key: "floorRegions", label: "Floors",       color: "#7A9E5A",              visible: visibleFloorRegions,   toggle: () => setVisibleFloorRegions(v => !v),   count: floorRegions.length, lockable: true },
            { key: "furniture",  label: "Furniture",      color: "#C07840",              visible: visibleFurniture,      toggle: () => setVisibleFurniture(v => !v),      count: furniture.length, lockable: true },
            { key: "guides",     label: "Elevation Rulers", color: "#2E8BE6",            visible: visibleGuides,         toggle: () => setVisibleGuides(v => !v),         count: guides.length, lockable: true },
            { key: "itmep",      label: "IT / MEP",       color: T.uiElec ?? "#E0A030",  visible: visibleITMEP,          toggle: () => setVisibleITMEP(v => !v),          count: markers.length, lockable: true },
            // ITMEP-specific per-layer toggles (only inside IT/MEP mode, and only when the master is on)
            ...(mode === "itmep" && visibleITMEP ? [
              { key: "elec",   label: "Electrical", color: T.uiElec,     visible: visibleBuildElectrical, toggle: () => setVisibleBuildElectrical(v => !v), count: markers.filter(m => m.layer === "power" && !isLightComp(m.componentType)).length, lockable: true },
              { key: "light",  label: "Lighting",   color: T.uiLighting, visible: visibleBuildLighting,   toggle: () => setVisibleBuildLighting(v => !v),   count: markers.filter(m => m.layer === "power" && isLightComp(m.componentType)).length, lockable: true },
            ] : []),
            // ITMEP spec layers
            ...(mode === "itmep" && visibleITMEP ? Object.entries(SPEC_LAYERS).filter(([k]) => k !== "power").map(([k, l]) => ({
              key: k, label: l.name, color: uiColor(l.color), visible: visibleLayers[k],
              toggle: () => setVisibleLayers(v => ({ ...v, [k]: !v[k] })),
              count: markers.filter(m => m.layer === k).length, lockable: true,
            })) : []),
          ];
          const toggleLock = (key) => {
            const locking = !lockedLayers[key];
            setLockedLayers(v => ({ ...v, [key]: !v[key] }));
            // Locking drops the current selection so a pre-selected item on a now-locked
            // layer can't still be nudged / deleted / edited via the inspector.
            if (locking) { setSelectedId(null); setSelType(null); setSelectedIds([]); }
          };
          // Layer presets — the same one-click looks as the Docs stage, applied to the live
          // planning layers (so you can focus the working view AND preview how a slide reads).
          // Collapse the spread-out visibility state into the SLIDE_LAYER_DEFS vis shape:
          // IT/MEP layers only count as "on" when the master (visibleITMEP) is also on.
          const layerVis = {
            grid: showGrid, dims: visibleDims, zones: visibleZones, floors: visibleFloorRegions,
            labels: visibleLabels, revClouds: visibleRevClouds, flowPaths: visibleFlowPaths, guides: visibleGuides,
            elec: visibleITMEP && visibleBuildElectrical, light: visibleITMEP && visibleBuildLighting,
            av: visibleITMEP && !!visibleLayers.av, it: visibleITMEP && !!visibleLayers.it,
            mep: visibleITMEP && !!visibleLayers.mep, security: visibleITMEP && !!visibleLayers.security,
          };
          const allLayersOn = Object.values(layerVis).every(Boolean);
          const activeLayerPreset = allLayersOn ? "all" : matchSlidePreset(layerVis);
          const layerPresets = [{ id: "all", label: "All", vis: Object.fromEntries(Object.keys(layerVis).map(k => [k, true])) }, ...SLIDE_VIS_PRESETS];
          const applyLayerPreset = (vis) => {
            setShowGrid(!!vis.grid); setVisibleDims(!!vis.dims); setVisibleZones(!!vis.zones);
            setVisibleFloorRegions(!!vis.floors); setVisibleLabels(!!vis.labels);
            setVisibleRevClouds(!!vis.revClouds); setVisibleFlowPaths(!!vis.flowPaths); setVisibleGuides(!!vis.guides);
            setVisibleBuildElectrical(!!vis.elec); setVisibleBuildLighting(!!vis.light);
            setVisibleLayers({ power: !!(vis.elec || vis.light), av: !!vis.av, it: !!vis.it, mep: !!vis.mep, security: !!vis.security });
            // Master IT/MEP toggle: on iff the preset shows any device layer, else all markers hide.
            setVisibleITMEP(!!(vis.elec || vis.light || vis.av || vis.it || vis.mep || vis.security));
          };
          return (
            <div style={{ borderTop: "1px solid " + T.bg3, padding: "10px 12px", background: T.bg1, flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>Layers</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {layerPresets.map(p => (
                  <button key={p.id} data-testid={"plan-layer-preset-" + p.id} data-active={activeLayerPreset === p.id ? "true" : undefined} onClick={() => applyLayerPreset(p.vis)}
                    style={{ padding: "3px 8px", fontSize: 9.5, fontFamily: "inherit", fontWeight: 600, borderRadius: 5, cursor: "pointer",
                      border: "1px solid " + (activeLayerPreset === p.id ? T.brand : T.border),
                      background: activeLayerPreset === p.id ? T.brand + "22" : "transparent",
                      color: activeLayerPreset === p.id ? T.textBright : T.textMuted }}>{p.label}</button>
                ))}
              </div>
              {[...rows].sort((a, b) => a.label.localeCompare(b.label)).map(({ key, label, color, visible, toggle, count, lockable }) => {
                const locked = lockable && layerLocked(key);
                return (
                <div key={key} data-testid={"plan-layer-row-" + key} style={{ ...S.lr, padding: "4px 4px", borderRadius: 6, marginBottom: 1 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: color, opacity: visible ? 1 : 0.3, flexShrink: 0 }} />
                  <span style={{ color: locked ? T.textDim : visible ? T.accent : T.textMuted, flex: 1, fontSize: 11 }}>{label}</span>
                  {count != null && <span style={{ color: visible ? color : T.accentDim, fontSize: 10, fontWeight: 500 }}>{count}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span onClick={toggle} title={visible ? "Hide layer" : "Show layer"}
                      style={{ cursor: "pointer", display: "flex", alignItems: "center", color: visible ? color : T.textFaint }}>
                      {visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </span>
                    {lockable
                      ? <span onClick={() => toggleLock(key)} title={locked ? "Locked — click to unlock" : "Lock layer"}
                          style={{ cursor: "pointer", display: "flex", alignItems: "center", color: locked ? T.brand : T.textFaint, userSelect: "none" }}>
                          {locked ? <Lock size={13} /> : <Unlock size={13} />}
                        </span>
                      : <span style={{ width: 13 }} />}
                  </span>
                </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </>
  );
}

export default memo(Sidebar);
