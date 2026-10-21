// ─── Sidebar ─────────────────────────────────────────────────────────────────────
// Left sidebar: project name, the per-stage panel (reference image + summary in Build,
// zone types in Zones, furniture catalog in Furnish, component layers in IT/MEP, the deck
// strip in Docs, the cost breakdown in Budget) and the LAYERS visibility/lock panel.
// Props-only (never imports testfit.jsx): `S` is the shared style sheet, `T` the chrome
// theme; everything else is state and handlers threaded from TestfitTool.
//
// YARDSTICK (styles/yardstick.css): every block is a <details class="ys-section"> with a
// plate head and a mono count in its end slot, so a long palette folds away instead of
// pushing Layers off the bottom. Catalog entries and placed items are List rows (chip ·
// title · mono meta · end figure): a palette row carries a real glyph of the piece
// (FurnitureGlyph) or a colour chip with an ink border; the ACTIVE placement tool is a
// pressed row (2px inset INK ring — a pressed control stays ink), the SELECTED item on the
// canvas is a 2px `selected` blue frame — the one blue thing. Figures (dimensions, sf,
// counts, money) are `data` mono; nothing reads by colour alone — hidden layers get a
// hatched chip AND a muted name, locked ones a closed lock AND a muted name.
import { memo } from "react";
import { DeckStrip } from "./DocsView";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { FINISH_COLORS, SPEC_COMPONENTS, SPEC_LAYERS } from "../constants/specs";
import { FURNITURE_CATALOG, FURNITURE_CATEGORIES } from "../constants/furniture";
import { SLIDE_VIS_PRESETS, defaultSlideName, matchSlidePreset } from "../utils/docs";
import { isLightComponent, polyArea } from "../imports/model";
import { FurnitureGlyph } from "./Furniture2D";

// lucide glyphs drawn to the Yardstick icon rule: 1.25 absolute, square caps, mitred joins.
const ICON = { size: 18, strokeWidth: 1.25, absoluteStrokeWidth: true, strokeLinecap: "square", strokeLinejoin: "miter" };

const Section = ({ title, end, open = true, flush = false, children, testid }) => (
  <details className="ys-section" open={open || undefined} data-testid={testid}>
    <summary><span>{title}</span>{end != null && end !== "" && <span className="ys-section__end">{end}</span>}</summary>
    <div className={"ys-section__body" + (flush ? " ys-section__body--flush" : "")}>{children}</div>
  </details>
);

// One list row. `pressed` = this row is the active placement tool (ink ring);
// `current` = the item it stands for is selected on the canvas (blue frame).
const Row = ({ chip, title, meta, end, endMuted = true, pressed, current, onClick, testid, ariaLabel, compact = false }) => (
  <button type="button" className={"ys-row" + (compact ? " ys-row--compact" : "")} data-testid={testid}
    aria-pressed={pressed === undefined ? undefined : !!pressed} aria-current={current ? "true" : undefined} aria-label={ariaLabel} onClick={onClick}>
    <span className="ys-row__chip">{chip}</span>
    <span className="ys-row__main">
      <span className="ys-row__title">{title}</span>
      {meta != null && meta !== "" && <span className="ys-row__meta">{meta}</span>}
    </span>
    {end != null && <span className={"ys-row__end" + (endMuted ? " ys-muted" : "")}>{end}</span>}
  </button>
);

// A colour swatch: a square chip with an ink border, so the hue is never the only edge.
const Swatch = ({ color, small = false, hidden = false, square = true }) => (
  <span className={"ys-chip" + (small ? " ys-chip--sm" : "") + (hidden ? " ys-chip--hidden" : "")} aria-hidden="true"
    style={{ background: hidden ? undefined : color, borderRadius: square ? 0 : "50%" }} />
);

const Fact = ({ k, v, onClick, current, total = false, kStyle, testid }) => {
  const cls = "ys-fact" + (total ? " ys-fact--total" : "");
  const body = <><span className="ys-fact__k" style={kStyle}>{k}</span><span className="ys-fact__v">{v}</span></>;
  return onClick
    ? <button type="button" className={cls} aria-current={current ? "true" : undefined} onClick={onClick} data-testid={testid}>{body}</button>
    : <div className={cls} data-testid={testid}>{body}</div>;
};

const Empty = ({ children }) => <div className="ys-empty">{children}</div>;

