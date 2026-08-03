import { useCallback, useRef, useState } from "react";
import { fitTransform, viewportRect } from "../imports/geometry";

const MARGIN = 16;
// Where each corner anchors, given other pane chrome that already claims two of them:
// - "tl" clashes with the pane's own "Plan ▾ 📷" chip (testfit.jsx PaneChip, top:8/left:8,
//   well above this widget's z-index) — that chip sits on the LEFT, so a right-anchored
//   widget never needs `topInset` regardless of top/bottom.
// - "br" clashes with the rotate-view button row (also bottom-right) — that row sits on
//   the RIGHT, so a left-anchored widget never needs `bottomInset` regardless of top/bottom.
// Both insets clear their collision so neither widget ever sits behind the other, unreachable.
const cornerStyle = (corner, topInset, bottomInset) => ({
  bl: { left: MARGIN, bottom: MARGIN },
  br: { right: MARGIN, bottom: MARGIN + bottomInset },
  tl: { left: MARGIN, top: MARGIN + topInset },
  tr: { right: MARGIN, top: MARGIN },
}[corner] || { left: MARGIN, bottom: MARGIN });

// ─── Minimap ─────────────────────────────────────────────────────────────────
// A simplified overview of the whole model with a "you are here" frame, for navigating a
// plan that's larger than the window. Props-only: the caller hands over already-derived
// draw data (see `minimapData` in testfit.jsx), so this file stays free of model knowledge.
//
//   areas    [{ id, points, fill, stroke }]  floor regions + zones — flat blocks
//   segments [{ id, x1, y1, x2, y2, color, demo }]  walls — the structure you navigate by
//   dots     [{ id, x, y, color }]           furniture + IT/MEP — presence, not detail
//   bounds   from contentBounds() — null when there's nothing to show
//   corner   "bl" | "br" | "tl" | "tr" — which corner of the pane it's docked to
//
// Clicking or dragging INSIDE the map re-centres the canvas (onNavigate). Dragging the
// header (or the collapsed pill) instead REPOSITIONS the whole widget — released, it snaps
// to whichever corner of the pane it's nearest to (onCornerChange).
export default function Minimap({
  bounds, areas = [], segments = [], dots = [],
  viewOff, zoom, canvasW, canvasH, canvasRotation = 0,
  onNavigate, onFit, T, font, width = 168, height = 128, collapsed, onToggle,
  corner = "bl", onCornerChange, topInset = 0, bottomInset = 0,
}) {
  const svgRef = useRef(null);
  const shellRef = useRef(null);
  const [navDragging, setNavDragging] = useState(false);       // dragging INSIDE the map → pans the canvas
  const [widgetDragging, setWidgetDragging] = useState(false); // dragging the HEADER → repositions the widget
  const [dragPos, setDragPos] = useState(null);                // {left, top} px, only while widgetDragging

  // Minimap px per content px, plus the centring offset.
  const { s, ox, oy } = fitTransform(bounds, width, height);
  const mx = (x) => x * s + ox;
  const my = (y) => y * s + oy;

  // Pointer → content coords → ask the caller to centre there.
  const navigateTo = useCallback((e) => {
    const el = svgRef.current;
    if (!el || !onNavigate) return;
    const r = el.getBoundingClientRect();
    onNavigate((e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s);
  }, [onNavigate, ox, oy, s]);

  const onDown = useCallback((e) => {
    e.stopPropagation();
    setNavDragging(true);
    navigateTo(e);
  }, [navigateTo]);

  const onMove = useCallback((e) => { if (navDragging) { e.stopPropagation(); navigateTo(e); } }, [navDragging, navigateTo]);
  const stop = useCallback(() => setNavDragging(false), []);

  // Repositioning the WHOLE widget — a separate gesture from navigating inside the map. A
  // press that never moves stays an ordinary click on whatever it started on (Map/Fit);
  // suppressClickRef swallows the click a real drag would otherwise leave behind if the
  // pointer happens to release back over that same button (the collapsed pill has no other
  // surface to grab, so dragging has to start on the button there).
  const suppressClickRef = useRef(false);
  const onHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const el = shellRef.current;
    if (!el || !canvasW || !canvasH) return;
    // Read the CURRENT rendered position via the DOM rather than re-deriving it from
    // `corner` — offsetLeft/Top is correct however the position is currently controlled
    // (left/top for tl/bl, right/bottom for tr/br), so the drag starts with zero jump.
    const startLeft = el.offsetLeft, startTop = el.offsetTop;
    const w = el.offsetWidth, h = el.offsetHeight;
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    let live = { left: startLeft, top: startTop };
    const onMouseMove = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) > 4) { moved = true; setWidgetDragging(true); }
      if (!moved) return;
      live = {
        left: Math.max(4, Math.min(canvasW - w - 4, startLeft + dx)),
        top: Math.max(4, Math.min(canvasH - h - 4, startTop + dy)),
      };
      setDragPos(live);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (moved) {
        suppressClickRef.current = true;
        const cx = live.left + w / 2, cy = live.top + h / 2;
        onCornerChange?.((cy < canvasH / 2 ? "t" : "b") + (cx < canvasW / 2 ? "l" : "r"));
      }
      setWidgetDragging(false);
      setDragPos(null);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [canvasW, canvasH, onCornerChange]);

  // Wrap a button's onClick so a drag that ends back over it doesn't also fire the click.
  const guard = (fn) => () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    fn?.();
  };

  const posStyle = dragPos || cornerStyle(corner, topInset, bottomInset);
  const shell = {
    position: "absolute", ...posStyle, zIndex: 12,
    background: T.panelBg, border: "1px solid " + T.border, borderRadius: 7,
    boxShadow: T.panelShadow, backdropFilter: "blur(12px)", overflow: "hidden",
    fontFamily: font,
    // Snap smoothly into the corner on drop; no transition while actively following the
    // cursor, or the widget would visibly lag behind the pointer.
    transition: widgetDragging ? "none" : "left 0.15s ease, top 0.15s ease, right 0.15s ease, bottom 0.15s ease",
  };
  const headBtn = {
    background: "transparent", border: "none", color: T.textMuted, cursor: "pointer",
    fontFamily: font, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
    fontWeight: 600, padding: "5px 9px", display: "flex", alignItems: "center", gap: 6,
  };

  if (collapsed) {
    return (
      <div ref={shellRef} data-testid="minimap" data-collapsed="true" style={shell}>
        <button data-testid="minimap-toggle" onMouseDown={onHeaderMouseDown} onClick={guard(onToggle)}
          title="Show minimap · drag to move" style={{ ...headBtn, cursor: widgetDragging ? "grabbing" : "pointer" }}>Map</button>
      </div>
    );
  }

  // Where the canvas is looking, in content space.
  const vr = viewportRect(viewOff, zoom, canvasW, canvasH);
  // The canvas element itself is CSS-rotated about its centre, so the region actually on
  // screen is this rect counter-rotated about the content point at the canvas middle.
  const vcx = vr.x + vr.w / 2, vcy = vr.y + vr.h / 2;

  return (
    <div ref={shellRef} data-testid="minimap" data-collapsed="false" style={shell}>
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid " + T.border }}>
        <button data-testid="minimap-toggle" onClick={guard(onToggle)} title="Hide minimap" style={headBtn}>Map</button>
        {/* The blank strip IS the drag handle — a plain div, so it never collides with a
            click target and needs no click-suppression of its own. */}
        <div data-testid="minimap-drag-handle" onMouseDown={onHeaderMouseDown} title="Drag to move"
          style={{ flex: 1, alignSelf: "stretch", cursor: widgetDragging ? "grabbing" : "grab" }} />
        {onFit && (
          <button data-testid="minimap-fit" onClick={guard(onFit)} title="Fit everything (0)"
            style={{ ...headBtn, padding: "5px 9px", letterSpacing: 0, fontSize: 9 }}>Fit</button>
        )}
      </div>
      <svg ref={svgRef} data-testid="minimap-canvas" width={width} height={height}
        style={{ display: "block", background: T.canvas, cursor: navDragging ? "grabbing" : "crosshair" }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={stop} onMouseLeave={stop}>
        {/* Programme + floor blocks first, so walls read on top of them. */}
        {areas.map((a) => (
          <polygon key={a.id} points={a.points.map((p) => `${mx(p.x)},${my(p.y)}`).join(" ")}
            fill={a.fill} stroke={a.stroke || "none"} strokeWidth={0.5} />
        ))}
        {/* Walls carry the structure — one flat weight, since detail is not the point. */}
        {segments.map((w) => (
          <line key={w.id} x1={mx(w.x1)} y1={my(w.y1)} x2={mx(w.x2)} y2={my(w.y2)}
            stroke={w.color} strokeWidth={w.demo ? 0.8 : 1.2}
            strokeDasharray={w.demo ? "2 2" : undefined} strokeLinecap="round" />
        ))}
        {dots.map((d) => <circle key={d.id} cx={mx(d.x)} cy={my(d.y)} r={1.1} fill={d.color} opacity={0.75} />)}

        {/* "You are here". Drawn last and never interactive — clicks belong to the svg. */}
        <g transform={canvasRotation ? `rotate(${-canvasRotation} ${mx(vcx)} ${my(vcy)})` : undefined}
          style={{ pointerEvents: "none" }}>
          <rect data-testid="minimap-viewport"
            x={mx(vr.x)} y={my(vr.y)} width={Math.max(2, vr.w * s)} height={Math.max(2, vr.h * s)}
            fill={T.brand + "1A"} stroke={T.brand} strokeWidth={1} rx={1.5} />
        </g>
      </svg>
    </div>
  );
}
