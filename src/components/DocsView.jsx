// ─── Docs / presentation view ────────────────────────────────────────────────
// Props-only slide-deck workspace for the Docs workflow stage. Left: deck strip.
// Center: the active slide as a printable sheet (logical px sized to the deck's
// Letter/Tabloid setting, CSS-scaled to fit). Right: slide + deck inspector.
//
// Model content arrives via the `renderSlideBody(slide, {width,height,forPrint})`
// render prop built in testfit.jsx — this component never touches model state.
// Slide-local notes are edited here (local selection/tool state on purpose: using
// the global selectionStore would let the app-level Delete handler reach the model).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { uid } from "../imports/model";
import { sheetDims, formatSheetNo, viewTitle, SHEET_TITLE_H, SHEET_BODY_PAD } from "../utils/docs";
import { LabelAnnotation } from "./ui";
import { Printer, Trash2, ArrowUp, ArrowDown, PencilRuler, Type, MousePointer2 } from "lucide-react";

const TITLE_H = SHEET_TITLE_H;   // title-block strip height (sheet-logical px)
const BODY_PAD = SHEET_BODY_PAD; // margin around the drawing area

// Shared drafting title block — editable in the Docs editor, static for print.
// autoScale: the computed true print scale (plan/elevation slides render AT this scale);
// shown when the user hasn't typed an override into scaleText.
function TitleBlock({ slide, idx, total, T, font, display, projectName, editable, onUpdateSlide, autoScale = null }) {
  const title = slide.title || slide.name;
  return (
    <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, height: TITLE_H, borderTop: "1.5px solid " + T.text + "cc", display: "flex", alignItems: "stretch", background: T.canvas, fontFamily: font }}>
      <div style={{ flex: 1.6, borderRight: "1px solid " + T.text + "44", padding: "7px 12px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
        {editable
          ? <input value={slide.title} placeholder={slide.name} onChange={e => onUpdateSlide(slide.id, { title: e.target.value })} onMouseDown={e => e.stopPropagation()}
              style={{ background: "transparent", border: "none", outline: "none", fontFamily: display, fontSize: 22, letterSpacing: "0.03em", color: T.textBright, width: "100%", padding: 0 }} />
          : <div style={{ fontFamily: display, fontSize: 22, letterSpacing: "0.03em", color: T.textBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>}
        <div style={{ fontSize: 8.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{viewTitle(slide.view)}</div>
      </div>
      <div style={{ flex: 1, borderRight: "1px solid " + T.text + "44", padding: "7px 12px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{projectName}</div>
        <div style={{ fontSize: 8.5, color: T.textMuted }}>{new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</div>
      </div>
      <div style={{ width: 150, borderRight: "1px solid " + T.text + "44", padding: "7px 12px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
        <div style={{ fontSize: 8, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>Scale</div>
        {editable
          ? <input value={slide.scaleText} placeholder={autoScale || "—"} onChange={e => onUpdateSlide(slide.id, { scaleText: e.target.value })} onMouseDown={e => e.stopPropagation()}
              style={{ background: "transparent", border: "none", outline: "none", fontFamily: font, fontSize: 11, color: T.text, width: "100%", padding: 0 }} />
          : <div style={{ fontFamily: font, fontSize: 11, color: T.text }}>{slide.scaleText || autoScale || "—"}</div>}
      </div>
      <div style={{ width: 96, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
        <div style={{ fontSize: 8, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sheet</div>
        <div style={{ fontFamily: display, fontSize: 20, color: T.textBright }}>{formatSheetNo(idx, total)}</div>
      </div>
    </div>
  );
}

// Print deck: every slide as a full-logical-size sheet, one per page. Mounted (by the
// parent) only while printing; @media print swaps the app root for this.
export function PrintDeck({ slides, docSettings, T, font, display, projectName, renderSlideBody, autoScaleFor = null }) {
  const sheet = sheetDims(docSettings);
  const bodyW = sheet.w - BODY_PAD * 2, bodyH = sheet.h - TITLE_H - BODY_PAD * 2;
  return (
    <div className="docs-print-root">
      {slides.map((s, i) => (
        <div key={s.id} className="docs-sheet-page"
          style={{ width: sheet.w, height: sheet.h, position: "relative", background: T.canvas, overflow: "hidden", breakAfter: i < slides.length - 1 ? "page" : "auto", pageBreakAfter: i < slides.length - 1 ? "always" : "auto" }}>
          <div style={{ position: "absolute", left: BODY_PAD, top: BODY_PAD, width: bodyW, height: bodyH, overflow: "hidden" }}>
            {renderSlideBody(s, { width: bodyW, height: bodyH, forPrint: true })}
          </div>
          <div style={{ position: "absolute", inset: 10, border: "1.5px solid " + T.text + "cc", pointerEvents: "none" }} />
          <TitleBlock slide={s} idx={i} total={slides.length} T={T} font={font} display={display} projectName={projectName} editable={false} autoScale={autoScaleFor?.(s)} />
          <svg width={sheet.w} height={sheet.h} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
            {(s.notes || []).map(n => <LabelAnnotation key={n.id} lbl={n} sel={false} tool="pan" bg={T.canvas} />)}
          </svg>
        </div>
      ))}
    </div>
  );
}

export default function DocsView({
  T, font, display, projectName,
  slides, docSettings, activeSlideId,
  onSelectSlide, onUpdateSlide, onDeleteSlide, onMoveSlide, onUpdateSettings,
  onEditModel, renderSlideBody, onPrint, captureRef, autoScaleFor = null,
}) {
  const slide = slides.find(s => s.id === activeSlideId) || slides[0] || null;
  const sheet = sheetDims(docSettings);
  const bodyW = sheet.w - BODY_PAD * 2, bodyH = sheet.h - TITLE_H - BODY_PAD * 2;

  // ── Fit the sheet into the center area ──
  const centerRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.max(0.05, Math.min((r.width - 48) / sheet.w, (r.height - 80) / sheet.h)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheet.w, sheet.h]);

  // ── Slide-local note tool state ──
  const [noteTool, setNoteTool] = useState("select"); // "select" | "note"
  const [selNoteId, setSelNoteId] = useState(null);
  const [editNoteId, setEditNoteId] = useState(null);
  const [draft, setDraft] = useState("");
  const dragRef = useRef(null); // { id, kind: "move"|"leader", ox, oy }
  const placeRef = useRef(null); // { sx, sy } while click-dragging a new note (label-tool style)
  const [placeGhost, setPlaceGhost] = useState(null); // { sx, sy, cx, cy } placement preview
  const sheetRef = useRef(null);

  useEffect(() => { setSelNoteId(null); setEditNoteId(null); }, [activeSlideId]);

  // 3D capture pipeline: refresh the slide's deck/print image shortly after the live 3D
  // mounts (orbit-end captures are handled by the render prop's onCameraEnd). The cleanup
  // capture covers slide switches when the 3D instance is still mounted.
  useEffect(() => {
    if (!slide || slide.view !== "3d" || !captureRef) return;
    const id = slide.id;
    const cap = () => {
      if (!captureRef.current) return;
      const image = captureRef.current();
      if (image) onUpdateSlide(id, { image });
    };
    const t = setTimeout(cap, 900);
    return () => { clearTimeout(t); cap(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id, slide?.view]);

  const notes = slide?.notes || [];
  const setNotes = (next) => slide && onUpdateSlide(slide.id, { notes: next });

  const sheetPt = (e) => {
    const r = sheetRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const commitDraft = () => {
    if (!editNoteId) return;
    const text = draft.trim();
    setNotes(text ? notes.map(n => n.id === editNoteId ? { ...n, text } : n) : notes.filter(n => n.id !== editNoteId));
    setEditNoteId(null); setDraft("");
  };

  const onSheetMouseDown = (e) => {
    if (!slide) return;
    if (editNoteId) { commitDraft(); return; }
    if (noteTool === "note") {
      // Label-tool placement: press = anchor. A plain click drops the text there; a
      // drag > 8 sheet px puts the TEXT at the release point with a leader pointing back
      // at the press point (callout). Commit happens on mouseup (window listener below).
      // preventDefault: the browser's default mousedown focus (to <body>) runs AFTER this
      // handler and would instantly blur the autofocused editor → empty draft → note gone.
      e.preventDefault();
      const p = sheetPt(e);
      placeRef.current = { sx: p.x, sy: p.y };
      setPlaceGhost({ sx: p.x, sy: p.y, cx: p.x, cy: p.y });
      e.stopPropagation();
      return;
    }
    setSelNoteId(null);
  };

  const startNoteDrag = (e, id, kind) => {
    e.stopPropagation();
    setSelNoteId(id);
    const p = sheetPt(e);
    const n = notes.find(x => x.id === id);
    dragRef.current = { id, kind, ox: p.x - (kind === "move" ? n.x : (n.lx ?? n.x)), oy: p.y - (kind === "move" ? n.y : (n.ly ?? n.y)) };
  };
  useEffect(() => {
    const mv = (e) => {
      if (!sheetRef.current) return;
      if (placeRef.current) {
        const p = sheetPt(e);
        setPlaceGhost(g => g ? { ...g, cx: p.x, cy: p.y } : g);
        return;
      }
      const d = dragRef.current;
      if (!d) return;
      const p = sheetPt(e);
      setNotes((slide?.notes || []).map(n => n.id !== d.id ? n :
        d.kind === "move" ? { ...n, x: p.x - d.ox, y: p.y - d.oy } : { ...n, lx: p.x - d.ox, ly: p.y - d.oy }));
    };
    const up = (e) => {
      dragRef.current = null;
      const st = placeRef.current;
      if (!st || !sheetRef.current || !slide) { placeRef.current = null; return; }
      placeRef.current = null;
      setPlaceGhost(null);
      const p = sheetPt(e);
      // Drag → callout: text at release, leader tip at the press point (label-tool rule).
      const isLeader = Math.hypot(p.x - st.sx, p.y - st.sy) > 8;
      const nn = {
        id: uid(), text: "",
        x: isLeader ? p.x : st.sx, y: isLeader ? p.y : st.sy,
        lx: isLeader ? st.sx : null, ly: isLeader ? st.sy : null,
        color: T.text, fontSize: 13, bold: false, italic: false,
      };
      setNotes([...(slide.notes || []), nn]);
      setSelNoteId(nn.id); setEditNoteId(nn.id); setDraft("");
      setNoteTool("select");
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, scale, notes]);

  // Delete/Backspace removes the selected note (local handler — never touches the model).
  useEffect(() => {
    if (!selNoteId) return;
    const down = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !editNoteId) {
        e.preventDefault(); e.stopPropagation();
        setNotes((slide?.notes || []).filter(n => n.id !== selNoteId));
        setSelNoteId(null);
      }
    };
    window.addEventListener("keydown", down, true); // capture: beat the app-level handler
    return () => window.removeEventListener("keydown", down, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selNoteId, editNoteId, slide, notes]);

  const editNote = notes.find(n => n.id === editNoteId);
  const selIdx = slide ? slides.indexOf(slide) : -1;
  const inp = { background: T.bg0, border: "1px solid " + T.border, borderRadius: 5, color: T.text, fontFamily: font, fontSize: 11, padding: "5px 7px", width: "100%", outline: "none", boxSizing: "border-box" };
  const secH = { fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, margin: "14px 0 6px" };
  const segBtn = (active) => ({ flex: 1, padding: "5px 0", fontSize: 10, fontFamily: font, fontWeight: 600, cursor: "pointer", borderRadius: 5, border: "1px solid " + (active ? T.brand : T.border), background: active ? T.brand + "22" : "transparent", color: active ? T.textBright : T.textMuted });

  const viewGlyph = { plan: "P", front: "F", back: "B", left: "L", right: "R", "3d": "3D" };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: T.bg0 }} data-testid="docs-view">
      {/* ── Deck strip ── */}
      <div style={{ width: 216, flexShrink: 0, borderRight: "1px solid " + T.border, background: T.bg1, overflowY: "auto", padding: 10 }}>
        <div style={{ ...secH, marginTop: 2 }}>Deck · {slides.length} slide{slides.length === 1 ? "" : "s"}</div>
        {slides.length === 0 && (
          <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.6, padding: "8px 4px", fontStyle: "italic" }}>
            No slides yet. Use the camera button on any pane (plan, elevation, 3D) in the planning stages to save a view here.
          </div>
        )}
        {slides.map((s, i) => {
          const active = slide && s.id === slide.id;
          return (
            <div key={s.id} data-testid={"deck-slide-" + i} onClick={() => onSelectSlide(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, marginBottom: 4, cursor: "pointer", border: "1px solid " + (active ? T.brand + "88" : "transparent"), background: active ? T.brand + "14" : "transparent" }}>
              <span style={{ fontSize: 9, color: T.textDim, width: 16, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
              {s.view === "3d" && s.image
                ? <img src={s.image} alt="" style={{ width: 34, height: 24, objectFit: "cover", borderRadius: 3, border: "1px solid " + T.border, flexShrink: 0 }} />
                : <span style={{ width: 34, height: 24, borderRadius: 3, border: "1px solid " + T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: T.textMuted, flexShrink: 0 }}>{viewGlyph[s.view]}</span>}
              <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: active ? 600 : 500, color: active ? T.textBright : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                <button title="Move up" onClick={(e) => { e.stopPropagation(); onMoveSlide(s.id, -1); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: 1 }}><ArrowUp size={11} /></button>
                <button title="Move down" onClick={(e) => { e.stopPropagation(); onMoveSlide(s.id, 1); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: 1 }}><ArrowDown size={11} /></button>
                <button title="Delete slide" onClick={(e) => { e.stopPropagation(); if (confirm("Delete slide \"" + s.name + "\"?")) onDeleteSlide(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: 1 }}><Trash2 size={11} /></button>
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Sheet area ── */}
      <div ref={centerRef} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
        {slide && (
          <div style={{ display: "flex", gap: 6, position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 5, background: T.panelBg, border: "1px solid " + T.border, borderRadius: 7, padding: 4, boxShadow: T.panelShadow }}>
            <button style={{ ...segBtn(noteTool === "select"), padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }} onClick={() => setNoteTool("select")}><MousePointer2 size={11} /> Select</button>
            <button data-testid="note-tool" style={{ ...segBtn(noteTool === "note"), padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }} onClick={() => setNoteTool("note")}><Type size={11} /> Note</button>
          </div>
        )}
        {!slide && (
          <div style={{ color: T.textMuted, fontSize: 12, fontFamily: font, textAlign: "center", lineHeight: 1.8 }}>
            <div style={{ fontSize: 28, fontFamily: display, letterSpacing: "0.04em", color: T.textDim }}>DOCUMENTATION</div>
            Save a view from any pane to start the deck.
          </div>
        )}
        {slide && (
          <div style={{ width: sheet.w * scale, height: sheet.h * scale, flexShrink: 0 }}>
            <div ref={sheetRef} data-testid="docs-sheet" onMouseDown={onSheetMouseDown}
              style={{ width: sheet.w, height: sheet.h, transform: `scale(${scale})`, transformOrigin: "top left", background: T.canvas, border: "1px solid " + T.border, boxShadow: "0 18px 44px rgba(0,0,0,0.28)", position: "relative", cursor: noteTool === "note" ? "crosshair" : "default" }}>
              {/* Drawing area */}
              <div style={{ position: "absolute", left: BODY_PAD, top: BODY_PAD, width: bodyW, height: bodyH, overflow: "hidden", pointerEvents: "none" }}>
                {renderSlideBody(slide, { width: bodyW, height: bodyH, forPrint: false, captureRef, sheetScale: scale })}
              </div>
              {/* Sheet border rules */}
              <div style={{ position: "absolute", inset: 10, border: "1.5px solid " + T.text + "cc", pointerEvents: "none" }} />
              {/* Title block */}
              <TitleBlock slide={slide} idx={selIdx} total={slides.length} T={T} font={font} display={display} projectName={projectName} editable onUpdateSlide={onUpdateSlide} autoScale={autoScaleFor?.(slide)} />
              {/* Notes overlay (full sheet, above body, below title-block inputs) */}
              <svg width={sheet.w} height={sheet.h} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
                {notes.map(n => (
                  <g key={n.id} style={{ pointerEvents: "auto", cursor: "move" }}
                    onMouseDown={(e) => startNoteDrag(e, n.id, "move")}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditNoteId(n.id); setDraft(n.text); }}>
                    <LabelAnnotation lbl={n} sel={selNoteId === n.id} tool="select" bg={T.canvas} />
                  </g>
                ))}
                {selNoteId && (() => {
                  const n = notes.find(x => x.id === selNoteId);
                  if (!n) return null;
                  const hx = n.lx ?? n.x + 46, hy = n.ly ?? n.y + 34;
                  return <g style={{ pointerEvents: "auto", cursor: "crosshair" }} onMouseDown={(e) => startNoteDrag(e, n.id, "leader")}>
                    {n.lx == null && <line x1={n.x} y1={n.y} x2={hx} y2={hy} stroke={T.textDim} strokeWidth={0.8} strokeDasharray="3 3" opacity={0.6} />}
                    <circle cx={hx} cy={hy} r={5} fill={T.brand} stroke={T.canvas} strokeWidth={1.5} />
                  </g>;
                })()}
                {placeGhost && (
                  <g style={{ pointerEvents: "none" }}>
                    <line x1={placeGhost.sx} y1={placeGhost.sy} x2={placeGhost.cx} y2={placeGhost.cy} stroke={T.brand} strokeWidth={1} strokeDasharray="4 3" />
                    <circle cx={placeGhost.sx} cy={placeGhost.sy} r={3.5} fill={T.brand} />
                    <circle cx={placeGhost.cx} cy={placeGhost.cy} r={3} fill="none" stroke={T.brand} strokeWidth={1.2} />
                  </g>
                )}
              </svg>
              {/* Note text editor */}
              {editNote && (
                <textarea autoFocus value={draft} data-testid="note-editor"
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commitDraft}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitDraft(); } if (e.key === "Escape") { e.preventDefault(); commitDraft(); } e.stopPropagation(); }}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ position: "absolute", left: editNote.x, top: editNote.y - 9, width: 220, height: 54, background: T.panelBg, border: "1.5px solid " + T.brand, borderRadius: 5, color: T.text, fontFamily: font, fontSize: 13, padding: 6, outline: "none", resize: "none", zIndex: 10 }} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Inspector ── */}
      <div style={{ width: 236, flexShrink: 0, borderLeft: "1px solid " + T.border, background: T.bg1, overflowY: "auto", padding: "6px 14px 20px" }}>
        {slide && <>
          <div style={secH}>Slide</div>
          <div style={{ fontSize: 9, color: T.textDim, marginBottom: 3 }}>Name</div>
          <input style={inp} value={slide.name} data-testid="slide-name" onChange={e => onUpdateSlide(slide.id, { name: e.target.value })} />
          <div style={{ fontSize: 9, color: T.textDim, margin: "8px 0 3px" }}>Sheet title</div>
          <input style={inp} value={slide.title} placeholder={slide.name} onChange={e => onUpdateSlide(slide.id, { title: e.target.value })} />
          <div style={{ fontSize: 9, color: T.textDim, margin: "8px 0 3px" }}>Scale note</div>
          <input style={inp} value={slide.scaleText} placeholder={autoScaleFor?.(slide) ? "auto: " + autoScaleFor(slide) : "e.g. 1/8\" = 1'-0\""} onChange={e => onUpdateSlide(slide.id, { scaleText: e.target.value })} />
          {autoScaleFor?.(slide) && !slide.scaleText && (
            <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4, lineHeight: 1.5 }}>
              Rendered at true {autoScaleFor(slide)} — printed at 100% this sheet measures to scale.
            </div>
          )}
          <button data-testid="edit-model" onClick={() => onEditModel(slide)}
            style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", borderRadius: 6, border: "1px solid " + T.brand + "77", background: T.brand + "18", color: T.textBright, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            <PencilRuler size={12} /> Edit model
          </button>
          <div style={{ fontSize: 9, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
            Slides render the live model — changes in the planning stages appear here automatically.
          </div>
        </>}
        {slide && (() => {
          const n = notes.find(x => x.id === selNoteId);
          if (!n) return null;
          const upd = (patch) => setNotes(notes.map(x => x.id === n.id ? { ...x, ...patch } : x));
          return <>
            <div style={secH}>Note</div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <button style={{ ...segBtn(false), maxWidth: 28 }} onClick={() => upd({ fontSize: Math.max(9, (n.fontSize || 13) - 1) })}>−</button>
              <span style={{ fontSize: 10, color: T.textMuted, minWidth: 36, textAlign: "center", fontFamily: font }}>{n.fontSize || 13}px</span>
              <button style={{ ...segBtn(false), maxWidth: 28 }} onClick={() => upd({ fontSize: Math.min(28, (n.fontSize || 13) + 1) })}>+</button>
              <button style={{ ...segBtn(!!n.bold), maxWidth: 30, fontWeight: 700 }} onClick={() => upd({ bold: !n.bold })}>B</button>
              <button style={{ ...segBtn(!!n.italic), maxWidth: 30, fontStyle: "italic" }} onClick={() => upd({ italic: !n.italic })}>I</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
              {[T.text, T.brand, "#4A7EC0", "#50A070"].map(c => (
                <button key={c} title={c} onClick={() => upd({ color: c })}
                  style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: n.color === c ? "2px solid " + T.textBright : "2px solid " + T.border, cursor: "pointer", padding: 0 }} />
              ))}
              <div style={{ flex: 1 }} />
              <button style={{ ...segBtn(false), maxWidth: 74 }} onClick={() => { setNotes(notes.filter(x => x.id !== n.id)); setSelNoteId(null); }}>Delete</button>
            </div>
          </>;
        })()}
        <div style={secH}>Deck</div>
        <div style={{ fontSize: 9, color: T.textDim, marginBottom: 3 }}>Sheet size</div>
        <div style={{ display: "flex", gap: 5 }}>
          <button style={segBtn(docSettings.size === "letter")} onClick={() => onUpdateSettings({ size: "letter" })}>Letter</button>
          <button style={segBtn(docSettings.size === "tabloid")} onClick={() => onUpdateSettings({ size: "tabloid" })}>Tabloid</button>
        </div>
        <div style={{ fontSize: 9, color: T.textDim, margin: "8px 0 3px" }}>Orientation</div>
        <div style={{ display: "flex", gap: 5 }}>
          <button style={segBtn(docSettings.orientation === "landscape")} onClick={() => onUpdateSettings({ orientation: "landscape" })}>Landscape</button>
          <button style={segBtn(docSettings.orientation === "portrait")} onClick={() => onUpdateSettings({ orientation: "portrait" })}>Portrait</button>
        </div>
        <button data-testid="print-deck" onClick={onPrint} disabled={!slides.length}
          style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 6, border: "1px solid " + T.border, background: T.bg2, color: slides.length ? T.textBright : T.textDim, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: slides.length ? "pointer" : "default" }}>
          <Printer size={12} /> Print / PDF
        </button>
        <div style={{ fontSize: 9, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
          Prints every slide as a {docSettings.size} {docSettings.orientation} page. Use the print dialog's "Save as PDF" for a file.
        </div>
      </div>
    </div>
  );
}
