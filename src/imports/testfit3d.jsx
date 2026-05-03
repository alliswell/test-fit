import { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";

// ─── Constants ─────────────────────────────────────────────────────────────────
const WALL_KINDS = {
  existing: { label: "Existing", color: "#9A9488", thickness: 7 },
  demo:     { label: "Demo",     color: "#E05050", thickness: 7 },
  new:      { label: "New",      color: "#50A0E0", thickness: 4.5 },
  pony:     { label: "Pony",     color: "#C8A060", thickness: 3.5 },
};

// Zone colors come from the editable zoneLibrary prop passed by TestFit3D.
const zoneColor = (zone, zoneLibrary) =>
  zoneLibrary?.[zone.type]?.color ?? zone.paintColor ?? "#8B7355";

const DOOR_HEIGHT_FT = 7;   // standard door height; masthead fills above
// Wall-mounted markers are centered at the wall centerline in world space.
// A 7" existing wall has a half-thickness of ~0.29 ft. Push markers to both
// wall faces so they're always visible regardless of which face is interior.
const WALL_SURFACE = 0.32; // ft — just proud of a 7" wall's face

const MODE_SELECT = {
  build:  new Set(["wall", "door", "window", "column"]),
  zone:   new Set(["zone"]),
  itmep:  new Set(["marker"]),
  budget: new Set([]),
};

const GLOW_COLOR  = "#FFB347";
const GLOW_OFFSET = 0.12;

// 2700 K warm-white palette
const WARM_2700K  = "#FFD4A8"; // scene pointLight color
const WARM_HALO   = "#FF9A3C"; // visible halo sphere color
const LIGHT_TYPES = new Set([
  "light_can_4","light_can_6",
  "light_pendant",
  "light_linear_2","light_linear_4",
  "light_sconce",
  "htrack_4","htrack_8","htrack",
]);

const dst = (ax, ay, bx, by) => Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);

const polyArea = pts => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
};
const polyCentroid = pts => { let x = 0, y = 0; pts.forEach(p => { x += p.x; y += p.y; }); return { x: x / pts.length, y: y / pts.length }; };
const ftFmtDirect = v => { const ti = Math.round(v * 12); const f = Math.floor(ti / 12), i = ti % 12; return i === 0 ? `${f}′-0″` : `${f}′-${i}″`; };
const ftFmt = (px, ppf) => ftFmtDirect(px / ppf);

// ─── Marker 3D config table ────────────────────────────────────────────────────
// y      : AFF in feet; "ceil" = flush ceiling; "hangN" = N ft below ceiling
// shape  : geometry variant key
// All dimensional values in feet unless noted.
const M3D = {
  // ── In-wall outlets (18" AFF) ─────────────────────────────
  outlet_duplex:         { y: 1.5,      shape: "outlet",   color: "#50C878", w: 0.23, h: 0.375, d: 0.06 },
  outlet_quad:           { y: 1.5,      shape: "outlet",   color: "#50C878", w: 0.23, h: 0.375, d: 0.06 },
  // Surface/conduit outlets (18" AFF, thicker box)
  outlet_duplex_surface: { y: 1.5,      shape: "surf",     color: "#E0A050", w: 0.23, h: 0.23,  d: 0.16 },
  outlet_quad_surface:   { y: 1.5,      shape: "surf",     color: "#E0A050", w: 0.23, h: 0.23,  d: 0.16 },
  // Ceiling outlet
  outlet_ceiling:        { y: "ceil",   shape: "disc",     color: "#60B0E0", r: 0.15, d: 0.05  },
  // Switches (48" AFF)
  switch_single:         { y: 4.0,      shape: "switch",   color: "#C8A060", w: 0.12, h: 0.22,  d: 0.04 },
  switch_double:         { y: 4.0,      shape: "switch",   color: "#C8A060", w: 0.22, h: 0.22,  d: 0.04 },
  switch_dimmer:         { y: 4.0,      shape: "switch",   color: "#C8A060", w: 0.16, h: 0.22,  d: 0.04 },
  // Electrical panel — 14.5"W × 21.5"H × 4"D, center at 60" AFF
  panel_board:           { y: 5.0,      shape: "panel",    color: "#E05050"                                },
  // T-Stat (60" AFF)
  tstat:                 { y: 5.0,      shape: "plate",    color: "#E8C0A0", w: 0.2,  h: 0.25,  d: 0.04 },
  // Prewires
  sconce_prewire:        { y: 5.5,      shape: "disc",     color: "#C87840", r: 0.07, d: 0.04  },
  pendent_prewire:       { y: "ceil",   shape: "disc",     color: "#C87840", r: 0.07, d: 0.04  },
  // H-Track (ceiling, 1" below)
  htrack_4:              { y: "ceil",   shape: "htrack",   color: "#E8D070", len: 4               },
  htrack_8:              { y: "ceil",   shape: "htrack",   color: "#E8D070", len: 8               },
  htrack:                { y: "ceil",   shape: "htrack",   color: "#E8D070", len: 4               },
  // Recessed cans (ceiling-flush)
  light_can_4:           { y: "ceil",   shape: "can",      color: "#FFFACD", r: 4 / 24            },
  light_can_6:           { y: "ceil",   shape: "can",      color: "#FFFACD", r: 6 / 24            },
  // Pendant (1.3 ft below ceiling)
  light_pendant:         { y: "hang1.3",shape: "pendant",  color: "#FFFACD"                       },
  // Linear fixtures (ceiling)
  light_linear_2:        { y: "ceil",   shape: "linear",   color: "#FFFACD", len: 2               },
  light_linear_4:        { y: "ceil",   shape: "linear",   color: "#FFFACD", len: 4               },
  // Wall sconce (66" AFF)
  light_sconce:          { y: 5.5,      shape: "sconce",   color: "#FFFACD"                       },
  // Legacy power symbols
  duplex_outlet:         { y: 1.5,      shape: "plate",    color: "#50A070", w: 0.23, h: 0.375, d: 0.06 },
  quad_outlet:           { y: 1.5,      shape: "plate",    color: "#E05050", w: 0.23, h: 0.375, d: 0.06 },
  dedicated_quad:        { y: 1.5,      shape: "plate",    color: "#4080E0", w: 0.23, h: 0.375, d: 0.06 },
  ceiling_quad:          { y: "ceil",   shape: "disc",     color: "#E05050", r: 0.15, d: 0.05  },
  // ── AV ────────────────────────────────────────────────────
  wall_speaker:          { y: 7.0,      shape: "speaker",  color: "#D07840"                       },
  subwoofer:             { y: 0.25,     shape: "box",      color: "#704020", w: 0.5,  h: 0.42,  d: 0.42 },
  pendant_speaker:       { y: "hang0.8",shape: "cone",     color: "#D07840"                       },
  speaker_line:          { y: 7.0,      shape: "disc",     color: "#D07840", r: 0.12, d: 0.05  },
  // ── IT ────────────────────────────────────────────────────
  router:                { y: 2.5,      shape: "box",      color: "#4080E0", w: 0.35, h: 0.12,  d: 0.25 },
  access_point:          { y: "ceil",   shape: "ap",       color: "#60A0D0"                       },
  // ── MEP ───────────────────────────────────────────────────
  drain_line:            { y: 0.02,     shape: "disc",     color: "#50A070", r: 0.1,  d: 0.04  },
  water_line:            { y: 1.5,      shape: "pipe",     color: "#5050A0"                       },
  // ── Security ──────────────────────────────────────────────
  white_camera:          { y: 7.5,      shape: "camera",   color: "#E8E0D0"                       },
  black_camera:          { y: 7.5,      shape: "camera",   color: "#1A1A1A"                       },
  outdoor_camera:        { y: 7.5,      shape: "camera",   color: "#556B2F"                       },
};

