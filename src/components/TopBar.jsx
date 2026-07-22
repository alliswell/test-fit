// ─── Top bar (chrome) ────────────────────────────────────────────────────────
// Props-only component extracted from testfit.jsx: wordmark, snapshot switcher,
// stage dropdown, undo/redo, save/load/new, layout switcher, theme + settings.
import { Tooltip, TooltipTrigger, TooltipContent } from "../app/components/ui/tooltip";
import { ChevronDown, PanelLeft, PanelLeftClose, Plus, Redo2, RotateCcw, Settings, Undo2, X } from "lucide-react";

export default function TopBar({
  $, MODES, S, T, activeSnapshotId, canRedo, canUndo, cost, deleteSnapshot, display, exportPdf, exportPng, exportProject, font, importProject, liveDirty, loadRef, markers, mode, modeMenuRect, newProject, newSnapMode, redo, renameSnapshot, renamingSnapId, saveMenuRect, setMode, setModeMenuRect, setNewSnapMode, setRenamingSnapId, setSaveMenuRect, setShowModeMenu, setShowSaveMenu, setShowSettings, setShowSnapMenu, setSidebarOpen, setSnapDraftName, setSnapMenuRect, setT, setMonoDraw, monoDraw, setThemeMode, showModeMenu, showSaveMenu, showSnapMenu, sidebarOpen, slidesCount = 0, snapDraftName, snapMenuRect, snapshot, snapshots, switchSnapshot, takeSnapshot, themeMode, undo, updateSnapshot, walls, zones, panes, setLayout, setSelType, setSelectedId, setSelectedIds,
}) {
  return (
      <div style={S.bar}>
        {/* Wordmark — simple monospace logotype */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px", flexShrink: 0, alignSelf: "stretch", borderRight: "1px solid " + T.border }}>
          <span style={{ fontFamily: font, fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", color: T.textBright, whiteSpace: "nowrap" }}>
            TestFit <span style={{ color: T.textMuted }}>v2</span>
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button style={{ ...S.smBtn, padding: "5px 6px", marginLeft: 8 }} onClick={() => setSidebarOpen(v => !v)}>
              {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{sidebarOpen ? "Hide panel" : "Show panel"}</TooltipContent>
        </Tooltip>
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        {/* Snapshot switcher */}
        {(() => {
          const activeSnap = snapshots.find(s => s.id === activeSnapshotId);
          const dirty = liveDirty();
          const ac = T.accent;
          const openSwitcher = e => {
            setSnapMenuRect(e.currentTarget.getBoundingClientRect());
            setShowSnapMenu(v => !v); setNewSnapMode(false); setRenamingSnapId(null);
          };
          return <div style={{ position: "relative", marginRight: 4 }}>
            <button
              onClick={openSwitcher}
              title="Snapshots"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", maxWidth: 200, background: showSnapMenu ? ac + "28" : ac + "14", border: "1px solid " + ac + (showSnapMenu ? "88" : "40"), borderRadius: 6, cursor: "pointer", color: ac, fontWeight: 600, fontSize: 10, fontFamily: "inherit", transition: "all 0.12s ease", height: 28 }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dirty ? ac : "transparent", border: "1.5px solid " + ac, flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeSnap ? activeSnap.name : "Draft"}{dirty && activeSnap ? " •" : ""}</span>
              <ChevronDown size={10} style={{ opacity: 0.7, flexShrink: 0, transition: "transform 0.15s", transform: showSnapMenu ? "rotate(180deg)" : "none" }} />
            </button>
            {showSnapMenu && <>
              <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => { setShowSnapMenu(false); setNewSnapMode(false); setRenamingSnapId(null); }} />
              <div style={{ position: "fixed", top: (snapMenuRect?.bottom ?? 44) + 6, left: snapMenuRect?.left ?? 12, background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 6, zIndex: 1000, minWidth: 230, maxWidth: 300, boxShadow: T.panelShadow, backdropFilter: "blur(16px)" }}>
                <div style={{ fontSize: 8, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 8px 6px", fontWeight: 600 }}>Snapshots</div>
                {snapshots.length === 0 && <div style={{ padding: "8px 10px", fontSize: 10, color: T.textFaint, fontStyle: "italic" }}>None yet — save one below.</div>}
                {snapshots.map(s => {
                  const isActive = s.id === activeSnapshotId;
                  return <div key={s.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: isActive ? ac + "18" : "transparent", marginBottom: 2, cursor: "pointer", transition: "background 0.12s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.border + "44"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? ac : T.textFaint, flexShrink: 0 }} />
                    {renamingSnapId === s.id ? (
                      <input autoFocus defaultValue={s.name}
                        onClick={e => e.stopPropagation()}
                        onBlur={e => { renameSnapshot(s.id, e.target.value); setRenamingSnapId(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { renameSnapshot(s.id, e.target.value); setRenamingSnapId(null); } if (e.key === "Escape") setRenamingSnapId(null); }}
                        style={{ flex: 1, background: T.bg2, border: "1px solid " + ac, borderRadius: 4, color: T.textBright, fontSize: 10, fontFamily: "inherit", padding: "2px 6px", outline: "none" }} />
                    ) : (
                      <span style={{ flex: 1, fontSize: 10, color: isActive ? ac : T.textMuted, fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        onClick={() => { if (!isActive) { if (liveDirty() && !window.confirm("Switch snapshots? Unsaved changes to the current state will be lost.")) return; } switchSnapshot(s.id); setShowSnapMenu(false); }}
                        onDoubleClick={() => setRenamingSnapId(s.id)}
                        title="Click to switch · double-click to rename">{s.name}</span>
                    )}
                    {isActive && <span style={{ fontSize: 8, color: ac, opacity: 0.75 }}>active</span>}
                    <button onClick={e => { e.stopPropagation(); if (window.confirm(`Delete snapshot "${s.name}"?`)) deleteSnapshot(s.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, padding: 2, display: "flex" }}><X size={11} /></button>
                  </div>;
                })}
                <div style={{ height: 1, background: T.border, margin: "6px 4px" }} />
                {activeSnap && (
                  <div onClick={() => { updateSnapshot(activeSnap.id); setShowSnapMenu(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, cursor: "pointer", fontSize: 10, color: dirty ? ac : T.textMuted, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.border + "44"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <RotateCcw size={12} /> Update "{activeSnap.name}"
                  </div>
                )}
                {newSnapMode ? (
                  <div style={{ display: "flex", gap: 6, padding: "6px 8px" }} onClick={e => e.stopPropagation()}>
                    <input autoFocus placeholder="Snapshot name…" value={snapDraftName}
                      onChange={e => setSnapDraftName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { takeSnapshot(snapDraftName); setSnapDraftName(""); setNewSnapMode(false); setShowSnapMenu(false); } if (e.key === "Escape") { setNewSnapMode(false); setSnapDraftName(""); } }}
                      style={{ flex: 1, background: T.bg2, border: "1px solid " + ac, borderRadius: 5, color: T.textBright, fontSize: 10, fontFamily: "inherit", padding: "5px 8px", outline: "none" }} />
                    <button onClick={() => { takeSnapshot(snapDraftName); setSnapDraftName(""); setNewSnapMode(false); setShowSnapMenu(false); }}
                      style={{ padding: "4px 10px", background: ac + "22", border: "1px solid " + ac + "55", borderRadius: 5, color: ac, fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Save</button>
                  </div>
                ) : (
                  <div onClick={() => { setNewSnapMode(true); setSnapDraftName(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, cursor: "pointer", fontSize: 10, color: T.textMuted, fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.border + "44"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Plus size={12} /> Save as new snapshot
                  </div>
                )}
              </div>
            </>}
          </div>;
        })()}
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 6px 0 2px" }} />
        {/* Workflow-stage dropdown — same trigger+popover pattern as the snapshot switcher above */}
        {(() => {
          const cur = MODES[mode];
          // Live per-stage content counts so the menu shows which stages have work in them
          const n = (c, w) => `${c} ${w}${c === 1 ? "" : "s"}`;
          const HINTS = { build: n(walls.length, "wall"), itmep: n(markers.length, "marker"), zone: n(zones.length, "zone"), budget: $(cost.total), docs: n(slidesCount, "slide") };
          const badge = (m, active) => (
            <span style={{ width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, fontWeight: 700, fontFamily: "inherit",
              background: active ? m.color : "transparent", color: active ? T.bg1 : T.textMuted, border: active ? "none" : "1.5px solid " + T.textFaint }}>{m.num}</span>
          );
          return <div style={{ position: "relative" }}>
            <button
              onClick={e => { setModeMenuRect(e.currentTarget.getBoundingClientRect()); setShowModeMenu(v => !v); }}
              title="Workflow stage (1–5)"
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px", background: cur.color + (showModeMenu ? "30" : "1C"), border: "1px solid " + cur.color + (showModeMenu ? "88" : "55"), borderRadius: 6, cursor: "pointer", color: T.textBright, fontWeight: 600, fontSize: 11, fontFamily: "inherit", transition: "all 0.12s ease", height: 28 }}
            >
              {badge(cur, true)}
              <span>{cur.name}</span>
              <ChevronDown size={10} style={{ opacity: 0.7, flexShrink: 0, transition: "transform 0.15s", transform: showModeMenu ? "rotate(180deg)" : "none" }} />
            </button>
            {showModeMenu && <>
              <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setShowModeMenu(false)} />
              <div style={{ position: "fixed", top: (modeMenuRect?.bottom ?? 44) + 6, left: modeMenuRect?.left ?? 12, background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 6, zIndex: 1000, minWidth: 250, boxShadow: T.panelShadow, backdropFilter: "blur(16px)" }}>
                <div style={{ fontSize: 8, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 8px 6px", fontWeight: 600 }}>Workflow Stage</div>
                {Object.entries(MODES).map(([k, m]) => {
                  const isActive = k === mode;
                  return <div key={k} role="button" aria-label={m.name}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 6, background: isActive ? m.color + "18" : "transparent", marginBottom: 2, cursor: "pointer", transition: "background 0.12s" }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.border + "44"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    onClick={() => { setMode(k); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); setShowModeMenu(false); }}>
                    {badge(m, isActive)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: isActive ? 600 : 500, color: isActive ? T.textBright : T.textMuted }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: T.textDim, marginTop: 1 }}>{m.desc}</div>
                    </div>
                    <span style={{ fontSize: 9, color: T.textDim, flexShrink: 0 }}>{HINTS[k]}</span>
                    <span style={{ fontSize: 8, color: T.textFaint, border: "1px solid " + T.border, borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{m.num}</span>
                  </div>;
                })}
              </div>
            </>}
          </div>;
        })()}
        <div style={{ flex: 1 }} />
        <Tooltip>
          <TooltipTrigger asChild>
            <button style={{ ...S.smBtn, opacity: canUndo ? 1 : 0.35, cursor: canUndo ? "pointer" : "default" }} onClick={undo} disabled={!canUndo}><Undo2 size={13} /></button>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button style={{ ...S.smBtn, opacity: canRedo ? 1 : 0.35, cursor: canRedo ? "pointer" : "default" }} onClick={redo} disabled={!canRedo}><Redo2 size={13} /></button>
          </TooltipTrigger>
          <TooltipContent>Redo (⌘⇧Z / ⌘Y)</TooltipContent>
        </Tooltip>
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        {/* Theme: Vellum (light) · Blueprint (dark) · Print (white paper / black ink,
            for exporting and printing). Print restyles the 2D canvas, docs sheets, and
            the 3D view together. */}
        <div style={{ display: "flex", gap: 2, alignItems: "center", background: T.bg2, borderRadius: 6, padding: 2 }}>
          {[["light", "Light"], ["dark", "Dark"], ["print", "Print"]].map(([m, label]) => (
            <button key={m} onClick={() => setThemeMode(m)}
              style={{ padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 10, fontWeight: themeMode === m ? 600 : 500,
                background: themeMode === m ? T.brand + "22" : "transparent",
                color: themeMode === m ? T.textBright : T.textMuted,
                outline: themeMode === m ? "1px solid " + T.brand : "none" }}>{label}</button>
          ))}
        </div>
        {/* Mono is a DRAWING style, not a UI theme — it restyles the canvas (plan,
            elevation, isometric, 3D, sheets) and leaves the chrome on Light/Dark/Print. */}
        <Tooltip><TooltipTrigger asChild>
          <button data-testid="mono-toggle" onClick={() => setMonoDraw(v => !v)}
            style={{ ...S.smBtn, marginLeft: 4, borderColor: monoDraw ? T.brand : undefined,
              background: monoDraw ? T.brand + "22" : undefined, color: monoDraw ? T.textBright : undefined,
              fontWeight: monoDraw ? 600 : undefined }}>Mono</button>
        </TooltipTrigger><TooltipContent>Monochrome drawing style (canvas only)</TooltipContent></Tooltip>
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        <div style={{ position: "relative" }}>
          <button style={{ ...S.smBtn, display: "flex", alignItems: "center", gap: 4 }} onClick={e => { setSaveMenuRect(e.currentTarget.getBoundingClientRect()); setShowSaveMenu(v => !v); }}>
            Save<ChevronDown size={11} style={{ opacity: 0.7, transition: "transform 0.15s", transform: showSaveMenu ? "rotate(180deg)" : "none" }} />
          </button>
          {showSaveMenu && <>
            <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setShowSaveMenu(false)} />
            <div style={{ position: "fixed", top: (saveMenuRect?.bottom ?? 44) + 6, right: Math.max(8, window.innerWidth - (saveMenuRect?.right ?? 0)), background: T.panelBg, border: "1px solid " + T.border, borderRadius: 8, padding: 6, zIndex: 1000, minWidth: 160, boxShadow: T.panelShadow, backdropFilter: "blur(16px)" }}>
              {[
                { label: "Save Project (.json)", fn: exportProject },
                { label: "Export PNG", fn: exportPng },
                { label: "Export PDF", fn: exportPdf },
              ].map(({ label, fn }) => (
                <div key={label} onClick={() => { setShowSaveMenu(false); fn(); }}
                  style={{ padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, color: T.textMuted, fontFamily: "inherit", transition: "background 0.12s" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.border + "60"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{label}</div>
              ))}
            </div>
          </>}
        </div>
        <button style={S.smBtn} onClick={() => loadRef.current?.click()}>Load</button>
        <button style={S.smBtn} onClick={() => { if (walls.length || zones.length || markers.length) { if (confirm("New project?")) newProject(); } else newProject(); }}>New</button>
        <input ref={loadRef} type="file" accept=".json" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = ""; }} />
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        {/* Layout switcher (single / split / quad) — always visible in the top bar */}
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {[[1, "▢", "Single"], [2, "◫", "Split"], [4, "⊞", "Quad"]].map(([n, g, label]) => (
            <Tooltip key={n}><TooltipTrigger asChild>
              <button onClick={() => setLayout(n)} style={{ padding: "4px 9px", borderRadius: 5, border: "none", cursor: "pointer", background: panes.length === n ? T.accent : "transparent", color: panes.length === n ? "#fff" : T.textMuted, fontSize: 13, fontWeight: 600, fontFamily: "inherit", lineHeight: 1 }}>{g}</button>
            </TooltipTrigger><TooltipContent>{label} layout</TooltipContent></Tooltip>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: T.border, margin: "0 3px" }} />
        <Tooltip>
          <TooltipTrigger asChild>
            <button style={S.smBtn} onClick={() => setShowSettings(true)}><Settings size={13} /></button>
          </TooltipTrigger>
          <TooltipContent>Zone Library Settings</TooltipContent>
        </Tooltip>
      </div>
  );
}
