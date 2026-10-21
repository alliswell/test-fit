// ─── Top bar (chrome) ────────────────────────────────────────────────────────
// Props-only component extracted from testfit.jsx: wordmark, snapshot switcher,
// stage dropdown, undo/redo, save/load/new, layout switcher, theme + settings.
//
// YARDSTICK: a 52px toolbar of 40px controls — ink-bordered buttons in plate lettering,
// quiet (borderless) icon buttons for undo/redo/panel/settings, segmented controls for
// Light/Dark/Print, Mono and the layout, and the stage shown as an inverted number in a
// square. Menus are paper panels with a 1px ink frame, no shadow, no blur, rows 40px with
// a tint hover (styles/yardstick.css .ys-menu). Nothing here uses window.confirm — the
// artifact viewer swallows native dialogs — so every destructive step is a two-step inline
// confirm: New, Delete project, Delete snapshot and "switch away from unsaved changes".
import { useState, useEffect, useRef } from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "../app/components/ui/tooltip";
import { PanelLeft, PanelLeftClose, Redo2, Undo2 } from "lucide-react";
import { ChevronIcon, CloseIcon, GearIcon, PencilIcon, PlusIcon, QuadIcon, SingleIcon, SplitIcon } from "./icons";
import MonoSkinPanel from "./MonoSkinPanel";
import { historySummary, relativeTime } from "../utils/autosaveHistory";

const ICON = { size: 18, strokeWidth: 1.25, absoluteStrokeWidth: true, strokeLinecap: "square", strokeLinejoin: "miter" };
const Sep = () => <div style={{ width: 1, height: 24, background: "var(--rule-soft)", margin: "0 2px", flex: "none" }} aria-hidden="true" />;
// Popovers hang 4px under their trigger; right-anchored ones keep their right edge on screen.
const menuPos = (rect, right = false) => right
  ? { top: (rect?.bottom ?? 52) + 4, right: Math.max(8, window.innerWidth - (rect?.right ?? 0)) }
  : { top: (rect?.bottom ?? 52) + 4, left: rect?.left ?? 12 };