// Resolve y-spec to a world Y coordinate
const resolveY = (ySpec, ceilH) => {
  if (ySpec === "ceil") return ceilH - 0.04;
  if (typeof ySpec === "string" && ySpec.startsWith("hang")) return ceilH - parseFloat(ySpec.slice(4));
  return Math.min(typeof ySpec === "number" ? ySpec : 1.5, ceilH - 0.1);
};

// ─── Glow halos ────────────────────────────────────────────────────────────────
function BoxGlow({ w, h, d }) {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.material.opacity = 0.38 + 0.22 * Math.sin(clock.getElapsedTime() * 3.5); });
  const G = GLOW_OFFSET;
  return <mesh ref={ref}><boxGeometry args={[w + G * 2, h + G * 2, d + G * 2]} /><meshLambertMaterial color={GLOW_COLOR} transparent opacity={0.5} side={THREE.BackSide} depthWrite={false} /></mesh>;
}
function CylGlow({ r, h }) {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.material.opacity = 0.38 + 0.22 * Math.sin(clock.getElapsedTime() * 3.5); });
  const G = GLOW_OFFSET;
  return <mesh ref={ref}><cylinderGeometry args={[r + G, r + G, h + G * 2, 24]} /><meshLambertMaterial color={GLOW_COLOR} transparent opacity={0.5} side={THREE.BackSide} depthWrite={false} /></mesh>;
}

// ─── Warm 2700 K light glow (detailed mode only) ───────────────────────────────
function WarmGlow({ r = 0.28, intensity = 1.0, distance = 9, position = [0, 0, 0] }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.opacity = 0.16 + 0.06 * Math.sin(clock.getElapsedTime() * 0.5);
  });
  return (
    <group position={position}>
      <pointLight color={WARM_2700K} intensity={intensity} distance={distance} decay={2} />
      <mesh ref={ref}>
        <sphereGeometry args={[r, 10, 7]} />
        <meshBasicMaterial color={WARM_HALO} transparent opacity={0.2} depthWrite={false} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function WallEdges({ w, h, d, color }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d]);
  return <lineSegments geometry={geo}><lineBasicMaterial color={color} /></lineSegments>;
}

// ─── Wall box ──────────────────────────────────────────────────────────────────
function WallBox({ lenFt, heightFt, thickFt, yCenter, offsetFt = 0, color, wallId, onSelect, isDemo, isSelected, style3d = "clay" }) {
  const [hov, setHov] = useState(false);
  const c = hov ? "#ffffff" : color;
  return (
    <group position={[offsetFt, yCenter, 0]}>
      <mesh
        key={style3d}
        onClick={e => { e.stopPropagation(); onSelect(wallId, "wall"); }}
        onPointerOver={e => { e.stopPropagation(); setHov(true); }}
        onPointerOut={() => setHov(false)}
        castShadow={style3d === "detailed"}
        receiveShadow={style3d === "detailed"}
      >
        <boxGeometry args={[lenFt, heightFt, thickFt]} />
        {style3d === "xray"    && <meshBasicMaterial    color={c} transparent opacity={hov ? 0.25 : 0.08} depthWrite={false} />}
        {style3d === "detailed"&& <meshStandardMaterial color={c} roughness={0.75} metalness={0.0} transparent={isDemo} opacity={isDemo ? 0.5 : 1} />}
        {style3d === "clay"    && <meshLambertMaterial  color={c} transparent={isDemo || hov} opacity={isDemo ? 0.5 : hov ? 0.85 : 1} />}
      </mesh>
      {style3d === "xray" && <WallEdges w={lenFt} h={heightFt} d={thickFt} color={color} />}
      {isSelected && <BoxGlow w={lenFt} h={heightFt} d={thickFt} />}
    </group>
  );
}

