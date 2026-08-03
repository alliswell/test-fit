// ─── useCanvasEvents — plan-canvas interaction handlers ───────────────────────
// Extracted from testfit.jsx. The four handlers + the private nodeCentroid memo, moved
// verbatim. Geometry / interaction / selection state come from their stores; everything
// else (helper callbacks, UI scalars, refs, tool config) arrives via `ctx`.
import { useCallback, useMemo } from "react";
import { uid, sn, dst, ptSeg, orthoSnap, pointInPoly, polyCentroid, furnitureInZone, splitWallAtNode, mergeNode, dedupeWalls, splitWallThroughNodes } from "./model";
import { applySmartGuides, wallResizeCursor, wallSideSign, markerDrawPos, polyCarryStart, applyPolyCarry } from "./geometry";
import { labelBounds } from "../utils/labels";
import { SPEC_COMPONENTS, SNAP_R, PROX_DRAG_TYPES, isWallOffsetComponent } from "../constants/specs";
import { newFurniture, pointInFurniture } from "../constants/furniture";
import { useGeometryStore } from "../store/geometryStore";
import { useInteractionStore } from "../store/interactionStore";
import { useSelectionStore } from "../store/selectionStore";
import { useLayersStore } from "../store/layersStore";

export function useCanvasEvents(ctx) {
  const { nodes, setNodes, walls, setWalls, zones, setZones, furniture, setFurniture, markers, setMarkers, doors, setDoors, windows, setWindows, columns, setColumns, dims, setDims, labels, setLabels, revClouds, setRevClouds, flowPaths, setFlowPaths, floorRegions, setFloorRegions, guides, setGuides } = useGeometryStore();
  const { drawChain, setDrawChain, drawRect, setDrawRect, drawDim, setDrawDim, drawPolyZone, setDrawPolyZone, drawRevCloud, setDrawRevCloud, drawFlowPath, setDrawFlowPath, drawFloorRegion, setDrawFloorRegion, drag, setDrag, resize, setResize, marquee, setMarquee, ghostPos, setGhostPos, rotatingMarker, setRotatingMarker, rotatingFurniture, setRotatingFurniture, furnitureResize, setFurnitureResize, calibrationLine, setCalibrationLine, hoverNid, setHoverNid, guideDraft, setGuideDraft, addingLeaderToId, setAddingLeaderToId, panning, setPanning, panSt, setPanSt, spaceHeld, setSpaceHeld } = useInteractionStore();
  const { selectedId, setSelectedId, selType, setSelType, selectedIds, setSelectedIds } = useSelectionStore();
  const {
    activeComponentType, activeFurnitureType, activePhase, activeSpecLayer, activeZoneType, bgImage, bgOffset, canvasRotation, columnLabel, columnNotes, columnShape, columnSize, commitWallSegment, commitRectRoom, cvs, cvsContainer, doorFlipped, doorHingeRight, doorType, doorWidth, findDimSnap, findNear, findProxHover, floorMaterial, gn, htrackAngle, inToPx, isWallTool, lastCopyInfo, layerLocked, lightingIsNew, lightingType, markerFinish, markerLocked, markerNotes, markerVisible, mode, outletIsNew, outletType, phaseVisible, proxHover, pxPerFoot, resolveDimEndpoints, resolveLeaderTip, resolvePoints, resolvePos, s2c, setBgOffset, setCursorPos, setDimInput, setEditingLabelId, setEditingLabelText, setGuideScrub, setHoverGuideId, setLastCopyInfo, setProxHover, setSmartGuides, setT, setTool, setViewOff, setZoneEdge, snapGrid, snapGuide, snapLabelAnchor, snapToWall, themeMode, tool, viewOff, visibleFurniture, wallKind, wc, windowHeight, windowSill, windowType, windowWidth, zoneEdge, zoneLibrary, zoneNotes, zonePaintColor, zonePaintFinish, zoom,
  } = ctx;

  const hitTest = useCallback((pos) => {
    // Selection read from the store at call time (event-only fn), so it's not a dependency.
    const { selectedId, selType, selectedIds } = useSelectionStore.getState();
    // When a dim is selected, its two measured endpoints are draggable handles — check
    // them before anything else so grabbing a handle takes priority over re-selecting.
    if (selType === "dim" && selectedId && !layerLocked("dims")) {
      const d = dims.find(dd => dd.id === selectedId);
      if (d) {
        const r = resolveDimEndpoints(d);
        if (dst(pos.x, pos.y, r.x1, r.y1) < 10) return { type: "dim-endpoint", id: d.id, ep: 0 };
        if (dst(pos.x, pos.y, r.x2, r.y2) < 10) return { type: "dim-endpoint", id: d.id, ep: 1 };
      }
    }
    // Elevation cut guides — selectable/draggable lines spanning the canvas (any mode),
    // unless the Elevation Rulers layer is hidden or locked.
    if (useLayersStore.getState().visibleGuides && !layerLocked("guides")) {
      const tol = 6 / zoom;
      for (let i = guides.length - 1; i >= 0; i--) {
        const g = guides[i];
        const horiz = g.dir === "front" || g.dir === "back"; // horizontal line at y = pos
        if (Math.abs((horiz ? pos.y : pos.x) - g.pos) < tol) return { type: "guide", id: g.id };
      }
    }
    // Dim strings are always selectable in any mode
    for (let i = dims.length - 1; i >= 0 && !layerLocked("dims"); i--) {
      const d = dims[i];
      const dx2 = d.x2 - d.x1, dy2 = d.y2 - d.y1, dlen = Math.hypot(dx2, dy2);
      if (dlen < 1) continue;
      const nx = -dy2 / dlen, ny = dx2 / dlen;
      const dlx1 = d.x1 + nx * d.offset, dly1 = d.y1 + ny * d.offset;
      const dlx2 = d.x2 + nx * d.offset, dly2 = d.y2 + ny * d.offset;
      if (ptSeg(pos.x, pos.y, dlx1, dly1, dlx2, dly2) < 8) return { type: "dim", id: d.id };
    }
    // Labels are an annotation overlay (rendered on top of geometry), so they win when the
    // cursor is directly over a label box or its leader tip — otherwise a label sitting on a
    // wall would grab the wall on click/drag.
    for (let i = labels.length - 1; i >= 0 && !layerLocked("labels"); i--) {
      const lbl = labels[i];
      if (!phaseVisible(lbl.phase)) continue;
      if (lbl.lx != null) {
        const tip = resolveLeaderTip(lbl);
        if (dst(pos.x, pos.y, tip.lx, tip.ly) <= 8) return { type: "label-tip", id: lbl.id };
      }
      const { w, h } = labelBounds(lbl);
      if (pos.x >= lbl.x - w / 2 && pos.x <= lbl.x + w / 2 &&
          pos.y >= lbl.y - h / 2 && pos.y <= lbl.y + h / 2)
        return { type: "label", id: lbl.id };
    }
    // Filter hits based on current mode
    if (mode === "build") {
      // Pre-build set of node IDs connected to at least one visible wall — O(walls) once vs O(nodes×walls) per node
      const visibleWallNodeIds = new Set(walls.filter(w => phaseVisible(w.phase)).flatMap(w => [w.n1, w.n2]));
      for (const n of nodes) {
        if (!visibleWallNodeIds.has(n.id)) continue;
        if (dst(pos.x, pos.y, n.x, n.y) < 10) return { type: "node", id: n.id };
      }
      for (let i = columns.length - 1; i >= 0; i--) { const col = columns[i]; if (!phaseVisible(col.phase)) continue; const rp = resolvePos(col); const r = inToPx(col.size) / 2; if (dst(pos.x, pos.y, rp.x, rp.y) < r + 4) return { type: "column", id: col.id }; }
      for (let i = markers.length - 1; i >= 0; i--) {
        const p = markers[i];
        if (p.layer !== "power") continue;
        if (!markerVisible(p) || markerLocked(p)) continue;
        const rp = resolvePos(p);
        const ct = p.componentType;
        const isHtrack = ct === "htrack_4" || ct === "htrack_8" || ct === "htrack";
        if (isHtrack) {
          const ftLen = ct === "htrack_8" ? 8 : 4;
          const lenPx = ftLen * pxPerFoot, widPx = 0.25 * pxPerFoot;
          const angle = p.angle || 0;
          const ddx = pos.x - rp.x, ddy = pos.y - rp.y;
          const lx = ddx * Math.cos(-angle) - ddy * Math.sin(-angle);
          const ly = ddx * Math.sin(-angle) + ddy * Math.cos(-angle);
          if (Math.abs(lx) <= lenPx / 2 + 8 && Math.abs(ly) <= widPx / 2 + 8) return { type: "marker", id: p.id };
        } else {
          // All other power-layer marker types (outlets, switches, lights, etc.). Pick at
          // the DRAWN point — wall devices stand off the wall — so the symbol you click is
          // the symbol you see, and clicking the wall itself doesn't grab the outlet.
          const dp = markerDrawPos(p, rp.x, rp.y, pxPerFoot);
          if (dst(pos.x, pos.y, dp.x, dp.y) < 16) return { type: "marker", id: p.id };
        }
      }
      for (let i = doors.length - 1; i >= 0; i--) { const d = doors[i]; if (!phaseVisible(d.phase)) continue; const rp = resolvePos(d); if (dst(pos.x, pos.y, rp.x, rp.y) < inToPx(d.width) / 2 + 4) return { type: "door", id: d.id }; }
      for (let i = windows.length - 1; i >= 0; i--) { const w = windows[i]; if (!phaseVisible(w.phase)) continue; const rp = resolvePos(w); if (dst(pos.x, pos.y, rp.x, rp.y) < inToPx(w.width) / 2 + 4) return { type: "window", id: w.id }; }
      for (let i = walls.length - 1; i >= 0; i--) { const w = walls[i]; if (!phaseVisible(w.phase)) continue; const c = wc(w); if (c && ptSeg(pos.x, pos.y, c.x1, c.y1, c.x2, c.y2) < 10) return { type: "wall", id: w.id }; }
    } else if (mode === "zone") {
      // In ZONE mode — check zone vertices first, then edges, then zone bodies (all using resolved positions)
      for (let i = zones.length - 1; i >= 0 && !layerLocked("zones"); i--) { const z = zones[i];
        if (!phaseVisible(z.phase)) continue;
        if (z.points && (selectedId === z.id || selectedIds.includes(z.id))) {
          const rpts = resolvePoints(z);
          for (let vi = 0; vi < rpts.length; vi++) {
            if (dst(pos.x, pos.y, rpts[vi].x, rpts[vi].y) < 10) return { type: "zone-vertex", id: z.id, vertexIndex: vi };
          }
        }
      }
      for (let i = zones.length - 1; i >= 0 && !layerLocked("zones"); i--) { const z = zones[i];
        if (!phaseVisible(z.phase)) continue;
        if (z.points && (selectedId === z.id || selectedIds.includes(z.id))) {
          const rpts = resolvePoints(z);
          for (let ei = 0; ei < rpts.length; ei++) {
            const ej = (ei + 1) % rpts.length;
            if (ptSeg(pos.x, pos.y, rpts[ei].x, rpts[ei].y, rpts[ej].x, rpts[ej].y) < 8) return { type: "zone-edge", id: z.id, edgeIndex: ei };
          }
        }
      }
      for (let i = zones.length - 1; i >= 0 && !layerLocked("zones"); i--) { const z = zones[i];
        if (!phaseVisible(z.phase)) continue;
        if (z.points) { if (pointInPoly(pos.x, pos.y, resolvePoints(z))) return { type: "zone", id: z.id }; }
        else { if (pos.x >= z.x && pos.x <= z.x + z.w && pos.y >= z.y && pos.y <= z.y + z.h) return { type: "zone", id: z.id }; }
      }
    } else if (mode === "itmep") {
      for (let i = markers.length - 1; i >= 0; i--) { const p = markers[i]; if (!markerVisible(p) || markerLocked(p)) continue; const rp = resolvePos(p); const dp = markerDrawPos(p, rp.x, rp.y, pxPerFoot); if (dst(pos.x, pos.y, dp.x, dp.y) < 14) return { type: "marker", id: p.id }; }
    } else if (mode === "furnish") {
      if (visibleFurniture && !layerLocked("furniture")) {
        for (let i = furniture.length - 1; i >= 0; i--) {
          const f = furniture[i];
          if (!phaseVisible(f.phase)) continue;
          if (pointInFurniture(f, pos.x, pos.y, pxPerFoot, 4)) return { type: "furniture", id: f.id };
        }
      }
    }
    // RevCloud hit testing
    for (let i = revClouds.length - 1; i >= 0 && !layerLocked("revClouds"); i--) {
      const rc = revClouds[i];
      if (!phaseVisible(rc.phase)) continue;
      const isSel = selectedId === rc.id && selType === "revcloud";
      if (isSel) {
        for (let vi = 0; vi < rc.points.length; vi++)
          if (dst(pos.x, pos.y, rc.points[vi].x, rc.points[vi].y) < SNAP_R)
            return { type: "revcloud-vertex", id: rc.id, vertexIndex: vi };
        for (let ei = 0; ei < rc.points.length; ei++) {
          const ej = (ei + 1) % rc.points.length;
          if (ptSeg(pos.x, pos.y, rc.points[ei].x, rc.points[ei].y, rc.points[ej].x, rc.points[ej].y) < 10)
            return { type: "revcloud-edge", id: rc.id, edgeIndex: ei };
        }
      }
      if (rc.points.length >= 3 && pointInPoly(pos.x, pos.y, rc.points))
        return { type: "revcloud", id: rc.id };
    }
    // Flow path hit testing — open polyline, band half-width as the hit margin. Flow Path is
    // a BUILD-only tool (see the tool rail), so its items are only selectable while building —
    // you can't select what the current mode can't create.
    for (let i = flowPaths.length - 1; i >= 0 && mode === "build" && !layerLocked("flowPaths"); i--) {
      const fp = flowPaths[i];
      if (!phaseVisible(fp.phase)) continue;
      const isSel = selectedId === fp.id && selType === "flowPath";
      if (isSel) {
        for (let vi = 0; vi < fp.points.length; vi++)
          if (dst(pos.x, pos.y, fp.points[vi].x, fp.points[vi].y) < SNAP_R)
            return { type: "flowPath-vertex", id: fp.id, vertexIndex: vi };
      }
      const halfBand = (fp.width / 12) * pxPerFoot / 2 + 2;
      for (let ei = 0; ei < fp.points.length - 1; ei++) {
        if (ptSeg(pos.x, pos.y, fp.points[ei].x, fp.points[ei].y, fp.points[ei+1].x, fp.points[ei+1].y) < halfBand)
          return { type: "flowPath", id: fp.id, edgeIndex: ei };
      }
    }
    // Floor region hit testing — checked last so everything above wins. Also a BUILD-only
    // tool, so only selectable while building.
    for (let i = floorRegions.length - 1; i >= 0 && mode === "build" && !layerLocked("floorRegions"); i--) {
      const fr = floorRegions[i];
      if (!phaseVisible(fr.phase)) continue;
      const isSel = selectedId === fr.id && selType === "floorRegion";
      if (isSel) {
        for (let vi = 0; vi < fr.points.length; vi++)
          if (dst(pos.x, pos.y, fr.points[vi].x, fr.points[vi].y) < SNAP_R)
            return { type: "floorRegion-vertex", id: fr.id, vertexIndex: vi };
        for (let ei = 0; ei < fr.points.length; ei++) {
          const ej = (ei + 1) % fr.points.length;
          if (ptSeg(pos.x, pos.y, fr.points[ei].x, fr.points[ei].y, fr.points[ej].x, fr.points[ej].y) < 10)
            return { type: "floorRegion-edge", id: fr.id, edgeIndex: ei };
        }
      }
      if (fr.points.length >= 3 && pointInPoly(pos.x, pos.y, fr.points))
        return { type: "floorRegion", id: fr.id };
    }
    return null;
  }, [mode, nodes, walls, zones, furniture, visibleFurniture, markers, doors, windows, columns, dims, labels, revClouds, flowPaths, floorRegions, guides, zoom, pxPerFoot, wc, inToPx, resolvePos, resolvePoints, phaseVisible, resolveLeaderTip, resolveDimEndpoints, layerLocked, markerLocked, markerVisible]);

  // Centroid of all nodes — used to aim wall-mounted directional markers into the room.
  const nodeCentroid = useMemo(() => {
    if (!nodes.length) return { x: 0, y: 0 };
    let sx = 0, sy = 0; for (const n of nodes) { sx += n.x; sy += n.y; }
    return { x: sx / nodes.length, y: sy / nodes.length };
  }, [nodes]);

  // Furniture a zone-move should carry, snapshotted at drag start with each piece's
  // starting point — recomputing containment mid-drag would drop pieces the moment the zone
  // slid off them. A LOCKED furniture layer opts out (lock means "don't edit these"), and
  // pieces from a hidden phase stay put rather than being moved sight-unseen.
  const zoneFurnStart = useCallback((zone, pts) => {
    if (layerLocked("furniture")) return [];
    return furnitureInZone(furniture.filter(f => phaseVisible(f.phase)), zone, pts)
      .map(f => ({ id: f.id, x: f.x, y: f.y }));
  }, [furniture, layerLocked, phaseVisible]);

  // Floor regions and zones a room-resize should carry. Their vertices hold no reference to
  // the walls they were drawn against — the rect-room tool writes a floor from the very same
  // scalars as the wall corners and the two then drift apart — so the binding is positional,
  // snapshotted here and re-derived. Locked layers opt out; a hidden phase stays put.
  // `exclude` skips polygons already being dragged wholesale, so they never move twice.
  const polyCarry = useCallback((movingNodes, exclude) => {
    if (!movingNodes?.length) return [];
    const tol = Math.max(1e-6, pxPerFoot / 48); // ¼" — well under the 1" finest snap step
    const skip = new Set(exclude || []);
    const src = [];
    if (!layerLocked("floorRegions")) for (const fr of floorRegions) if (phaseVisible(fr.phase)) src.push(fr);
    if (!layerLocked("zones")) for (const z of zones) if (z.points && phaseVisible(z.phase)) src.push(z);
    return polyCarryStart(src, movingNodes, tol, skip);
  }, [floorRegions, zones, layerLocked, phaseVisible, pxPerFoot]);

  // Apply a carry list to both collections. Split by id so each store write only touches its
  // own array, and skipped entirely when nothing moved (zustand notifies on every set).
  const applyCarry = useCallback((carry, deltaOf) => {
    if (!carry?.length) return;
    const frIds = new Set(floorRegions.map(f => f.id));
    const frCarry = carry.filter(c => frIds.has(c.polyId));
    const zCarry = carry.filter(c => !frIds.has(c.polyId));
    if (frCarry.length) setFloorRegions(p => applyPolyCarry(p, frCarry, deltaOf));
    if (zCarry.length) setZones(p => applyPolyCarry(p, zCarry, deltaOf));
  }, [floorRegions, setFloorRegions, setZones]);

  const onDown = useCallback((e) => {
    // Selection is read fresh at event time (never during render) so it stays out of the
    // dep array — avoids re-creating this large handler on every selection change, and
    // fixes a latent stale-closure read of selectedId.
    const { selectedId, selectedIds } = useSelectionStore.getState();
    // Pan with middle click or spacebar held
    if (e.button === 1 || (e.button === 0 && (tool === "pan" || spaceHeld))) {
      setPanning(true); setPanSt({ sx: e.clientX, sy: e.clientY, ox: viewOff.x, oy: viewOff.y }); return;
    }
    const pos = s2c(e.clientX, e.clientY);
    let sx = sn(pos.x, snapGrid), sy = sn(pos.y, snapGrid);

    // Wall tools: click-to-place chain
    if (isWallTool(tool)) {
      // Double-click finishes the chain
      if (e.detail === 2 && drawChain) {
        setDrawChain(null); setCursorPos(null); setDimInput(""); return;
      }
      if (e.shiftKey && drawChain) {
        const o = orthoSnap(drawChain.lastX, drawChain.lastY, sx, sy);
        sx = sn(o.x, snapGrid); sy = sn(o.y, snapGrid);
      }
      const near = findNear(sx, sy, drawChain?.lastNodeId ? [drawChain.lastNodeId] : []);
      // If no nearby node, snap to wall body if cursor is close
      const wallSnap = !near ? snapToWall(sx, sy, SNAP_R) : null;
      const tx = near ? near.x : wallSnap ? wallSnap.x : sx;
      const ty = near ? near.y : wallSnap ? wallSnap.y : sy;

      if (!drawChain) {
        // First click: start chain — also snap to wall body for start point
        const startNode = findNear(sx, sy);
        const startWallSnap = !startNode ? snapToWall(sx, sy, SNAP_R) : null;
        setDrawChain({ lastNodeId: startNode?.id || null, lastX: startNode?.x ?? (startWallSnap?.x ?? sx), lastY: startNode?.y ?? (startWallSnap?.y ?? sy), history: [] });
      } else {
        // Subsequent click: commit segment and continue
        if (dst(drawChain.lastX, drawChain.lastY, tx, ty) > 8) {
          const result = commitWallSegment(drawChain.lastNodeId, drawChain.lastX, drawChain.lastY, tx, ty, wallKind);
          if (result) {
            // If we connected to the existing network — an existing node, or a wall body
            // (commitWallSegment welds a T-junction there) — finish the chain (stay in wall tool)
            if (near || wallSnap) {
              setDrawChain(null);
              setCursorPos(null);
              setDimInput("");
            } else {
              setDrawChain({ lastNodeId: result.nodeId, lastX: result.x, lastY: result.y, history: [...(drawChain.history || []), { lastNodeId: drawChain.lastNodeId, lastX: drawChain.lastX, lastY: drawChain.lastY }] });
            }
          }
        }
      }
      return;
    }
    // Rect-room tool: two clicks = four welded walls tracing the rectangle.
    if (tool === "rect") {
      // Corner snapping mirrors the wall tool — node first, then wall body.
      const near = findNear(sx, sy);
      const ws = !near ? snapToWall(sx, sy, SNAP_R) : null;
      const px = near ? near.x : ws ? ws.x : sx;
      const py = near ? near.y : ws ? ws.y : sy;
      if (!drawRect) { setDrawRect({ x1: px, y1: py }); return; }
      const { x1, y1 } = drawRect;
      if (commitRectRoom(x1, y1, px, py, wallKind)) { setDrawRect(null); setCursorPos(null); }
      return;
    }
    if (tool === "zone") {
      const zt = zoneLibrary[activeZoneType]; const nid = uid();
      const pts = [{ x: sx, y: sy }, { x: sx + zt.defaultW * pxPerFoot, y: sy }, { x: sx + zt.defaultW * pxPerFoot, y: sy + zt.defaultH * pxPerFoot }, { x: sx, y: sy + zt.defaultH * pxPerFoot }];
      setZones(p => [...p, { id: nid, type: activeZoneType, points: pts, label: zt.name, notes: zoneNotes, paintColor: zonePaintColor, paintFinish: zonePaintFinish, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("zone"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "furniture") {
      const nid = uid();
      const f = newFurniture(activeFurnitureType, sx, sy, nid);
      if (!f) return;
      setFurniture(p => [...p, { ...f, phase: activePhase }]);
      // Shift keeps the tool armed to drop more of the same piece; otherwise select it.
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("furniture"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "marker") {
      const nid = uid();
      const compData = SPEC_COMPONENTS[activeSpecLayer][activeComponentType];
      const wallMount = compData.mount === "inwall" || compData.mount === "surface";
      const snap = wallMount ? snapToWall(pos.x, pos.y, Infinity) : null;
      const ox = snap ? snap.x : sx, oy = snap ? snap.y : sy;
      let angle = 0;
      if (snap) {
        const wallAng = snap.angle * Math.PI / 180;
        if (compData.directional) {
          // Aim = wall normal pointing toward the model interior (node centroid).
          const nx = -Math.sin(wallAng), ny = Math.cos(wallAng);
          const sgn = ((nodeCentroid.x - ox) * nx + (nodeCentroid.y - oy) * ny) >= 0 ? 1 : -1;
          angle = Math.atan2(ny * sgn, nx * sgn);
        } else {
          angle = wallAng; // lay the body along the wall
        }
      } else if (compData.directional) {
        angle = htrackAngle * Math.PI / 180; // free-placed directional: R-rotatable
      }
      setMarkers(p => [...p, { id: nid, layer: activeSpecLayer, componentType: activeComponentType, x: ox, y: oy, angle, finish: compData.finish ? markerFinish : undefined, label: compData.name, notes: markerNotes, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("marker"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "door") {
      const nid = uid();
      const snap = snapToWall(pos.x, pos.y);
      const dx = snap ? snap.x : sx, dy = snap ? snap.y : sy, da = snap ? snap.angle : 0;
      setDoors(p => [...p, { id: nid, x: dx, y: dy, angle: da, width: doorWidth, flipped: doorFlipped, hingeRight: doorHingeRight, doorType, isNew: false, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("door"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "window") {
      const nid = uid();
      const snap = snapToWall(pos.x, pos.y);
      const wx = snap ? snap.x : sx, wy = snap ? snap.y : sy, wa2 = snap ? snap.angle : 0;
      setWindows(p => [...p, { id: nid, x: wx, y: wy, angle: wa2, width: windowWidth, height: windowHeight, sill: windowSill, type: windowType, isNew: false, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("window"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "column") {
      const nid = uid();
      setColumns(p => [...p, { id: nid, x: sx, y: sy, size: columnSize, shape: columnShape, label: columnLabel, notes: columnNotes, isNew: false, phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("column"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "outlet") {
      const nid = uid();
      const isCeiling = outletType === "outlet_ceiling" || outletType === "pendent_prewire" || outletType.startsWith("htrack_") || (outletType.startsWith("light_") && outletType !== "light_sconce");
      const wallSnap = !isCeiling; // wall-mounted types snap to walls
      const snap = wallSnap ? snapToWall(pos.x, pos.y, Infinity) : null;
      const ox = snap ? snap.x : sx, oy = snap ? snap.y : sy;
      const angleRad = outletType.startsWith("htrack_") ? (htrackAngle * Math.PI / 180) : (snap ? (snap.angle * Math.PI / 180) : 0);
      // Which room the device faces: the side of the wall the click landed on. The symbol
      // is drawn offset that way (markerDisplayPos) while x/y stay on the centerline.
      const side = snap && isWallOffsetComponent(outletType) ? wallSideSign(pos.x, pos.y, ox, oy, angleRad) : undefined;
      setMarkers(p => [...p, { id: nid, layer: "power", componentType: outletType, x: ox, y: oy, angle: angleRad, side, isNew: outletIsNew, label: SPEC_COMPONENTS.power[outletType].name, notes: "", phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("marker"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "lighting") {
      const nid = uid();
      const isCeiling = lightingType !== "light_sconce" && lightingType !== "sconce_prewire";
      const snap = isCeiling ? null : snapToWall(pos.x, pos.y, Infinity);
      const ox = snap ? snap.x : sx, oy = snap ? snap.y : sy;
      const angleRad = lightingType.startsWith("htrack_") ? (htrackAngle * Math.PI / 180) : (snap ? (snap.angle * Math.PI / 180) : 0);
      // Sconces: the clicked side is the room they light — drives both the plan offset and
      // which way the throw fans (same convention as outlets/switches).
      const side = snap && isWallOffsetComponent(lightingType) ? wallSideSign(pos.x, pos.y, ox, oy, angleRad) : undefined;
      setMarkers(p => [...p, { id: nid, layer: "power", componentType: lightingType, x: ox, y: oy, angle: angleRad, side, isNew: lightingIsNew, label: SPEC_COMPONENTS.power[lightingType].name, notes: "", phase: activePhase }]);
      if (e.shiftKey) { setSelectedId(null); setSelType(null); } else { setSelectedId(nid); setSelType("marker"); setTool("select"); setGhostPos(null); }
      return;
    }
    if (tool === "dim") {
      // Shift while placing the span's END point locks it to the horizontal/vertical
      // axis from the start point (like the wall tool). Ortho lock overrides geometry
      // snapping and detaches the anchor — the point is now defined by the axis, not
      // a piece of geometry that could drift off-axis.
      const orthoLock = e.shiftKey && drawDim && !("x2" in drawDim);
      const snap = orthoLock ? null : findDimSnap(pos.x, pos.y);
      let px = snap ? snap.x : sx, py = snap ? snap.y : sy;
      if (orthoLock) { const o = orthoSnap(drawDim.x1, drawDim.y1, sx, sy); px = o.x; py = o.y; }
      if (!drawDim) {
        setDrawDim({ x1: px, y1: py, anchor1Id: snap?.anchorId ?? null, anchor1Type: snap?.anchorType ?? null });
      } else if (!("x2" in drawDim)) {
        if (Math.hypot(px - drawDim.x1, py - drawDim.y1) < 4) return;
        setDrawDim({ ...drawDim, x2: px, y2: py, anchor2Id: snap?.anchorId ?? null, anchor2Type: snap?.anchorType ?? null });
      } else {
        const ddx = drawDim.x2 - drawDim.x1, ddy = drawDim.y2 - drawDim.y1;
        const dlen = Math.hypot(ddx, ddy);
        if (dlen < 1) { setDrawDim(null); return; }
        const nnx = -ddy / dlen, nny = ddx / dlen;
        const off = (pos.x - drawDim.x1) * nnx + (pos.y - drawDim.y1) * nny;
        setDims(prev => [...prev, {
          id: uid(), x1: drawDim.x1, y1: drawDim.y1, x2: drawDim.x2, y2: drawDim.y2, offset: off,
          anchor1Id: drawDim.anchor1Id ?? null, anchor1Type: drawDim.anchor1Type ?? null,
          anchor2Id: drawDim.anchor2Id ?? null, anchor2Type: drawDim.anchor2Type ?? null,
        }]);
        if (e.shiftKey) { setDrawDim(null); }
        else { setDrawDim(null); setT("select"); }
      }
      return;
    }
    if (tool === "calibrate") {
      if (!calibrationLine) {
        // First click: set p1
        setCalibrationLine({ p1: { x: pos.x, y: pos.y }, p2: null });
      } else if (calibrationLine.p1 && !calibrationLine.p2) {
        // Second click: set p2
        setCalibrationLine({ ...calibrationLine, p2: { x: pos.x, y: pos.y } });
        setT("select"); // Switch back to select after drawing line
      }
      return;
    }
    if (tool === "revcloud") {
      const near = findNear(pos.x, pos.y);
      let cx = near ? near.x : sx, cy = near ? near.y : sy;
      const lpRC = drawRevCloud?.points?.[drawRevCloud.points.length - 1];
      if (e.shiftKey && lpRC) { const o = orthoSnap(lpRC.x, lpRC.y, sx, sy); cx = o.x; cy = o.y; }
      if (!drawRevCloud) {
        setDrawRevCloud({ points: [{ x: cx, y: cy }] });
      } else {
        const pts = drawRevCloud.points;
        const distToFirst = dst(cx, cy, pts[0].x, pts[0].y);
        if (pts.length >= 3 && distToFirst < SNAP_R * 1.5) {
          const nid = uid();
          setRevClouds(prev => [...prev, { id: nid, points: pts, arcR: 8, label: "", color: "#E05252", phase: activePhase }]);
          setDrawRevCloud(null);
          setSelectedId(nid); setSelType("revcloud"); setSelectedIds([nid]);
          setT("select");
        } else {
          const last = pts[pts.length - 1];
          if (dst(cx, cy, last.x, last.y) > 4)
            setDrawRevCloud({ points: [...pts, { x: cx, y: cy }] });
        }
      }
      return;
    }
    if (tool === "flowPath") {
      // Open polyline. Double-click finishes (>=2 pts) without adding a dup point.
      if (e.detail === 2 && drawFlowPath) {
        const pts = drawFlowPath.points;
        if (pts.length >= 2) {
          if (drawFlowPath.editingId) {
            const eid = drawFlowPath.editingId;
            setFlowPaths(prev => prev.map(f => f.id === eid ? { ...f, points: pts } : f));
            setSelectedId(eid); setSelType("flowPath"); setSelectedIds([eid]);
          } else {
            const nid = uid();
            setFlowPaths(prev => [...prev, { id: nid, points: pts, width: 36, color: "#4A90D9", label: "", phase: activePhase }]);
            setSelectedId(nid); setSelType("flowPath"); setSelectedIds([nid]);
          }
          setT("select");
        }
        setDrawFlowPath(null);
        return;
      }
      const near = findNear(pos.x, pos.y);
      let cx = near ? near.x : sx, cy = near ? near.y : sy;
      const lpFP = drawFlowPath?.points?.[drawFlowPath.points.length - 1];
      if (e.shiftKey && lpFP) { const o = orthoSnap(lpFP.x, lpFP.y, sx, sy); cx = o.x; cy = o.y; }
      if (!drawFlowPath) {
        setDrawFlowPath({ points: [{ x: cx, y: cy }] });
      } else {
        const last = drawFlowPath.points[drawFlowPath.points.length - 1];
        if (dst(cx, cy, last.x, last.y) > 4)
          setDrawFlowPath({ points: [...drawFlowPath.points, { x: cx, y: cy }] });
      }
      return;
    }
    if (tool === "floorRegion") {
      // Closed polygon. Click first point (3+ pts) to close.
      if (drawFloorRegion) {
        const pts = drawFloorRegion.points;
        if (pts.length >= 3 && dst(pos.x, pos.y, pts[0].x, pts[0].y) < SNAP_R * 1.5) {
          const nid = uid();
          setFloorRegions(prev => [...prev, { id: nid, points: pts, material: "Wood", label: "", phase: activePhase }]);
          setDrawFloorRegion(null);
          setSelectedId(nid); setSelType("floorRegion"); setSelectedIds([nid]);
          setT("select");
          return;
        }
      }
      const near = findNear(pos.x, pos.y);
      let cx = near ? near.x : sx, cy = near ? near.y : sy;
      const lpFR = drawFloorRegion?.points?.[drawFloorRegion.points.length - 1];
      if (e.shiftKey && lpFR) { const o = orthoSnap(lpFR.x, lpFR.y, sx, sy); cx = o.x; cy = o.y; }
      if (!drawFloorRegion) {
        setDrawFloorRegion({ points: [{ x: cx, y: cy }] });
      } else {
        const last = drawFloorRegion.points[drawFloorRegion.points.length - 1];
        if (dst(cx, cy, last.x, last.y) > 4)
          setDrawFloorRegion({ points: [...drawFloorRegion.points, { x: cx, y: cy }] });
      }
      return;
    }
    // "Add Leader" mode: next click sets leader anchor
    if (addingLeaderToId) {
      const { x, y, anchorId, anchorType } = snapLabelAnchor(pos.x, pos.y);
      setLabels(p => p.map(l => l.id !== addingLeaderToId ? l : { ...l, lx: x, ly: y, anchorId, anchorType }));
      setAddingLeaderToId(null);
      e.stopPropagation();
      return;
    }
    if (tool === "label") {
      const { x: startX, y: startY, anchorId: startAnchorId, anchorType: startAnchorType } = snapLabelAnchor(pos.x, pos.y);
      setDrag({ type: "label-place", startX, startY, startAnchorId, startAnchorType, snapped: !!(startAnchorId || startX !== pos.x || startY !== pos.y) });
      e.stopPropagation();
      return;
    }
    if (tool === "select") {
      const hit = hitTest(pos);
      
      // Shift+Click: toggle object in/out of selection
      if (hit && e.shiftKey && !e.altKey) {
        const isSelected = selectedIds.includes(hit.id);
        if (isSelected) {
          setSelectedIds(prev => prev.filter(id => id !== hit.id));
          if (selectedId === hit.id) {
            const remaining = selectedIds.filter(id => id !== hit.id);
            setSelectedId(remaining[0] || null);
            if (remaining.length > 0) {
              const rid = remaining[0];
              const rType = nodes.find(n => n.id === rid) ? "node" : walls.find(w => w.id === rid) ? "wall" : zones.find(z => z.id === rid) ? "zone" : markers.find(m => m.id === rid) ? "marker" : doors.find(d => d.id === rid) ? "door" : windows.find(w => w.id === rid) ? "window" : columns.find(c => c.id === rid) ? "column" : furniture.find(f => f.id === rid) ? "furniture" : null;
              setSelType(rType);
            } else { setSelType(null); }
          }
        } else {
          setSelectedIds(prev => [...prev, hit.id]);
          setSelectedId(hit.id);
          setSelType(hit.type);
        }
        return;
      }
      
      if (hit && e.altKey) {
        // Alt+drag: duplicate selected objects and immediately start dragging the copies
        const isMultiCopy = selectedIds.length > 1 && selectedIds.includes(hit.id);

        if (isMultiCopy) {
          // Duplicate ALL selected items and start a multi-drag with the copies
          const srcItems = [];
          const newColumns = [], newMarkers = [], newDoors = [], newWindows = [], newZones = [], newLabels = [], newNodes = [], newWalls = [], newFurns = [];
          const copyIds = [];

          // Pre-pass: build node ID remap so wall copies can reference new node IDs
          const nodeIdMap = new Map();
          selectedIds.forEach(id => { if (nodes.find(n => n.id === id)) nodeIdMap.set(id, uid()); });

          selectedIds.forEach(id => {
            // Nodes — must come before walls; drag.objects includes nodes so walls follow automatically
            const nd = nodes.find(n => n.id === id);
            if (nd) { const nid = nodeIdMap.get(id); const rp = resolvePos(nd); newNodes.push({ ...nd, id: nid, px: undefined, x: rp.x, y: rp.y }); srcItems.push({ id: nid, type: "node", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            // Walls — remap n1/n2 to new node IDs; walls follow nodes during drag so not added to srcItems
            const wl = walls.find(w => w.id === id);
            if (wl) { const nid = uid(); newWalls.push({ ...wl, id: nid, n1: nodeIdMap.get(wl.n1) ?? wl.n1, n2: nodeIdMap.get(wl.n2) ?? wl.n2 }); copyIds.push(nid); return; }
            const col = columns.find(c => c.id === id);
            if (col) { const rp = resolvePos(col); const nid = uid(); newColumns.push({ ...col, id: nid, px: undefined, x: rp.x, y: rp.y }); srcItems.push({ id: nid, type: "column", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            const mk = markers.find(m => m.id === id);
            if (mk) { const rp = resolvePos(mk); const nid = uid(); newMarkers.push({ ...mk, id: nid, px: undefined, x: rp.x, y: rp.y, deletedAtPhase: undefined }); srcItems.push({ id: nid, type: "marker", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            const fn = furniture.find(f => f.id === id);
            if (fn) { const nid = uid(); newFurns.push({ ...fn, id: nid, fromZone: undefined }); srcItems.push({ id: nid, type: "furniture", x: fn.x, y: fn.y }); copyIds.push(nid); return; }
            const dr = doors.find(d => d.id === id);
            if (dr) { const rp = resolvePos(dr); const nid = uid(); newDoors.push({ ...dr, id: nid, px: undefined, x: rp.x, y: rp.y }); srcItems.push({ id: nid, type: "door", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            const win = windows.find(w => w.id === id);
            if (win) { const rp = resolvePos(win); const nid = uid(); newWindows.push({ ...win, id: nid, px: undefined, x: rp.x, y: rp.y }); srcItems.push({ id: nid, type: "window", x: rp.x, y: rp.y }); copyIds.push(nid); return; }
            const zn = zones.find(z => z.id === id);
            if (zn) { const rpts = resolvePoints(zn); const nid = uid(); newZones.push({ ...zn, id: nid, px: undefined, points: rpts.map(p => ({ ...p })) }); const c = polyCentroid(rpts); srcItems.push({ id: nid, type: "zone", x: c.x, y: c.y }); copyIds.push(nid); return; }
            const lb = labels.find(l => l.id === id);
            if (lb) { const nid = uid(); newLabels.push({ ...lb, id: nid }); srcItems.push({ id: nid, type: "label", x: lb.x, y: lb.y }); copyIds.push(nid); return; }
          });

          if (newNodes.length)   setNodes(p => [...p, ...newNodes]);
          if (newWalls.length)   setWalls(p => [...p, ...newWalls]);
          if (newColumns.length) setColumns(p => [...p, ...newColumns]);
          if (newMarkers.length) setMarkers(p => [...p, ...newMarkers]);
          if (newFurns.length)   setFurniture(p => [...p, ...newFurns]);
          if (newDoors.length)   setDoors(p => [...p, ...newDoors]);
          if (newWindows.length) setWindows(p => [...p, ...newWindows]);
          if (newZones.length)   setZones(p => [...p, ...newZones]);
          if (newLabels.length)  setLabels(p => [...p, ...newLabels]);

          setSelectedIds(copyIds);
          setSelectedId(copyIds[0]);
          setSelType(hit.type);
          // Record source positions so "/" can distribute later
          setLastCopyInfo({ srcItems, dx: 0, dy: 0 });
          setDrag({ type: "multi", objects: srcItems, startX: pos.x, startY: pos.y, lastX: pos.x, lastY: pos.y, isCopy: true });
        } else {
          // Single-item alt-drag copy
          const nid = uid();
          if (hit.type === "zone") {
            const src = zones.find(z => z.id === hit.id);
            if (src) {
              const rpts = resolvePoints(src);
              const dup = { ...src, id: nid, px: undefined, points: rpts.map(p => ({ ...p })) };
              setZones(p => [...p, dup]);
              const c = polyCentroid(rpts);
              setSelectedId(nid); setSelType("zone");
              setLastCopyInfo({ srcItems: [{ id: nid, type: "zone", x: c.x, y: c.y }], dx: 0, dy: 0 });
              setDrag({ type: "zone", id: nid, ox: pos.x - c.x, oy: pos.y - c.y, startX: sn(c.x, snapGrid), startY: sn(c.y, snapGrid), startPts: rpts.map(p => ({ ...p })), lastX: sn(c.x, snapGrid), lastY: sn(c.y, snapGrid), isCopy: true });
            }
          } else if (hit.type === "door") {
            const src = doors.find(d => d.id === hit.id);
            if (src) { const rp = resolvePos(src); setDoors(p => [...p, { ...src, id: nid, px: undefined, x: rp.x, y: rp.y }]); setSelectedId(nid); setSelType("door"); setLastCopyInfo({ srcItems: [{ id: nid, type: "door", x: rp.x, y: rp.y }], dx: 0, dy: 0 }); setDrag({ type: "door", id: nid, ox: pos.x - rp.x, oy: pos.y - rp.y, isCopy: true }); }
          } else if (hit.type === "window") {
            const src = windows.find(w => w.id === hit.id);
            if (src) { const rp = resolvePos(src); setWindows(p => [...p, { ...src, id: nid, px: undefined, x: rp.x, y: rp.y }]); setSelectedId(nid); setSelType("window"); setLastCopyInfo({ srcItems: [{ id: nid, type: "window", x: rp.x, y: rp.y }], dx: 0, dy: 0 }); setDrag({ type: "window", id: nid, ox: pos.x - rp.x, oy: pos.y - rp.y, isCopy: true }); }
          } else if (hit.type === "column") {
            const src = columns.find(c => c.id === hit.id);
            if (src) { const rp = resolvePos(src); setColumns(p => [...p, { ...src, id: nid, px: undefined, x: rp.x, y: rp.y }]); setSelectedId(nid); setSelType("column"); setLastCopyInfo({ srcItems: [{ id: nid, type: "column", x: rp.x, y: rp.y }], dx: 0, dy: 0 }); setDrag({ type: "column", id: nid, ox: pos.x - rp.x, oy: pos.y - rp.y, isCopy: true }); }
          } else if (hit.type === "marker") {
            const src = markers.find(m => m.id === hit.id);
            if (src) { const rp = resolvePos(src); setMarkers(p => [...p, { ...src, id: nid, px: undefined, x: rp.x, y: rp.y, deletedAtPhase: undefined }]); setSelectedId(nid); setSelType("marker"); setLastCopyInfo({ srcItems: [{ id: nid, type: "marker", x: rp.x, y: rp.y }], dx: 0, dy: 0 }); setDrag({ type: "marker", id: nid, ox: pos.x - rp.x, oy: pos.y - rp.y, isCopy: true }); }
          } else if (hit.type === "furniture") {
            const src = furniture.find(f => f.id === hit.id);
            if (src) { setFurniture(p => [...p, { ...src, id: nid, fromZone: undefined }]); setSelectedId(nid); setSelType("furniture"); setLastCopyInfo({ srcItems: [{ id: nid, type: "furniture", x: src.x, y: src.y }], dx: 0, dy: 0 }); setDrag({ type: "furniture", id: nid, ox: pos.x - src.x, oy: pos.y - src.y, isCopy: true }); }
          } else if (hit.type === "label") {
            const src = labels.find(l => l.id === hit.id);
            if (src) { setLabels(p => [...p, { ...src, id: nid }]); setSelectedId(nid); setSelType("label"); setLastCopyInfo({ srcItems: [{ id: nid, type: "label", x: src.x, y: src.y }], dx: 0, dy: 0 }); setDrag({ type: "label", id: nid, ox: pos.x - src.x, oy: pos.y - src.y, isCopy: true }); }
          }
        }
        return;
      }
      if (hit) {
        // Check if we're dragging multiple objects
        const isMultiDrag = selectedIds.length > 1 && selectedIds.includes(hit.id);
        
        if (isMultiDrag) {
          // Multi-object drag: capture initial positions of all selected objects
          const initialPositions = [];
          selectedIds.forEach(id => {
            const node = nodes.find(n => n.id === id);
            if (node) {
              initialPositions.push({ id, type: "node", x: node.x, y: node.y });
              return;
            }
            const zone = zones.find(z => z.id === id);
            if (zone) {
              if (zone.points) {
                const c = polyCentroid(zone.points);
                initialPositions.push({ id, type: "zone", centroid: c, points: zone.points.map(p => ({ ...p })) });
              } else {
                initialPositions.push({ id, type: "zone", x: zone.x, y: zone.y });
              }
              return;
            }
            const marker = markers.find(m => m.id === id);
            if (marker) {
              initialPositions.push({ id, type: "marker", x: marker.x, y: marker.y });
              return;
            }
            const door = doors.find(d => d.id === id);
            if (door) {
              initialPositions.push({ id, type: "door", x: door.x, y: door.y });
              return;
            }
            const window = windows.find(w => w.id === id);
            if (window) {
              initialPositions.push({ id, type: "window", x: window.x, y: window.y });
              return;
            }
            const column = columns.find(c => c.id === id);
            if (column) {
              initialPositions.push({ id, type: "column", x: column.x, y: column.y });
              return;
            }
            const lbl = labels.find(l => l.id === id);
            if (lbl) {
              initialPositions.push({ id, type: "label", x: lbl.x, y: lbl.y, lx: lbl.lx, ly: lbl.ly });
              return;
            }
            const rc = revClouds.find(r => r.id === id);
            if (rc) {
              const c = polyCentroid(rc.points);
              const startLabelPositions = labels.filter(l => l.anchorType === "revcloud" && l.anchorId === id).map(l => ({ id: l.id, x: l.x, y: l.y, lx: l.lx, ly: l.ly }));
              initialPositions.push({ id, type: "revcloud", centroid: c, points: rc.points.map(p => ({ ...p })), startLabelPositions });
              return;
            }
            const fp = flowPaths.find(r => r.id === id);
            if (fp) {
              initialPositions.push({ id, type: "flowPath", points: fp.points.map(p => ({ ...p })) });
              return;
            }
            const fr = floorRegions.find(r => r.id === id);
            if (fr) {
              initialPositions.push({ id, type: "floorRegion", points: fr.points.map(p => ({ ...p })) });
            }
          });

          setDrag({ type: "multi", objects: initialPositions, startX: pos.x, startY: pos.y, lastX: pos.x, lastY: pos.y,
                    polyCarry: polyCarry(
                      initialPositions.filter(o => o.type === "node").map(o => ({ id: o.id, x: o.x, y: o.y })),
                      initialPositions.map(o => o.id)) });
          setSelectedId(hit.id); setSelType(hit.type === "label-tip" ? "label" : hit.type);
        } else {
          // Clear multi-selection when clicking on a single object (unless shift is held)
          if (!e.shiftKey) {
            setSelectedIds([hit.id]);
          }
          const resolvedSelType = hit.type === "label-tip" ? "label"
            : (hit.type === "zone-vertex" || hit.type === "zone-edge") ? "zone"
            : (hit.type === "flowPath-vertex") ? "flowPath"
            : (hit.type === "floorRegion-vertex" || hit.type === "floorRegion-edge") ? "floorRegion"
            : hit.type === "dim-endpoint" ? "dim"
            : hit.type;
          setSelectedId(hit.id); setSelType(resolvedSelType);
          if (hit.type === "node") {
            if (e.detail === 2) {
              // Double-click node: merge two walls by removing this node
              const connWalls = walls.filter(w => w.n1 === hit.id || w.n2 === hit.id);
              if (connWalls.length === 2) {
                const [w1, w2] = connWalls;
                // Find the two outer nodes (not the one being removed)
                const outerN1 = w1.n1 === hit.id ? w1.n2 : w1.n1;
                const outerN2 = w2.n1 === hit.id ? w2.n2 : w2.n1;
                // Keep w1, update it to span outerN1→outerN2, remove w2 and the node
                setWalls(p => p.filter(w => w.id !== w2.id).map(w => w.id === w1.id ? { ...w, n1: outerN1, n2: outerN2 } : w));
                setNodes(p => p.filter(n => n.id !== hit.id));
                setSelectedId(w1.id); setSelType("wall");
              }
            } else {
              // Find doors/windows on walls connected to this node, with parametric position
              const nodeAttached = [];
              walls.forEach(w => {
                if (w.n1 !== hit.id && w.n2 !== hit.id) return;
                const c = wc(w);
                if (!c) return;
                const isN1 = w.n1 === hit.id;
                [...doors, ...windows].forEach(item => {
                  if (ptSeg(item.x, item.y, c.x1, c.y1, c.x2, c.y2) < 8) {
                    const wdx = c.x2 - c.x1, wdy = c.y2 - c.y1, wlen2 = wdx * wdx + wdy * wdy;
                    const t = wlen2 > 0 ? ((item.x - c.x1) * wdx + (item.y - c.y1) * wdy) / wlen2 : 0;
                    if (!nodeAttached.some(a => a.id === item.id)) {
                      nodeAttached.push({ id: item.id, wallId: w.id, isN1, t, isDoor: doors.some(d => d.id === item.id) });
                    }
                  }
                });
              });
              const nStart = gn(hit.id);
              setDrag({ type: "node", id: hit.id, nodeAttached, startNode: nStart,
                        polyCarry: polyCarry([{ id: hit.id, x: nStart.x, y: nStart.y }]) });
            }
          }
          else if (hit.type === "wall") {
          if (e.detail === 2) {
            // Double-click wall: split wall by inserting a new node at click point
            const w = walls.find(ww => ww.id === hit.id), c = wc(w);
            if (c) {
              // Project click onto wall segment to get exact position
              const wdx = c.x2 - c.x1, wdy = c.y2 - c.y1, wlen2 = wdx * wdx + wdy * wdy;
              const t = wlen2 > 0 ? Math.max(0.05, Math.min(0.95, ((pos.x - c.x1) * wdx + (pos.y - c.y1) * wdy) / wlen2)) : 0.5;
              const newX = sn(c.x1 + t * wdx, snapGrid), newY = sn(c.y1 + t * wdy, snapGrid);
              const newNodeId = uid(), newWallId = uid();
              // Create new node at the split point
              setNodes(p => [...p, { id: newNodeId, x: newX, y: newY }]);
              // Original wall keeps n1→newNode, new wall goes newNode→n2
              const origN2 = w.n2;
              setWalls(p => [...p.map(ww => ww.id === w.id ? { ...ww, n2: newNodeId } : ww), { ...w, id: newWallId, n1: newNodeId, n2: origN2 }]);
              setSelectedId(newNodeId); setSelType("node");
            }
          } else {
            const w = walls.find(ww => ww.id === hit.id), c = wc(w);
            if (c) {
              const n1 = gn(w.n1), n2 = gn(w.n2);
              if (n1 && n2) {
                // Items on the dragged wall itself — parametric t keeps them on centerline
                // even when snap grid causes slight wall rotation.
                const doorIds = new Set(doors.map(d => d.id));
                const attachedItems = [];
                const wdxA = c.x2 - c.x1, wdyA = c.y2 - c.y1, wlen2A = wdxA * wdxA + wdyA * wdyA;
                const itemIds = new Set();
                [...doors, ...windows].forEach(item => {
                  if (ptSeg(item.x, item.y, c.x1, c.y1, c.x2, c.y2) < 8) {
                    const t = wlen2A > 0 ? ((item.x - c.x1) * wdxA + (item.y - c.y1) * wdyA) / wlen2A : 0;
                    attachedItems.push({ id: item.id, t, isDoor: doorIds.has(item.id) });
                    itemIds.add(item.id);
                  }
                });
                // Items on adjacent walls — when this wall translates, shared nodes move,
                // causing adjacent walls to skew. Reposition items along the new skewed wall.
                const adjacentAttached = [];
                [{ nodeId: w.n1, isN1W: true }, { nodeId: w.n2, isN1W: false }].forEach(({ nodeId, isN1W }) => {
                  walls.forEach(adjW => {
                    if (adjW.id === w.id) return;
                    if (adjW.n1 !== nodeId && adjW.n2 !== nodeId) return;
                    const adjC = wc(adjW);
                    if (!adjC) return;
                    const sharedIsN1ofAdj = adjW.n1 === nodeId;
                    const otherX = sharedIsN1ofAdj ? adjC.x2 : adjC.x1;
                    const otherY = sharedIsN1ofAdj ? adjC.y2 : adjC.y1;
                    const adjDx = adjC.x2 - adjC.x1, adjDy = adjC.y2 - adjC.y1, adjLen2 = adjDx * adjDx + adjDy * adjDy;
                    [...doors, ...windows].forEach(item => {
                      if (itemIds.has(item.id)) return;
                      if (ptSeg(item.x, item.y, adjC.x1, adjC.y1, adjC.x2, adjC.y2) < 8) {
                        const t = adjLen2 > 0 ? ((item.x - adjC.x1) * adjDx + (item.y - adjC.y1) * adjDy) / adjLen2 : 0;
                        adjacentAttached.push({ id: item.id, t, isDoor: doorIds.has(item.id), isN1W, sharedIsN1WA: sharedIsN1ofAdj, otherX, otherY });
                        itemIds.add(item.id);
                      }
                    });
                  });
                });
                setDrag({ type: "wall", id: hit.id, ox: pos.x, oy: pos.y, n1x: n1.x, n1y: n1.y, n2x: n2.x, n2y: n2.y, attached: attachedItems, adjacentAttached,
                          polyCarry: polyCarry([{ id: w.n1, x: n1.x, y: n1.y }, { id: w.n2, x: n2.x, y: n2.y }]) });
              }
            }
          }
        }
        else if (hit.type === "dim-endpoint") {
          const d = dims.find(dd => dd.id === hit.id);
          if (d) {
            const r = resolveDimEndpoints(d);
            const pt = hit.ep === 0 ? { x: r.x1, y: r.y1 } : { x: r.x2, y: r.y2 };
            setDrag({ type: "dim-endpoint", id: hit.id, ep: hit.ep, ox: pos.x - pt.x, oy: pos.y - pt.y });
          }
        }
        else if (hit.type === "guide") {
          setDrag({ type: "guide", id: hit.id, downX: e.clientX, downY: e.clientY });
        }
        else if (hit.type === "zone-vertex") {
          const z = zones.find(zz => zz.id === hit.id);
          if (z && z.points) {
            if (e.detail === 2 && z.points.length > 3) {
              // Double-click vertex: remove it (keep at least 3 points)
              setZones(p => p.map(zz => zz.id === hit.id ? { ...zz, points: zz.points.filter((_, i) => i !== hit.vertexIndex) } : zz));
            } else if (e.detail < 2) {
              const rpts = resolvePoints(z);
              const vt = rpts[hit.vertexIndex];
              setDrag({ type: "zone-vertex", id: hit.id, vertexIndex: hit.vertexIndex, ox: pos.x - vt.x, oy: pos.y - vt.y });
            }
          }
        }
        else if (hit.type === "zone-edge") {
          const z = zones.find(zz => zz.id === hit.id);
          if (z && z.points) {
            if (e.detail === 2) {
              // Double-click on edge: insert a vertex
              const ei = hit.edgeIndex, ej = (ei + 1) % z.points.length;
              const newPt = { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) };
              const newPoints = [...z.points];
              newPoints.splice(ej, 0, newPt);
              setZones(p => p.map(zz => zz.id === hit.id ? { ...zz, points: newPoints } : zz));
            } else {
              const rpts = resolvePoints(z);
              const ei = hit.edgeIndex, ej = (ei + 1) % rpts.length;
              const p1 = rpts[ei], p2 = rpts[ej];
              const edx = p2.x - p1.x, edy = p2.y - p1.y;
              const elen = Math.hypot(edx, edy) || 1;
              setDrag({ type: "zone-edge", id: hit.id, edgeIndex: ei, ox: pos.x, oy: pos.y, p1x: p1.x, p1y: p1.y, p2x: p2.x, p2y: p2.y, nx: -edy / elen, ny: edx / elen, cursor: wallResizeCursor(p1.x, p1.y, p2.x, p2.y) });
            }
          }
        }
        else if (hit.type === "zone") {
          const z = zones.find(zz => zz.id === hit.id);
          if (!z) { /* zone deleted between hit test and drag */ }
          else if (e.detail === 2 && z.points) {
            // Double-click on zone: add a vertex on nearest edge
            let bestDist = Infinity, bestIdx = -1;
            for (let i = 0; i < z.points.length; i++) {
              const j = (i + 1) % z.points.length;
              const d = ptSeg(pos.x, pos.y, z.points[i].x, z.points[i].y, z.points[j].x, z.points[j].y);
              if (d < bestDist) { bestDist = d; bestIdx = j; }
            }
            if (bestDist < 15) {
              const newPt = { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) };
              const newPoints = [...z.points];
              newPoints.splice(bestIdx, 0, newPt);
              setZones(p => p.map(zz => zz.id === hit.id ? { ...zz, points: newPoints } : zz));
            }
          }
          else if (z.points) {
            const rpts = resolvePoints(z);
            const c = polyCentroid(rpts);
            setDrag({ type: "zone", id: hit.id, ox: pos.x - c.x, oy: pos.y - c.y, startX: sn(c.x, snapGrid), startY: sn(c.y, snapGrid), startPts: rpts, lastX: sn(c.x, snapGrid), lastY: sn(c.y, snapGrid), startFurn: zoneFurnStart(z, rpts) });
          } else if (zoneEdge && zoneEdge.id === hit.id) {
            setResize({ id: hit.id, edge: zoneEdge.edge });
          } else {
            // startX/Y let the move handler derive a total delta to apply to the furniture,
            // the same way the polygon branch already does.
            setDrag({ type: "zone", id: hit.id, ox: pos.x - z.x, oy: pos.y - z.y, startX: z.x, startY: z.y, startFurn: zoneFurnStart(z, null) });
          }
        }
          else if (hit.type === "furniture") { const f = furniture.find(ff => ff.id === hit.id); if (f) { setDrag({ type: "furniture", id: hit.id, ox: pos.x - f.x, oy: pos.y - f.y }); } }
          else if (hit.type === "marker") { const p = markers.find(pp => pp.id === hit.id); if (p) { const rp = resolvePos(p); setDrag({ type: "marker", id: hit.id, ox: pos.x - rp.x, oy: pos.y - rp.y }); } }
          else if (hit.type === "door") { const d = doors.find(dd => dd.id === hit.id); if (d) { const rp = resolvePos(d); setDrag({ type: "door", id: hit.id, ox: pos.x - rp.x, oy: pos.y - rp.y }); } }
          else if (hit.type === "window") { const w = windows.find(ww => ww.id === hit.id); if (w) { const rp = resolvePos(w); setDrag({ type: "window", id: hit.id, ox: pos.x - rp.x, oy: pos.y - rp.y }); } }
          else if (hit.type === "column") { const c = columns.find(cc => cc.id === hit.id); if (c) { const rp = resolvePos(c); setDrag({ type: "column", id: hit.id, ox: pos.x - rp.x, oy: pos.y - rp.y }); } }
          else if (hit.type === "dim") { setDrag({ type: "dim", id: hit.id }); }
          else if (hit.type === "label-tip") {
            setSelectedId(hit.id); setSelType("label"); setSelectedIds([hit.id]);
            setDrag({ type: "label-tip", id: hit.id, snapX: null, snapY: null, snapped: false, snapAnchorId: null, snapAnchorType: null });
          }
          else if (hit.type === "label") {
            if (e.detail < 2) {
              const hitLbl = labels.find(l => l.id === hit.id);
              setDrag({ type: "label", id: hit.id, ox: pos.x - (hitLbl?.x ?? 0), oy: pos.y - (hitLbl?.y ?? 0) });
            }
            // double-click handled by onClick on the <g> via e.detail >= 2
          }
          else if (hit.type === "revcloud-vertex") {
            const rc = revClouds.find(r => r.id === hit.id);
            if (rc) {
              if (e.detail === 2 && rc.points.length > 3)
                setRevClouds(p => p.map(r => r.id === hit.id ? { ...r, points: r.points.filter((_, i) => i !== hit.vertexIndex) } : r));
              else if (e.detail < 2) {
                const vt = rc.points[hit.vertexIndex];
                setDrag({ type: "revcloud-vertex", id: hit.id, vertexIndex: hit.vertexIndex, ox: pos.x - vt.x, oy: pos.y - vt.y, origVx: vt.x, origVy: vt.y });
              }
            }
          }
          else if (hit.type === "revcloud-edge") {
            const rc = revClouds.find(r => r.id === hit.id);
            if (rc) {
              if (e.detail === 2) {
                // Double-click: insert a new vertex on this edge
                const newPts = [...rc.points];
                newPts.splice((hit.edgeIndex + 1) % rc.points.length, 0, { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) });
                setRevClouds(p => p.map(r => r.id === hit.id ? { ...r, points: newPts } : r));
              } else {
                // Single drag: move both endpoints of this edge together
                const ei = hit.edgeIndex, ej = (hit.edgeIndex + 1) % rc.points.length;
                const a = rc.points[ei], b = rc.points[ej];
                setDrag({ type: "revcloud-edge", id: hit.id, edgeIndex: ei,
                  ox: pos.x, oy: pos.y,
                  startA: { ...a }, startB: { ...b },
                  cursor: wallResizeCursor(a.x, a.y, b.x, b.y) });
              }
            }
          }
          else if (hit.type === "revcloud") {
            const rc = revClouds.find(r => r.id === hit.id);
            if (rc) {
              const c = polyCentroid(rc.points);
              const startLabelPositions = labels
                .filter(l => l.anchorType === "revcloud" && l.anchorId === rc.id)
                .map(l => ({ id: l.id, x: l.x, y: l.y, lx: l.lx, ly: l.ly }));
              setDrag({ type: "revcloud", id: hit.id, ox: pos.x - c.x, oy: pos.y - c.y,
                startX: c.x, startY: c.y, startPts: rc.points.map(p => ({ ...p })), startLabelPositions });
            }
          }
          else if (hit.type === "flowPath-vertex") {
            const fp = flowPaths.find(r => r.id === hit.id);
            if (fp) {
              if (e.detail === 2 && fp.points.length > 2)
                setFlowPaths(p => p.map(r => r.id === hit.id ? { ...r, points: r.points.filter((_, i) => i !== hit.vertexIndex) } : r));
              else if (e.detail < 2) {
                const vt = fp.points[hit.vertexIndex];
                setDrag({ type: "flowPath-vertex", id: hit.id, vertexIndex: hit.vertexIndex, ox: pos.x - vt.x, oy: pos.y - vt.y });
              }
            }
          }
          else if (hit.type === "flowPath") {
            const fp = flowPaths.find(r => r.id === hit.id);
            if (fp) {
              if (e.detail === 2) {
                // Double-click on band: insert a vertex at the click point on that segment
                const newPts = [...fp.points];
                newPts.splice(hit.edgeIndex + 1, 0, { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) });
                setFlowPaths(p => p.map(r => r.id === hit.id ? { ...r, points: newPts } : r));
              } else {
                const cx = fp.points.reduce((s,p)=>s+p.x,0)/fp.points.length, cy = fp.points.reduce((s,p)=>s+p.y,0)/fp.points.length;
                setDrag({ type: "flowPath", id: hit.id, ox: pos.x - cx, oy: pos.y - cy, startX: cx, startY: cy, startPts: fp.points.map(p => ({ ...p })) });
              }
            }
          }
          else if (hit.type === "floorRegion-vertex") {
            const fr = floorRegions.find(r => r.id === hit.id);
            if (fr) {
              if (e.detail === 2 && fr.points.length > 3)
                setFloorRegions(p => p.map(r => r.id === hit.id ? { ...r, points: r.points.filter((_, i) => i !== hit.vertexIndex) } : r));
              else if (e.detail < 2) {
                const vt = fr.points[hit.vertexIndex];
                setDrag({ type: "floorRegion-vertex", id: hit.id, vertexIndex: hit.vertexIndex, ox: pos.x - vt.x, oy: pos.y - vt.y });
              }
            }
          }
          else if (hit.type === "floorRegion-edge") {
            const fr = floorRegions.find(r => r.id === hit.id);
            if (fr) {
              if (e.detail === 2) {
                const ej = (hit.edgeIndex + 1) % fr.points.length;
                const newPts = [...fr.points];
                newPts.splice(ej, 0, { x: sn(pos.x, snapGrid), y: sn(pos.y, snapGrid) });
                setFloorRegions(p => p.map(r => r.id === hit.id ? { ...r, points: newPts } : r));
              } else {
                const ei = hit.edgeIndex, ej = (ei + 1) % fr.points.length;
                const a = fr.points[ei], b = fr.points[ej];
                const edx = b.x - a.x, edy = b.y - a.y, elen = Math.hypot(edx, edy) || 1;
                setDrag({ type: "floorRegion-edge", id: hit.id, edgeIndex: ei, ox: pos.x, oy: pos.y,
                  startA: { ...a }, startB: { ...b }, nx: -edy / elen, ny: edx / elen,
                  cursor: wallResizeCursor(a.x, a.y, b.x, b.y) });
              }
            }
          }
          else if (hit.type === "floorRegion") {
            const fr = floorRegions.find(r => r.id === hit.id);
            if (fr) {
              const c = polyCentroid(fr.points);
              setDrag({ type: "floorRegion", id: hit.id, ox: pos.x - c.x, oy: pos.y - c.y, startX: c.x, startY: c.y, startPts: fr.points.map(p => ({ ...p })) });
            }
          }
        }
      } else {
        // No hit — Alt+drag moves underlay image, otherwise start marquee selection
        if (e.altKey && bgImage) {
          setDrag({ type: "underlay", ox: pos.x - bgOffset.x, oy: pos.y - bgOffset.y });
        } else {
          // Start marquee selection
          setMarquee({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
          if (!e.shiftKey) {
            setSelectedId(null); setSelType(null); setSelectedIds([]);
          }
        }
      }
    }
  }, [tool, activeZoneType, activeSpecLayer, activeFurnitureType, s2c, findNear, findDimSnap, hitTest, walls, wc, zones, markers, furniture, doors, windows, columns, labels, revClouds, flowPaths, viewOff, drawChain, drawRect, commitWallSegment, floorMaterial, spaceHeld, doorWidth, windowWidth, columnSize, columnShape, snapToWall, snapGrid, activeComponentType, markerFinish, nodeCentroid, bgImage, bgOffset, gn, calibrationLine, drawDim, dims, nodes, pxPerFoot, zoneEdge, resolvePos, resolvePoints, activePhase, addingLeaderToId, snapLabelAnchor, drawRevCloud, drawFlowPath, floorRegions, drawFloorRegion, polyCentroid, resolveDimEndpoints,
    columnLabel, columnNotes, doorFlipped, doorHingeRight, doorType, htrackAngle, isWallTool, lightingIsNew, lightingType, markerNotes, mode, outletIsNew, outletType, setCursorPos, setDimInput, setLastCopyInfo, setT, setTool, wallKind, windowHeight, windowSill, windowType, zoneLibrary, zoneNotes, zonePaintColor, zonePaintFinish, zoneFurnStart, polyCarry, commitRectRoom,]);

  const onMove = useCallback((e) => {
    if (panning && panSt) {
      const dsx = e.clientX - panSt.sx, dsy = e.clientY - panSt.sy;
      let dvx = dsx, dvy = dsy;
      if (canvasRotation !== 0) {
        const rad = -canvasRotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        dvx = dsx * cos - dsy * sin;
        dvy = dsx * sin + dsy * cos;
      }
      setViewOff({ x: panSt.ox + dvx, y: panSt.oy + dvy });
      return;
    }
    const pos = s2c(e.clientX, e.clientY);
    let sx = sn(pos.x, snapGrid), sy = sn(pos.y, snapGrid);

    // Wall chain: track cursor for preview
    if (isWallTool(tool)) {
      if (e.shiftKey && drawChain) {
        const o = orthoSnap(drawChain.lastX, drawChain.lastY, sx, sy);
        sx = sn(o.x, snapGrid); sy = sn(o.y, snapGrid);
      }
      const near = findNear(sx, sy, drawChain?.lastNodeId ? [drawChain.lastNodeId] : []);
      const wallSnap2 = !near ? snapToWall(sx, sy, SNAP_R) : null;
      let cpx = near ? near.x : wallSnap2 ? wallSnap2.x : sx;
      let cpy = near ? near.y : wallSnap2 ? wallSnap2.y : sy;
      // Smart guides while drawing — only when not already snapping to a node or wall
      if (!near && !wallSnap2 && drawChain) {
        const excludeId = drawChain.lastNodeId;
        const wallGuideTargets = [
          ...nodes.filter(n => n.id !== excludeId).map(n => ({ x: n.x, y: n.y })),
          ...doors.map(d => ({ x: d.x, y: d.y })),
          ...windows.map(w => ({ x: w.x, y: w.y })),
        ];
        const g = applySmartGuides(cpx, cpy, wallGuideTargets);
        cpx = g.x; cpy = g.y;
        setSmartGuides(g.guides);
      } else {
        setSmartGuides([]);
      }
      setCursorPos({ x: cpx, y: cpy, snap: !!(near || wallSnap2) });
      setHoverNid(near ? near.id : null);
      return;
    }

    // Rect-room tool: track the (snapped) cursor for the ghost rectangle
    if (tool === "rect") {
      const near = findNear(sx, sy);
      const ws = !near ? snapToWall(sx, sy, SNAP_R) : null;
      setCursorPos({ x: near ? near.x : ws ? ws.x : sx, y: near ? near.y : ws ? ws.y : sy, snap: !!(near || ws) });
      setHoverNid(near ? near.id : null);
      return;
    }

    // Calibration line: track cursor for preview
    if (tool === "calibrate" && calibrationLine && calibrationLine.p1 && !calibrationLine.p2) {
      setCursorPos({ x: pos.x, y: pos.y });
      return;
    }

    // Update marquee selection while dragging
    if (marquee) {
      setMarquee(prev => ({ ...prev, endX: pos.x, endY: pos.y }));
      return;
    }

    if (tool === "select" && !drag) {
      const near = findNear(pos.x, pos.y);
      setHoverNid(near ? near.id : null);
      // Proximity-hover: preview the nearest hoverable as cursor approaches
      setProxHover(findProxHover(pos.x, pos.y));
      // Reveal a faded elevation guide as the cursor nears its line (so it's grabbable)
      const gtol = 6 / zoom;
      let gid = null;
      for (let i = guides.length - 1; i >= 0; i--) {
        const g = guides[i], horiz = g.dir === "front" || g.dir === "back";
        if (Math.abs((horiz ? pos.y : pos.x) - g.pos) < gtol) { gid = g.id; break; }
      }
      setHoverGuideId(prev => prev === gid ? prev : gid);
    } else if (drag && PROX_DRAG_TYPES.has(drag.type)) {
      // While dragging a face/edge/vertex/element, keep the proximity preview
      // alive (excluding the dragged item itself) so nearby snap targets glow.
      const ph = findProxHover(pos.x, pos.y);
      setProxHover(ph && ph.id !== drag.id ? ph : null);
    } else if (proxHover) {
      setProxHover(null);
    }
    if (tool === "dim") {
      if (e.shiftKey && drawDim && !("x2" in drawDim)) { const o = orthoSnap(drawDim.x1, drawDim.y1, sx, sy); setGhostPos({ x: o.x, y: o.y, snapped: false }); }
      else { const dsnap = findDimSnap(pos.x, pos.y); setGhostPos(dsnap ? { x: dsnap.x, y: dsnap.y, snapped: true } : { x: pos.x, y: pos.y, snapped: false }); }
    }
    if (tool === "zone" || tool === "marker" || tool === "column" || tool === "furniture") { setGhostPos({ x: sx, y: sy }); }
    if (tool === "revcloud") {
      const lp = drawRevCloud?.points?.[drawRevCloud.points.length - 1];
      if (e.shiftKey && lp) { const o = orthoSnap(lp.x, lp.y, sx, sy); setGhostPos({ x: o.x, y: o.y, snapped: false }); }
      else { const near = findNear(pos.x, pos.y); setGhostPos(near ? { x: near.x, y: near.y, snapped: true } : { x: sx, y: sy, snapped: false }); }
    }
    if (tool === "flowPath") {
      const lp = drawFlowPath?.points?.[drawFlowPath.points.length - 1];
      if (e.shiftKey && lp) { const o = orthoSnap(lp.x, lp.y, sx, sy); setGhostPos({ x: o.x, y: o.y, snapped: false }); }
      else { const near = findNear(pos.x, pos.y); setGhostPos(near ? { x: near.x, y: near.y, snapped: true } : { x: sx, y: sy, snapped: false }); }
    }
    if (tool === "floorRegion") {
      // snap-to-first when near the opening vertex (3+ pts) for a clean close
      let snappedFirst = false;
      if (drawFloorRegion && drawFloorRegion.points.length >= 3) {
        const p0 = drawFloorRegion.points[0];
        if (dst(pos.x, pos.y, p0.x, p0.y) < SNAP_R * 1.5) { setGhostPos({ x: p0.x, y: p0.y, snapped: true, closing: true }); snappedFirst = true; }
      }
      const lp = drawFloorRegion?.points?.[drawFloorRegion.points.length - 1];
      if (!snappedFirst && e.shiftKey && lp) { const o = orthoSnap(lp.x, lp.y, sx, sy); setGhostPos({ x: o.x, y: o.y, snapped: false }); snappedFirst = true; }
      if (!snappedFirst) {
        const near = findNear(pos.x, pos.y);
        setGhostPos(near ? { x: near.x, y: near.y, snapped: true } : { x: sx, y: sy, snapped: false });
      }
    }
    if (tool === "label") {
      const snap = snapLabelAnchor(pos.x, pos.y);
      setGhostPos({ x: snap.x, y: snap.y, snapped: !!(snap.anchorId || snap.x !== pos.x || snap.y !== pos.y) });
    }
    // Leader tip drag: snap to objects and update ghost for snap indicator
    if (drag?.type === "label-tip") {
      const { x, y, anchorId, anchorType } = snapLabelAnchor(pos.x, pos.y);
      setGhostPos({ x, y, snapped: !!anchorId });
      setDrag(d => ({ ...d, snapX: x, snapY: y, snapAnchorId: anchorId, snapAnchorType: anchorType, snapped: !!anchorId }));
      return;
    }
    if (drag?.type === "label-place") {
      const snap = snapLabelAnchor(pos.x, pos.y);
      setGhostPos({ x: snap.x, y: snap.y, snapped: !!(snap.anchorId || snap.x !== pos.x || snap.y !== pos.y) });
      return;
    }
    if (tool === "door" || tool === "window") {
      const snap = snapToWall(pos.x, pos.y);
      if (snap) setGhostPos({ x: snap.x, y: snap.y, angle: snap.angle, snapped: true });
      else setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
    }
    if (tool === "outlet") {
      const isCeiling = outletType === "outlet_ceiling" || outletType === "pendent_prewire" || outletType.startsWith("htrack_");
      if (isCeiling) {
        const angle = outletType.startsWith("htrack_") ? (htrackAngle * Math.PI / 180) : 0;
        setGhostPos({ x: sx, y: sy, angle, snapped: false });
      } else {
        const snap = snapToWall(pos.x, pos.y, Infinity);
        if (snap) {
          const ang = snap.angle * Math.PI / 180;
          const side = isWallOffsetComponent(outletType) ? wallSideSign(pos.x, pos.y, snap.x, snap.y, ang) : undefined;
          setGhostPos({ x: snap.x, y: snap.y, angle: ang, side, snapped: true });
        } else setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
      }
    }
    if (tool === "lighting") {
      if (lightingType !== "light_sconce" && lightingType !== "sconce_prewire") {
        const angle = lightingType.startsWith("htrack_") ? (htrackAngle * Math.PI / 180) : 0;
        setGhostPos({ x: sx, y: sy, angle, snapped: false });
      } else {
        const snap = snapToWall(pos.x, pos.y, Infinity);
        if (snap) {
          const ang = snap.angle * Math.PI / 180;
          const side = isWallOffsetComponent(lightingType) ? wallSideSign(pos.x, pos.y, snap.x, snap.y, ang) : undefined;
          setGhostPos({ x: snap.x, y: snap.y, angle: ang, side, snapped: true });
        } else setGhostPos({ x: sx, y: sy, angle: 0, snapped: false });
      }
    }

    // Zone edge detection — drives resize cursor and onDown decision
    if (!drag && !resize) {
      let fe = null;
      for (const z of zones) {
        if (z.points) continue;
        const T = 12 / zoom;
        if (pos.x < z.x - T || pos.x > z.x + z.w + T || pos.y < z.y - T || pos.y > z.y + z.h + T) continue;
        const inX = pos.x >= z.x && pos.x <= z.x + z.w;
        const inY = pos.y >= z.y && pos.y <= z.y + z.h;
        if (!inX || !inY) continue;
        const nL = pos.x - z.x < T, nR = z.x + z.w - pos.x < T;
        const nT = pos.y - z.y < T, nB = z.y + z.h - pos.y < T;
        if (nT && nL) { fe = { id: z.id, edge: "nw", cursor: "nwse-resize" }; break; }
        if (nT && nR) { fe = { id: z.id, edge: "ne", cursor: "nesw-resize" }; break; }
        if (nB && nL) { fe = { id: z.id, edge: "sw", cursor: "nesw-resize" }; break; }
        if (nB && nR) { fe = { id: z.id, edge: "se", cursor: "nwse-resize" }; break; }
        if (nT)       { fe = { id: z.id, edge: "n",  cursor: "ns-resize"   }; break; }
        if (nB)       { fe = { id: z.id, edge: "s",  cursor: "ns-resize"   }; break; }
        if (nL)       { fe = { id: z.id, edge: "w",  cursor: "ew-resize"   }; break; }
        if (nR)       { fe = { id: z.id, edge: "e",  cursor: "ew-resize"   }; break; }
      }
      setZoneEdge(fe);
    }

    if (rotatingMarker) {
      const dx = pos.x - rotatingMarker.cx;
      const dy = pos.y - rotatingMarker.cy;
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (e.shiftKey) angle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      setMarkers(prev => prev.map(m => m.id === rotatingMarker.id ? { ...m, angle } : m));
      return;
    }

    if (rotatingFurniture) {
      const dx = pos.x - rotatingFurniture.cx, dy = pos.y - rotatingFurniture.cy;
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      // Snap to 15° by default; hold Shift for free rotation (inverse of the marker rule,
      // matching furniture's usual grid-aligned placement).
      if (!e.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
      setFurniture(prev => prev.map(f => f.id === rotatingFurniture.id ? { ...f, angle } : f));
      return;
    }

    if (furnitureResize) {
      // Opposite-edge-anchored resize in the piece's ROTATED frame (ux = width axis,
      // uy = depth axis, both unit). `sx`/`sy` are the dragged handle's local sign (−1/0/1);
      // the opposite edge/corner (the anchor) stays fixed. Work in projections onto (ux,uy):
      // the new extent along an axis is the cursor's distance from the anchor on that axis,
      // snapped to the inch (≥6"); the axis the handle doesn't touch keeps the centre.
      const { id, sx, sy, ax, ay, ux, uy } = furnitureResize;
      const inchPx = pxPerFoot / 12, snap = (px) => Math.max(inchPx * 6, Math.round(px / inchPx) * inchPx);
      const au = ax * ux[0] + ay * ux[1], av = ax * uy[0] + ay * uy[1];        // anchor proj
      const pu = pos.x * ux[0] + pos.y * ux[1], pv = pos.x * uy[0] + pos.y * uy[1]; // cursor proj
      setFurniture(prev => prev.map(f => {
        if (f.id !== id) return f;
        let w = f.w, d = f.d;
        let cu = f.x * ux[0] + f.y * ux[1], cv = f.x * uy[0] + f.y * uy[1];     // centre proj
        if (sx) { const wpx = snap((pu - au) * sx); w = wpx / pxPerFoot; cu = au + sx * wpx / 2; }
        if (sy) { const dpx = snap((pv - av) * sy); d = dpx / pxPerFoot; cv = av + sy * dpx / 2; }
        return { ...f, w: +w.toFixed(4), d: +d.toFixed(4), x: cu * ux[0] + cv * uy[0], y: cu * ux[1] + cv * uy[1] };
      }));
      return;
    }

    if (drag) {
      // Wall/node topology welds operate on the base ("existing") geometry only — phase
      // overrides move px positions, not the shared node graph.
      const baseGeom = !activePhase || activePhase === "existing";
      // Build smart-guide target list — all element centers except the one(s) being dragged
      const _dragIds = new Set(
        drag.type === "multi" ? drag.objects.map(o => o.id)
        : drag.type === "wall" ? [walls.find(w => w.id === drag.id)?.n1, walls.find(w => w.id === drag.id)?.n2].filter(Boolean)
        : [drag.id]
      );
      const _guideTargets = [
        ...nodes.filter(n => !_dragIds.has(n.id)).map(n => ({ x: n.x, y: n.y })),
        ...doors.filter(d => !_dragIds.has(d.id)).map(d => ({ x: d.x, y: d.y })),
        ...windows.filter(w => !_dragIds.has(w.id)).map(w => ({ x: w.x, y: w.y })),
        ...columns.filter(c => !_dragIds.has(c.id)).map(c => ({ x: c.x, y: c.y })),
        ...markers.filter(m => !_dragIds.has(m.id)).map(m => ({ x: m.x, y: m.y })),
      ];

      if (drag.type === "multi") {
        // Multi-object drag
        const dx = sn(pos.x, snapGrid) - sn(drag.lastX, snapGrid);
        const dy = sn(pos.y, snapGrid) - sn(drag.lastY, snapGrid);
        
        if (dx || dy) {
          // Polygons NOT in the selection but whose corners sit on a selected node still
          // follow. Total delta from the snapped start — telescopes to the same sum the
          // per-frame node math applies, so floor and nodes stay in lockstep.
          if (drag.polyCarry?.length) {
            const tdx = sn(pos.x, snapGrid) - sn(drag.startX, snapGrid);
            const tdy = sn(pos.y, snapGrid) - sn(drag.startY, snapGrid);
            if (tdx || tdy) applyCarry(drag.polyCarry, () => ({ dx: tdx, dy: tdy }));
          }
          drag.objects.forEach(obj => {
            if (obj.type === "node") {
              setNodes(prev => prev.map(n => {
                if (n.id !== obj.id) return n;
                if (activePhase && activePhase !== "existing") {
                  const cur = n.px?.[activePhase] ?? { x: n.x, y: n.y };
                  return { ...n, px: { ...n.px, [activePhase]: { x: cur.x + dx, y: cur.y + dy } } };
                }
                return { ...n, x: n.x + dx, y: n.y + dy };
              }));
            } else if (obj.type === "zone") {
              const phased = activePhase && activePhase !== "existing";
              if (obj.points) {
                setZones(p => p.map(z => {
                  if (z.id !== obj.id) return z;
                  if (phased) {
                    const base = z.px?.[activePhase] ?? z.points;
                    return { ...z, px: { ...z.px, [activePhase]: base.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) } };
                  }
                  return { ...z, points: z.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
                }));
              } else {
                setZones(p => p.map(z => {
                  if (z.id !== obj.id) return z;
                  if (phased) {
                    const base = z.px?.[activePhase] ?? { x: z.x, y: z.y };
                    return { ...z, px: { ...z.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } };
                  }
                  return { ...z, x: z.x + dx, y: z.y + dy };
                }));
              }
            } else if (obj.type === "marker") {
              setMarkers(p => p.map(m => {
                if (m.id !== obj.id) return m;
                if (activePhase && activePhase !== "existing") { const base = m.px?.[activePhase] ?? { x: m.x, y: m.y }; return { ...m, px: { ...m.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } }; }
                return { ...m, x: m.x + dx, y: m.y + dy };
              }));
            } else if (obj.type === "door") {
              setDoors(p => p.map(d => {
                if (d.id !== obj.id) return d;
                if (activePhase && activePhase !== "existing") { const base = d.px?.[activePhase] ?? { x: d.x, y: d.y }; return { ...d, px: { ...d.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } }; }
                return { ...d, x: d.x + dx, y: d.y + dy };
              }));
            } else if (obj.type === "window") {
              setWindows(p => p.map(w => {
                if (w.id !== obj.id) return w;
                if (activePhase && activePhase !== "existing") { const base = w.px?.[activePhase] ?? { x: w.x, y: w.y }; return { ...w, px: { ...w.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } }; }
                return { ...w, x: w.x + dx, y: w.y + dy };
              }));
            } else if (obj.type === "column") {
              setColumns(p => p.map(c => {
                if (c.id !== obj.id) return c;
                if (activePhase && activePhase !== "existing") { const base = c.px?.[activePhase] ?? { x: c.x, y: c.y }; return { ...c, px: { ...c.px, [activePhase]: { x: base.x + dx, y: base.y + dy } } }; }
                return { ...c, x: c.x + dx, y: c.y + dy };
              }));
            } else if (obj.type === "label") {
              setLabels(p => p.map(l => l.id !== obj.id ? l : { ...l, x: l.x + dx, y: l.y + dy }));
            } else if (obj.type === "revcloud") {
              const rdx = sn(pos.x, snapGrid) - drag.startX, rdy = sn(pos.y, snapGrid) - drag.startY;
              setRevClouds(p => p.map(r => r.id !== obj.id ? r
                : { ...r, points: obj.points.map(pt => ({ x: pt.x + rdx, y: pt.y + rdy })) }));
              // move labels anchored to this cloud that aren't themselves in the multi-selection
              const selSet = new Set(useSelectionStore.getState().selectedIds);
              setLabels(p => p.map(l => {
                if (l.anchorType !== "revcloud" || l.anchorId !== obj.id || selSet.has(l.id)) return l;
                const lp = obj.startLabelPositions?.find(lsp => lsp.id === l.id);
                if (!lp || lp.lx == null) return l; // no leader → text stays put
                return { ...l, lx: lp.lx + rdx, ly: lp.ly + rdy }; // only leader tip moves
              }));
            } else if (obj.type === "flowPath") {
              const rdx = sn(pos.x, snapGrid) - drag.startX, rdy = sn(pos.y, snapGrid) - drag.startY;
              setFlowPaths(p => p.map(r => r.id !== obj.id ? r
                : { ...r, points: obj.points.map(pt => ({ x: pt.x + rdx, y: pt.y + rdy })) }));
            } else if (obj.type === "floorRegion") {
              const rdx = sn(pos.x, snapGrid) - drag.startX, rdy = sn(pos.y, snapGrid) - drag.startY;
              setFloorRegions(p => p.map(r => r.id !== obj.id ? r
                : { ...r, points: obj.points.map(pt => ({ x: pt.x + rdx, y: pt.y + rdy })) }));
            }
          });
          setDrag(d => ({ ...d, lastX: pos.x, lastY: pos.y }));
        }
      } else if (drag.type === "node") {
        const near = findNear(sx, sy, [drag.id]);
        let newNodeX = near ? near.x : sx, newNodeY = near ? near.y : sy;
        if (near) { setSmartGuides([]); }
        else {
          // No node under the cursor — try welding onto another wall's body: snap the
          // node onto its centerline (mid-span only) so the drop becomes a clean
          // T-junction. Walls already touching this node are excluded.
          const incident = new Set(walls.filter(w => w.n1 === drag.id || w.n2 === drag.id).map(w => w.id));
          const ws = baseGeom ? snapToWall(sx, sy, SNAP_R, incident) : null;
          if (ws && ws.t > 0.02 && ws.t < 0.98) {
            newNodeX = ws.x; newNodeY = ws.y; setSmartGuides([]);
          } else {
            const g = applySmartGuides(newNodeX, newNodeY, _guideTargets);
            newNodeX = g.x; newNodeY = g.y;
            setSmartGuides(g.guides);
          }
        }
        setNodes(prev => prev.map(n => {
          if (n.id !== drag.id) return n;
          if (activePhase && activePhase !== "existing")
            return { ...n, px: { ...n.px, [activePhase]: { x: newNodeX, y: newNodeY } } };
          return { ...n, x: newNodeX, y: newNodeY };
        }));
        // Floor/zone corners sitting on this node come along — resize the room, resize its
        // floor. TOTAL delta from the drag-start position, so the vertex stays exactly on
        // the node however far the drag wanders.
        if (drag.startNode) {
          const cdx = newNodeX - drag.startNode.x, cdy = newNodeY - drag.startNode.y;
          if (cdx || cdy) applyCarry(drag.polyCarry, () => ({ dx: cdx, dy: cdy }));
        }
        setHoverNid(near ? near.id : null);
        // Reposition attached doors/windows along their walls
        if (drag.nodeAttached?.length) {
          drag.nodeAttached.forEach(att => {
            const w = walls.find(ww => ww.id === att.wallId);
            if (!w) return;
            // Get the current wall endpoints (the dragged node has new position)
            const a = w.n1 === drag.id ? { x: newNodeX, y: newNodeY } : gn(w.n1);
            const b = w.n2 === drag.id ? { x: newNodeX, y: newNodeY } : gn(w.n2);
            if (!a || !b) return;
            const nx = a.x + att.t * (b.x - a.x), ny = a.y + att.t * (b.y - a.y);
            const newAngle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
            if (att.isDoor) setDoors(p => p.map(d => d.id === att.id ? { ...d, x: nx, y: ny, angle: newAngle } : d));
            else setWindows(p => p.map(ww => ww.id === att.id ? { ...ww, x: nx, y: ny, angle: newAngle } : ww));
          });
        }
      } else if (drag.type === "wall") {
        const w = walls.find(ww => ww.id === drag.id);
        if (w) {
          const dx = pos.x - drag.ox;
          const dy = pos.y - drag.oy;
          const n1NewX = sn(drag.n1x + dx, snapGrid);
          const n1NewY = sn(drag.n1y + dy, snapGrid);
          const n2NewX = sn(drag.n2x + dx, snapGrid);
          const n2NewY = sn(drag.n2y + dy, snapGrid);
          const phased = activePhase && activePhase !== "existing";
          setNodes(prev => prev.map(n => {
            if (n.id === w.n1) return phased ? { ...n, px: { ...n.px, [activePhase]: { x: n1NewX, y: n1NewY } } } : { ...n, x: n1NewX, y: n1NewY };
            if (n.id === w.n2) return phased ? { ...n, px: { ...n.px, [activePhase]: { x: n2NewX, y: n2NewY } } } : { ...n, x: n2NewX, y: n2NewY };
            return n;
          }));
          // Items on the dragged wall — parametric reposition keeps them on the centerline.
          // Floor/zone corners on either endpoint follow that endpoint's own total delta,
          // so dragging a wall resizes the room's floor with it (and a corner drag yields a
          // matching trapezoid). Same snapshot-plus-total-delta shape as the openings below.
          if (drag.polyCarry?.length) {
            const d1 = { dx: n1NewX - drag.n1x, dy: n1NewY - drag.n1y };
            const d2 = { dx: n2NewX - drag.n2x, dy: n2NewY - drag.n2y };
            if (d1.dx || d1.dy || d2.dx || d2.dy) applyCarry(drag.polyCarry, id => id === w.n1 ? d1 : d2);
          }
          if (drag.attached?.length) {
            const newAngle = Math.atan2(n2NewY - n1NewY, n2NewX - n1NewX) * 180 / Math.PI;
            drag.attached.forEach(item => {
              const nx = n1NewX + item.t * (n2NewX - n1NewX);
              const ny = n1NewY + item.t * (n2NewY - n1NewY);
              const np = { x: nx, y: ny, angle: newAngle };
              if (item.isDoor) setDoors(p => p.map(d => {
                if (d.id !== item.id) return d;
                if (phased) return { ...d, px: { ...d.px, [activePhase]: np } };
                return { ...d, ...np };
              }));
              else setWindows(p => p.map(ww => {
                if (ww.id !== item.id) return ww;
                if (phased) return { ...ww, px: { ...ww.px, [activePhase]: np } };
                return { ...ww, ...np };
              }));
            });
          }
          // Items on adjacent walls that skew because a shared node moved.
          if (drag.adjacentAttached?.length) {
            drag.adjacentAttached.forEach(item => {
              const movingX = item.isN1W ? n1NewX : n2NewX;
              const movingY = item.isN1W ? n1NewY : n2NewY;
              const ax = item.sharedIsN1WA ? movingX : item.otherX;
              const ay = item.sharedIsN1WA ? movingY : item.otherY;
              const bx = item.sharedIsN1WA ? item.otherX : movingX;
              const by = item.sharedIsN1WA ? item.otherY : movingY;
              const nx = ax + item.t * (bx - ax);
              const ny = ay + item.t * (by - ay);
              const newAngle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
              if (item.isDoor) setDoors(p => p.map(d => d.id === item.id ? { ...d, x: nx, y: ny, angle: newAngle } : d));
              else setWindows(p => p.map(ww => ww.id === item.id ? { ...ww, x: nx, y: ny, angle: newAngle } : ww));
            });
          }
        }
      } else if (drag.type === "zone-edge") {
        const dx = pos.x - drag.ox, dy = pos.y - drag.oy;
        // Project movement onto edge normal for perpendicular drag
        const proj = dx * drag.nx + dy * drag.ny;
        const mx = sn(drag.nx * proj, snapGrid), my = sn(drag.ny * proj, snapGrid);
        const ei = drag.edgeIndex;
        setZones(p => p.map(zz => {
          if (zz.id !== drag.id) return zz;
          const ej = (ei + 1) % zz.points.length;
          return { ...zz, points: zz.points.map((pt, i) => {
            if (i === ei) return { x: drag.p1x + mx, y: drag.p1y + my };
            if (i === ej) return { x: drag.p2x + mx, y: drag.p2y + my };
            return pt;
          }) };
        }));
      } else if (drag.type === "dim-endpoint") {
        // Re-snap to nodes / wall-mids / columns / markers like creation does, else free grid point.
        const tx = pos.x - drag.ox, ty = pos.y - drag.oy;
        const snap = findDimSnap(tx, ty);
        const nx = snap ? snap.x : sn(tx, snapGrid), ny = snap ? snap.y : sn(ty, snapGrid);
        setDims(p => p.map(d => {
          if (d.id !== drag.id) return d;
          return drag.ep === 0
            ? { ...d, x1: nx, y1: ny, anchor1Id: snap?.anchorId ?? null, anchor1Type: snap?.anchorType ?? null }
            : { ...d, x2: nx, y2: ny, anchor2Id: snap?.anchorId ?? null, anchor2Type: snap?.anchorType ?? null };
        }));
      } else if (drag.type === "guide") {
        const g = guides.find(gg => gg.id === drag.id);
        if (g) {
          const axis = (g.dir === "front" || g.dir === "back") ? "y" : "x";
          const np = snapGuide(axis === "y" ? pos.y : pos.x, axis);
          setGuides(p => p.map(x => x.id === drag.id ? { ...x, pos: np } : x));
          setGuideScrub({ dir: g.dir, x: pos.x, y: pos.y }); // cursor drives the elevation camera
        }
      } else if (drag.type === "zone-vertex") {
        const newX = sn(pos.x - drag.ox, snapGrid), newY = sn(pos.y - drag.oy, snapGrid);
        setZones(p => p.map(zz => zz.id === drag.id ? { ...zz, points: zz.points.map((pt, i) => i === drag.vertexIndex ? { x: newX, y: newY } : pt) } : zz));
      } else if (drag.type === "zone") {
        const z = zones.find(zz => zz.id === drag.id);
        // Moving a zone carries its contents: the pieces captured at drag start shift by the
        // zone's own total delta, so the room arrives furnished exactly as it was laid out.
        const carryFurniture = (dx, dy) => {
          if (!drag.startFurn?.length) return;
          const by = new Map(drag.startFurn.map(f => [f.id, f]));
          setFurniture(p => p.map(f => {
            const s0 = by.get(f.id);
            return s0 ? { ...f, x: s0.x + dx, y: s0.y + dy } : f;
          }));
        };
        if (z?.points && drag.startPts) {
          const curX = sn(pos.x - drag.ox, snapGrid);
          const curY = sn(pos.y - drag.oy, snapGrid);
          const totalDx = curX - drag.startX;
          const totalDy = curY - drag.startY;
          const newPts = drag.startPts.map(pt => ({ x: pt.x + totalDx, y: pt.y + totalDy }));
          setZones(p => p.map(zz => {
            if (zz.id !== drag.id) return zz;
            if (activePhase && activePhase !== "existing") return { ...zz, px: { ...zz.px, [activePhase]: newPts } };
            return { ...zz, points: newPts };
          }));
          carryFurniture(totalDx, totalDy);
        } else if (z && !z.points) {
          const nx = sn(pos.x - drag.ox, snapGrid), ny = sn(pos.y - drag.oy, snapGrid);
          setZones(p => p.map(zz => zz.id === drag.id ? { ...zz, x: nx, y: ny } : zz));
          carryFurniture(nx - drag.startX, ny - drag.startY);
        }
      }
      else if (drag.type === "marker") {
        const dragMarker = markers.find(x => x.id === drag.id);
        const ct = dragMarker?.componentType;
        const isCeilingMount = ct === "outlet_ceiling" || ct === "pendent_prewire" || ct?.startsWith("htrack_") || (ct?.startsWith("light_") && ct !== "light_sconce");
        const isWallOutlet = dragMarker?.layer === "power" && ct && !isCeilingMount &&
          (ct.startsWith("outlet_") || ct.startsWith("switch_") || ct === "panel_board" || ct === "light_sconce" || ct === "sconce_prewire" || ct === "tstat");
        if (isWallOutlet) {
          const snap = snapToWall(pos.x, pos.y, Infinity);
          if (snap) {
            const ang = snap.angle * Math.PI / 180;
            const np = { x: snap.x, y: snap.y, angle: ang };
            // Dragging across the wall flips which room the symbol stands in.
            if (isWallOffsetComponent(ct)) np.side = wallSideSign(pos.x, pos.y, snap.x, snap.y, ang);
            setMarkers(p => p.map(x => {
              if (x.id !== drag.id) return x;
              if (activePhase && activePhase !== "existing") return { ...x, px: { ...x.px, [activePhase]: np } };
              return { ...x, ...np };
            }));
          }
          setSmartGuides([]);
        } else {
          const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
          const g = applySmartGuides(rawX, rawY, _guideTargets);
          setSmartGuides(g.guides);
          const np = { x: g.x, y: g.y };
          setMarkers(p => p.map(x => {
            if (x.id !== drag.id) return x;
            if (activePhase && activePhase !== "existing") return { ...x, px: { ...x.px, [activePhase]: np } };
            return { ...x, ...np };
          }));
        }
      }
      else if (drag.type === "door") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const snap = snapToWall(pos.x - drag.ox, pos.y - drag.oy);
        const fx = snap ? snap.x : rawX, fy = snap ? snap.y : rawY;
        setDoors(p => p.map(d => {
          if (d.id !== drag.id) return d;
          const override = { x: fx, y: fy, ...(snap ? { angle: snap.angle } : {}) };
          if (activePhase && activePhase !== "existing") return { ...d, px: { ...d.px, [activePhase]: override } };
          return { ...d, ...override };
        }));
        const g = applySmartGuides(fx, fy, _guideTargets);
        setSmartGuides(g.guides);
      }
      else if (drag.type === "window") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const snap = snapToWall(pos.x - drag.ox, pos.y - drag.oy);
        const fx = snap ? snap.x : rawX, fy = snap ? snap.y : rawY;
        setWindows(p => p.map(w => {
          if (w.id !== drag.id) return w;
          const override = { x: fx, y: fy, ...(snap ? { angle: snap.angle } : {}) };
          if (activePhase && activePhase !== "existing") return { ...w, px: { ...w.px, [activePhase]: override } };
          return { ...w, ...override };
        }));
        const g = applySmartGuides(fx, fy, _guideTargets);
        setSmartGuides(g.guides);
      }
      else if (drag.type === "column") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const g = applySmartGuides(rawX, rawY, _guideTargets);
        setSmartGuides(g.guides);
        setColumns(p => p.map(c => {
          if (c.id !== drag.id) return c;
          if (activePhase && activePhase !== "existing") return { ...c, px: { ...c.px, [activePhase]: { x: g.x, y: g.y } } };
          return { ...c, x: g.x, y: g.y };
        }));
      }
      else if (drag.type === "furniture") {
        const rawX = sn(pos.x - drag.ox, snapGrid), rawY = sn(pos.y - drag.oy, snapGrid);
        const g = applySmartGuides(rawX, rawY, _guideTargets);
        setSmartGuides(g.guides);
        setFurniture(p => p.map(f => f.id === drag.id ? { ...f, x: g.x, y: g.y } : f));
      }
      else if (drag.type === "dim") {
        const dim = dims.find(x => x.id === drag.id);
        if (dim) {
          const re = resolveDimEndpoints(dim);
          const ddx = re.x2 - re.x1, ddy = re.y2 - re.y1, dlen = Math.hypot(ddx, ddy);
          if (dlen > 0) {
            const nnx = -ddy / dlen, nny = ddx / dlen;
            const newOff = (pos.x - re.x1) * nnx + (pos.y - re.y1) * nny;
            setDims(p => p.map(x => x.id === drag.id ? { ...x, offset: newOff } : x));
          }
        }
      }
      else if (drag.type === "label") {
        const newX = sn(pos.x - drag.ox, snapGrid), newY = sn(pos.y - drag.oy, snapGrid);
        setLabels(p => p.map(l => l.id !== drag.id ? l : { ...l, x: newX, y: newY }));
      }
      else if (drag.type === "revcloud-edge") {
        const dx = pos.x - drag.ox, dy = pos.y - drag.oy;
        const ei = drag.edgeIndex;
        setRevClouds(p => p.map(r => {
          if (r.id !== drag.id) return r;
          const ej = (ei + 1) % r.points.length;
          return { ...r, points: r.points.map((pt, i) => {
            if (i === ei) return { x: sn(drag.startA.x + dx, snapGrid), y: sn(drag.startA.y + dy, snapGrid) };
            if (i === ej) return { x: sn(drag.startB.x + dx, snapGrid), y: sn(drag.startB.y + dy, snapGrid) };
            return pt;
          })};
        }));
      }
      else if (drag.type === "revcloud-vertex") {
        const newX = sn(pos.x - drag.ox, snapGrid), newY = sn(pos.y - drag.oy, snapGrid);
        setRevClouds(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: r.points.map((pt, i) => i === drag.vertexIndex ? { x: newX, y: newY } : pt) }));
        setLabels(p => p.map(l => {
          if (l.anchorType !== "revcloud" || l.anchorId !== drag.id) return l;
          const atTip = l.lx != null && Math.abs(l.lx - drag.origVx) < 1 && Math.abs(l.ly - drag.origVy) < 1;
          if (atTip) return { ...l, lx: newX, ly: newY };
          return l;
        }));
      }
      else if (drag.type === "revcloud") {
        const dx = sn(pos.x - drag.ox, snapGrid) - drag.startX;
        const dy = sn(pos.y - drag.oy, snapGrid) - drag.startY;
        setRevClouds(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: drag.startPts.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
        if (drag.startLabelPositions?.length) {
          const posMap = new Map(drag.startLabelPositions.map(lp => [lp.id, lp]));
          setLabels(p => p.map(l => {
            const lp = posMap.get(l.id);
            if (!lp || lp.lx == null) return l; // no leader → text stays put
            return { ...l, lx: lp.lx + dx, ly: lp.ly + dy }; // only leader tip moves
          }));
        }
      }
      else if (drag.type === "flowPath-vertex") {
        setFlowPaths(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: r.points.map((pt, i) => i === drag.vertexIndex
              ? { x: sn(pos.x - drag.ox, snapGrid), y: sn(pos.y - drag.oy, snapGrid) } : pt) }));
      }
      else if (drag.type === "flowPath") {
        const dx = sn(pos.x - drag.ox, snapGrid) - drag.startX;
        const dy = sn(pos.y - drag.oy, snapGrid) - drag.startY;
        setFlowPaths(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: drag.startPts.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
      }
      else if (drag.type === "floorRegion-vertex") {
        setFloorRegions(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: r.points.map((pt, i) => i === drag.vertexIndex
              ? { x: sn(pos.x - drag.ox, snapGrid), y: sn(pos.y - drag.oy, snapGrid) } : pt) }));
      }
      else if (drag.type === "floorRegion-edge") {
        const dx = pos.x - drag.ox, dy = pos.y - drag.oy;
        const proj = dx * drag.nx + dy * drag.ny;
        const mx = sn(drag.nx * proj, snapGrid), my = sn(drag.ny * proj, snapGrid);
        const ei = drag.edgeIndex;
        setFloorRegions(p => p.map(r => {
          if (r.id !== drag.id) return r;
          const ej = (ei + 1) % r.points.length;
          return { ...r, points: r.points.map((pt, i) => {
            if (i === ei) return { x: drag.startA.x + mx, y: drag.startA.y + my };
            if (i === ej) return { x: drag.startB.x + mx, y: drag.startB.y + my };
            return pt;
          }) };
        }));
      }
      else if (drag.type === "floorRegion") {
        const dx = sn(pos.x - drag.ox, snapGrid) - drag.startX;
        const dy = sn(pos.y - drag.oy, snapGrid) - drag.startY;
        setFloorRegions(p => p.map(r => r.id !== drag.id ? r
          : { ...r, points: drag.startPts.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }));
      }
      else if (drag.type === "underlay") {
        setBgOffset({ x: pos.x - drag.ox, y: pos.y - drag.oy });
      }
      return;
    }
    if (resize) {
      const { id: rid, edge } = resize;
      setZones(p => p.map(z => {
        if (z.id !== rid || z.points) return z;
        let { x, y, w, h } = z;
        const px = sn(pos.x, snapGrid), py = sn(pos.y, snapGrid);
        if (edge.includes("e")) w = Math.max(40, px - x);
        if (edge.includes("s")) h = Math.max(40, py - y);
        if (edge.includes("w")) { const nx = Math.min(px, x + w - 40); w = w + x - nx; x = nx; }
        if (edge.includes("n")) { const ny = Math.min(py, y + h - 40); h = h + y - ny; y = ny; }
        return { ...z, x, y, w, h };
      }));
    }
  }, [panning, panSt, canvasRotation, drawChain, drag, resize, s2c, findNear, findDimSnap, walls, wc, tool, snapToWall, snapGrid, marquee, calibrationLine, dims, drawDim, zones, zoom, rotatingMarker, rotatingFurniture, furnitureResize, outletType, lightingType, htrackAngle, nodes, doors, windows, columns, markers, furniture, activePhase, snapLabelAnchor, revClouds, drawRevCloud, flowPaths, drawFlowPath, floorRegions, drawFloorRegion, resolveDimEndpoints, snapGuide, guides, findProxHover, proxHover,
    gn, isWallTool, pxPerFoot, setBgOffset, setCursorPos, setGuideScrub, setHoverGuideId, setProxHover, setSmartGuides, setViewOff, setZoneEdge, applyCarry,]);

  const onUp = useCallback((e) => {
    // Selection read fresh at event time → kept out of the dep array (event-only handler).
    const { selectedId, selectedIds } = useSelectionStore.getState();
    // Guide drag: dropping back onto its source edge removes it (Figma behavior).
    if (drag?.type === "guide") {
      const g = guides.find(gg => gg.id === drag.id);
      const r = (cvsContainer.current ?? cvs.current)?.getBoundingClientRect();
      // Only delete if the user actually dragged it back to the source edge — a plain
      // click on a guide that already sits near an edge must select, not delete.
      const moved = Math.hypot(e.clientX - (drag.downX ?? e.clientX), e.clientY - (drag.downY ?? e.clientY)) > 4;
      if (g && r && moved) {
        const RAIL = 16;
        const onEdge =
          (g.dir === "back"  && e.clientY - r.top    < RAIL) ||
          (g.dir === "front" && r.bottom - e.clientY < RAIL) ||
          (g.dir === "left"  && e.clientX - r.left   < RAIL) ||
          (g.dir === "right" && r.right - e.clientX  < RAIL);
        if (onEdge) { setGuides(p => p.filter(gg => gg.id !== drag.id)); setSelectedId(null); setSelType(null); }
      }
      setDrag(null); setGuideScrub(null);
      return;
    }
    // Commit label placement
    if (drag?.type === "label-tip") {
      const pos = s2c(e.clientX, e.clientY);
      const { x, y, anchorId, anchorType } = snapLabelAnchor(pos.x, pos.y);
      setLabels(p => p.map(l => l.id !== drag.id ? l : { ...l, lx: x, ly: y, anchorId, anchorType }));
      setDrag(null); setGhostPos(null);
      return;
    }
    if (drag?.type === "label-place") {
      const rawPos = s2c(e.clientX, e.clientY);
      const endSnap = snapLabelAnchor(rawPos.x, rawPos.y);
      const dx = endSnap.x - drag.startX, dy = endSnap.y - drag.startY;
      const isLeader = Math.hypot(dx, dy) > 8;
      const nid = uid();
      const rcAnchorId = drag.startAnchorType === "revcloud" ? drag.startAnchorId : endSnap.anchorType === "revcloud" ? endSnap.anchorId : null;
      const rcColor = rcAnchorId ? revClouds.find(r => r.id === rcAnchorId)?.color : null;
      const defaultColor = rcColor ?? (themeMode === "dark" ? "#F0EDE6" : "#1A1812");
      const newLabel = {
        id: nid, phase: activePhase,
        x: isLeader ? endSnap.x : drag.startX,
        y: isLeader ? endSnap.y : drag.startY,
        text: "",
        fontSize: 12, bold: false, italic: false,
        color: defaultColor,
        lx: isLeader ? drag.startX : null,
        ly: isLeader ? drag.startY : null,
        anchorId: isLeader ? (drag.startAnchorId ?? null) : null,
        anchorType: isLeader ? (drag.startAnchorType ?? null) : null,
      };
      setLabels(p => [...p, newLabel]);
      setEditingLabelId(nid);
      setEditingLabelText("");
      setDrag(null);
      return;
    }
    // Finish marquee selection
    if (marquee) {
      const minX = Math.min(marquee.startX, marquee.endX);
      const maxX = Math.max(marquee.startX, marquee.endX);
      const minY = Math.min(marquee.startY, marquee.endY);
      const maxY = Math.max(marquee.startY, marquee.endY);
      
      const selected = [];
      
      // Check nodes
      if (mode === "build") {
        const visibleWallNodeIds = new Set(walls.filter(w => phaseVisible(w.phase)).flatMap(w => [w.n1, w.n2]));
        nodes.forEach(n => {
          if (!visibleWallNodeIds.has(n.id)) return;
          if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
            selected.push({ id: n.id, type: "node" });
          }
        });
        // Add walls whose both endpoints are inside the marquee
        walls.forEach(w => {
          if (!phaseVisible(w.phase)) return;
          const c = wc(w); if (!c) return;
          const n1 = nodes.find(n => n.id === w.n1), n2 = nodes.find(n => n.id === w.n2);
          if (n1 && n2 &&
              n1.x >= minX && n1.x <= maxX && n1.y >= minY && n1.y <= maxY &&
              n2.x >= minX && n2.x <= maxX && n2.y >= minY && n2.y <= maxY) {
            selected.push({ id: w.id, type: "wall" });
          }
        });
        doors.forEach(d => {
          if (!phaseVisible(d.phase)) return;
          const rp = resolvePos(d);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: d.id, type: "door" });
          }
        });
        windows.forEach(w => {
          if (!phaseVisible(w.phase)) return;
          const rp = resolvePos(w);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: w.id, type: "window" });
          }
        });
        columns.forEach(c => {
          if (!phaseVisible(c.phase)) return;
          const rp = resolvePos(c);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: c.id, type: "column" });
          }
        });
        markers.forEach(m => {
          // Build owns only the power layer (electrical + lighting) — IT/MEP components
          // belong to their own stage. Matches the mode's hit test, which skips them too;
          // without this the marquee was a back door to selecting and dragging them here.
          if (m.layer !== "power") return;
          if (!markerVisible(m) || markerLocked(m)) return;
          const rp = resolvePos(m);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: m.id, type: "marker" });
          }
        });
        if (!layerLocked("labels")) labels.forEach(lbl => {
          if (!phaseVisible(lbl.phase)) return;
          if (lbl.x >= minX && lbl.x <= maxX && lbl.y >= minY && lbl.y <= maxY)
            selected.push({ id: lbl.id, type: "label" });
        });
        if (!layerLocked("revClouds")) revClouds.forEach(rc => {
          if (!phaseVisible(rc.phase)) return;
          const c = polyCentroid(rc.points);
          if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY)
            selected.push({ id: rc.id, type: "revcloud" });
        });
        if (!layerLocked("flowPaths")) flowPaths.forEach(fp => {
          if (!phaseVisible(fp.phase)) return;
          const cx = fp.points.reduce((s,p)=>s+p.x,0)/fp.points.length, cy = fp.points.reduce((s,p)=>s+p.y,0)/fp.points.length;
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY)
            selected.push({ id: fp.id, type: "flowPath" });
        });
        if (!layerLocked("floorRegions")) floorRegions.forEach(fr => {
          if (!phaseVisible(fr.phase)) return;
          const c = polyCentroid(fr.points);
          if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY)
            selected.push({ id: fr.id, type: "floorRegion" });
        });
      } else if (mode === "zone") {
        if (!layerLocked("zones")) zones.forEach(z => {
          if (!phaseVisible(z.phase)) return;
          const rpts = resolvePoints(z);
          const zx = z.points ? polyCentroid(rpts).x : z.x + z.w / 2;
          const zy = z.points ? polyCentroid(rpts).y : z.y + z.h / 2;
          if (zx >= minX && zx <= maxX && zy >= minY && zy <= maxY) {
            selected.push({ id: z.id, type: "zone" });
          }
        });
      } else if (mode === "itmep") {
        markers.forEach(m => {
          if (!markerVisible(m) || markerLocked(m)) return;
          const rp = resolvePos(m);
          if (rp.x >= minX && rp.x <= maxX && rp.y >= minY && rp.y <= maxY) {
            selected.push({ id: m.id, type: "marker" });
          }
        });
      } else if (mode === "furnish") {
        // Furnish owns furniture, which hitTest, copy/paste, alt-drag and "/" all support —
        // the marquee was the one selection path that skipped it.
        if (visibleFurniture && !layerLocked("furniture")) furniture.forEach(f => {
          if (!phaseVisible(f.phase)) return;
          if (f.x >= minX && f.x <= maxX && f.y >= minY && f.y <= maxY) {
            selected.push({ id: f.id, type: "furniture" });
          }
        });
      }
      
      if (e.shiftKey) {
        // Add to existing selection
        const newIds = [...selectedIds];
        selected.forEach(s => {
          if (!newIds.includes(s.id)) newIds.push(s.id);
        });
        setSelectedIds(newIds);
        if (newIds.length > 0 && !selectedId) {
          setSelectedId(newIds[0]);
          setSelType(selected[0]?.type || null);
        }
      } else {
        // Replace selection
        setSelectedIds(selected.map(s => s.id));
        if (selected.length > 0) {
          setSelectedId(selected[0].id);
          setSelType(selected[0].type);
        }
      }
      
      setMarquee(null);
      return;
    }
    
    // Weld dragged geometry onto the existing node graph. An endpoint dropped on another
    // node merges into it; dropped on a wall's body, it splits that wall into a shared
    // T-junction. Applies to a single node drag, both ends of a whole-wall drag, and every
    // dragged node of a multi-drag (marquee / alt-drag a room against another room).
    // Topology lives on the base ("existing") geometry only.
    if ((!activePhase || activePhase === "existing") && (drag?.type === "node" || drag?.type === "wall" || drag?.type === "multi")) {
      // Project a point onto the nearest wall BODY of the working copy (cur), not the
      // store — sequential welds split walls into fresh ids, so a store-based snap
      // would return an id that no longer exists and silently skip the 2nd+ weld.
      const wallBodyHit = (cur, px, py, excl) => {
        const byId = Object.fromEntries(cur.nodes.map(n => [n.id, n]));
        let best = null, bd = SNAP_R;
        for (const w of cur.walls) {
          if (excl.has(w.id)) continue;
          const A = byId[w.n1], B = byId[w.n2]; if (!A || !B) continue;
          const dx = B.x - A.x, dy = B.y - A.y, ls = dx * dx + dy * dy; if (ls < 1) continue;
          const t = ((px - A.x) * dx + (py - A.y) * dy) / ls;
          if (t <= 0.02 || t >= 0.98) continue; // mid-span only — ends merge via findNear
          const d = dst(px, py, A.x + t * dx, A.y + t * dy);
          if (d < bd) { bd = d; best = w.id; }
        }
        return best;
      };
      // After a weld, a wall now attached at `nid` may run collinear over another wall
      // (drag a wall in line with one it connects to) — split it at any node it passes
      // over so the commit-time dedupe collapses the doubled piece.
      const splitIncidents = (nodesList, wallsList, nid) => {
        let out = wallsList;
        for (const w of wallsList) if (w.n1 === nid || w.n2 === nid) out = splitWallThroughNodes(out, nodesList, w.id);
        return out;
      };
      // exclNodes/exclWalls keep a multi-drag selection from welding onto itself.
      const weld = (cur, endId, preferNid, exclNodes, exclWalls) => {
        const p = cur.nodes.find(n => n.id === endId);
        if (!p) return { cur, mergedInto: null };
        let tgtId = (preferNid && preferNid !== endId && cur.nodes.some(n => n.id === preferNid)) ? preferNid : null;
        if (!tgtId) { const t = findNear(p.x, p.y, exclNodes || [endId]); if (t && cur.nodes.some(n => n.id === t.id)) tgtId = t.id; }
        if (tgtId) {
          const m = mergeNode(cur.nodes, cur.walls, endId, tgtId);
          return { cur: { nodes: m.nodes, walls: splitIncidents(m.nodes, m.walls, tgtId) }, mergedInto: tgtId };
        }
        const incident = new Set(cur.walls.filter(w => w.n1 === endId || w.n2 === endId).map(w => w.id));
        if (exclWalls) exclWalls.forEach(id => incident.add(id));
        const hitId = wallBodyHit(cur, p.x, p.y, incident);
        if (hitId) {
          const w2 = splitWallAtNode(cur.walls, hitId, endId);
          return { cur: { nodes: cur.nodes, walls: splitIncidents(cur.nodes, w2, endId) }, mergedInto: null };
        }
        return { cur, mergedInto: null };
      };
      // dedupeWalls on commit: two welds can leave a wall collinear-on top of another
      // (drop a room flush against a room → shared wall) — collapse to one segment.
      if (drag.type === "node") {
        const r = weld({ nodes, walls }, drag.id, hoverNid);
        if (r.cur.nodes !== nodes) setNodes(r.cur.nodes);
        if (r.cur.walls !== walls) setWalls(dedupeWalls(r.cur.walls));
        if (r.mergedInto) { setSelectedId(r.mergedInto); setSelType("node"); }
        else if (r.cur.walls !== walls) { setSelectedId(drag.id); setSelType("node"); }
      } else if (drag.type === "wall") {
        const w = walls.find(x => x.id === drag.id);
        let cur = { nodes, walls };
        if (w) [w.n1, w.n2].forEach(id => { cur = weld(cur, id, null).cur; });
        if (cur.nodes !== nodes) setNodes(cur.nodes);
        if (cur.walls !== walls) setWalls(dedupeWalls(cur.walls));
      } else {
        // Multi-drag: weld each dragged node against STATIONARY geometry only — never
        // against other dragged nodes or the selection's own (possibly deforming) walls.
        const dragNodeIds = drag.objects.filter(o => o.type === "node").map(o => o.id);
        if (dragNodeIds.length) {
          const dragNodeSet = new Set(dragNodeIds);
          const dragWallIds = walls.filter(w => dragNodeSet.has(w.n1) || dragNodeSet.has(w.n2)).map(w => w.id);
          let cur = { nodes, walls };
          dragNodeIds.forEach(id => { cur = weld(cur, id, null, dragNodeIds, dragWallIds).cur; });
          if (cur.nodes !== nodes) setNodes(cur.nodes);
          if (cur.walls !== walls) setWalls(dedupeWalls(cur.walls));
        }
      }
    }
    // When a copy-drag finishes, record the total displacement so "/" can distribute intermediates
    if (drag?.isCopy && drag.type === "multi") {
      const dx = drag.lastX - drag.startX, dy = drag.lastY - drag.startY;
      if (dx !== 0 || dy !== 0) setLastCopyInfo(prev => prev ? { ...prev, dx, dy } : null);
    } else if (drag?.isCopy) {
      // Single-item copy: compute displacement from first srcItem position to its current resolved position
      setLastCopyInfo(prev => {
        if (!prev || prev.srcItems.length !== 1) return prev;
        const item = prev.srcItems[0];
        let el = null;
        if (item.type === "column") el = columns.find(c => c.id === item.id);
        else if (item.type === "marker") el = markers.find(m => m.id === item.id);
        else if (item.type === "door") el = doors.find(d => d.id === item.id);
        else if (item.type === "window") el = windows.find(w => w.id === item.id);
        else if (item.type === "furniture") { const f = furniture.find(f => f.id === item.id); if (f) return { ...prev, dx: f.x - item.x, dy: f.y - item.y }; }
        else if (item.type === "zone") { const z = zones.find(z => z.id === item.id); if (z) { const c = polyCentroid(resolvePoints(z)); return { ...prev, dx: c.x - item.x, dy: c.y - item.y }; } }
        if (!el) return prev;
        const rp = resolvePos(el);
        return { ...prev, dx: rp.x - item.x, dy: rp.y - item.y };
      });
    }
    // No re-clipping on zone drag/vertex drag end — user controls shape manually
    setDrag(null); setResize(null); setPanning(false); setPanSt(null); setHoverNid(null); setProxHover(null); setRotatingMarker(null); setRotatingFurniture(null); setFurnitureResize(null); setSmartGuides([]);
  }, [drag, resize, hoverNid, marquee, mode, nodes, walls, doors, windows, zones, markers, columns, furniture, labels, revClouds, flowPaths, floorRegions, guides, phaseVisible, resolvePos, resolvePoints, wc, lastCopyInfo, s2c, themeMode, activePhase, snapLabelAnchor, layerLocked, markerLocked, findNear, snapToWall,
    cvs, cvsContainer, markerVisible, setEditingLabelId, setEditingLabelText, setGuideScrub, setLastCopyInfo, setProxHover, setSmartGuides,]);

  return { hitTest, onDown, onMove, onUp };
}
