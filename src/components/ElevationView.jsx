// ─── 2D Elevation view ──────────────────────────────────────────────────────
// Orthographic side projection of the model along one cardinal axis. Read-only
// (view + annotate); geometry editing stays in plan/3D. Each instance owns its
// own pan/zoom camera. Props-only — no main-component state.

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { markerMountYFt } from "../imports/markerMount";
import { dst, polyCentroid } from "../imports/model";
import { revCloudPath } from "../imports/geometry";
import { WALL_KINDS, DOOR_TYPE_STYLES, WINDOW_TYPE_STYLES } from "../constants/theme";
import { SPEC_COMPONENTS, DOOR_HEIGHT_IN, DOOR_KNOB_HEIGHT_IN, SNAP_R, FINISH_COLORS } from "../constants/specs";

// readonly: presentation rendering (Docs slides) — no pan/zoom/annotation interaction.
// fixedRect: {x,y,w,h} in projected u/v units — contain-fit this crop instead of the
// content auto-fit; the camera tracks the rect, not user input.
export default function ElevationView({ dir, nodes, walls, doors, windows, columns, markers = [], ceilingHeight, pxPerFoot, T,
  selectedId, selType, onSelect, ft, tool, cut, scrub, onView, panU, anno, onPlaceDim, onPlaceLabel, onUpdateDim, onUpdateLabel, onDeleteLabel, onPlaceRevCloud, onUpdateRevCloud,
  readonly = false, fixedRect = null, fixedZoom = null }) {
  const svgRef = useRef(null);
  const [cam, setCam] = useState(null); // { tx, ty, z } — null until first auto-fit
  const panRef = useRef(null);
  const dimDraftRef = useRef(null);
  const fittedRef = useRef(null); // last direction we auto-fit, so edits don't reset the camera
  const [dimDraft, setDimDraft] = useState(null); // elevation-space {x1,y1,x2,y2?}
  const [hoverSnap, setHoverSnap] = useState(null); // {x,y,snapped} live snap preview for the dim/label tools
  const [editingLbl, setEditingLbl] = useState(null); // {id, x, y, text} inline label editor; id===null means a new (uncommitted) label
  const [lblDragPrev, setLblDragPrev] = useState(null); // {from, to} screen-space pts while dragging a callout leader
  const [rcDraft, setRcDraft] = useState(null); // {points:[{x,y}]} elevation-space revision cloud being drawn
  useEffect(() => { if (tool !== "revcloud" && rcDraft) setRcDraft(null); }, [tool]); // tool switch abandons the draft
  useEffect(() => {
    if (!rcDraft) return;
    const onKey = (e) => { if (e.key === "Escape") setRcDraft(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rcDraft]);

  // Project a plan point (x,y) to elevation horizontal u + depth d (for painter sort).
  const proj = useCallback((x, y) => {
    switch (dir) {
      case "back":  return { u: -x, d: -y };
      case "left":  return { u: y, d: -x };
      case "right": return { u: -y, d: x };
      default:      return { u: x, d: y }; // front
    }
  }, [dir]);
  const vAt = useCallback((heightIn) => -(heightIn / 12) * pxPerFoot, [pxPerFoot]); // up = negative
  const ceilV = vAt(ceilingHeight);

  const nodeMap = useMemo(() => { const m = new Map(); for (const n of nodes) m.set(n.id, n); return m; }, [nodes]);

  // Build projected, depth-sorted draw list.
  const items = useMemo(() => {
    const out = [];
    const wallProj = []; // projected walls, gathered first so we can occlusion-test against them
    // Section cut from an elevation guide: keep only geometry at or beyond the cut depth
    // (d ≤ cutD), removing everything between the viewer (max d) and the cut so the wall at
    // the cut becomes the visible near face. Plan pos → projected depth via a point on the line.
    const cutPt = cut != null ? ((dir === "left" || dir === "right") ? proj(cut, 0) : proj(0, cut)) : null;
    const cutD = cutPt ? cutPt.d : null;
    const beyondCut = (d) => cutD != null && d > cutD + 1; // d in front of the cut → cropped
    for (const w of walls) {
      const a = nodeMap.get(w.n1), b = nodeMap.get(w.n2); if (!a || !b) continue;
      const pa = proj(a.x, a.y), pb = proj(b.x, b.y);
      const u1 = Math.min(pa.u, pb.u), u2 = Math.max(pa.u, pb.u);
      if (u2 - u1 < 0.5) continue; // wall is edge-on to this elevation — skip sliver
      const d = (pa.d + pb.d) / 2;
      if (beyondCut(d)) continue; // in front of the section cut — cropped away
      const wk = WALL_KINDS[w.kind || "existing"];
      const topIn = w.kind === "pony" ? (w.ponyHeight || 42) : (w.ceilingHeight ?? ceilingHeight);
      wallProj.push({ kind: "wall", id: w.id, u1, u2, top: vAt(topIn), d,
        color: wk.color, dash: wk.dash, demo: w.kind === "demo" });
    }
    // Hidden-surface rule: a true elevation is a straight-on view of a single face. A
    // surface at [u1,u2] reaching up to `top` (negative = up; everything rises from the
    // floor) is hidden when the union of *strictly nearer*, at-least-as-tall opaque walls
    // fully spans its width. This occludes the back wall, interior partitions, a pony wall
    // behind the front wall, and columns/openings tucked behind the near face — so each
    // direction reads as a distinct, non-x-ray face. Walls are gathered first; the union
    // handles a near wall built from several collinear segments.
    const occluded = (u1, u2, top, d) => {
      const ivs = wallProj
        .filter(f => !f.demo && f.d > d + 0.5 && f.top <= top + 0.5)
        .map(f => [f.u1, f.u2]).sort((p, q) => p[0] - q[0]);
      let cursor = u1;
      for (const [a, b] of ivs) {
        if (a > cursor + 0.5) break;        // gap in coverage → visible through it
        cursor = Math.max(cursor, b);
        if (cursor >= u2 - 0.5) return true;
      }
      return cursor >= u2 - 0.5;
    };
    for (const wp of wallProj) { if (!occluded(wp.u1, wp.u2, wp.top, wp.d)) out.push(wp); }
    const opening = (arr, type) => {
      for (const it of arr) {
        // Project the opening's two ends ALONG its host wall (angle in degrees) so it
        // stays on that wall's plane — full width when the wall faces the viewer,
        // collapsing to edge-on (skipped) when the wall is perpendicular to the view.
        const rad = ((it.angle || 0) * Math.PI) / 180;
        const half = ((it.width || 36) / 12) * pxPerFoot / 2;
        const e1 = proj(it.x - Math.cos(rad) * half, it.y - Math.sin(rad) * half);
        const e2 = proj(it.x + Math.cos(rad) * half, it.y + Math.sin(rad) * half);
        if (Math.abs(e2.u - e1.u) < 1) continue; // edge-on to this elevation — its wall isn't shown here
        const d = (e1.d + e2.d) / 2, u1 = Math.min(e1.u, e2.u), u2 = Math.max(e1.u, e2.u);
        if (beyondCut(d)) continue; // in front of the section cut — cropped away
        const top = type === "window" ? vAt((it.sill ?? 30) + (it.height ?? 48)) : vAt(DOOR_HEIGHT_IN);
        if (occluded(u1, u2, top, d)) continue; // behind a nearer wall — hidden
        // Doors: keep the hinge end's projected u so the knob can render latch-side.
        // (Plan hinge sits at the +half end when hingeRight — see DoorSvg's hingeSide.)
        const hingeU = type === "door" ? (it.hingeRight ? e2.u : e1.u) : undefined;
        out.push({ kind: type, id: it.id, u1, u2, d, item: it, hingeU });
      }
    };
    opening(doors, "door");
    opening(windows, "window");
    for (const c of columns) {
      const p = proj(c.x, c.y);
      if (beyondCut(p.d)) continue; // in front of the section cut — cropped away
      const halfW = ((c.size || 12) / 12) * pxPerFoot / 2;
      if (occluded(p.u - halfW, p.u + halfW, ceilV, p.d)) continue; // behind the near face — hidden
      out.push({ kind: "column", id: c.id, u1: p.u - halfW, u2: p.u + halfW, d: p.d, top: ceilV });
    }
    // IT/MEP markers, placed at their mounting height (AFF). Pushed last so they draw on top
    // of the wall they're mounted on; same cut + occlusion rules as everything else.
    const ceilFt = ceilingHeight / 12;
    const mHalf = 0.35 * pxPerFoot;        // symbol footprint for occlusion
    const mDepthTol = 0.5 * pxPerFoot;     // treat a marker as "on" the nearest wall within ~½'
    for (const m of markers) {
      const p = proj(m.x, m.y);
      if (beyondCut(p.d)) continue; // in front of the section cut — cropped away
      const v = vAt(markerMountYFt(m.componentType, ceilFt) * 12); // center height (elevation up)
      // Hidden only if a wall is nearer by more than the tolerance (so a marker mounted on
      // the near face isn't culled by its own wall, but far-wall items stay hidden).
      if (occluded(p.u - mHalf, p.u + mHalf, v, p.d + mDepthTol)) continue;
      out.push({ kind: "marker", id: m.id, u: p.u, v, d: p.d, item: m });
    }
    return out.sort((m, n) => m.d - n.d); // far → near
  }, [walls, doors, windows, columns, markers, nodeMap, proj, vAt, ceilingHeight, ceilV, pxPerFoot, cut, dir]);

  // Content bounds (pre-camera) for auto-fit.
  const bounds = useMemo(() => {
    let uMin = Infinity, uMax = -Infinity;
    for (const it of items) {
      const a = it.u1 ?? it.u, b = it.u2 ?? it.u; // markers carry `u` (point), others u1/u2
      if (a == null) continue;
      uMin = Math.min(uMin, a); uMax = Math.max(uMax, b);
    }
    if (!isFinite(uMin)) { uMin = -100; uMax = 100; }
    return { uMin, uMax, vTop: ceilV, vBot: 0 };
  }, [items, ceilV]);

  // Auto-fit the camera once per (direction + cut) — so editing geometry doesn't reset the
  // user's pan/zoom, but changing the elevation's section cut reframes to the cropped face.
  // Retries across bounds changes only until the first successful fit for this key.
  const fitKey = `${dir}:${cut ?? ""}`;
  useEffect(() => {
    if (fixedRect) return; // slide crop drives the camera (effect below)
    if (scrub) return; // suspended while scrubbing — the cursor drives the camera (below)
    if (fittedRef.current === fitKey) return;
    const el = svgRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const m = 48;
    const cw = (bounds.uMax - bounds.uMin) || 200, ch = (bounds.vBot - bounds.vTop) || 200;
    const z = Math.min((r.width - 2 * m) / cw, (r.height - 2 * m) / ch, 4);
    const cx = (bounds.uMin + bounds.uMax) / 2, cy = (bounds.vTop + bounds.vBot) / 2;
    setCam({ z, tx: r.width / 2 - cx * z, ty: r.height / 2 - cy * z });
    fittedRef.current = fitKey;
  }, [fitKey, scrub, bounds.uMin, bounds.uMax, bounds.vTop, bounds.vBot]);

  // Slide crop camera: contain-fit fixedRect into the layout box. clientWidth/Height are
  // used (not getBoundingClientRect) because Docs sheets are CSS-scaled — layout size is
  // the SVG's logical coordinate space; the transform scales the result visually.
  const rectKey = fixedRect ? [fixedRect.x, fixedRect.y, fixedRect.w, fixedRect.h, fixedZoom].join(",") : null;
  useEffect(() => {
    if (!fixedRect) return;
    const el = svgRef.current; if (!el) return;
    const W = el.clientWidth || 400, H = el.clientHeight || 300;
    const pad = 8;
    // fixedZoom (Docs standard-scale rendering) wins over the contain-fit.
    const z = fixedZoom ?? Math.max(0.01, Math.min((W - pad * 2) / (fixedRect.w || 200), (H - pad * 2) / (fixedRect.h || 200), 20));
    const cx = fixedRect.x + fixedRect.w / 2, cy = fixedRect.y + fixedRect.h / 2;
    setCam({ z, tx: W / 2 - cx * z, ty: H / 2 - cy * z });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rectKey]);

  // While a section guide is being dragged, the cursor's position along the plan is the
  // elevation's camera: pan horizontally so the point under the cursor is centered (keeping
  // the current zoom). Lets you scrub along the wall as you place/move the cut.
  useEffect(() => {
    if (!scrub) return;
    const el = svgRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const u = proj(scrub.x, scrub.y).u;
    setCam(c => { const cc = c || { z: 1, tx: 0, ty: 0 }; return { ...cc, tx: r.width / 2 - u * cc.z }; });
    // On scrub end, force a re-fit so releasing always reframes the final cut (even after a
    // horizontal drag where the cut depth — and thus fitKey — didn't change).
    return () => { fittedRef.current = null; };
  }, [scrub, proj]);

  // Pan to a target u when the camera marker is dragged along the ruler. Doesn't touch the
  // fit guard, so the pan persists (no snap-back) until the cut changes.
  useEffect(() => {
    if (panU == null) return;
    const el = svgRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    setCam(c => { const cc = c || { z: 1, tx: 0, ty: 0 }; return { ...cc, tx: r.width / 2 - panU * cc.z }; });
  }, [panU]);

  // Report the camera's visible extent (in projected u/v units) up to the plan: u drives
  // the "camera" marker on the matching edge ruler; the full u/v rect is what the Docs
  // stage captures when saving this view as a slide.
  useEffect(() => {
    if (!onView) return;
    const el = svgRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const c = cam || { tx: 0, ty: 0, z: 1 };
    onView(dir, {
      uMin: (0 - c.tx) / c.z, uMax: (r.width - c.tx) / c.z, uCenter: (r.width / 2 - c.tx) / c.z,
      vMin: (0 - c.ty) / c.z, vMax: (r.height - c.ty) / c.z,
    });
  }, [cam, dir, onView]);

  const cm = cam || { tx: 0, ty: 0, z: 1 };
  // screen <-> elevation conversions
  const toScreen = (u, v) => ({ x: u * cm.z + cm.tx, y: v * cm.z + cm.ty });
  const toElev = (sx, sy) => ({ x: (sx - cm.tx) / cm.z, y: (sy - cm.ty) / cm.z });
  const svgPt = (e) => { const r = svgRef.current.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; };

  // Object nodes the dim/label tools snap to — corners + edge-midpoints of every drawn item,
  // plus marker centers, in elevation (u,v) space. Mirrors the plan dim tool's node snapping.
  const snapPts = useMemo(() => {
    const pts = [];
    for (const it of items) {
      if (it.kind === "marker") { pts.push({ u: it.u, v: it.v }); continue; }
      let vb, vt;
      if (it.kind === "wall" || it.kind === "column") { vb = 0; vt = it.top; }
      else if (it.kind === "window") { const s = it.item.sill ?? 30, h = it.item.height ?? 48; vb = vAt(s); vt = vAt(s + h); }
      else if (it.kind === "door") { vb = 0; vt = vAt(DOOR_HEIGHT_IN); }
      else continue;
      const um = (it.u1 + it.u2) / 2, vm = (vb + vt) / 2;
      pts.push({ u: it.u1, v: vb }, { u: it.u2, v: vb }, { u: it.u1, v: vt }, { u: it.u2, v: vt },
               { u: um, v: vb }, { u: um, v: vt }, { u: it.u1, v: vm }, { u: it.u2, v: vm });
    }
    return pts;
  }, [items, vAt]);

  // Snap an elevation point to the nearest item node within ~SNAP_R screen px, else to the
  // floor/ceiling datum line (height only). Returns { x, y, snapped }.
  const snapElev = (p) => {
    const thresh = SNAP_R / cm.z;
    let best = null, bd = thresh;
    for (const s of snapPts) { const d = Math.hypot(p.x - s.u, p.y - s.v); if (d < bd) { best = s; bd = d; } }
    if (best) return { x: best.u, y: best.v, snapped: true };
    if (Math.abs(p.y) < thresh) return { x: p.x, y: 0, snapped: true };          // finished floor
    if (Math.abs(p.y - ceilV) < thresh) return { x: p.x, y: ceilV, snapped: true }; // ceiling
    return { x: p.x, y: p.y, snapped: false };
  };

  // Horizontal/vertical edge lines (with their spans) the Shift axis-lock snaps the dimension
  // onto — every wall/window/door/column edge, plus the floor & ceiling datums.
  const snapLines = useMemo(() => {
    const h = [{ v: 0, uMin: -Infinity, uMax: Infinity }, { v: ceilV, uMin: -Infinity, uMax: Infinity }];
    const v = [];
    for (const it of items) {
      if (it.kind === "marker") continue;
      let vb, vt;
      if (it.kind === "wall" || it.kind === "column") { vb = 0; vt = it.top; }
      else if (it.kind === "window") { const s = it.item.sill ?? 30, hh = it.item.height ?? 48; vb = vAt(s); vt = vAt(s + hh); }
      else if (it.kind === "door") { vb = 0; vt = vAt(DOOR_HEIGHT_IN); }
      else continue;
      const uMin = Math.min(it.u1, it.u2), uMax = Math.max(it.u1, it.u2);
      const vMin = Math.min(vb, vt), vMax = Math.max(vb, vt);
      h.push({ v: vt, uMin, uMax });                                  // top / head
      if (it.kind === "window") h.push({ v: vb, uMin, uMax });        // sill
      v.push({ u: it.u1, vMin, vMax }, { u: it.u2, vMin, vMax });     // left / right edges
    }
    return { h, v };
  }, [items, vAt, ceilV]);

  // Shift held while placing the 2nd point: lock to the dominant axis from p1, then snap the
  // free coordinate onto any object edge the locked line actually crosses.
  const axisSnap = (raw, p1) => {
    const thresh = SNAP_R / cm.z;
    if (Math.abs(raw.x - p1.x) >= Math.abs(raw.y - p1.y)) { // horizontal lock (v = p1.y)
      let bx = raw.x, bd = thresh, hit = false;
      for (const L of snapLines.v) { if (p1.y >= L.vMin - 1 && p1.y <= L.vMax + 1) { const d = Math.abs(raw.x - L.u); if (d < bd) { bx = L.u; bd = d; hit = true; } } }
      return { x: bx, y: p1.y, snapped: hit, axis: "h" };
    }
    let by = raw.y, bd = thresh, hit = false;                // vertical lock (u = p1.x)
    for (const L of snapLines.h) { if (p1.x >= L.uMin - 1 && p1.x <= L.uMax + 1) { const d = Math.abs(raw.y - L.v); if (d < bd) { by = L.v; bd = d; hit = true; } } }
    return { x: p1.x, y: by, snapped: hit, axis: "v" };
  };

  const onBgMove = (e) => {
    if (tool !== "dim" && tool !== "label" && tool !== "revcloud") { if (hoverSnap) setHoverSnap(null); return; }
    const { sx, sy } = svgPt(e);
    const raw = toElev(sx, sy);
    const dd = dimDraftRef.current;
    // Shift axis-locks the 2nd point onto crossed edges; otherwise normal node snapping.
    const sp = (tool === "dim" && e.shiftKey && dd && !("x2" in dd)) ? axisSnap(raw, { x: dd.x1, y: dd.y1 }) : snapElev(raw);
    setHoverSnap({ ...sp, rx: raw.x, ry: raw.y }); // rx/ry = un-snapped cursor for the offset pull
  };

  const onWheel = (e) => {
    e.preventDefault();
    const { sx, sy } = svgPt(e);
    const factor = 1 - e.deltaY * 0.001; // match the plan canvas's delta-proportional zoom speed
    setCam(c => { const cc = c || cm; const z2 = Math.min(10, Math.max(0.05, cc.z * factor));
      const ux = (sx - cc.tx) / cc.z, uy = (sy - cc.ty) / cc.z;
      return { z: z2, tx: sx - ux * z2, ty: sy - uy * z2 }; });
  };

  const onBgDown = (e) => {
    const { sx, sy } = svgPt(e);
    if (tool === "revcloud") {
      // Click-to-place polygon, same as the plan: ≥3 points + a click back near the first
      // point closes the cloud. Escape (or switching tools) abandons the draft.
      const p = snapElev(toElev(sx, sy));
      if (!rcDraft) { setRcDraft({ points: [{ x: p.x, y: p.y }] }); return; }
      const pts = rcDraft.points;
      const closeThresh = (SNAP_R * 1.5) / cm.z; // screen px → elevation units
      if (pts.length >= 3 && dst(p.x, p.y, pts[0].x, pts[0].y) < closeThresh) {
        onPlaceRevCloud?.(pts);
        setRcDraft(null);
      } else if (dst(p.x, p.y, pts[pts.length - 1].x, pts[pts.length - 1].y) > 4 / cm.z) {
        setRcDraft({ points: [...pts, { x: p.x, y: p.y }] });
      }
      return;
    }
    if (tool === "dim" || tool === "label") {
      const raw = toElev(sx, sy);
      const p = snapElev(raw); // snap the measured points to object nodes, like the 2D dim tool
      if (tool === "label") {
        // Open the editor on mouse-UP, not down: focusing the textarea while the button is
        // still pressed lets the browser steal focus back on release, which fires onBlur and
        // instantly commits-and-closes the empty editor. Opening after release (like the
        // plan's onUp label flow) lets autoFocus stick. The label isn't created until text is
        // committed, so abandoning it (Esc / empty blur) leaves nothing behind.
        // Drag (press → release apart) draws a leader: the press point is the leader tip, the
        // release point is the label box — same as the plan's click-and-drag callout.
        const down = { cx: e.clientX, cy: e.clientY };
        const tipScreen = toScreen(p.x, p.y);
        const move = (ev) => {
          const s = svgPt(ev);
          setLblDragPrev({ from: tipScreen, to: { x: s.sx, y: s.sy } });
        };
        const open = (ev) => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", open);
          setLblDragPrev(null);
          const upS = svgPt(ev), upP = snapElev(toElev(upS.sx, upS.sy));
          const isLeader = Math.hypot(ev.clientX - down.cx, ev.clientY - down.cy) > 8;
          setEditingLbl(isLeader
            ? { id: null, x: upP.x, y: upP.y, lx: p.x, ly: p.y, text: "" }
            : { id: null, x: p.x, y: p.y, lx: null, ly: null, text: "" });
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", open);
        return;
      }
      // dim: 3-click (point, point, then pull the dim line away to set its offset) — like 2D
      const dd = dimDraftRef.current;
      if (!dd) {
        dimDraftRef.current = { x1: p.x, y1: p.y }; setDimDraft({ x1: p.x, y1: p.y });
      } else if (!("x2" in dd)) {
        // Shift locks the axis from p1 and snaps onto any edge the locked line crosses.
        const sp = (tool === "dim" && e.shiftKey) ? axisSnap(raw, { x: dd.x1, y: dd.y1 }) : p;
        if (Math.hypot(sp.x - dd.x1, sp.y - dd.y1) < 4) return; // ignore a tiny second click
        dimDraftRef.current = { ...dd, x2: sp.x, y2: sp.y }; setDimDraft({ ...dd, x2: sp.x, y2: sp.y });
      } else {
        const ddx = dd.x2 - dd.x1, ddy = dd.y2 - dd.y1, dlen = Math.hypot(ddx, ddy);
        if (dlen < 1) { dimDraftRef.current = null; setDimDraft(null); return; }
        const nnx = -ddy / dlen, nny = ddx / dlen; // perpendicular
        const off = (raw.x - dd.x1) * nnx + (raw.y - dd.y1) * nny; // signed pull distance (un-snapped)
        onPlaceDim?.({ x1: dd.x1, y1: dd.y1, x2: dd.x2, y2: dd.y2, offset: off });
        dimDraftRef.current = null; setDimDraft(null);
      }
      return;
    }
    // pan
    panRef.current = { startX: e.clientX, startY: e.clientY, tx: cm.tx, ty: cm.ty };
    const move = (ev) => setCam(c => ({ ...(c || cm), tx: panRef.current.tx + (ev.clientX - panRef.current.startX), ty: panRef.current.ty + (ev.clientY - panRef.current.startY) }));
    const up = () => { panRef.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  const sel = (id, type) => (e) => { if (tool !== "select") return; e.stopPropagation(); onSelect?.(id, type); };
  const isSel = (id, type) => selectedId === id && selType === type;

  // Drag an existing annotation (elevation space). part: "p1"/"p2"/"line" for dims, "move" for labels.
  const startAnnoDrag = (kind, id, part, e) => {
    if (tool !== "select") return; // dim/label tools place new ones; only Select drags
    e.stopPropagation();
    onSelect?.(id, kind === "dim" ? "elevDim" : kind === "revcloud" ? "elevRevCloud" : "elevLabel");
    const s0 = svgPt(e), e0 = toElev(s0.sx, s0.sy);
    const src = kind === "dim" ? (anno?.dims || []).find(x => x.id === id)
      : kind === "revcloud" ? (anno?.revClouds || []).find(x => x.id === id)
      : (anno?.labels || []).find(x => x.id === id);
    if (!src) return;
    const move = (ev) => {
      const p = svgPt(ev), cur = toElev(p.sx, p.sy);
      const dx = cur.x - e0.x, dy = cur.y - e0.y;
      if (kind === "revcloud") { onUpdateRevCloud?.(id, { points: src.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }); return; }
      if (kind === "label") {
        if (part === "tip") onUpdateLabel?.(id, { lx: (src.lx ?? src.x) + dx, ly: (src.ly ?? src.y) + dy });
        else onUpdateLabel?.(id, { x: src.x + dx, y: src.y + dy }); // box moves; leader tip stays anchored
        return;
      }
      if (part === "p1") onUpdateDim?.(id, { x1: src.x1 + dx, y1: src.y1 + dy });
      else if (part === "p2") onUpdateDim?.(id, { x2: src.x2 + dx, y2: src.y2 + dy });
      else {
        // Dragging the dim line pulls the measurement away from the placed points (offset).
        const ddx = src.x2 - src.x1, ddy = src.y2 - src.y1, dl = Math.hypot(ddx, ddy) || 1;
        const nnx = -ddy / dl, nny = ddx / dl;
        onUpdateDim?.(id, { offset: (cur.x - src.x1) * nnx + (cur.y - src.y1) * nny });
      }
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  // Screen-space geometry for an offset dimension string (elevation-space d {x1,y1,x2,y2,offset}).
  // Mirrors the 2D DimString: extension lines, offset dim line, diagonal ticks, rotated label.
  const elevDimGeom = (d) => {
    const a1 = toScreen(d.x1, d.y1), a2 = toScreen(d.x2, d.y2);
    const sdx = a2.x - a1.x, sdy = a2.y - a1.y, slen = Math.hypot(sdx, sdy) || 1;
    const sux = sdx / slen, suy = sdy / slen, snx = -suy, sny = sux;
    const soff = (d.offset || 0) * cm.z, sign = soff >= 0 ? 1 : -1, aoff = Math.abs(soff);
    const gap = 4, over = 6, tk = 5;
    let ang = Math.atan2(sdy, sdx) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    return {
      a1, a2, tk,
      dl1: { x: a1.x + snx * soff, y: a1.y + sny * soff }, dl2: { x: a2.x + snx * soff, y: a2.y + sny * soff },
      e1s: { x: a1.x + snx * sign * gap, y: a1.y + sny * sign * gap }, e1e: { x: a1.x + snx * sign * (aoff + over), y: a1.y + sny * sign * (aoff + over) },
      e2s: { x: a2.x + snx * sign * gap, y: a2.y + sny * sign * gap }, e2e: { x: a2.x + snx * sign * (aoff + over), y: a2.y + sny * sign * (aoff + over) },
      diagX: (sux + snx * sign) / Math.SQRT2, diagY: (suy + sny * sign) / Math.SQRT2,
      mid: { x: (a1.x + a2.x) / 2 + snx * soff, y: (a1.y + a2.y) / 2 + sny * soff },
      label: ft(Math.hypot(d.x2 - d.x1, d.y2 - d.y1)), ang, slen,
    };
  };
  const ElevDimVisual = ({ g, col, sw }) => (<g style={{ pointerEvents: "none" }}>
    <line x1={g.e1s.x} y1={g.e1s.y} x2={g.e1e.x} y2={g.e1e.y} stroke={col} strokeWidth={sw} />
    <line x1={g.e2s.x} y1={g.e2s.y} x2={g.e2e.x} y2={g.e2e.y} stroke={col} strokeWidth={sw} />
    <line x1={g.dl1.x} y1={g.dl1.y} x2={g.dl2.x} y2={g.dl2.y} stroke={col} strokeWidth={sw} />
    <line x1={g.dl1.x - g.diagX * g.tk} y1={g.dl1.y - g.diagY * g.tk} x2={g.dl1.x + g.diagX * g.tk} y2={g.dl1.y + g.diagY * g.tk} stroke={col} strokeWidth={sw + 0.25} />
    <line x1={g.dl2.x - g.diagX * g.tk} y1={g.dl2.y - g.diagY * g.tk} x2={g.dl2.x + g.diagX * g.tk} y2={g.dl2.y + g.diagY * g.tk} stroke={col} strokeWidth={sw + 0.25} />
    <rect x={g.mid.x - (g.label.length * 3 + 4)} y={g.mid.y - 7} width={g.label.length * 6 + 8} height={14} fill={T.canvas} transform={`rotate(${g.ang},${g.mid.x},${g.mid.y})`} />
    <text x={g.mid.x} y={g.mid.y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={col} fontFamily="inherit" fontWeight={600} transform={`rotate(${g.ang},${g.mid.x},${g.mid.y})`}>{g.label}</text>
  </g>);

  // Datum lines in screen space (full pane width)
  const floorY = toScreen(0, 0).y, ceilY = toScreen(0, ceilV).y;
  const annoDims = anno?.dims || [], annoLabels = anno?.labels || [];

  // Inline label editor commit/cancel (window.prompt is blocked in embedded browsers).
  // editingLbl.id === null → a brand-new label (created only if text is committed); a real
  // id → editing an existing label (empty commit deletes it, matching the plan).
  const commitLblEdit = () => {
    if (!editingLbl) return;
    const { id, x, y, lx, ly, text } = editingLbl;
    const t = text.trim();
    if (id == null) { if (t) onPlaceLabel?.({ x, y, lx, ly, text: t }); }   // new: create only if non-empty
    else if (t) onUpdateLabel?.(id, { text: t });
    else onDeleteLabel?.(id);                                       // existing emptied → remove
    setEditingLbl(null);
  };
  const cancelLblEdit = () => setEditingLbl(null); // nothing created/changed yet

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <svg ref={svgRef} width="100%" height="100%"
      onMouseDown={readonly ? undefined : onBgDown} onMouseMove={readonly ? undefined : onBgMove}
      onMouseLeave={readonly ? undefined : () => hoverSnap && setHoverSnap(null)} onWheel={readonly ? undefined : onWheel}
      style={{ display: "block", background: T.canvas, cursor: (tool === "dim" || tool === "label") ? "crosshair" : "grab" }}>
      {/* Floor + ceiling datum lines */}
      <line x1={0} y1={floorY} x2="100%" y2={floorY} stroke={T.textMuted} strokeWidth={1} opacity={0.6} />
      <line x1={0} y1={ceilY} x2="100%" y2={ceilY} stroke={T.textMuted} strokeWidth={0.75} strokeDasharray="5 4" opacity={0.4} />
      <text x={6} y={floorY - 4} fontSize={9} fill={T.textMuted} fontFamily="inherit">FIN. FLOOR 0'-0"</text>
      <text x={6} y={ceilY - 4} fontSize={9} fill={T.textMuted} fontFamily="inherit">CEILING {ft((ceilingHeight / 12) * pxPerFoot)}</text>

      {items.map((it, i) => {
        if (it.kind === "wall") {
          const a = toScreen(it.u1, 0), b = toScreen(it.u2, it.top);
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(a.y - b.y);
          const on = isSel(it.id, "wall");
          return <rect key={"w" + it.id + i} x={x} y={y} width={w} height={h}
            fill={it.demo ? "none" : it.color + "55"} stroke={on ? T.accent : it.color}
            strokeWidth={on ? 2 : 1} strokeDasharray={it.dash || "none"}
            onClick={sel(it.id, "wall")} style={{ cursor: "pointer" }} />;
        }
        if (it.kind === "window") {
          const sill = it.item.sill ?? 30, hgt = it.item.height ?? 48;
          const a = toScreen(it.u1, vAt(sill)), b = toScreen(it.u2, vAt(sill + hgt));
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(a.y - b.y);
          const on = isSel(it.id, "window");
          const wst = WINDOW_TYPE_STYLES[it.item.type] || WINDOW_TYPE_STYLES.Window;
          return <g key={"win" + it.id + i} onClick={sel(it.id, "window")} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width={w} height={h} fill={wst.fill ?? "transparent"}
              stroke={on ? T.accent : wst.stroke} strokeWidth={on ? 2 : 1.2} strokeDasharray={wst.dash || "none"} />
            {wst.glassTick && <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={wst.stroke} strokeWidth={0.6} opacity={0.6} style={{ pointerEvents: "none" }} />}
          </g>;
        }
        if (it.kind === "door") {
          const a = toScreen(it.u1, 0), b = toScreen(it.u2, vAt(DOOR_HEIGHT_IN));
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(a.y - b.y);
          const on = isSel(it.id, "door");
          const st = DOOR_TYPE_STYLES[it.item.doorType] || DOOR_TYPE_STYLES.Wood;
          const stroke = on ? T.accent : st.elev.stroke;
          return <g key={"d" + it.id + i} onClick={sel(it.id, "door")} style={{ cursor: "pointer" }}>
            <rect x={x} y={y} width={w} height={h} fill={st.elev.fill ?? "transparent"}
              stroke={stroke} strokeWidth={on ? 2 : 1.2} strokeDasharray={st.elev.dash || "none"} />
            {/* Wood: classic 2-panel symbol; guards keep zoomed-out doors clean */}
            {st.elev.panels && w > 10 && h > 24 && <g style={{ pointerEvents: "none" }}>
              <rect x={x + w * 0.18} y={y + h * 0.10} width={w * 0.64} height={h * 0.34} fill="none" stroke={stroke} strokeWidth={0.8} opacity={0.65} />
              <rect x={x + w * 0.18} y={y + h * 0.52} width={w * 0.64} height={h * 0.38} fill="none" stroke={stroke} strokeWidth={0.8} opacity={0.65} />
            </g>}
            {/* Glass: narrow frame + full glazed lite, same glass language as windows */}
            {st.elev.lite === "full" && w > 8 && h > 16 && (() => {
              const fx = x + w * 0.10, fy = y + h * 0.06, fw = w * 0.80, fh = h * 0.88;
              return <g style={{ pointerEvents: "none" }}>
                <rect x={fx} y={fy} width={fw} height={fh} fill="#7FB4D633" stroke="#60A0C8" strokeWidth={0.8} />
                <line x1={fx} y1={fy} x2={fx + fw} y2={fy + fh} stroke="#60A0C8" strokeWidth={0.6} opacity={0.6} />
              </g>;
            })()}
            {/* Metal: small vision lite in the upper third */}
            {st.elev.lite === "vision" && w > 14 && h > 30 &&
              <rect x={x + w * 0.32} y={y + h * 0.12} width={w * 0.36} height={h * 0.20}
                fill="#7FB4D633" stroke="#60A0C8" strokeWidth={0.7} style={{ pointerEvents: "none" }} />}
            {/* Knob dot, latch side (opposite the hinge) at knob height */}
            {st.elev.knob && w > 8 && h > 16 && (() => {
              const hingeLeft = it.hingeU != null && Math.abs(it.hingeU - it.u1) < Math.abs(it.hingeU - it.u2);
              const kx = hingeLeft ? x + w * 0.88 : x + w * 0.12;
              const ky = toScreen(0, vAt(DOOR_KNOB_HEIGHT_IN)).y;
              return <circle cx={kx} cy={ky} r={Math.max(1.8, w * 0.045)} fill={stroke} opacity={0.9} style={{ pointerEvents: "none" }} />;
            })()}
            {/* Access reader (Openpath) on the jamb at ~44" AFF */}
            {it.item.accessControl && (() => {
              const hingeLeft = it.hingeU != null && Math.abs(it.hingeU - it.u1) < Math.abs(it.hingeU - it.u2);
              const onLeft = (it.item.accessSide === "hinge") ? hingeLeft : !hingeLeft;
              const rw = Math.max(2.5, w * 0.1), rh = Math.max(8, 0.5 * pxPerFoot * cm.z);
              const rx = onLeft ? x - rw - 2 : x + w + 2;
              const ry = toScreen(0, vAt(44)).y - rh / 2;
              return <g style={{ pointerEvents: "none" }}>
                <rect x={rx} y={ry} width={rw} height={rh} rx={1.5} fill="#ECEAE3" stroke={on ? T.accent : "#8A8478"} strokeWidth={1} />
                <rect x={rx + rw * 0.25} y={ry + rh * 0.12} width={rw * 0.5} height={rh * 0.3} rx={1} fill="#3FC8E8" />
              </g>;
            })()}
          </g>;
        }
        if (it.kind === "marker") {
          const m = it.item;
          const spec = SPEC_COMPONENTS[m.layer]?.[m.componentType];
          const sym = spec?.symbol, letter = spec?.letter;
          const baseColor = spec?.color || "#9A9488";
          const a = toScreen(it.u, it.v);
          const r = Math.max(3, 0.35 * pxPerFoot * cm.z); // ~0.7' symbol, min 3px
          const on = isSel(it.id, "marker");
          const fin = m.finish && FINISH_COLORS[m.finish];
          const fillC = fin ? fin.fill : baseColor;
          const lineC = on ? T.accent : (fin ? fin.line : baseColor);
          const sw = on ? 2 : 1.2;
          // Recognizable silhouettes by symbol family.
          const rectSyms = new Set(["speaker", "sub", "rack", "panel", "switch", "outlet", "surf", "tstat", "water", "linear_lt", "rect", "speaker_drop", "plate"]);
          const domeSyms = new Set(["camera", "floodlight"]);
          let glyph;
          if (sym === "router") {
            const dy = a.y + r * 0.5;
            const arc = (R) => { let p = ""; for (let k = 0; k <= 8; k++) { const th = (220 + 12.5 * k) * Math.PI / 180; p += (k ? " L " : "M ") + (a.x + R * Math.cos(th)).toFixed(1) + " " + (dy + R * Math.sin(th)).toFixed(1); } return p; };
            glyph = <>
              <circle cx={a.x} cy={a.y} r={r} fill={fillC} stroke={lineC} strokeWidth={sw} />
              {[r * 0.42, r * 0.72, r * 1.02].map((R, i) => <path key={i} d={arc(R)} fill="none" stroke={lineC} strokeWidth={1} strokeLinecap="round" />)}
              <circle cx={a.x} cy={dy} r={1.5} fill={lineC} />
            </>;
          } else if (domeSyms.has(sym)) {
            glyph = <>
              <path d={`M ${a.x - r} ${a.y + r} L ${a.x - r} ${a.y - r * 0.2} Q ${a.x - r} ${a.y - r} ${a.x} ${a.y - r} Q ${a.x + r} ${a.y - r} ${a.x + r} ${a.y - r * 0.2} L ${a.x + r} ${a.y + r} Z`}
                fill={fillC} stroke={lineC} strokeWidth={sw} />
              <circle cx={a.x} cy={a.y + r * 0.1} r={r * 0.34} fill="#141414" stroke={lineC} strokeWidth={0.6} />
            </>;
          } else if (rectSyms.has(sym)) {
            glyph = <><rect x={a.x - r} y={a.y - r} width={r * 2} height={r * 2} rx={1.5} fill={fillC} stroke={lineC} strokeWidth={sw} />
              {letter && <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" fontSize={r} fill={fin ? fin.line : "#fff"} fontFamily="inherit" fontWeight={700} style={{ pointerEvents: "none" }}>{letter}</text>}</>;
          } else {
            glyph = <><circle cx={a.x} cy={a.y} r={r} fill={fin ? fillC : baseColor + "cc"} stroke={lineC} strokeWidth={sw} />
              {letter && <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" fontSize={r} fill={fin ? fin.line : "#fff"} fontFamily="inherit" fontWeight={700} style={{ pointerEvents: "none" }}>{letter}</text>}</>;
          }
          return <g key={"mk" + it.id + i} onClick={sel(it.id, "marker")} style={{ cursor: "pointer" }}>{glyph}</g>;
        }
        // column
        const a = toScreen(it.u1, 0), b = toScreen(it.u2, it.top);
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(a.y - b.y);
        const on = isSel(it.id, "column");
        return <rect key={"c" + it.id + i} x={x} y={y} width={w} height={h}
          fill={T.nodeStroke + "66"} stroke={on ? T.accent : "#9A9488"} strokeWidth={on ? 2 : 1}
          onClick={sel(it.id, "column")} style={{ cursor: "pointer" }} />;
      })}

      {/* Annotations (elevation space) — selectable + draggable with the Select tool */}
      {annoDims.map(d => {
        if (![d.x1, d.y1, d.x2, d.y2].every(Number.isFinite)) return null; // skip malformed/legacy dims
        const g = elevDimGeom(d);
        const on = isSel(d.id, "elevDim");
        const interactive = tool === "select";
        return <g key={d.id}>
          {/* wide transparent hit line along the dim line — grab to pull the offset */}
          <line x1={g.dl1.x} y1={g.dl1.y} x2={g.dl2.x} y2={g.dl2.y} stroke="transparent" strokeWidth={12}
            onMouseDown={e => startAnnoDrag("dim", d.id, "line", e)}
            style={{ cursor: interactive ? "move" : "inherit", pointerEvents: interactive ? "stroke" : "none" }} />
          <ElevDimVisual g={g} col={on ? T.accent : T.dimText} sw={on ? 1.6 : 1} />
          {on && interactive && [["p1", g.a1], ["p2", g.a2]].map(([part, p]) => (
            <circle key={part} cx={p.x} cy={p.y} r={5} fill={T.accent} stroke={T.nodeFill} strokeWidth={1.5}
              onMouseDown={e => startAnnoDrag("dim", d.id, part, e)} style={{ cursor: "move" }} />
          ))}
        </g>;
      })}
      {/* Revision clouds (elevation annotations) — scalloped path computed in screen space */}
      {(anno?.revClouds || []).map(rc => {
        const spts = rc.points.map(pt => toScreen(pt.x, pt.y));
        const d = revCloudPath(spts, (rc.arcR ?? 8) * cm.z);
        const on = isSel(rc.id, "elevRevCloud");
        const interactive = tool === "select";
        const c = polyCentroid(spts);
        return <g key={rc.id} style={{ cursor: interactive ? "move" : "inherit", pointerEvents: interactive ? "auto" : "none" }}
          onMouseDown={e => startAnnoDrag("revcloud", rc.id, "move", e)}>
          <path d={d} fill={rc.color + "18"} stroke={rc.color} strokeWidth={on ? 2 : 1.5}
            strokeLinejoin="round" strokeLinecap="round" />
          {on && <path d={d} fill="none" stroke={rc.color} strokeWidth={5} opacity={0.15} style={{ pointerEvents: "none" }} />}
          {rc.label && <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill={rc.color} fontFamily="inherit" style={{ pointerEvents: "none" }}>{rc.label}</text>}
        </g>;
      })}
      {/* Revision cloud ghost preview while drawing */}
      {tool === "revcloud" && rcDraft && hoverSnap && (() => {
        const cursor = { x: hoverSnap.x, y: hoverSnap.y };
        const preview = [...rcDraft.points, cursor].map(pt => toScreen(pt.x, pt.y));
        const first = rcDraft.points[0];
        const closeable = rcDraft.points.length >= 3 &&
          dst(cursor.x, cursor.y, first.x, first.y) < (SNAP_R * 1.5) / cm.z;
        const d = preview.length >= 3 ? revCloudPath(preview, 8 * cm.z)
          : `M ${preview.map(pt => `${pt.x},${pt.y}`).join(" L ")}`;
        const fp = toScreen(first.x, first.y);
        return <g style={{ pointerEvents: "none" }}>
          <path d={d} fill={closeable ? "#E0525225" : "none"}
            stroke={closeable ? "#E05252" : T.accent} strokeWidth={1.5}
            strokeDasharray={preview.length >= 3 ? "none" : "5 3"} opacity={0.7} />
          {rcDraft.points.map((pt, i) => { const sp = toScreen(pt.x, pt.y);
            return <circle key={i} cx={sp.x} cy={sp.y} r={i === 0 ? 5 : 3} fill={i === 0 ? T.accent : "#E05252"} opacity={0.8} />; })}
          {closeable && <circle cx={fp.x} cy={fp.y} r={SNAP_R * 1.5} fill="none" stroke="#E05252" strokeWidth={1} opacity={0.4} strokeDasharray="3 2" />}
        </g>;
      })()}
      {annoLabels.map(l => {
        if (editingLbl?.id === l.id) return null; // hidden while its inline editor is open
        const p = toScreen(l.x, l.y);
        const on = isSel(l.id, "elevLabel");
        const interactive = tool === "select";
        const col = on ? T.accent : (l.color || T.textBright);
        const tip = l.lx != null ? toScreen(l.lx, l.ly) : null;
        return <g key={l.id}>
          {tip && <>
            <line x1={tip.x} y1={tip.y} x2={p.x} y2={p.y} stroke={col} strokeWidth={on ? 1.5 : 1} opacity={0.85} style={{ pointerEvents: "none" }} />
            <circle cx={tip.x} cy={tip.y} r={on && interactive ? 5 : 3} fill={col} opacity={0.85}
              onMouseDown={e => startAnnoDrag("label", l.id, "tip", e)}
              style={{ cursor: interactive ? "move" : "inherit", pointerEvents: interactive ? "auto" : "none" }} />
          </>}
          <text x={p.x} y={p.y} fontSize={l.fontSize ?? 11} fontWeight={l.bold ? 700 : 400} fontStyle={l.italic ? "italic" : "normal"} fill={col} fontFamily="inherit"
            onMouseDown={e => startAnnoDrag("label", l.id, "move", e)}
            onDoubleClick={e => { if (tool !== "select") return; e.stopPropagation(); setEditingLbl({ id: l.id, x: l.x, y: l.y, lx: l.lx ?? null, ly: l.ly ?? null, text: l.text || "" }); }}
            style={{ cursor: interactive ? "move" : "inherit", pointerEvents: interactive ? "auto" : "none" }}>{l.text}</text>
        </g>;
      })}
      {/* Live leader preview while the user is still dragging to place a callout */}
      {lblDragPrev && Math.hypot(lblDragPrev.to.x - lblDragPrev.from.x, lblDragPrev.to.y - lblDragPrev.from.y) > 8 && (
        <g style={{ pointerEvents: "none" }}>
          <line x1={lblDragPrev.from.x} y1={lblDragPrev.from.y} x2={lblDragPrev.to.x} y2={lblDragPrev.to.y}
            stroke={T.accent} strokeWidth={1.5} opacity={0.7} strokeDasharray="4 3" />
          <circle cx={lblDragPrev.from.x} cy={lblDragPrev.from.y} r={3} fill={T.accent} opacity={0.85} />
        </g>
      )}
      {/* Live leader line while a callout's inline editor is open (the editor box is HTML, outside the SVG) */}
      {editingLbl?.lx != null && (() => {
        const tip = toScreen(editingLbl.lx, editingLbl.ly), box = toScreen(editingLbl.x, editingLbl.y);
        return <g style={{ pointerEvents: "none" }}>
          <line x1={tip.x} y1={tip.y} x2={box.x} y2={box.y} stroke={T.accent} strokeWidth={1.5} opacity={0.85} />
          <circle cx={tip.x} cy={tip.y} r={3} fill={T.accent} opacity={0.85} />
        </g>;
      })()}
      {dimDraft && (() => { const a = toScreen(dimDraft.x1, dimDraft.y1); const b = ("x2" in dimDraft) ? toScreen(dimDraft.x2, dimDraft.y2) : null;
        return <g style={{ pointerEvents: "none" }}><circle cx={a.x} cy={a.y} r={3} fill={T.accent} />{b && <circle cx={b.x} cy={b.y} r={3} fill={T.accent} />}</g>; })()}

      {/* Live preview for the dim/label tools */}
      {(tool === "dim" || tool === "label") && hoverSnap && (() => {
        // Offset phase: both measured points placed → preview the full offset dim at the cursor
        if (tool === "dim" && dimDraft && ("x2" in dimDraft)) {
          const dd = dimDraft, ddx = dd.x2 - dd.x1, ddy = dd.y2 - dd.y1, dl = Math.hypot(ddx, ddy) || 1;
          const nnx = -ddy / dl, nny = ddx / dl;
          const off = (hoverSnap.rx - dd.x1) * nnx + (hoverSnap.ry - dd.y1) * nny;
          return <g style={{ pointerEvents: "none", opacity: 0.85 }}><ElevDimVisual g={elevDimGeom({ ...dd, offset: off })} col={T.accent} sw={1} /></g>;
        }
        // Measuring phase: snap ring + live span line + length
        const s = toScreen(hoverSnap.x, hoverSnap.y);
        return <g style={{ pointerEvents: "none" }}>
          {dimDraft && (() => {
            const a = toScreen(dimDraft.x1, dimDraft.y1);
            const lenIn = Math.hypot(hoverSnap.x - dimDraft.x1, hoverSnap.y - dimDraft.y1) / pxPerFoot * 12;
            const mid = { x: (a.x + s.x) / 2, y: (a.y + s.y) / 2 };
            return <>
              <line x1={a.x} y1={a.y} x2={s.x} y2={s.y} stroke={T.accent} strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
              {lenIn > 0.5 && <text x={mid.x} y={mid.y - 4} textAnchor="middle" fontSize={10} fill={T.accent} fontFamily="inherit" fontWeight={600}>{ft((lenIn / 12) * pxPerFoot)}</text>}
            </>;
          })()}
          {hoverSnap.snapped
            ? <><circle cx={s.x} cy={s.y} r={5} fill="none" stroke={T.accent} strokeWidth={2} /><circle cx={s.x} cy={s.y} r={1.5} fill={T.accent} /></>
            : <circle cx={s.x} cy={s.y} r={3} fill={T.accent} opacity={0.6} />}
        </g>;
      })()}

      {/* Offset past the pane's view-selector chip (absolute, left:8, ~80px wide) so it isn't covered */}
      <text x={100} y={22} fontSize={10} fontWeight={700} fill={T.textMuted} fontFamily="inherit" style={{ letterSpacing: "0.08em" }}>{dir.toUpperCase()} ELEVATION</text>
    </svg>
    {/* Inline label editor — same in-canvas flow as the plan (Enter commits, Esc cancels,
        empty text deletes); replaces window.prompt, which embedded browsers block. */}
    {editingLbl && (() => {
      // New label: position from the click (editingLbl.x/y). Existing: from the label.
      const src = editingLbl.id == null ? editingLbl : annoLabels.find(l => l.id === editingLbl.id);
      if (!src) return null;
      const p = toScreen(src.x, src.y);
      return <textarea
        autoFocus
        rows={Math.max(1, editingLbl.text.split("\n").length)}
        value={editingLbl.text}
        onChange={e => setEditingLbl(s => ({ ...s, text: e.target.value }))}
        onMouseDown={e => e.stopPropagation()}
        onBlur={commitLblEdit}
        onKeyDown={ev => {
          if (ev.key === "Escape") { ev.stopPropagation(); cancelLblEdit(); }
          else if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); commitLblEdit(); }
        }}
        style={{ position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)",
          background: T.bg2 + "EE", border: "1.5px solid " + T.accent, borderRadius: 4,
          color: T.textBright, fontSize: 11, fontFamily: "inherit", padding: "4px 8px",
          minWidth: 90, resize: "none", outline: "none", textAlign: "center", zIndex: 30,
          lineHeight: 1.4, overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      />;
    })()}
    </div>
  );
}