// ─── Door with swing arc ───────────────────────────────────────────────────────
function DoorSwing3D({ door, segLenFt, heightFt, offsetFt, thickFt, onSelect, isSelected }) {
  const isCaseOpening = door.doorType === "Case Opening";
  const hingeRight    = door.hingeRight ?? false;
  const swingZ        = door.flipped ? -1 : 1;
  const doorH         = heightFt; // caller passes door-height only (DOOR_HEIGHT_FT)
  const hingeX        = offsetFt + (hingeRight ? segLenFt / 2 : -segLenFt / 2);
  const closedAngle   = hingeRight ? Math.PI : 0;
  const sweepSign     = (hingeRight ? -1 : 1) * swingZ;

  const tubeGeo = useMemo(() => {
    const N = 24, pts = [];
    for (let i = 0; i <= N; i++) {
      const a = closedAngle + sweepSign * (Math.PI / 2) * (i / N);
      pts.push(new THREE.Vector3(hingeX + segLenFt * Math.cos(a), 0.015, segLenFt * Math.sin(a)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.025, 6, false);
  }, [hingeX, segLenFt, closedAngle, sweepSign]);

  const click = e => { e.stopPropagation(); onSelect(door.id, "door"); };
  return (
    <group onClick={click}>
      <mesh position={[offsetFt, doorH / 2, 0]}>
        <boxGeometry args={[segLenFt, doorH, thickFt * 2.5]} /><meshLambertMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {!isCaseOpening && (<>
        <group position={[hingeX, doorH / 2, swingZ * segLenFt / 2]}>
          <mesh><boxGeometry args={[0.08, doorH, segLenFt]} /><meshLambertMaterial color="#C8A878" transparent opacity={0.88} /></mesh>
          {isSelected && <BoxGlow w={0.08} h={doorH} d={segLenFt} />}
        </group>
        <mesh position={[hingeX, 0.06, 0]}><cylinderGeometry args={[0.05, 0.05, 0.14, 8]} /><meshLambertMaterial color={isSelected ? GLOW_COLOR : "#C8A060"} /></mesh>
        <mesh geometry={tubeGeo}><meshLambertMaterial color={isSelected ? GLOW_COLOR : "#C8A060"} transparent opacity={isSelected ? 0.85 : 0.55} /></mesh>
      </>)}
      {isCaseOpening && isSelected && (
        <mesh position={[offsetFt, doorH / 2, 0]}>
          <boxGeometry args={[segLenFt + GLOW_OFFSET * 2, doorH + GLOW_OFFSET * 2, thickFt + GLOW_OFFSET * 2]} /><meshLambertMaterial color={GLOW_COLOR} transparent opacity={0.3} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ─── Window glass / glow ───────────────────────────────────────────────────────
function WindowGlass({ lenFt, winHFt, sillFt, thickFt }) {
  return <mesh position={[0, sillFt + winHFt / 2, 0]}><boxGeometry args={[lenFt, winHFt, thickFt * 0.1]} /><meshLambertMaterial color="#90CAF9" transparent opacity={0.28} side={THREE.DoubleSide} /></mesh>;
}
function WindowGlow({ lenFt, winHFt, sillFt, thickFt }) {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.material.opacity = 0.38 + 0.22 * Math.sin(clock.getElapsedTime() * 3.5); });
  const G = GLOW_OFFSET;
  return <mesh ref={ref} position={[0, sillFt + winHFt / 2, 0]}><boxGeometry args={[lenFt + G * 2, winHFt + G * 2, thickFt + G * 2]} /><meshLambertMaterial color={GLOW_COLOR} transparent opacity={0.5} side={THREE.BackSide} depthWrite={false} /></mesh>;
}

// ─── Wall with openings ────────────────────────────────────────────────────────
function Wall3D({ w, nodes, doors, windows, cx, cz, pxPerFoot, ceilingHeight, onSelect, selectedId, selType, showDims, style3d = "clay" }) {
  const n1 = nodes.find(n => n.id === w.n1), n2 = nodes.find(n => n.id === w.n2);
  if (!n1 || !n2) return null;
  const wk       = WALL_KINDS[w.kind || "existing"];
  const thickFt  = (w.kind === "pony" ? (w.ponyDepth || 6) : (wk.thickness || 5)) / 12;
  const ceilFt   = ceilingHeight / 12;
  const heightFt = w.kind === "pony" ? (w.ponyHeight || 42) / 12 : ceilFt;
  const x1 = n1.x, y1 = n1.y, x2 = n2.x, y2 = n2.y;
  const wLen     = dst(x1, y1, x2, y2);
  if (wLen < 1) return null;
  const wallLenFt = wLen / pxPerFoot;
  const angle     = Math.atan2(y2 - y1, x2 - x1);
  const midX      = ((x1 + x2) / 2 - cx) / pxPerFoot;
  const midZ      = ((y1 + y2) / 2 - cz) / pxPerFoot;
  const wallSel   = selectedId === w.id && selType === "wall";
  const dx = x2 - x1, dy = y2 - y1;
  const doorHFt   = Math.min(DOOR_HEIGHT_FT, heightFt);

  const segs = useMemo(() => {
    const doorIds = new Set(doors.map(d => d.id));
    const cuts = [];
    [...doors, ...windows].forEach(item => {
      const projT = ((item.x - x1) * dx + (item.y - y1) * dy) / (wLen * wLen);
      if (projT < -0.05 || projT > 1.05) return;
      const projX = x1 + projT * dx, projY = y1 + projT * dy;
      if (dst(item.x, item.y, projX, projY) > 8) return;
      const halfW = (item.width / 12 * pxPerFoot) / 2 / wLen;
      cuts.push({ t0: Math.max(0, projT - halfW), t1: Math.min(1, projT + halfW), isDoor: doorIds.has(item.id), item });
    });
    cuts.sort((a, b) => a.t0 - b.t0);
    const merged = [];
    cuts.forEach(cu => {
      if (merged.length && cu.t0 <= merged[merged.length - 1].t1)
        Object.assign(merged[merged.length - 1], { t1: Math.max(merged[merged.length - 1].t1, cu.t1), isDoor: merged[merged.length - 1].isDoor || cu.isDoor, item: cu.item });
      else merged.push({ ...cu });
    });
    const result = []; let tS = 0;
    merged.forEach(cu => { if (cu.t0 > tS) result.push({ t0: tS, t1: cu.t0, solid: true }); result.push({ t0: cu.t0, t1: cu.t1, solid: false, isDoor: cu.isDoor, item: cu.item }); tS = cu.t1; });
    if (tS < 1) result.push({ t0: tS, t1: 1, solid: true });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, doors, windows, x1, y1, dx, dy, wLen, pxPerFoot]);

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      {segs.map((seg, i) => {
        const segLenFt = (seg.t1 - seg.t0) * wallLenFt;
        if (segLenFt < 0.001) return null;
        const offsetFt = ((seg.t0 + seg.t1) / 2 - 0.5) * wallLenFt;
        if (seg.solid) return <WallBox key={i} lenFt={segLenFt} heightFt={heightFt} thickFt={thickFt} yCenter={heightFt / 2} offsetFt={offsetFt} color={wk.color} wallId={w.id} onSelect={onSelect} isDemo={w.kind === "demo"} isSelected={wallSel} style3d={style3d} />;
        if (seg.isDoor) {
          const mhH = heightFt - doorHFt;
          return (
            <group key={i}>
              <DoorSwing3D door={seg.item} segLenFt={segLenFt} heightFt={doorHFt} offsetFt={offsetFt} thickFt={thickFt} onSelect={onSelect} isSelected={selectedId === seg.item.id && selType === "door"} />
              {mhH > 0.01 && <WallBox lenFt={segLenFt} heightFt={mhH} thickFt={thickFt} yCenter={doorHFt + mhH / 2} offsetFt={offsetFt} color={wk.color} wallId={w.id} onSelect={onSelect} isDemo={w.kind === "demo"} isSelected={wallSel} style3d={style3d} />}
            </group>
          );
        }
        const winSel = selectedId === seg.item.id && selType === "window";
        const isCut = seg.item?.type === "Cut Opening";
        const sillFt = (seg.item?.sill ?? 30) / 12, winHFt = (seg.item?.height ?? 48) / 12, headerFt = heightFt - sillFt - winHFt;
        return (
          <group key={i} position={[offsetFt, 0, 0]} onClick={e => { e.stopPropagation(); onSelect(seg.item.id, "window"); }}>
            <mesh position={[0, sillFt + winHFt / 2, 0]}><boxGeometry args={[segLenFt, winHFt, thickFt * 2.5]} /><meshLambertMaterial transparent opacity={0} depthWrite={false} /></mesh>
            {sillFt > 0.01 && <WallBox lenFt={segLenFt} heightFt={sillFt} thickFt={thickFt} yCenter={sillFt / 2} offsetFt={0} color={wk.color} wallId={w.id} onSelect={onSelect} isDemo={w.kind === "demo"} isSelected={false} style3d={style3d} />}
            {!isCut && <WindowGlass lenFt={segLenFt} winHFt={winHFt} sillFt={sillFt} thickFt={thickFt} />}
            {headerFt > 0.01 && <WallBox lenFt={segLenFt} heightFt={headerFt} thickFt={thickFt} yCenter={sillFt + winHFt + headerFt / 2} offsetFt={0} color={wk.color} wallId={w.id} onSelect={onSelect} isDemo={w.kind === "demo"} isSelected={false} style3d={style3d} />}
            {winSel && <WindowGlow lenFt={segLenFt} winHFt={winHFt} sillFt={sillFt} thickFt={thickFt} />}
          </group>
        );
      })}
      {showDims && wallLenFt > 0.5 && (
        <Billboard position={[0, heightFt + 0.3, 0]}>
          <Text fontSize={0.28} color="#9A9488" anchorX="center" anchorY="middle" outlineWidth={0.025} outlineColor="#000000">{ftFmtDirect(wallLenFt)}</Text>
        </Billboard>
      )}
    </group>
  );
}

// ─── Column ────────────────────────────────────────────────────────────────────
function Column3D({ col, cx, cz, pxPerFoot, ceilingHeight, onSelect, isSelected, style3d = "clay" }) {
  const [hov, setHov] = useState(false);
  const r = col.size / 12 / 2, h = ceilingHeight / 12;
  const x = (col.x - cx) / pxPerFoot, z = (col.y - cz) / pxPerFoot;
  const colColor = hov ? "#ffffff" : "#888888";
  return (
    <group position={[x, h / 2, z]}>
      <mesh
        key={style3d}
        onClick={e => { e.stopPropagation(); onSelect(col.id, "column"); }}
        onPointerOver={e => { e.stopPropagation(); setHov(true); }}
        onPointerOut={() => setHov(false)}
        castShadow={style3d === "detailed"}
        receiveShadow={style3d === "detailed"}
      >
        {col.shape === "circle" ? <cylinderGeometry args={[r, r, h, 24]} /> : <boxGeometry args={[r * 2, h, r * 2]} />}
        {style3d === "xray"     && <meshBasicMaterial    color={colColor} transparent opacity={0.1} />}
        {style3d === "detailed" && <meshStandardMaterial color={colColor} roughness={0.4} metalness={0.15} />}
        {style3d === "clay"     && <meshLambertMaterial  color={colColor} />}
      </mesh>
      {isSelected && (col.shape === "circle" ? <CylGlow r={r} h={h} /> : <BoxGlow w={r * 2} h={h} d={r * 2} />)}
    </group>
  );
}

// ─── IT / MEP / Electrical Marker 3D ─────────────────────────────────────────
function Marker3D({ marker, cx, cz, pxPerFoot, ceilingHeight, onSelect, isSelected, style3d = "clay" }) {
  const [hov, setHov] = useState(false);
  const wx = (marker.x - cx) / pxPerFoot;
  const wz = (marker.y - cz) / pxPerFoot;
  const cH = ceilingHeight / 12;

  const cfg = M3D[marker.componentType] ?? { y: 2.0, shape: "sphere", color: "#9A9488" };
  const baseColor = cfg.color;
  const c = hov ? "#ffffff" : isSelected ? GLOW_COLOR : baseColor;
  const wy = resolveY(cfg.y, cH);

  const click = e => { e.stopPropagation(); onSelect(marker.id, "marker"); };
  const hp    = { onPointerOver: e => { e.stopPropagation(); setHov(true); }, onPointerOut: () => setHov(false) };

  const angle = marker.angle ?? 0;
  // Y rotation aligns the group's local +Z with the wall's outward normal in world XZ.
  const wallRot = [0, angle, 0];
  // Ceiling/floor items rotate around Y. 2D screen-Y maps to 3D +Z, so the
  // sign is negated: a 90° clockwise rotation in 2D becomes -90° around world Y.
  const floorRot = [0, -angle, 0];
  // The scene centroid is at world origin. The wall normal pointing toward the centroid
  // is the interior face. dot > 0 → interior is on +Z local side.
  const normalX = Math.sin(angle), normalZ = Math.cos(angle);
  const dot = -wx * normalX + -wz * normalZ;
  const interiorZ = dot >= 0 ? WALL_SURFACE : -WALL_SURFACE;

  // "new / planned" markers render at 60% opacity to signal not-yet-installed.
  const isNew = !!marker.isNew;

  const shape = cfg.shape;
  const isLight = style3d === "detailed" && LIGHT_TYPES.has(marker.componentType);

  // ── Outlet plate — interior face only, 2× schematic scale ───────────────
  if (shape === "outlet") {
    const w = cfg.w * 2, h = cfg.h * 2, d = 0.08;
    return (
      <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
        <group position={[0, 0, interiorZ]}>
          <mesh><boxGeometry args={[w, h, d]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
          {[-0.07, 0.07].map((ox, i) => (
            <mesh key={i} position={[ox, 0, d / 2 + 0.005]}>
              <boxGeometry args={[0.03, 0.1, 0.015]} /><meshLambertMaterial color="#1A2A1A" />
            </mesh>
          ))}
        </group>
        {isSelected && <BoxGlow w={w} h={h} d={d} />}
      </group>
    );
  }

  // ── Surface/conduit outlet — interior face only ───────────────────────────
  if (shape === "surf") {
    const w = cfg.w * 2, h = cfg.h * 2, d = 0.2;
    return (
      <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
        <group position={[0, 0, interiorZ]}>
          <mesh><boxGeometry args={[w, h, d]} /><meshLambertMaterial color={c} transparent opacity={isNew ? 0.45 : 0.85} /></mesh>
          <mesh position={[0, 0, d / 2]}><boxGeometry args={[w * 0.8, h * 0.8, 0.03]} /><meshLambertMaterial color={c} /></mesh>
        </group>
        {isSelected && <BoxGlow w={w} h={h} d={d} />}
      </group>
    );
  }

  // ── Switch plate — interior face only, 2.5× scale ────────────────────────
  if (shape === "switch") {
    const w = cfg.w * 2.5, h = cfg.h * 2.5, d = 0.08;
    return (
      <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
        <group position={[0, 0, interiorZ]}>
          <mesh><boxGeometry args={[w, h, d]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
          <mesh position={[0, 0.02, d / 2 + 0.008]}>
            <boxGeometry args={[w * 0.5, h * 0.55, 0.018]} /><meshLambertMaterial color={c} />
          </mesh>
        </group>
        {isSelected && <BoxGlow w={w} h={h} d={d} />}
      </group>
    );
  }

  // ── Electrical panel — 14.5"W × 21.5"H × 4"D (standard 100–200A load center)
  if (shape === "panel") {
    // Real dims in feet: 14.5/12 × 21.5/12 × 4/12
    const PW = 14.5 / 12, PH = 21.5 / 12, PD = 4 / 12;
    const doorW = PW - 0.04, doorH = PH - 0.04;
    const op = isNew ? 0.55 : 1;
    return (
      <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
        <group position={[0, 0, interiorZ]}>
          {/* Enclosure box */}
          <mesh><boxGeometry args={[PW, PH, PD]} /><meshLambertMaterial color="#4A4A4A" transparent={isNew} opacity={op} /></mesh>
          {/* Door face (slightly proud of enclosure) */}
          <mesh position={[0, 0, PD / 2 + 0.005]}><boxGeometry args={[doorW, doorH, 0.018]} /><meshLambertMaterial color={c} transparent={isNew} opacity={op} /></mesh>
          {/* Left breaker column — 10 breakers */}
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={"L" + i} position={[-PW * 0.18, PH * 0.38 - i * (PH * 0.082), PD / 2 + 0.016]}>
              <boxGeometry args={[PW * 0.28, PH * 0.066, 0.012]} />
              <meshLambertMaterial color="#1A1A1A" transparent={isNew} opacity={op} />
            </mesh>
          ))}
          {/* Right breaker column — 10 breakers */}
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={"R" + i} position={[PW * 0.18, PH * 0.38 - i * (PH * 0.082), PD / 2 + 0.016]}>
              <boxGeometry args={[PW * 0.28, PH * 0.066, 0.012]} />
              <meshLambertMaterial color="#1A1A1A" transparent={isNew} opacity={op} />
            </mesh>
          ))}
          {/* Main breaker at top */}
          <mesh position={[0, PH * 0.44, PD / 2 + 0.016]}>
            <boxGeometry args={[PW * 0.44, PH * 0.07, 0.016]} />
            <meshLambertMaterial color="#CC2222" transparent={isNew} opacity={op} />
          </mesh>
          {/* Handle / latch on right edge */}
          <mesh position={[doorW / 2 - 0.01, 0, PD / 2 + 0.024]}>
            <boxGeometry args={[0.02, 0.06, 0.018]} />
            <meshLambertMaterial color="#888888" />
          </mesh>
        </group>
        {isSelected && <BoxGlow w={PW} h={PH} d={PD} />}
      </group>
    );
  }

  // ── Generic thin plate — interior face only ───────────────────────────────
  if (shape === "plate") {
    const w = cfg.w * 2, h = cfg.h * 2, d = 0.08;
    return (
      <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
        <group position={[0, 0, interiorZ]}>
          <mesh><boxGeometry args={[w, h, d]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
        </group>
        {isSelected && <BoxGlow w={w} h={h} d={d} />}
      </group>
    );
  }

  // ── Disc (ceiling outlets, prewire discs, speaker lines, drain) ───────────
  if (shape === "disc") return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><cylinderGeometry args={[cfg.r, cfg.r, cfg.d, 16]} /><meshLambertMaterial color={c} /></mesh>
      {isSelected && <CylGlow r={cfg.r} h={cfg.d} />}
    </group>
  );

  // ── Recessed can (ceiling-flush cylinder with trim ring) ──────────────────
  if (shape === "can") return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><cylinderGeometry args={[cfg.r, cfg.r, 0.06, 16]} /><meshLambertMaterial color={c} /></mesh>
      <mesh><cylinderGeometry args={[cfg.r + 0.025, cfg.r + 0.025, 0.025, 16]} /><meshLambertMaterial color="#999999" /></mesh>
      {isSelected && <CylGlow r={cfg.r + 0.025} h={0.06} />}
      {isLight && <WarmGlow r={0.22} intensity={1.0} distance={9} />}
    </group>
  );

  // ── H-Track with two adjustable heads ────────────────────────────────────
  if (shape === "htrack") {
    const len = cfg.len;
    return (
      <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
        {/* Track rail */}
        <mesh><boxGeometry args={[len, 0.06, 0.06]} /><meshLambertMaterial color={c} /></mesh>
        {/* Track heads at ~1/3 intervals */}
        {[-len * 0.3, len * 0.3].map((ox, i) => (
          <group key={i} position={[ox, -0.12, 0]}>
            <mesh><boxGeometry args={[0.14, 0.16, 0.14]} /><meshLambertMaterial color={c} /></mesh>
            {/* Lamp cone */}
            <mesh position={[0, -0.1, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.06, 0.12, 8]} /><meshLambertMaterial color="#FFFACD" transparent opacity={0.7} />
            </mesh>
            {isLight && <WarmGlow position={[0, -0.14, 0]} r={0.18} intensity={0.7} distance={8} />}
          </group>
        ))}
        {isSelected && <BoxGlow w={len} h={0.06} d={0.06} />}
      </group>
    );
  }

  // ── Linear fixture ────────────────────────────────────────────────────────
  if (shape === "linear") return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><boxGeometry args={[cfg.len, 0.067, 0.267]} /><meshLambertMaterial color={c} /></mesh>
      {/* Diffuser face */}
      <mesh position={[0, -0.033, 0]}><boxGeometry args={[cfg.len - 0.04, 0.005, 0.24]} /><meshLambertMaterial color="#FFFFFF" transparent opacity={0.6} /></mesh>
      {isSelected && <BoxGlow w={cfg.len} h={0.067} d={0.267} />}
      {isLight && <>
        <WarmGlow position={[0, -0.05, 0]} r={0.3} intensity={1.4} distance={10} />
        {cfg.len >= 4 && <WarmGlow position={[ cfg.len * 0.35, -0.05, 0]} r={0.22} intensity={0.8} distance={7} />}
        {cfg.len >= 4 && <WarmGlow position={[-cfg.len * 0.35, -0.05, 0]} r={0.22} intensity={0.8} distance={7} />}
      </>}
    </group>
  );

  // ── Pendant light (globe on wire) ─────────────────────────────────────────
  if (shape === "pendant") return (
    <group position={[wx, 0, wz]} rotation={floorRot} onClick={click} {...hp}>
      {/* Wire from ceiling */}
      <mesh position={[0, cH - 0.45, 0]}><cylinderGeometry args={[0.008, 0.008, 0.85, 4]} /><meshLambertMaterial color="#606060" /></mesh>
      {/* Globe */}
      <mesh position={[0, cH - 1.3, 0]}>
        <sphereGeometry args={[0.16, 12, 8]} /><meshLambertMaterial color={c} />
      </mesh>
      {isSelected && <group position={[0, cH - 1.3, 0]}><CylGlow r={0.16} h={0.32} /></group>}
      {isLight && <WarmGlow position={[0, cH - 1.3, 0]} r={0.3} intensity={1.1} distance={9} />}
    </group>
  );

  // ── Wall sconce — interior face only ─────────────────────────────────────
  if (shape === "sconce") return (
    <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
      <group position={[0, 0, interiorZ]}>
        <mesh><boxGeometry args={[0.15, 0.22, 0.04]} /><meshLambertMaterial color="#888888" transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
        <mesh position={[0, 0.18, 0.1]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.1, 0.18, 8, 1, true]} /><meshLambertMaterial color={c} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
        {isLight && <WarmGlow position={[0, 0.24, 0.15]} r={0.22} intensity={0.7} distance={7} />}
      </group>
      {isSelected && <BoxGlow w={0.15} h={0.4} d={0.04} />}
    </group>
  );

  // ── Wall speaker — interior face only ────────────────────────────────────
  if (shape === "speaker") return (
    <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
      <group position={[0, 0, interiorZ]}>
        <mesh><boxGeometry args={[0.27, 0.32, 0.1]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
        <mesh position={[0, 0, 0.051]}><cylinderGeometry args={[0.09, 0.09, 0.01, 16]} /><meshLambertMaterial color="#1A1A1A" /></mesh>
      </group>
      {isSelected && <BoxGlow w={0.27} h={0.32} d={0.1} />}
    </group>
  );

  // ── Pendant speaker (cone on wire, pointing down) ─────────────────────────
  if (shape === "cone") return (
    <group position={[wx, 0, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh position={[0, cH - 0.4, 0]}><cylinderGeometry args={[0.008, 0.008, 0.6, 4]} /><meshLambertMaterial color="#606060" /></mesh>
      <mesh position={[0, cH - 0.86, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.2, 8]} /><meshLambertMaterial color={c} />
      </mesh>
      {isSelected && <group position={[0, cH - 0.86, 0]}><CylGlow r={0.12} h={0.2} /></group>}
    </group>
  );

  // ── Generic box (router, subwoofer, etc.) ─────────────────────────────────
  if (shape === "box") return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><boxGeometry args={[cfg.w, cfg.h, cfg.d]} /><meshLambertMaterial color={c} /></mesh>
      {isSelected && <BoxGlow w={cfg.w} h={cfg.h} d={cfg.d} />}
    </group>
  );

  // ── Access point (flat teardrop disc at ceiling) ───────────────────────────
  if (shape === "ap") return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><cylinderGeometry args={[0.22, 0.18, 0.05, 16]} /><meshLambertMaterial color={c} /></mesh>
      {/* LED ring accent */}
      <mesh position={[0, 0, 0]}><cylinderGeometry args={[0.24, 0.22, 0.025, 16]} /><meshLambertMaterial color="#88C8E8" /></mesh>
      {isSelected && <CylGlow r={0.24} h={0.05} />}
    </group>
  );

  // ── Water line pipe stub ──────────────────────────────────────────────────
  if (shape === "pipe") return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><cylinderGeometry args={[0.04, 0.04, 0.2, 8]} /><meshLambertMaterial color={c} /></mesh>
      {/* Valve wheel */}
      <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.01, 6, 12]} /><meshLambertMaterial color="#888888" />
      </mesh>
      {isSelected && <CylGlow r={0.06} h={0.2} />}
    </group>
  );

  // ── Security camera — interior face only ─────────────────────────────────
  if (shape === "camera") return (
    <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
      <group position={[0, 0, interiorZ]}>
        <group rotation={[THREE.MathUtils.degToRad(25), 0, 0]}>
          <mesh><boxGeometry args={[0.21, 0.14, 0.24]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
          <mesh position={[0, 0, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.055, 0.1, 10]} /><meshLambertMaterial color="#111111" />
          </mesh>
        </group>
        <mesh position={[0, 0.15, 0]}><boxGeometry args={[0.07, 0.22, 0.07]} /><meshLambertMaterial color="#666666" /></mesh>
      </group>
      {isSelected && <BoxGlow w={0.21} h={0.35} d={0.24} />}
    </group>
  );

  // ── Fallback sphere ───────────────────────────────────────────────────────
  return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><sphereGeometry args={[0.15, 8, 6]} /><meshLambertMaterial color={c} /></mesh>
      {isSelected && <CylGlow r={0.15} h={0.3} />}
    </group>
  );
}