export default function TopBar({
  $, MODES, S, T, activeSnapshotId, canRedo, canUndo, cost, deleteSnapshot, display, exportPdf, exportPng, exportSvg, exportDxf, exportDxfSlide = null, activeSlideName = "", exportProject, font, readAutosaveHistory, restoreAutosave, importProject, projects = [], projectsKind = null, projectsCanWrite = true, projectsBusy = false, saveToProjects, openProject, deleteProject, renameProject, activeProjectId = null, projectName = "", liveDirty, loadRef, markers, mode, modeMenuRect, newProject, newSnapMode, redo, renameSnapshot, renamingSnapId, saveMenuRect, setMode, setModeMenuRect, setNewSnapMode, setRenamingSnapId, setSaveMenuRect, setShowModeMenu, setShowSaveMenu, setShowSettings, setShowSnapMenu, setSidebarOpen, setSnapDraftName, setSnapMenuRect, setT, setMonoDraw, monoDraw, monoSkin, setMonoSkin, monoTiers = [], setThemeMode, showModeMenu, showSaveMenu, showSnapMenu, sidebarOpen, slidesCount = 0, snapDraftName, snapMenuRect, snapshot, snapshots, switchSnapshot, takeSnapshot, themeMode, undo, updateSnapshot, walls, zones, furnitureCount = 0, panes, setLayout, setSelType, setSelectedId, setSelectedIds,
}) {
  // Mono style options live in a split-button dropdown (main = toggle, chevron = skin panel).
  const [showMono, setShowMono] = useState(false);
  const [monoRect, setMonoRect] = useState(null);
  // Load menu: file import + the autosave history ring (read when the menu opens).
  const [showLoad, setShowLoad] = useState(false);
  // In-app project list (utils/projectList.js via useProjectList): the Save menu's name box
  // and the Load menu's Projects section. Delete and New are TWO-STEP inline confirms —
  // the artifact viewer swallows native dialogs (confirm() returns false), which had left
  // New dead whenever there was content on the canvas.
  const [projDraft, setProjDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [newArmed, setNewArmed] = useState(false);
  useEffect(() => { if (!newArmed) return; const t = setTimeout(() => setNewArmed(false), 3000); return () => clearTimeout(t); }, [newArmed]);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameDoneRef = useRef(false); // Enter commits and unmounts the input; a trailing blur must not commit twice
  const commitRename = (p) => {
    if (renameDoneRef.current) return;
    renameDoneRef.current = true;
    const n = renameDraft.trim();
    setRenamingId(null);
    if (n && n !== p.name) renameProject?.(p.id, n);
  };
  const canSaveProject = !!projDraft.trim() && projectsCanWrite && !projectsBusy && !!projectsKind && !!saveToProjects;
  const backendLabel = projectsKind === "shared" ? " · shared" : projectsKind === "local" ? " · this browser" : "";
  // The entry the editor is working on (Save → Update it). Null = unsaved / unbound.
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) || null : null;
  const [loadRect, setLoadRect] = useState(null);
  const [history, setHistory] = useState([]);
  // Snapshot menu two-step confirms (replacing window.confirm): which row is armed.
  const [confirmSnapDel, setConfirmSnapDel] = useState(null);
  const [confirmSwitch, setConfirmSwitch] = useState(null);
  const closeSnapMenu = () => { setShowSnapMenu(false); setNewSnapMode(false); setRenamingSnapId(null); setConfirmSnapDel(null); setConfirmSwitch(null); };
  return (
      <div style={S.bar} className="ys-bar">
        {/* Wordmark — plate lettering in its own cell */}
        <div className="ys-plate" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", flexShrink: 0, alignSelf: "stretch", borderRight: "1px solid " + T.border, whiteSpace: "nowrap" }}>
          Test Fit <span className="ys-label">v2</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="ys-btn ys-btn--quiet ys-btn--icon" style={{ marginLeft: 4 }} onClick={() => setSidebarOpen(v => !v)} aria-label={sidebarOpen ? "Hide panel" : "Show panel"}>
              {sidebarOpen ? <PanelLeftClose {...ICON} /> : <PanelLeft {...ICON} />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{sidebarOpen ? "Hide panel" : "Show panel"}</TooltipContent>
        </Tooltip>
        <Sep />
        {/* Snapshot switcher */}
        {(() => {
          const activeSnap = snapshots.find(s => s.id === activeSnapshotId);
          const dirty = liveDirty();
          const openSwitcher = e => {
            setSnapMenuRect(e.currentTarget.getBoundingClientRect());
            setShowSnapMenu(v => !v); setNewSnapMode(false); setRenamingSnapId(null); setConfirmSnapDel(null); setConfirmSwitch(null);
          };
          return <div style={{ position: "relative" }}>
            <button type="button" className="ys-btn" onClick={openSwitcher} title="Snapshots" aria-haspopup="menu" aria-expanded={showSnapMenu} style={{ maxWidth: 220 }}>
              {/* a square chip: filled when the live state has drifted from the snapshot */}
              <span className="ys-chip ys-chip--sm" aria-hidden="true" style={{ background: dirty ? "var(--ink)" : "transparent" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeSnap ? activeSnap.name : "Draft"}{dirty && activeSnap ? " ·" : ""}</span>
              <ChevronIcon open={showSnapMenu} />
            </button>
            {showSnapMenu && <>
              <div className="ys-backdrop" onClick={closeSnapMenu} />
              <div className="ys-menu" style={{ ...menuPos(snapMenuRect), minWidth: 260 }}>
                <div className="ys-menu__head"><span>Snapshots</span><span className="ys-data">{snapshots.length}</span></div>
                {snapshots.length === 0 && <div className="ys-menu__note">None yet — save one below.</div>}
                {snapshots.map(s => {
                  const isActive = s.id === activeSnapshotId;
                  const armedSwitch = confirmSwitch === s.id;
                  const armedDel = confirmSnapDel === s.id;
                  return <div key={s.id} className="ys-menu__item" aria-current={isActive ? "true" : undefined}>
                    <span className={"ys-num" + (isActive ? "" : " ys-num--outline")} aria-hidden="true">{snapshots.indexOf(s) + 1}</span>
                    {renamingSnapId === s.id ? (
                      <input autoFocus defaultValue={s.name} className="ys-input" style={{ flex: 1, minHeight: 32 }}
                        onClick={e => e.stopPropagation()}
                        onBlur={e => { renameSnapshot(s.id, e.target.value); setRenamingSnapId(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { renameSnapshot(s.id, e.target.value); setRenamingSnapId(null); } if (e.key === "Escape") setRenamingSnapId(null); }} />
                    ) : (
                      <span className="ys-menu__main" style={{ cursor: isActive ? "default" : "pointer" }}
                        onClick={() => {
                          if (isActive) return;
                          if (liveDirty() && !armedSwitch) { setConfirmSwitch(s.id); setConfirmSnapDel(null); return; }
                          switchSnapshot(s.id); closeSnapMenu();
                        }}
                        onDoubleClick={() => setRenamingSnapId(s.id)}
                        title="Click to switch · double-click to rename">
                        <span className="ys-menu__title">{s.name}</span>
                        {armedSwitch && <span className="ys-menu__sub">Unsaved changes will be lost — click again to switch</span>}
                      </span>
                    )}
                    {isActive && <span className="ys-menu__end">active</span>}
                    {armedDel
                      ? <button type="button" className="ys-btn ys-btn--sm ys-btn--armed" onClick={e => { e.stopPropagation(); setConfirmSnapDel(null); deleteSnapshot(s.id); }}>Delete?</button>
                      : <button type="button" className="ys-ibtn" aria-label={`Delete snapshot ${s.name}`} onClick={e => { e.stopPropagation(); setConfirmSnapDel(s.id); setConfirmSwitch(null); }}><CloseIcon size={16} /></button>}
                  </div>;
                })}
                {activeSnap && (
                  <button type="button" className="ys-menu__item" onClick={() => { updateSnapshot(activeSnap.id); closeSnapMenu(); }}>
                    <span className="ys-menu__main"><span className="ys-menu__title">Update "{activeSnap.name}"</span>{dirty && <span className="ys-menu__sub">Overwrite it with the live state</span>}</span>
                  </button>
                )}
                {newSnapMode ? (
                  <div className="ys-menu__pad" style={{ flexDirection: "row", borderBottom: 0 }} onClick={e => e.stopPropagation()}>
                    <input autoFocus placeholder="Snapshot name" value={snapDraftName} className="ys-input" style={{ flex: 1 }}
                      onChange={e => setSnapDraftName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { takeSnapshot(snapDraftName); setSnapDraftName(""); closeSnapMenu(); } if (e.key === "Escape") { setNewSnapMode(false); setSnapDraftName(""); } }} />
                    <button type="button" className="ys-btn ys-btn--primary" onClick={() => { takeSnapshot(snapDraftName); setSnapDraftName(""); closeSnapMenu(); }}>Save</button>
                  </div>
                ) : (
                  <button type="button" className="ys-menu__item" onClick={() => { setNewSnapMode(true); setSnapDraftName(""); }}>
                    <PlusIcon size={16} /> <span className="ys-menu__title">Save as new snapshot</span>
                  </button>
                )}
              </div>
            </>}
          </div>;
        })()}
        <Sep />
        {/* Workflow-stage dropdown — same trigger+popover pattern as the snapshot switcher above */}
        {(() => {
          const cur = MODES[mode];
          // Live per-stage content counts so the menu shows which stages have work in them
          const n = (c, w) => `${c} ${w}${c === 1 ? "" : "s"}`;
          const HINTS = { build: n(walls.length, "wall"), itmep: n(markers.length, "marker"), zone: n(zones.length, "zone"), furnish: n(furnitureCount, "piece"), budget: $(cost.total), docs: n(slidesCount, "slide") };
          return <div style={{ position: "relative" }}>
            <button type="button" className="ys-btn"
              onClick={e => { setModeMenuRect(e.currentTarget.getBoundingClientRect()); setShowModeMenu(v => !v); }}
              title="Workflow stage (1–6)" aria-haspopup="menu" aria-expanded={showModeMenu}>
              <span className="ys-num" aria-hidden="true">{cur.num}</span>
              <span>{cur.name}</span>
              <ChevronIcon open={showModeMenu} />
            </button>
            {showModeMenu && <>
              <div className="ys-backdrop" onClick={() => setShowModeMenu(false)} />
              <div className="ys-menu" style={{ ...menuPos(modeMenuRect), minWidth: 300 }}>
                <div className="ys-menu__head"><span>Workflow stage</span><span className="ys-data">1–6</span></div>
                {Object.entries(MODES).map(([k, m]) => {
                  const isActive = k === mode;
                  return <button type="button" key={k} className="ys-menu__item" aria-label={m.name} aria-current={isActive ? "true" : undefined}
                    onClick={() => { setMode(k); setT("select"); setSelectedId(null); setSelType(null); setSelectedIds([]); setShowModeMenu(false); }}>
                    <span className={"ys-num" + (isActive ? "" : " ys-num--outline")} aria-hidden="true">{m.num}</span>
                    <span className="ys-menu__main">
                      <span className="ys-menu__title">{m.name}</span>
                      <span className="ys-menu__sub">{m.desc}</span>
                    </span>
                    <span className="ys-menu__end">{HINTS[k]}</span>
                  </button>;
                })}
              </div>
            </>}
          </div>;
        })()}
        <div style={{ flex: 1 }} />
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="ys-btn ys-btn--quiet ys-btn--icon" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 {...ICON} /></button>
          </TooltipTrigger>
          <TooltipContent>Undo <kbd>⌘Z</kbd></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="ys-btn ys-btn--quiet ys-btn--icon" onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 {...ICON} /></button>
          </TooltipTrigger>
          <TooltipContent>Redo <kbd>⌘⇧Z</kbd></TooltipContent>
        </Tooltip>
        <Sep />
        {/* Theme: Light · Dark · Print (white paper / black ink, for exporting and
            printing). Print restyles the 2D canvas, docs sheets, and the 3D view together. */}
        <div className="ys-seg" role="group" aria-label="Theme">
          {[["light", "Light"], ["dark", "Dark"], ["print", "Print"]].map(([m, label]) => (
            <button type="button" key={m} onClick={() => setThemeMode(m)} aria-pressed={themeMode === m}>{label}</button>
          ))}
        </div>
        {/* Mono is a DRAWING style, not a UI theme — it restyles the canvas (plan,
            elevation, isometric, 3D, sheets) and leaves the chrome on Light/Dark/Print.
            Split button: left toggles it, the chevron opens the skin options popover. */}
        <div className="ys-seg" style={{ marginLeft: 4, position: "relative" }}>
          <Tooltip><TooltipTrigger asChild>
            <button type="button" data-testid="mono-toggle" data-mono={monoDraw ? "on" : "off"} aria-pressed={monoDraw} onClick={() => setMonoDraw(v => !v)}>Mono</button>
          </TooltipTrigger><TooltipContent>Monochrome drawing style (canvas only)</TooltipContent></Tooltip>
          <button type="button" data-testid="mono-menu" aria-label="Mono skin options" aria-haspopup="dialog" aria-expanded={showMono} style={{ padding: "0 8px" }}
            onClick={e => { setMonoRect(e.currentTarget.getBoundingClientRect()); setShowMono(v => !v); }}>
            <ChevronIcon open={showMono} />
          </button>
          {showMono && <>
            <div className="ys-backdrop" onClick={() => setShowMono(false)} />
            <div className="ys-menu" style={{ ...menuPos(monoRect, true), width: 260, padding: "12px 14px 6px", maxHeight: "calc(100vh - 90px)", overflowY: "auto" }}>
              {/* Tweaking a skin option turns Mono on so the effect is visible immediately. */}
              <MonoSkinPanel skin={monoSkin} onChange={(sk) => { setMonoSkin(sk); if (!monoDraw) setMonoDraw(true); }} T={T} tiers={monoTiers} S={S} />
            </div>
          </>}
        </div>
        <Sep />
        <div style={{ position: "relative" }}>
          <button type="button" data-testid="save-menu" className="ys-btn" aria-haspopup="menu" aria-expanded={showSaveMenu}
            onClick={e => { setSaveMenuRect(e.currentTarget.getBoundingClientRect()); setProjDraft(projectName || ""); setShowSaveMenu(v => !v); }}>
            Save<ChevronIcon open={showSaveMenu} />
          </button>
          {showSaveMenu && <>
            <div className="ys-backdrop" onClick={() => setShowSaveMenu(false)} />
            <div className="ys-menu" style={{ ...menuPos(saveMenuRect, true), minWidth: 280 }}>
              {saveToProjects && <div data-testid="project-save-block">
                <div className="ys-menu__head"><span>Save to projects</span><span className="ys-data">{backendLabel.replace(" · ", "")}</span></div>
                <div className="ys-menu__pad">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input data-testid="project-name-input" className="ys-input" value={projDraft} placeholder="Project name" aria-label="Project name" onChange={e => setProjDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && canSaveProject) { setShowSaveMenu(false); saveToProjects(projDraft); } }} />
                    <button type="button" data-testid="project-save" className="ys-btn ys-btn--primary" disabled={!canSaveProject}
                      onClick={() => { setShowSaveMenu(false); saveToProjects(projDraft); }}>
                      {activeProject ? "Update" : "Save"}
                    </button>
                  </div>
                  {activeProject && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span className="ys-small ys-muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>Open: {activeProject.name}</span>
                    <button type="button" data-testid="project-save-as-new" className="ys-btn ys-btn--quiet ys-btn--sm" disabled={!canSaveProject}
                      onClick={() => { setShowSaveMenu(false); saveToProjects(projDraft, { asNew: true }); }}>Save as new</button>
                  </div>}
                  {!projectsCanWrite && <div className="ys-small ys-muted">View-only here — you can open projects, not save them.</div>}
                  {!projectsKind && <div className="ys-small ys-muted">Connecting…</div>}
                </div>
              </div>}
              <div className="ys-menu__head"><span>Export</span></div>
              {[
                { label: "Save project (.json)", fn: exportProject },
                { label: "Export PNG", fn: exportPng },
                { label: "Export SVG", fn: exportSvg },
                { label: "Export DXF (CAD)", fn: exportDxf },
                ...(exportDxfSlide ? [{ label: `Export DXF · this sheet${activeSlideName ? ` (${activeSlideName})` : ""}`, fn: exportDxfSlide }] : []),
                { label: "Export PDF", fn: exportPdf },
              ].map(({ label, fn }) => (
                <button type="button" key={label} className="ys-menu__item" onClick={() => { setShowSaveMenu(false); fn(); }}>{label}</button>
              ))}
            </div>
          </>}
        </div>
        <div style={{ position: "relative" }}>
          <button type="button" data-testid="load-menu" className="ys-btn" aria-haspopup="menu" aria-expanded={showLoad}
            onClick={e => { setLoadRect(e.currentTarget.getBoundingClientRect()); setHistory(readAutosaveHistory ? readAutosaveHistory() : []); setConfirmDel(null); setShowLoad(v => !v); }}>
            Load<ChevronIcon open={showLoad} />
          </button>
          {showLoad && <>
            <div className="ys-backdrop" onClick={() => setShowLoad(false)} />
            <div className="ys-menu" style={{ ...menuPos(loadRect, true), minWidth: 300 }}>
              {openProject && <>
                <div className="ys-menu__head"><span>Projects</span><span className="ys-data">{backendLabel.replace(" · ", "") || "—"}</span></div>
                {projects.length === 0 && <div className="ys-menu__note">{projectsKind ? "None saved yet — Save ▾ › Save to projects." : "Connecting…"}</div>}
                {projects.map(p => {
                  const editing = renamingId === p.id;
                  const isOpen = p.id === activeProjectId;
                  return (
                  <div key={p.id} data-testid="project-entry" title={p.summary} tabIndex={editing ? -1 : 0}
                    className={"ys-menu__item" + (editing ? " ys-menu__item--static" : "")} aria-current={isOpen ? "true" : undefined}
                    onClick={() => { if (projectsBusy || editing) return; setShowLoad(false); openProject(p.id); }}
                    onKeyDown={e => { if (!editing && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); setShowLoad(false); openProject(p.id); } }}>
                    {editing ? (
                      <input data-testid="project-rename-input" autoFocus value={renameDraft} className="ys-input" style={{ flex: 1, minWidth: 0, minHeight: 32 }} aria-label="Project name" onChange={e => setRenameDraft(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => { if (e.key === "Enter") commitRename(p); else if (e.key === "Escape") { renameDoneRef.current = true; setRenamingId(null); } }}
                        onBlur={() => commitRename(p)} />
                    ) : (
                      <span className="ys-menu__main">
                        <span className="ys-menu__title">{p.name}{isOpen && <span className="ys-muted"> · open</span>}</span>
                        <span className="ys-menu__sub">{relativeTime(p.savedAt)}</span>
                      </span>
                    )}
                    {projectsCanWrite && !editing && <button type="button" data-testid="project-rename" className="ys-ibtn" title="Rename project" aria-label={`Rename ${p.name}`}
                      onClick={e => { e.stopPropagation(); setConfirmDel(null); renameDoneRef.current = false; setRenameDraft(p.name); setRenamingId(p.id); }}><PencilIcon size={16} /></button>}
                    {projectsCanWrite && !editing && (confirmDel === p.id
                      ? <button type="button" data-testid="project-delete" className="ys-btn ys-btn--sm ys-btn--armed" title="Click again to delete"
                          onClick={e => { e.stopPropagation(); setConfirmDel(null); deleteProject(p.id); }}>Delete?</button>
                      : <button type="button" data-testid="project-delete" className="ys-ibtn" title="Delete project" aria-label={`Delete ${p.name}`}
                          onClick={e => { e.stopPropagation(); setConfirmDel(p.id); }}><CloseIcon size={16} /></button>)}
                  </div>
                  );
                })}
              </>}
              <div className="ys-menu__head"><span>File</span></div>
              <button type="button" className="ys-menu__item" onClick={() => { setShowLoad(false); loadRef.current?.click(); }}>Load project (.json)…</button>
              <div className="ys-menu__head"><span>Restore earlier autosave</span><span className="ys-data">{history.length}</span></div>
              {history.length === 0 && <div className="ys-menu__note">None yet — a copy is kept every ~2 minutes of editing.</div>}
              {history.map(h => (
                <button type="button" key={h.ts} data-testid="autosave-entry" className="ys-menu__item" onClick={() => { setShowLoad(false); restoreAutosave?.(h); }}>
                  <span className="ys-menu__main">
                    <span className="ys-menu__title">{relativeTime(h.ts)}</span>
                    <span className="ys-menu__sub">{historySummary(h.data)}</span>
                  </span>
                </button>
              ))}
            </div>
          </>}
        </div>
        <button type="button" data-testid="new-project" className={"ys-btn" + (newArmed ? " ys-btn--armed" : "")}
          onClick={() => {
            if ((walls.length || zones.length || markers.length || furnitureCount) && !newArmed) { setNewArmed(true); return; }
            setNewArmed(false); newProject();
          }}>{newArmed ? "New? Click again" : "New"}</button>
        <input ref={loadRef} type="file" accept=".json" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) importProject(f); e.target.value = ""; }} />
        <Sep />
        {/* Layout switcher (single / split / quad) — always visible in the top bar */}
        <div className="ys-seg ys-seg--icon" role="group" aria-label="Layout">
          {[[1, SingleIcon, "Single"], [2, SplitIcon, "Split"], [4, QuadIcon, "Quad"]].map(([n, Icon, label]) => (
            <Tooltip key={n}><TooltipTrigger asChild>
              <button type="button" onClick={() => setLayout(n)} aria-pressed={panes.length === n} aria-label={label}><Icon /></button>
            </TooltipTrigger><TooltipContent>{label} layout</TooltipContent></Tooltip>
          ))}
        </div>
        <Sep />
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="ys-btn ys-btn--quiet ys-btn--icon" onClick={() => setShowSettings(true)} aria-label="Zone library settings"><GearIcon /></button>
          </TooltipTrigger>
          <TooltipContent>Zone library settings</TooltipContent>
        </Tooltip>
      </div>
  );
}