function Sidebar({
  $, S, T, activeFurnitureType, activeSlideId, activeSpecLayer, activeZoneType, addSlide, bgImage, bgOpacity, bgScale, calibrationFeet, calibrationLine, columns, cost, dims, docSettings, doors, dropSlide, fRef, floorRegions, flowPaths, font, ft, furniture, furnitureClearance = 3, setFurnitureClearance, guides, labels, layerLocked, lockedLayers, markers, mode, projectName, pxPerFoot, removeSlide, revClouds, selectedId, selectedIds, setActiveComponentType, setActiveFurnitureType, setActiveSlideId, setActiveSpecLayer, setActiveZoneType, setBgImage, setBgOffset, setBgOpacity, setBgScale, setCalibrationFeet, setCalibrationLine, setLockedLayers, setProjectName, setSelType, setSelectedId, setSelectedIds, setShowGrid, setT, setTool, setVisibleBuildElectrical, setVisibleBuildLighting, setVisibleDims, setVisibleFloorRegions, setVisibleFlowPaths, setVisibleFurniture, setVisibleGuides, setVisibleITMEP, setVisibleLabels, setVisibleLayers, setVisibleRevClouds, setVisibleZones, showGrid, slides, tool, uiColor, updateSlide, visibleBuildElectrical, visibleBuildLighting, visibleDims, visibleFloorRegions, visibleFlowPaths, visibleFurniture, visibleGuides, visibleITMEP, visibleLabels, visibleLayers, visibleRevClouds, visibleZones, wallKinds, walls, windows, wl, zoneLibrary, zones,
}) {
  const dimsOf = (w, d) => `${ft(w * pxPerFoot)} × ${ft(d * pxPerFoot)}`;
  return (
    <>
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div style={S.side}>
        <div className="ys-side__project">
          <label className="ys-label" htmlFor="tf-project-name">Project</label>
          <input id="tf-project-name" data-testid="project-name" className="ys-input ys-input--flush" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Untitled" />
        </div>
        <div style={S.body}>

          {/* ── BUILD ─────────────────────────────────────────── */}
          {mode === "build" && <>
            <Section title="Reference image" end={bgImage ? "loaded" : null}>
              <button type="button" className="ys-btn ys-btn--block" onClick={() => fRef.current?.click()}>
                {bgImage ? "Replace image" : "Upload floorplan"}
              </button>
              <input ref={fRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setBgImage(ev.target.result); r.readAsDataURL(f); } }} />
              {bgImage && <>
                <div className="ys-field">
                  <label className="ys-field__label" htmlFor="tf-bg-opacity">Opacity <span className="ys-data">{Math.round(bgOpacity * 100)}%</span></label>
                  <input id="tf-bg-opacity" type="range" min="0" max="100" value={bgOpacity * 100} onChange={e => setBgOpacity(e.target.value / 100)} style={{ width: "100%" }} />
                </div>
                <div className="ys-field">
                  <label className="ys-field__label" htmlFor="tf-bg-scale">Scale <span className="ys-data">{Math.round(bgScale * 100)}%</span></label>
                  <input id="tf-bg-scale" type="range" min="20" max="300" value={bgScale * 100} onChange={e => setBgScale(e.target.value / 100)} style={{ width: "100%" }} />
                  <p className="ys-field__help">Alt + drag the canvas to reposition. Use Calibrate in the tool rail to set the scale from a known distance.</p>
                </div>
                <button type="button" className="ys-btn ys-btn--destroy ys-btn--block" onClick={() => { setBgImage(null); setBgOpacity(0.35); setBgScale(1); setBgOffset({ x: 0, y: 0 }); }}>Remove image</button>
              </>}
            </Section>
            {bgImage && calibrationLine && calibrationLine.p1 && calibrationLine.p2 && (
              <Section title="Calibrate scale">
                <div className="ys-field">
                  <label className="ys-field__label" htmlFor="tf-calib">Known distance</label>
                  <div className="ys-unit">
                    <input id="tf-calib" className="ys-input ys-input--data" type="number" value={calibrationFeet} onChange={e => setCalibrationFeet(e.target.value)} placeholder="10" step="0.5" />
                    <span className="ys-unit__suffix">ft</span>
                  </div>
                  <p className="ys-field__help">The length of the line you drew on the image.</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="ys-btn ys-btn--primary" style={{ flex: 1 }}
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
                    }}>Apply</button>
                  <button type="button" className="ys-btn" onClick={() => setCalibrationLine(null)}>Clear line</button>
                </div>
              </Section>
            )}
            <Section title="Summary" end={walls.length ? `${walls.length} walls` : null}>
              <div className="ys-facts">
                {Object.entries(cost.wallFt).map(([k, v]) => <Fact key={k} k={<><Swatch color={v.color} small />{v.label}</>} v={ft(v.ft)} />)}
                {Object.keys(cost.wallFt).length === 0 && <Empty>No walls yet</Empty>}
                <Fact k="Doors" v={doors.length} />
                <Fact k="Windows" v={windows.length} />
                <Fact k="Columns" v={columns.length} />
              </div>
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
                  return <Fact current={isGroupSel}
                    k={<><Swatch color={group.color} small />{group.ids.length}× {group.name}</>}
                    v={<span className={group.isNew ? "" : "ys-muted"}>{group.isNew ? "new" : "existing"}</span>}
                    onClick={() => { setSelectedIds(group.ids); setSelectedId(group.ids[0]); setSelType("marker"); setT("select"); }} />;
                };

                return <>
                  {elecGroups.length > 0 && <div className="ys-facts"><div className="ys-label" style={{ padding: "12px 0 4px" }}>Electrical</div>{elecGroups.map((g, i) => <SummaryRow key={i} group={g} />)}</div>}
                  {ltGroups.length > 0 && <div className="ys-facts"><div className="ys-label" style={{ padding: "12px 0 4px" }}>Lighting</div>{ltGroups.map((g, i) => <SummaryRow key={i} group={g} />)}</div>}
                </>;
              })()}
            </Section>
          </>}

          {/* ── ZONE ──────────────────────────────────────────── */}
          {mode === "zone" && <>
            <Section title="Zone types" flush>
              <div className="ys-list">
                {Object.entries(zoneLibrary).map(([k, z]) => (
                  <Row key={k} compact ariaLabel={z.name} pressed={tool === "zone" && activeZoneType === k}
                    chip={<Swatch color={z.color} />} title={z.name}
                    onClick={() => { setActiveZoneType(k); if (tool !== "zone") setT("zone"); }} />
                ))}
              </div>
              <p className="ys-side__hint ys-field__help">Pick a type, then drag a box on the plan. Press the type again to keep placing.</p>
            </Section>
            <Section title="Placed zones" end={zones.length} flush>
              {zones.length === 0 && <div style={{ padding: "0 16px" }}><Empty>No zones placed yet</Empty></div>}
              {zones.length > 0 && <div className="ys-list">
                {zones.map(z => (
                  <Row key={z.id} compact current={selectedId === z.id}
                    chip={<Swatch color={zoneLibrary[z.type]?.color} />} title={z.label}
                    meta={zoneLibrary[z.type]?.name}
                    end={z.points ? Math.round(polyArea(z.points) / (pxPerFoot * pxPerFoot)) + " sf" : dimsOf(z.w / pxPerFoot, z.h / pxPerFoot)}
                    onClick={() => { setSelectedId(z.id); setSelType("zone"); setT("select"); }} />
                ))}
              </div>}
              {cost.totalSf > 0 && <div style={{ padding: "0 16px 8px" }}><Fact total k="Total area" v={cost.totalSf + " sf"} /></div>}
            </Section>
          </>}

          {/* ── FURNISH ───────────────────────────────────────── */}
          {mode === "furnish" && <>
            {FURNITURE_CATEGORIES.map(cat => {
              const items = Object.values(FURNITURE_CATALOG).filter(s => s.cat === cat.key);
              if (!items.length) return null;
              return <Section key={cat.key} title={cat.label} end={items.length} flush>
                <div className="ys-list">
                  {items.map(s => (
                    <Row key={s.type} pressed={tool === "furniture" && activeFurnitureType === s.type}
                      chip={<FurnitureGlyph type={s.type} size={36} />} title={s.name} meta={dimsOf(s.w, s.d)}
                      onClick={() => { setActiveFurnitureType(s.type); setT("furniture"); }} />
                  ))}
                </div>
              </Section>;
            })}
            <Section title="Clearance">
              <div className="ys-field">
                <label className="ys-field__label" htmlFor="tf-clearance">Around the selected piece</label>
                <div className="ys-unit">
                  <input id="tf-clearance" data-testid="furniture-clearance" className="ys-input ys-input--data" type="number" min={0} max={10} step={0.5} value={furnitureClearance}
                    onChange={e => setFurnitureClearance?.(Math.max(0, Math.min(10, Number(e.target.value) || 0)))} />
                  <span className="ys-unit__suffix">ft · {Math.round(furnitureClearance * 12)}″</span>
                </div>
                <p className="ys-field__help">Checked against other furniture only. Overlaps and pieces through walls are flagged on every piece.</p>
              </div>
            </Section>
            <Section title="Placed furniture" end={furniture.length} flush>
              {furniture.length === 0 && <div style={{ padding: "0 16px" }}><Empty>Pick a piece, then click in a zone</Empty></div>}
              {furniture.length > 0 && <div className="ys-list">
                {furniture.map(f => (
                  <Row key={f.id} current={selectedId === f.id}
                    chip={<FurnitureGlyph type={f.type} size={36} />}
                    title={f.label || FURNITURE_CATALOG[f.type]?.name || f.type}
                    meta={f.label ? FURNITURE_CATALOG[f.type]?.name : undefined}
                    end={dimsOf(f.w, f.d)}
                    onClick={() => { setSelectedId(f.id); setSelType("furniture"); setT("select"); }} />
                ))}
              </div>}
            </Section>
          </>}

          {/* ── IT / MEP ───────────────────────────────────────── */}
          {mode === "itmep" && <>
            <Section title="Component layers" flush>
              <div className="ys-list">
                {Object.entries(SPEC_LAYERS).filter(([k]) => k !== "power").map(([k, l]) => (
                  <Row key={k} compact pressed={activeSpecLayer === k}
                    chip={<Swatch color={uiColor(l.color)} hidden={!visibleLayers[k]} />}
                    title={<span>{l.name}</span>}
                    end={markers.filter(p => p.layer === k).length}
                    onClick={() => { setActiveSpecLayer(k); const firstComp = Object.keys(SPEC_COMPONENTS[k])[0]; setActiveComponentType(firstComp); setT("marker"); }} />
                ))}
              </div>
              <p className="ys-side__hint ys-field__help">Power and lighting live in the tool rail. Pick a layer here to see its components there.</p>
            </Section>
            <Section title="Placed components" end={markers.length} flush>
              {markers.length === 0 && <div style={{ padding: "0 16px" }}><Empty>No components placed yet</Empty></div>}
              {markers.length > 0 && <div className="ys-list">
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
                  return <div key={layerKey} style={{ display: "contents" }}>
                    <div className="ys-list__group"><span>{layer.name}</span><span className="ys-data">{layerMarkers.length}</span></div>
                    {Object.entries(groups).map(([gkey, groupMarkers]) => {
                      const [compType, finish] = gkey.split("|");
                      const compData = SPEC_COMPONENTS[layerKey]?.[compType];
                      const fin = finish && FINISH_COLORS[finish];
                      const swFill = fin ? fin.fill : (compData?.color || layer.color);
                      const finLabel = finish ? ` (${finish[0].toUpperCase() + finish.slice(1)})` : "";
                      const groupIds = groupMarkers.map(m => m.id);
                      const isGroupSelected = groupIds.some(id => selectedId === id || selectedIds.includes(id));
                      return <Row key={gkey} compact current={isGroupSelected}
                        chip={<Swatch color={swFill} square={compData?.symbol === "rack"} />}
                        title={(compData?.name || compType) + finLabel}
                        end={groupMarkers.length > 1 ? groupMarkers.length + "×" : undefined}
                        onClick={() => { setSelectedId(null); setSelType(null); setSelectedIds(groupIds); setTool("select"); }} />;
                    })}
                  </div>;
                })}
              </div>}
            </Section>
          </>}

          {/* ── DOCS ──────────────────────────────────────────── */}
          {mode === "docs" && <>
            <Section title="Documentation" end={<span style={{ textTransform: "capitalize" }}>{docSettings.size} · {docSettings.orientation}</span>}>
              <p className="ys-field__help" style={{ margin: 0 }}>
                Slides live-render the current model — edits in stages 1–5 update the deck automatically. Use the camera button on any pane to add a slide.
              </p>
            </Section>
            <div style={{ padding: 12 }}>
              <DeckStrip T={T} font={font} slides={slides} activeSlideId={activeSlideId}
                onSelectSlide={setActiveSlideId} onUpdateSlide={updateSlide} onDeleteSlide={removeSlide}
                onDropSlide={dropSlide}
                onAddTemplate={(view) => addSlide({ name: defaultSlideName(view, slides.length), view, rect: null, cam3d: null, image: null })} />
            </div>
          </>}

          {/* ── BUDGET ────────────────────────────────────────── */}
          {mode === "budget" && <>
            <Section title="Cost breakdown" end={$(cost.total)}>
              <div className="ys-facts">
                {cost.construction.walls.map((v) => {
                  const k = v.kind;
                  const matchingWalls = walls.filter(w => (w.kind || "existing") === k);
                  const isSelected = matchingWalls.length > 0 && matchingWalls.every(w => selectedIds.includes(w.id));
                  return <Fact key={k} current={isSelected}
                    k={<><Swatch color={v.color} small />{v.label} wall · {ft(v.ft)}</>} v={v.cost ? $(v.cost) : "—"}
                    onClick={() => {
                      const wallIds = matchingWalls.map(w => w.id);
                      setSelectedIds(wallIds);
                      if (wallIds.length > 0) {
                        setSelectedId(wallIds[0]);
                        setSelType("wall");
                      }
                    }} />;
                })}
                {cost.construction.doors.map(d => <Fact key={"cd" + d.type} k={`${d.count}× Door · ${d.type}`} v={d.cost ? $(d.cost) : "—"} />)}
                {cost.construction.windows.map(w => <Fact key={"cw" + w.type} k={`${w.count}× ${w.type}`} v={w.cost ? $(w.cost) : "—"} />)}
                {cost.zones.map(z => <Fact key={z.id} current={selectedId === z.id}
                  k={<><Swatch color={zoneLibrary[z.type]?.color} small />{z.label}</>} v={$(z.total)}
                  onClick={() => { setSelectedId(z.id); setSelType("zone"); setSelectedIds([z.id]); }} />)}
                {Object.entries(cost.markers).map(([k, p]) => {
                  const [layer, componentType, finish] = k.split('|');
                  const matchingMarkers = markers.filter(m => m.layer === layer && m.componentType === componentType && (m.finish || "") === (finish || ""));
                  const isSelected = matchingMarkers.length > 0 && matchingMarkers.every(m => selectedIds.includes(m.id));
                  return <Fact key={k} current={isSelected} k={`${p.count}× ${p.name}`} v={$(p.count * p.unitCost)}
                    onClick={() => {
                      const markerIds = matchingMarkers.map(m => m.id);
                      setSelectedIds(markerIds);
                      if (markerIds.length > 0) {
                        setSelectedId(markerIds[0]);
                        setSelType("marker");
                      }
                    }} />;
                })}
                {cost.totalSf > 0 && <Fact k="Total area" v={cost.totalSf + " sf"} />}
                <Fact total k="Total estimate" v={$(cost.total)} />
              </div>
              <button type="button" className="ys-btn ys-btn--block"
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

                  // Clipboard copy with a textarea fallback (the API may be missing or refused)
                  const text = lines.join("\n");
                  const fallback = () => {
                    const textarea = document.createElement("textarea");
                    textarea.value = text;
                    textarea.style.position = "fixed";
                    textarea.style.opacity = "0";
                    document.body.appendChild(textarea);
                    textarea.select();
                    try { document.execCommand("copy"); } catch (err) { console.error("Copy failed:", err); }
                    document.body.removeChild(textarea);
                  };
                  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback);
                  else fallback();
                }}>Copy summary</button>
            </Section>
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
          const shown = rows.filter(r => r.visible).length;
          return (
            <div className="ys-layers" data-testid="layers-panel">
              <div className="ys-layers__head">
                <span className="ys-plate">Layers <span className="ys-label" style={{ marginLeft: 6 }}>{shown}/{rows.length}</span></span>
                {/* Six presets is one past a segmented control's five, so this is a Select;
                    "Custom" appears once the live layers match none of them. */}
                <label className="ys-select ys-select--sm ys-select--plate">
                  <select data-testid="plan-layer-preset" aria-label="Layer preset" value={activeLayerPreset || ""}
                    onChange={e => { const p = layerPresets.find(x => x.id === e.target.value); if (p) applyLayerPreset(p.vis); }}>
                    {!activeLayerPreset && <option value="">Custom</option>}
                    {layerPresets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="ys-layers__rows">
                {[...rows].sort((a, b) => a.label.localeCompare(b.label)).map(({ key, label, color, visible, toggle, count, lockable }) => {
                  const locked = lockable && layerLocked(key);
                  return (
                    <div key={key} className="ys-layer" data-testid={"plan-layer-row-" + key} data-visible={visible ? "true" : "false"} data-locked={locked ? "true" : "false"}>
                      <Swatch color={color} small hidden={!visible} />
                      <span className="ys-layer__name">{label}</span>
                      <span className="ys-layer__count">{count != null ? count : ""}</span>
                      <button type="button" className="ys-ibtn" aria-label={(visible ? "Hide " : "Show ") + label} onClick={toggle}
                        style={{ color: visible ? "var(--ink)" : "var(--ink-muted)" }}>
                        {visible ? <Eye {...ICON} /> : <EyeOff {...ICON} />}
                      </button>
                      {lockable
                        ? <button type="button" className="ys-ibtn" aria-label={(locked ? "Unlock " : "Lock ") + label} aria-pressed={!!locked} onClick={() => toggleLock(key)}>
                            {locked ? <Lock {...ICON} /> : <Unlock {...ICON} />}
                          </button>
                        : <span className="ys-ibtn ys-ibtn--blank" />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}

export default memo(Sidebar);
