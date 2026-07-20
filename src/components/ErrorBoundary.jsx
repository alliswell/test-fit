import { Component } from "react";

// Last-resort safety net for the whole app. Without this, ANY render-time exception
// anywhere in the tree (a bad prop, a lost WebGL context cascading into a stale ref, a
// NaN slipping into an SVG path, etc.) unmounts everything — the user is left staring at
// a blank/black page with no way back except guessing to reload. Deliberately
// self-contained (no theme store, no app state) since we don't know what broke.
//
// Autosave debounces ~800ms and is the source of truth on boot, so "Reload" is safe —
// it re-mounts against the last-saved state, exactly like a manual browser refresh.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("TestFit crashed — caught by ErrorBoundary:", error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const { error } = this.state;
    return (
      <div style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: "#151016", color: "#EAE4D8", fontFamily: "ui-sans-serif, system-ui, sans-serif",
        padding: 24, boxSizing: "border-box", zIndex: 999999,
      }}>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "#B8AFA0", marginBottom: 20 }}>
            TestFit hit an unexpected error and had to stop. Your work is safe — it's
            autosaved to this browser continuously. Reloading will pick up right where the
            last save left off.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "#BC3B26", color: "#fff", border: "none", borderRadius: 6,
            }}>
            Reload
          </button>
          <details style={{ marginTop: 20, fontSize: 11, color: "#8A8070" }}>
            <summary style={{ cursor: "pointer" }}>Error details</summary>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 8, fontFamily: "ui-monospace, monospace" }}>
              {error?.message}{error?.stack ? "\n\n" + error.stack : ""}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