// ─── Zone labels ──────────────────────────────────────────────────────────────
function ZoneLabel3D({ zone, cx, cz, pxPerFoot, zoneLibrary }) {
  const color = zoneColor(zone, zoneLibrary);
  let worldX, worldZ, sf;
  if (zone.points && zone.points.length >= 3) {
    const c = polyCentroid(zone.points); worldX = (c.x - cx) / pxPerFoot; worldZ = (c.y - cz) / pxPerFoot;
    sf = Math.round(polyArea(zone.points) / (pxPerFoot * pxPerFoot));
  } else if (zone.w && zone.h) {
    worldX = (zone.x + zone.w / 2 - cx) / pxPerFoot; worldZ = (zone.y + zone.h / 2 - cz) / pxPerFoot;
    sf = Math.round((zone.w / pxPerFoot) * (zone.h / pxPerFoot));
  } else { return null; }
  return (
    <Billboard position={[worldX, 0.6, worldZ]}>
      <Text fontSize={0.55} color={color} anchorX="center" anchorY="top" fontWeight="bold" outlineWidth={0.04} outlineColor="#000000">{zone.label || zone.type}</Text>
      <Text fontSize={0.42} color={color} anchorX="center" anchorY="top" position={[0, -0.7, 0]} outlineWidth={0.03} outlineColor="#000000">{sf} sf</Text>
    </Billboard>
  );
}

