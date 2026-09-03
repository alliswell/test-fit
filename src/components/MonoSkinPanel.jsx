// ─── Mono drawing skin ───────────────────────────────────────────────────────
// The token SCALE is fixed (four tiers, weight + lightness). Only the skin — hue,
// line saturation, background, polarity — is adjustable, so no control here can break
// the hierarchy; the worst you can do is pick a low-contrast background, which the
// guard below calls out.
import { MONO_PRESETS, MONO_RAMP, MONO_MIN_CONTRAST, MONO_PROFILES } from "../constants/theme";

// `T` is the UI chrome theme (the panel is chrome); `tiers` are the drawing tokens the
// canvas will use — the two are deliberately different themes now.
export default function MonoSkinPanel({ skin, onChange, T, tiers = [], S }) {
  const ramp = MONO_RAMP[skin.pol] || MONO_RAMP["dark-on-light"];
  const paper = `hsl(${skin.bg.h} ${skin.bg.s}% ${skin.bg.l}%)`; // swatch backdrop only
  const delta = Math.abs(ramp[0] - skin.bg.l);
  const lowContrast = delta < MONO_MIN_CONTRAST;
  const set = (patch) => onChange({ ...skin, ...patch });
  const lbl = { fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 5 };
  const row = { display: "flex", justifyContent: "space-between", fontSize: 9.5, color: T.textDim, marginBottom: 2 };

  const Slider = ({ label, value, min, max, suffix, onInput }) => (
    <div style={{ marginBottom: 7 }}>
      <div style={row}><span>{label}</span><span>{value}{suffix}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={e => onInput(+e.target.value)}
        style={{ width: "100%", accentColor: tiers[0]?.color, height: 3 }} />
    </div>
  );

  return (
    <div style={S.sec} data-testid="mono-skin-panel">
      <div style={S.sh}>Drawing skin</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {MONO_PRESETS.map(p => {
          const on = p.baseHue === skin.baseHue && p.bg.l === skin.bg.l && p.pol === skin.pol;
          return (
            <button key={p.id} data-testid={"mono-preset-" + p.id} onClick={() => onChange({ ...p })}
              style={{ padding: "3px 7px", fontSize: 9, fontFamily: "inherit", fontWeight: 600, borderRadius: 4, cursor: "pointer",
                border: "1px solid " + (on ? tiers[0]?.color : T.border),
                background: on ? tiers[0]?.color + "18" : "transparent",
                color: on ? T.textBright : T.textMuted }}>{p.name}</button>
          );
        })}
      </div>

      <Slider label="Hue" value={skin.baseHue} min={0} max={360} suffix="°" onInput={v => set({ baseHue: v })} />
      <Slider label="Line saturation" value={skin.lineSat} min={0} max={100} suffix="%" onInput={v => set({ lineSat: v })} />
      <Slider label="Paper lightness" value={skin.bg.l} min={0} max={100} suffix="%" onInput={v => set({ bg: { ...skin.bg, l: v } })} />
      <Slider label="Paper hue" value={skin.bg.h} min={0} max={360} suffix="°" onInput={v => set({ bg: { ...skin.bg, h: v } })} />

      <div style={{ ...lbl, marginTop: 8 }}>Polarity</div>
      <div style={{ display: "flex", border: "1px solid " + T.border, borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>
        {[["dark-on-light", "dark / light"], ["light-on-dark", "light / dark"]].map(([p, label]) => (
          <button key={p} data-testid={"mono-pol-" + p} onClick={() => set({ pol: p })}
            style={{ flex: 1, padding: "4px 0", fontSize: 9, fontFamily: "inherit", cursor: "pointer", border: "none",
              background: skin.pol === p ? tiers[0]?.color : "transparent",
              color: skin.pol === p ? T.canvas : T.textMuted, fontWeight: skin.pol === p ? 600 : 400 }}>{label}</button>
        ))}
      </div>

      {lowContrast && (
        <div data-testid="mono-contrast-warning" style={{ fontSize: 9, lineHeight: 1.5, padding: 6, marginBottom: 10, borderRadius: 4,
          border: "1px solid " + tiers[0]?.color, color: tiers[0]?.color }}>
          ⚠ T1 and paper are {delta}% apart in lightness. Below {MONO_MIN_CONTRAST}% the primary
          hierarchy stops reading — push them apart or flip polarity.
        </div>
      )}

      <div style={lbl}>Tiers · plan</div>
      {/* Swatches are drawn ON the mono paper (that's the only place tier ink is legible);
          the labels use chrome text, since this panel lives in the app UI. */}
      {tiers.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: T.textDim, width: 14 }}>T{i + 1}</span>
          <svg width="34" height="12" style={{ flexShrink: 0, background: paper, borderRadius: 2 }}>
            <line x1="2" y1="6" x2="32" y2="6" stroke={t.color} strokeWidth={t.w} />
          </svg>
          <span style={{ fontSize: 9, color: T.textMuted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {MONO_PROFILES.plan[i]}
          </span>
        </div>
      ))}
    </div>
  );
}
