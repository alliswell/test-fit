// ─── FF&E schedule — furniture, fixtures & equipment from placed zones ────────
// Props-only Docs data slide. Each placed zone contributes its program's FF&E line
// items (name / qty / unit cost); this schedules them grouped by zone with subtotals
// and a project rollup. Live — placing or resizing zones updates it.

export default function FnESheet({ width, height, cost, T, font, display, $ }) {
  const zones = cost.zones.filter(z => (z.items || []).length > 0);
  const grand = zones.reduce((s, z) => s + z.total, 0);
  const totalUnits = zones.reduce((s, z) => s + z.items.reduce((t, i) => t + i.qty, 0), 0);
  // Project rollup — same item name across zones collapses to one line with summed qty.
  const rollup = {};
  zones.forEach(z => z.items.forEach(i => {
    const k = i.name + "|" + i.unitCost;
    if (!rollup[k]) rollup[k] = { name: i.name, unitCost: i.unitCost, qty: 0 };
    rollup[k].qty += i.qty;
  }));
  const rollupRows = Object.values(rollup).sort((a, b) => (b.qty * b.unitCost) - (a.qty * a.unitCost));

  const th = { textAlign: "left", fontSize: 8.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "3px 8px", borderBottom: "1px solid " + T.text + "55" };
  const td = { fontSize: 10.5, color: T.text, padding: "3.5px 8px", borderBottom: "1px solid " + T.border + "66" };
  const num = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const secH = { fontFamily: display, fontSize: 15, letterSpacing: "0.04em", color: T.textBright, margin: "0 0 4px", textTransform: "uppercase" };
  const tile = { flex: 1, border: "1px solid " + T.text + "44", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2 };
  const tileLbl = { fontSize: 8.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 };

  return (
    <div data-testid="ffe-sheet" style={{ width, height, fontFamily: font, color: T.text, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden", boxSizing: "border-box", padding: "6px 4px" }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ ...tile, borderWidth: "1.5px", borderColor: T.text + "88" }}>
          <span style={tileLbl}>FF&amp;E Total</span>
          <span style={{ fontFamily: display, fontSize: 30, lineHeight: 1.1, color: T.textBright }}>{$(grand)}</span>
        </div>
        <div style={tile}><span style={tileLbl}>Program Areas</span><span style={{ fontFamily: display, fontSize: 30, lineHeight: 1.1, color: T.textBright }}>{zones.length}</span></div>
        <div style={tile}><span style={tileLbl}>Furnishings</span><span style={{ fontFamily: display, fontSize: 30, lineHeight: 1.1, color: T.textBright }}>{totalUnits}</span></div>
      </div>

      {zones.length === 0 ? (
        <div style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic", padding: "12px 4px" }}>
          No zones placed yet — add program areas in the Zones stage and their furniture, fixtures &amp; equipment schedule here.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
          {/* By-zone schedule */}
          <div style={{ flex: 1.6, minWidth: 0, overflow: "hidden" }}>
            <div style={secH}>Schedule by Area</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Item</th><th style={{ ...th, textAlign: "right" }}>Qty</th>
                <th style={{ ...th, textAlign: "right" }}>Unit</th><th style={{ ...th, textAlign: "right" }}>Total</th>
              </tr></thead>
              <tbody>
                {zones.map(z => [
                  <tr key={z.id + "-h"}><td colSpan={4} style={{ ...td, borderBottom: "none", paddingTop: 9, paddingBottom: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textMuted }}>{z.label} · {z.sf.toLocaleString()} sf</span>
                  </td></tr>,
                  ...z.items.map((it, i) => (
                    <tr key={z.id + "-" + i}>
                      <td style={td}>{it.name}</td>
                      <td style={num}>{it.qty}</td>
                      <td style={num}>{$(it.unitCost)}</td>
                      <td style={{ ...num, fontWeight: 600 }}>{$(it.qty * it.unitCost)}</td>
                    </tr>
                  )),
                  <tr key={z.id + "-s"}><td style={{ ...td, fontWeight: 600, color: T.textMuted }} colSpan={3}>{z.label} subtotal</td>
                    <td style={{ ...num, fontWeight: 700 }}>{$(z.total)}</td></tr>,
                ])}
                <tr><td style={{ ...td, borderBottom: "none", fontWeight: 700 }} colSpan={3}>FF&amp;E total</td>
                  <td style={{ ...num, borderBottom: "none", fontWeight: 700 }}>{$(grand)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Project rollup — same item across zones summed */}
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div style={secH}>Project Rollup</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Item</th><th style={{ ...th, textAlign: "right" }}>Qty</th><th style={{ ...th, textAlign: "right" }}>Total</th></tr></thead>
              <tbody>
                {rollupRows.map((r, i) => (
                  <tr key={i}><td style={td}>{r.name}</td><td style={num}>{r.qty}</td><td style={{ ...num, fontWeight: 600 }}>{$(r.qty * r.unitCost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