// ─── User dimension strings ────────────────────────────────────────────────────
function DimLine3D({ dim, cx, cz, pxPerFoot }) {
  const x1 = (dim.x1 - cx) / pxPerFoot, z1 = (dim.y1 - cz) / pxPerFoot;
  const x2 = (dim.x2 - cx) / pxPerFoot, z2 = (dim.y2 - cz) / pxPerFoot;
  const px  = Math.sqrt((dim.x2 - dim.x1) ** 2 + (dim.y2 - dim.y1) ** 2);
  const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
  if (len < 0.1) return null;
  const dx = (x2 - x1) / len, dz = (z2 - z1) / len;
  const nx = -dz, nz = dx;
  const offFt = (dim.offset ?? 20) / pxPerFoot;
  const lx1 = x1 + nx * offFt, lz1 = z1 + nz * offFt;
  const lx2 = x2 + nx * offFt, lz2 = z2 + nz * offFt;
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([lx1, 0.03, lz1, lx2, 0.03, lz2], 3));
    const mat = new THREE.LineBasicMaterial({ color: "#8A8478", transparent: true, opacity: 0.7 });
    return new THREE.Line(g, mat);
  }, [lx1, lz1, lx2, lz2]);
  return (
    <>
      <primitive object={line} />
      <Billboard position={[(lx1 + lx2) / 2, 0.4, (lz1 + lz2) / 2]}>
        <Text fontSize={0.28} color="#8A8478" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">{ftFmt(px, pxPerFoot)}</Text>
      </Billboard>
    </>
  );
}

