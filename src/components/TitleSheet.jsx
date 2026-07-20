// ─── Title / Section sheet — the Docs stage's section-divider slide ──────────
// Props-only. A "title" slide has no model geometry: it's a chapter divider used to
// group the child slides nested under it in the deck. Renders a large section heading
// with an overline, a brand rule, and an optional subtitle. When the section has
// nested slides, the right column becomes an auto-built contents index (sheet no +
// name + a per-view detail like scale or budget total), supplied by testfit.jsx. The
// project name + sheet number still come from the shared title block below it.
export default function TitleSheet({ width, height, title, subtitle, contents = [], T, font, display }) {
  const hasContents = contents.length > 0;
  return (
    <div data-testid="title-sheet"
      style={{ width, height, fontFamily: font, color: T.text, display: "flex", overflow: "hidden", boxSizing: "border-box" }}>
      {/* Left — section heading */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 18, padding: "0 6px" }}>
        <div style={{ fontFamily: font, fontSize: 12, letterSpacing: "0.32em", color: T.textDim, textTransform: "uppercase" }}>Section</div>
        <div style={{ fontFamily: display, fontSize: hasContents ? 56 : 68, lineHeight: 1.02, color: T.textBright, textTransform: "uppercase", letterSpacing: "0.02em", maxWidth: "100%", overflowWrap: "anywhere" }}>{title}</div>
        <div style={{ width: 150, height: 3, background: T.brand }} />
        {subtitle && (
          <div style={{ fontFamily: font, fontSize: 15, color: T.textMuted, lineHeight: 1.4, maxWidth: "92%", overflowWrap: "anywhere" }}>{subtitle}</div>
        )}
      </div>
      {/* Right — auto contents index of the section's nested slides */}
      {hasContents && (
        <div data-testid="title-contents" style={{ width: "38%", flexShrink: 0, borderLeft: "1px solid " + T.text + "33", paddingLeft: 26, display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ fontFamily: font, fontSize: 11, letterSpacing: "0.26em", color: T.textDim, textTransform: "uppercase", marginBottom: 12 }}>In this section</div>
          {contents.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "9px 0", borderBottom: "1px solid " + T.text + "1f" }}>
              <span style={{ fontFamily: font, fontSize: 11, color: T.textDim, fontVariantNumeric: "tabular-nums", minWidth: 20, flexShrink: 0 }}>{String(c.sheetNo).padStart(2, "0")}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: display, fontSize: 20, letterSpacing: "0.02em", color: T.textBright, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontFamily: font, fontSize: 11.5, color: T.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
