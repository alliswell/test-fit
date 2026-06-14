// ─── Small reusable UI widgets ────────────────────────────────────────────────
// Props-only components: no main-component state, themed via explicit color props.

import { useState, useEffect } from "react";
import { labelBounds } from "../utils/labels";

// Slider + inline number input — replaces both button grids and static range+span combos
export function SliderInput({ value, min, max, step = 1, onChange, accent = "#9A9488", textColor = "#E8E0D0", bgColor = "#2A2826", borderColor = "#3A3830", unit = '"', disabled = false }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value ?? ""));
  useEffect(() => { if (!editing) setRaw(String(value ?? "")); }, [value, editing]);
  const commit = () => {
    const v = Math.min(max, Math.max(min, parseInt(raw) || min));
    onChange(v);
    setEditing(false);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="range" min={min} max={max} step={step} value={value ?? min} disabled={disabled}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{ flex: 1, accentColor: accent, height: 4, cursor: "pointer", opacity: disabled ? 0.4 : 1 }} />
      {editing ? (
        <input type="number" min={min} max={max} value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setRaw(String(value ?? "")); } }}
          autoFocus
          style={{ width: 44, fontSize: 12, fontWeight: 600, color: textColor, background: bgColor, border: "1px solid " + borderColor, borderRadius: 4, padding: "2px 4px", textAlign: "center", fontFamily: "inherit" }}
        />
      ) : (
        <span onClick={() => { if (!disabled) { setRaw(String(value ?? "")); setEditing(true); } }}
          title={disabled ? undefined : "Click to type exact value"}
          style={{ fontSize: 12, fontWeight: 600, color: disabled ? borderColor : textColor, minWidth: "36px", textAlign: "right", cursor: disabled ? "default" : "text", borderBottom: disabled ? "none" : "1px dashed " + borderColor, paddingBottom: 1 }}
        >{disabled ? "—" : (value ?? "—")}{disabled ? "" : unit}</span>
      )}
    </div>
  );
}

// Plan-canvas label/callout annotation (leader line + wrapped text box).
export function LabelAnnotation({ lbl, sel, tool, bg }) {
  const labelFont = "'Inter', 'SF Pro', system-ui, sans-serif";
  const fontW = lbl.bold ? 700 : 400;
  const fontStyle = lbl.italic ? "italic" : "normal";
  const { w: approxW, h: approxH, lines, lineH } = labelBounds(lbl);
  const color = lbl.color;
  const firstLineY = lbl.y - ((lines.length - 1) * lineH) / 2;
  return <g style={{ cursor: tool === "select" ? "pointer" : "inherit" }}>
    {lbl.lx != null && <>
      <line x1={lbl.lx} y1={lbl.ly} x2={lbl.x} y2={lbl.y}
        stroke={color} strokeWidth={sel ? 1.5 : 1} opacity={0.85} style={{ pointerEvents: "none" }} />
      <circle cx={lbl.lx} cy={lbl.ly} r={3} fill={color} opacity={0.85} style={{ pointerEvents: "none" }} />
    </>}
    <rect x={lbl.x - approxW / 2} y={lbl.y - approxH / 2} width={approxW} height={approxH}
      fill={bg} fillOpacity={0.9} stroke={color} strokeWidth={sel ? 1.5 : 1} strokeOpacity={0.75} rx={3} />
    {sel && <rect x={lbl.x - approxW / 2 - 4} y={lbl.y - approxH / 2 - 4}
      width={approxW + 8} height={approxH + 8} fill="none"
      stroke={color} strokeWidth={1} strokeDasharray="4 3" rx={4} opacity={0.5} style={{ pointerEvents: "none" }} />}
    {lbl.text
      ? lines.map((line, i) => (
          <text key={i} x={lbl.x} y={firstLineY + i * lineH} textAnchor="middle" dominantBaseline="middle"
            fontSize={lbl.fontSize} fontWeight={fontW} fontStyle={fontStyle}
            fill={color} fontFamily={labelFont} style={{ pointerEvents: "none" }}>{line || " "}</text>
        ))
      : <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={lbl.fontSize} fill={color} opacity={0.35} fontFamily={labelFont} style={{ pointerEvents: "none" }}>Label…</text>}
  </g>;
}

// Align & Distribute panel button (hoisted to avoid remounting on every render)
export function AlignBtn({ action, label, tip, onAction, border, accent, textMuted, textBright }) {
  const base = { flex: 1, padding: "5px 0", background: "transparent", border: "1.5px solid " + border, borderRadius: 5, cursor: "pointer", color: textMuted, fontSize: 10, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s ease" };
  return (
    <button style={base} title={tip} onClick={() => onAction(action)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = textBright; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = textMuted; }}>
      {label}
    </button>
  );
}