// ─── Zone floor ───────────────────────────────────────────────────────────────
function ZoneFloor({ zone, cx, cz, pxPerFoot, zoneLibrary, style3d = "clay" }) {
  const geo = useMemo(() => {
    const toSX = sx =>  (sx - cx) / pxPerFoot;
    const toSY = sy => -((sy - cz) / pxPerFoot);
    const shape = new THREE.Shape();
    if (zone.points && zone.points.length >= 3) {
      shape.moveTo(toSX(zone.points[0].x), toSY(zone.points[0].y));
      for (let i = 1; i < zone.points.length; i++) shape.lineTo(toSX(zone.points[i].x), toSY(zone.points[i].y));
      shape.closePath();
    } else if (zone.w && zone.h) {
      const sx = toSX(zone.x), sy = toSY(zone.y), w = zone.w / pxPerFoot, d = -zone.h / pxPerFoot;
      shape.moveTo(sx, sy); shape.lineTo(sx + w, sy); shape.lineTo(sx + w, sy + d); shape.lineTo(sx, sy + d); shape.closePath();
    } else { return null; }
    return new THREE.ShapeGeometry(shape);
  }, [zone, cx, cz, pxPerFoot]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <meshLambertMaterial color={zoneColor(zone, zoneLibrary)} transparent opacity={style3d === "xray" ? 0.05 : style3d === "detailed" ? 0.55 : 0.4} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FloorPlane({ zones, cx, cz, pxPerFoot, T, zoneLibrary, style3d = "clay" }) {
  return (
    <group>
      {style3d !== "xray" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={style3d === "detailed"}>
          <planeGeometry args={[500, 500]} />
          {style3d === "detailed"
            ? <meshStandardMaterial color={T.canvas} roughness={0.9} metalness={0.0} />
            : <meshLambertMaterial color={T.canvas} />}
        </mesh>
      )}
      {zones.map(z => <ZoneFloor key={z.id} zone={z} cx={cx} cz={cz} pxPerFoot={pxPerFoot} zoneLibrary={zoneLibrary} style3d={style3d} />)}
    </group>
  );
}

// ─── Camera auto-fit on every mount ───────────────────────────────────────────
// Runs inside the Canvas so it can access useThree(). Imperatively sets the
// camera position and tells OrbitControls to treat it as the "home" state so
// the reset button always returns to the same fit-all view.
function CameraRig({ camDist, controlsRef }) {
  const { camera } = useThree();
  useEffect(() => {
    const d = camDist;
    camera.position.set(d * 0.7, d * 0.8, d * 0.7);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    // Give OrbitControls one frame to initialise before saving home state.
    const id = setTimeout(() => {
      if (controlsRef?.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
        controlsRef.current.saveState();
      }
    }, 0);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once per mount
  return null;
}

// ─── Main 3D component ─────────────────────────────────────────────────────────
export default function TestFit3D({
  walls, nodes, doors, windows, columns, zones, markers = [], dims = [],
  pxPerFoot, ceilingHeight, T, themeMode = "dark", onSelect, controlsRef,
  selectedId, selType, mode = "build",
  show3dLabels, setShow3dLabels,
  show3dDims,   setShow3dDims,
  zoneLibrary = {},
  style3d = "clay",
  visibleLayers = {},
  visibleBuildElectrical = true,
  visibleBuildLighting = true,
}) {
  const safeSelect = (id, type) => { if ((MODE_SELECT[mode] ?? new Set()).has(type)) onSelect(id, type); };

  // Filter markers by layer visibility (mirrors 2D rendering logic)
  const visibleMarkers = markers.filter(m => {
    if (m.layer === "power") {
      const isLighting = m.componentType?.startsWith("light_") || m.componentType?.startsWith("htrack_") ||
        m.componentType === "sconce_prewire" || m.componentType === "pendent_prewire";
      if (mode === "build") return isLighting ? visibleBuildLighting : visibleBuildElectrical;
      return true;
    }
    return visibleLayers[m.layer] !== false;
  });

  const { cx, cz } = useMemo(() => {
    if (!nodes.length) return { cx: 0, cz: 0 };
    return { cx: nodes.reduce((s, n) => s + n.x, 0) / nodes.length, cz: nodes.reduce((s, n) => s + n.y, 0) / nodes.length };
  }, [nodes]);

  const camDist = useMemo(() => {
    if (!nodes.length) return 18;
    let maxR = 0;
    nodes.forEach(n => { const dx = (n.x - cx) / pxPerFoot, dz = (n.y - cz) / pxPerFoot; maxR = Math.max(maxR, Math.sqrt(dx * dx + dz * dz)); });
    return Math.max(10, maxR * 2.2);
  }, [nodes, cx, cz, pxPerFoot]);

  const isDark = themeMode === "dark";
  const bgColor   = style3d === "xray" ? (isDark ? "#0d1117" : "#f0f4f8") : T.canvas;
  const gridCell  = style3d === "xray" ? (isDark ? "#1a2233" : "#a0c0ff") : T.accentDim;
  const gridSec   = style3d === "xray" ? (isDark ? "#2a3a55" : "#4060cc") : T.gridSub;

  // Offset the grid so its lines align with the 2D 1-foot boundaries.
  // In 3D, world-origin = centroid of nodes. A 2D foot-boundary n is at
  // world position (n - cx/pxPerFoot). We shift the grid by the fractional
  // foot of the centroid so lines land on the same marks as in 2D.
  const mod1 = x => ((x % 1) + 1) % 1; // positive modulo 1
  const gridOffX = mod1(-(cx / pxPerFoot));
  const gridOffZ = mod1(-(cz / pxPerFoot));

  return (
    <div style={{ position: "absolute", inset: 0, background: bgColor }}>
      <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 10, color: T.textFaint, zIndex: 10, userSelect: "none" }}>
        Orbit: drag · Pan: right-drag · Zoom: scroll · Click to inspect
      </div>

      <Canvas shadows={style3d === "detailed"} camera={{ fov: 50, near: 0.1, far: 2000 }} gl={{ antialias: true }} style={{ width: "100%", height: "100%" }}>
        <color attach="background" args={[bgColor]} />

        {style3d === "detailed" ? <>
          <ambientLight intensity={0.3} />
          <hemisphereLight skyColor="#b1e1ff" groundColor="#7a6552" intensity={0.5} />
          <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow
            shadow-mapSize-width={2048} shadow-mapSize-height={2048}
            shadow-camera-near={0.5} shadow-camera-far={200}
            shadow-camera-left={-50} shadow-camera-right={50}
            shadow-camera-top={50} shadow-camera-bottom={-50} />
        </> : style3d === "xray" ? <>
          <ambientLight intensity={1.0} />
        </> : <>
          <ambientLight intensity={0.65} />
          <directionalLight position={[8, 15, 8]} intensity={0.9} />
        </>}

        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} zoomSpeed={0.5} minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.04} target={[0, 0, 0]} />
        <CameraRig camDist={camDist} controlsRef={controlsRef} />

        <FloorPlane zones={zones} cx={cx} cz={cz} pxPerFoot={pxPerFoot} T={T} zoneLibrary={zoneLibrary} style3d={style3d} />
        <Grid args={[500, 500]} cellSize={1} sectionSize={10} cellColor={gridCell} sectionColor={gridSec} position={[gridOffX, 0.002, gridOffZ]} fadeDistance={camDist * 2.5} fadeStrength={1.2} />

        {walls.map(w => (
          <Wall3D key={w.id} w={w} nodes={nodes} doors={doors} windows={windows}
            cx={cx} cz={cz} pxPerFoot={pxPerFoot} ceilingHeight={w.ceilingHeight ?? ceilingHeight}
            onSelect={safeSelect} selectedId={selectedId} selType={selType} showDims={show3dDims} style3d={style3d} />
        ))}
        {columns.map(col => (
          <Column3D key={col.id} col={col} cx={cx} cz={cz} pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight}
            onSelect={safeSelect} isSelected={selectedId === col.id && selType === "column"} style3d={style3d} />
        ))}
        {visibleMarkers.map(m => (
          <Marker3D key={m.id} marker={m} cx={cx} cz={cz} pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight}
            onSelect={safeSelect} isSelected={selectedId === m.id && selType === "marker"} style3d={style3d} />
        ))}
        {show3dLabels && zones.map(z => <ZoneLabel3D key={z.id} zone={z} cx={cx} cz={cz} pxPerFoot={pxPerFoot} zoneLibrary={zoneLibrary} />)}
        {show3dDims   && dims.map(d =>  <DimLine3D  key={d.id} dim={d}  cx={cx} cz={cz} pxPerFoot={pxPerFoot} />)}
      </Canvas>
    </div>
  );
}
