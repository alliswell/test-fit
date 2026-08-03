import { SHORTCUT_GROUPS } from "../constants/shortcuts";

// Keyboard cheat sheet — "?" or the Help button. Props-only; everything it lists comes from
// constants/shortcuts.js so the reference can't drift from the handler the way the README did.
export default function ShortcutSheet({ T, S, font, display, onClose }) {
  const kbd = {
    fontFamily: font, fontSize: 10, fontWeight: 600, lineHeight: 1,
    padding: "3px 6px", borderRadius: 4, background: T.bg3,
    border: "1px solid " + T.border, color: T.textBright, whiteSpace: "nowrap",
  };
  return (
    <div data-testid="shortcut-sheet"
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#0006",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: T.panelBg, border: "1px solid " + T.border, borderRadius: 10,
          boxShadow: T.panelShadow, backdropFilter: "blur(16px)", maxWidth: 860, width: "100%",
          maxHeight: "84vh", overflowY: "auto", padding: "18px 20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: display, fontSize: 15, fontWeight: 600, letterSpacing: "0.04em",
            color: T.textBright, textTransform: "uppercase", flex: 1 }}>Keyboard shortcuts</div>
          <button data-testid="shortcut-sheet-close" onClick={onClose} style={{ ...S.smBtn }}>Close</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "4px 26px" }}>
          {SHORTCUT_GROUPS.map((g) => (
            <div key={g.title} style={{ breakInside: "avoid", marginBottom: 12 }}>
              <div style={{ fontFamily: display, fontSize: 9, letterSpacing: "0.18em", fontWeight: 600,
                textTransform: "uppercase", color: T.brand, margin: "8px 0 6px" }}>{g.title}</div>
              {g.items.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                  <span style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    {it.keys.map((kk, j) => <span key={j} style={kbd}>{kk}</span>)}
                  </span>
                  <span style={{ fontSize: 10.5, color: T.text, lineHeight: 1.3 }}>{it.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
