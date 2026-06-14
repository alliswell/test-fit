// ─── Zone Library Settings Modal ──────────────────────────────────────────────
// Edits the runtime zone-library catalog (zone types + their line-item costs).
// Props-only — themed via the passed `T`; persistence handled by the caller.

import { useState } from "react";
import { X, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

export default function ZoneLibraryModal({ zoneLibrary, setZoneLibrary, onReset, onClose, T }) {
  const [expandedKey, setExpandedKey] = useState(null);

  const updZone = (key, patch) =>
    setZoneLibrary(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const updItem = (key, idx, patch) =>
    setZoneLibrary(prev => {
      const items = prev[key].items.map((it, i) => i === idx ? { ...it, ...patch } : it);
      return { ...prev, [key]: { ...prev[key], items } };
    });

  const addItem = (key) =>
    setZoneLibrary(prev => ({
      ...prev,
      [key]: { ...prev[key], items: [...prev[key].items, { name: "", qty: 1, unitCost: 0 }] },
    }));

  const removeItem = (key, idx) =>
    setZoneLibrary(prev => ({
      ...prev,
      [key]: { ...prev[key], items: prev[key].items.filter((_, i) => i !== idx) },
    }));

  const addZoneType = () => {
    const newKey = "custom_" + Date.now();
    setZoneLibrary(prev => ({
      ...prev,
      [newKey]: { name: "New Zone", color: "#888888", defaultW: 12, defaultH: 10, recommendedSf: 120, items: [] },
    }));
    setExpandedKey(newKey);
  };

  const deleteZoneType = (key) => {
    setZoneLibrary(prev => { const next = { ...prev }; delete next[key]; return next; });
    setExpandedKey(null);
  };

  const inp = (extra = {}) => ({
    background: T.bg2, border: "1px solid " + T.border, borderRadius: 4,
    color: T.text, fontSize: 11, fontFamily: "inherit", padding: "3px 6px",
    outline: "none", ...extra,
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 48, paddingBottom: 48, overflowY: "auto" }}>
      <div style={{ background: T.bg1, border: "1px solid " + T.border, borderRadius: 10, width: 680, maxWidth: "95vw", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid " + T.border, background: T.bg0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: T.textBright, flex: 1 }}>Zone Library</span>
          <button onClick={onReset} style={{ ...inp(), marginRight: 8, cursor: "pointer", color: T.textMuted }}>Reset to defaults</button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4 }}><X size={16} /></button>
        </div>

        {/* Zone list */}
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {Object.entries(zoneLibrary).map(([key, zone]) => {
            const isOpen = expandedKey === key;
            const total = zone.items.reduce((s, i) => s + (i.qty || 0) * (i.unitCost || 0), 0);
            return (
              <div key={key} style={{ borderBottom: "1px solid " + T.border }}>
                {/* Row header */}
                <div
                  onClick={() => setExpandedKey(isOpen ? null : key)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", cursor: "pointer", background: isOpen ? T.bg2 : "transparent" }}
                >
                  <span style={{ color: T.textMuted, width: 14 }}>{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                  <input type="color" value={zone.color} onClick={e => e.stopPropagation()}
                    onChange={e => updZone(key, { color: e.target.value })}
                    style={{ width: 24, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0, background: "none" }} />
                  <input value={zone.name} onClick={e => e.stopPropagation()}
                    onChange={e => updZone(key, { name: e.target.value })}
                    style={{ ...inp(), flex: 1, fontWeight: 500 }} />
                  <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>Rec. {zone.recommendedSf ?? "—"} sf</span>
                  <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>${total.toLocaleString()} est.</span>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "12px 20px 16px 48px", background: T.bg0 }}>
                    {/* Meta row */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                        Sq Ft
                        <input type="number" value={zone.recommendedSf ?? ""} onChange={e => {
                          const newSf = Number(e.target.value);
                          const ratio = (zone.defaultW || 1) / (zone.defaultH || 1);
                          const newH = Math.round(Math.sqrt(newSf / ratio) * 10) / 10;
                          const newW = Math.round(Math.sqrt(newSf * ratio) * 10) / 10;
                          updZone(key, { recommendedSf: newSf, defaultW: newW, defaultH: newH });
                        }} style={{ ...inp({ width: 64 }) }} />
                      </label>
                      <label style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                        Default Width (ft)
                        <input type="number" value={zone.defaultW} onChange={e => {
                          const newW = Number(e.target.value);
                          updZone(key, { defaultW: newW, recommendedSf: Math.round(newW * (zone.defaultH || 1)) });
                        }} style={{ ...inp({ width: 64 }) }} />
                      </label>
                      <label style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                        Default Depth (ft)
                        <input type="number" value={zone.defaultH} onChange={e => {
                          const newH = Number(e.target.value);
                          updZone(key, { defaultH: newH, recommendedSf: Math.round((zone.defaultW || 1) * newH) });
                        }} style={{ ...inp({ width: 64 }) }} />
                      </label>
                    </div>

                    {/* FF&E items table */}
                    <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>FF&amp;E / Budget Items</div>
                    {zone.items.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 80px 28px", gap: 4, marginBottom: 6, fontSize: 10, color: T.textMuted, paddingRight: 4 }}>
                        <span>Item</span><span style={{ textAlign: "center" }}>Qty</span><span style={{ textAlign: "right" }}>$/unit</span><span />
                      </div>
                    )}
                    {zone.items.map((item, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 56px 80px 28px", gap: 4, marginBottom: 4 }}>
                        <input value={item.name} onChange={e => updItem(key, idx, { name: e.target.value })} placeholder="Item name" style={inp({ width: "100%" })} />
                        <input type="number" value={item.qty} onChange={e => updItem(key, idx, { qty: Number(e.target.value) })} style={{ ...inp({ textAlign: "center" }) }} />
                        <input type="number" value={item.unitCost} onChange={e => updItem(key, idx, { unitCost: Number(e.target.value) })} style={{ ...inp({ textAlign: "right" }) }} />
                        <button onClick={() => removeItem(key, idx)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 2, display: "flex", alignItems: "center" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addItem(key)} style={{ ...inp(), cursor: "pointer", marginTop: 4, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                      <Plus size={11} /> Add item
                    </button>

                    {/* Delete zone type */}
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid " + T.border }}>
                      <button onClick={() => deleteZoneType(key)}
                        style={{ ...inp(), cursor: "pointer", color: "#E05050", display: "flex", alignItems: "center", gap: 4 }}>
                        <Trash2 size={11} /> Delete zone type
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid " + T.border, background: T.bg0 }}>
          <button onClick={addZoneType} style={{ ...inp(), cursor: "pointer", color: T.accent, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
            <Plus size={13} /> Add zone type
          </button>
        </div>
      </div>
    </div>
  );
}

