// ─── Budget sheet — the Docs stage's data slide ──────────────────────────────
// Props-only. Live-renders the project budget rollup (the same `cost` memo the
// Budget stage uses) as a printable sheet: stat tiles, an equipment/item schedule
// with quantities, zone build-out, and structure counts. No camera — pure data.
import { SPEC_LAYERS } from "../constants/specs";

export default function BudgetSheet({ width, height, cost, T, font, display, $, ft }) {
  const layerOrder = Object.keys(SPEC_LAYERS);
  const equipRows = Object.entries(cost.markers)
    .map(([key, p]) => ({ key, ...p }))
    .sort((a, b) => (layerOrder.indexOf(a.layer) - layerOrder.indexOf(b.layer)) || a.name.localeCompare(b.name));
  const equipTotal = equipRows.reduce((s, r) => s + r.count * r.unitCost, 0);
  const equipQty = equipRows.reduce((s, r) => s + r.count, 0);
  const zoneTotal = cost.zones.reduce((s, z) => s + z.total, 0);
  const con = cost.construction || { walls: [], doors: [], windows: [], total: 0 };

  const th = { textAlign: "left", fontSize: 8.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "3px 8px", borderBottom: "1px solid " + T.text + "55" };
  const td = { fontSize: 10.5, color: T.text, padding: "3.5px 8px", borderBottom: "1px solid " + T.border + "66" };
  const num = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const secH = { fontFamily: display, fontSize: 15, letterSpacing: "0.04em", color: T.textBright, margin: "0 0 4px", textTransform: "uppercase" };
  const tile = { flex: 1, border: "1px solid " + T.text + "44", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2 };
  const tileLbl = { fontSize: 8.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 };

  return (
    <div data-testid="budget-sheet" style={{ width, height, fontFamily: font, color: T.text, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden", boxSizing: "border-box", padding: "6px 4px" }}>
      {/* Stat tiles */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ ...tile, borderWidth: "1.5px", borderColor: T.text + "88" }}>
          <span style={tileLbl}>Total Estimate</span>
          <span style={{ fontFamily: display, fontSize: 30, lineHeight: 1.1, color: T.textBright }}>{$(cost.total)}</span>
        </div>
        <div style={tile}>
          <span style={tileLbl}>Program Area</span>
          <span style={{ fontFamily: display, fontSize: 30, lineHeight: 1.1, color: T.textBright }}>{cost.totalSf.toLocaleString()} <span style={{ fontSize: 15 }}>sf</span></span>
        </div>
        <div style={tile}>
          <span style={tileLbl}>Equipment Items</span>
          <span style={{ fontFamily: display, fontSize: 30, lineHeight: 1.1, color: T.textBright }}>{equipQty}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        {/* Equipment / item schedule */}
        <div style={{ flex: 1.5, minWidth: 0, overflow: "hidden" }}>
          <div style={secH}>Item Schedule</div>
          {equipRows.length === 0
            ? <div style={{ fontSize: 10, color: T.textMuted, fontStyle: "italic", padding: "6px 0" }}>No IT/MEP components placed yet — add them in the IT/MEP stage.</div>
            : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Item</th><th style={{ ...th, textAlign: "right" }}>Qty</th>
                  <th style={{ ...th, textAlign: "right" }}>Unit</th><th style={{ ...th, textAlign: "right" }}>Total</th>
                </tr></thead>
                <tbody>
                  {equipRows.map((r, i) => {
                    const firstOfLayer = i === 0 || equipRows[i - 1].layer !== r.layer;
                    return [
                      firstOfLayer && (
                        <tr key={r.key + "-h"}><td colSpan={4} style={{ ...td, borderBottom: "none", paddingTop: i === 0 ? 2 : 9, paddingBottom: 1 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: SPEC_LAYERS[r.layer]?.color || T.textDim, display: "inline-block" }} />
                            {SPEC_LAYERS[r.layer]?.name || r.layer}
                          </span>
                        </td></tr>
                      ),
                      <tr key={r.key}>
                        <td style={td}>{r.name}</td>
                        <td style={num}>{r.count}</td>
                        <td style={num}>{$(r.unitCost)}</td>
                        <td style={{ ...num, fontWeight: 600 }}>{$(r.count * r.unitCost)}</td>
                      </tr>,
                    ];
                  })}
                  <tr><td style={{ ...td, borderBottom: "none", fontWeight: 700 }}>Equipment subtotal</td>
                    <td style={{ ...num, borderBottom: "none", fontWeight: 700 }}>{equipQty}</td><td style={{ borderBottom: "none" }} />
                    <td style={{ ...num, borderBottom: "none", fontWeight: 700 }}>{$(equipTotal)}</td></tr>
                </tbody>
              </table>}
        </div>

        {/* Build-out + structure */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={secH}>Build-Out</div>
            {cost.zones.length === 0
              ? <div style={{ fontSize: 10, color: T.textMuted, fontStyle: "italic", padding: "6px 0" }}>No zones placed yet.</div>
              : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Zone</th><th style={{ ...th, textAlign: "right" }}>Area</th><th style={{ ...th, textAlign: "right" }}>Est.</th></tr></thead>
                  <tbody>
                    {cost.zones.map(z => (
                      <tr key={z.id}><td style={td}>{z.label}</td><td style={num}>{z.sf.toLocaleString()} sf</td><td style={{ ...num, fontWeight: 600 }}>{$(z.total)}</td></tr>
                    ))}
                    <tr><td style={{ ...td, borderBottom: "none", fontWeight: 700 }}>Build-out subtotal</td><td style={{ borderBottom: "none" }} />
                      <td style={{ ...num, borderBottom: "none", fontWeight: 700 }}>{$(zoneTotal)}</td></tr>
                  </tbody>
                </table>}
          </div>
          <div>
            <div style={secH}>Construction</div>
            <div style={{ fontSize: 8.5, color: T.textMuted, margin: "0 0 6px", lineHeight: 1.4 }}>New scope only — as-built doors, windows &amp; columns are excluded until flagged “new.”</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Item</th><th style={{ ...th, textAlign: "right" }}>Qty</th><th style={{ ...th, textAlign: "right" }}>Cost</th>
              </tr></thead>
              <tbody>
                {con.walls.map(w => (
                  <tr key={"w" + w.kind}><td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: w.color, display: "inline-block" }} />{w.label} wall
                    </span>
                  </td><td style={num}>{ft(w.ft)}</td><td style={{ ...num, fontWeight: 600 }}>{w.cost ? $(w.cost) : "—"}</td></tr>
                ))}
                {con.doors.map(d => (
                  <tr key={"d" + d.type}><td style={td}>New door · {d.type}</td><td style={num}>{d.count}</td><td style={{ ...num, fontWeight: 600 }}>{d.cost ? $(d.cost) : "—"}</td></tr>
                ))}
                {con.windows.map(w => (
                  <tr key={"win" + w.type}><td style={td}>New {w.type}</td><td style={num}>{w.count}</td><td style={{ ...num, fontWeight: 600 }}>{w.cost ? $(w.cost) : "—"}</td></tr>
                ))}
                {con.columns?.count > 0 && <tr><td style={td}>New columns</td><td style={num}>{con.columns.count}</td><td style={{ ...num, fontWeight: 600 }}>{con.columns.cost ? $(con.columns.cost) : "—"}</td></tr>}
                <tr><td style={{ ...td, borderBottom: "none", fontWeight: 700 }}>Construction subtotal</td><td style={{ borderBottom: "none" }} />
                  <td style={{ ...num, borderBottom: "none", fontWeight: 700 }}>{$(con.total)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
