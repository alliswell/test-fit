import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { traceOuterBoundary, computeWallFootprints, junctionCapPolys } from "./geometry";
import { footprintToLocal, buildWallSolidGeometry, buildCapSolidGeometry, solidEdgesGeometry, buildWallEdgeSegments } from "./wallGeo3d";
import { DOOR_TYPE_STYLES } from "../constants/theme";
import { DOOR_KNOB_HEIGHT_IN, FINISH_COLORS } from "../constants/specs";
import { M3D } from "./markerMount";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Billboard, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass }     from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass }     from "three/examples/jsm/postprocessing/OutputPass.js";

// ─── Constants ─────────────────────────────────────────────────────────────────
const WALL_KINDS = {
  existing: { label: "Existing", color: "#9A9488", thickness: 7 },
  demo:     { label: "Demo",     color: "#E05050", thickness: 7 },
  new:      { label: "New",      color: "#50A0E0", thickness: 7   },
  pony:     { label: "Pony",     color: "#C8A060", thickness: 4   },
};

// Blend a hex color toward white by t∈[0,1]. Clay-mode walls render a lighter tone than
// their saturated drafting kind color (which xray still uses at low opacity) — pale,
// unpainted-drywall existing walls, while keeping the demo/new/pony hues distinguishable
// as soft tints. Paired with a matching `emissive` on the wall material (below): under
// clay's lighting (ambientLight 0.65 + one directional 0.9), pure Lambert shading caps
// shaded/side faces at ~65% of this color regardless of how light it is — emissive adds
// a light-independent floor so those faces read pale too, while lit faces (diffuse +
// emissive) stay brighter, preserving the per-face shading that gives the massing depth.
const lightenHex = (hex, t) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.round(v + (255 - v) * t);
  return "#" + [m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
};
const CLAY_WALL_LIGHTEN = 0.6;

// Per-material PBR specs used in detailed-mode rendering. Drafting kind colors
// (existing/demo/new/pony) drive the look in clay/xray; in detailed mode the
// material's realistic color/roughness wins so walls read as their built finish.
const WALL_MATERIAL_PBR = {
  "Drywall":     { color: "#ECE6D9", roughness: 0.92, metalness: 0.00 }, // off-white painted
  "Brick":       { color: "#9B4A3A", roughness: 0.95, metalness: 0.00 }, // rust red
  "CMU / Block": { color: "#8A8D8C", roughness: 0.92, metalness: 0.05 }, // cool gray
  "Concrete":    { color: "#A09D96", roughness: 0.85, metalness: 0.05 }, // medium gray
  "Plaster":     { color: "#E3D9C3", roughness: 0.88, metalness: 0.00 }, // warm cream
  "Other":       null, // sentinel — fall through to kind color
};

// Real-world tile size for materials that have a procedural texture. The wall's
// box geometry has its UVs scaled per-face so the pattern shows at correct scale
// regardless of wall length/height.
const WALL_MATERIAL_TILE_FT = {
  "Brick":       { x: 16/12, y: 8/12 },   // 16" × 8" tile = 2 rows of running bond
  "CMU / Block": { x: 16/12, y: 8/12 },   // 16" × 8" CMU block + mortar
};

// ─── Procedural wall textures (lazy, cached) ─────────────────────────────────
function _makeBrickColorTex() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5a4a40"; ctx.fillRect(0, 0, 256, 128); // mortar
  const bw = 128, bh = 64, m = 6;
  const colors = ["#9c4f3e", "#a55a47", "#8c4334", "#9b4f3f", "#a25241", "#854230", "#923f30"];
  for (let row = 0; row < 2; row++) {
    const xs = row === 1 ? -bw / 2 : 0;
    for (let col = -1; col <= 2; col++) {
      const x = col * bw + xs + m / 2;
      const y = row * bh + m / 2;
      ctx.fillStyle = colors[(row * 5 + col * 3 + 12) % colors.length];
      ctx.fillRect(x, y, bw - m, bh - m);
      ctx.fillStyle = "rgba(255,230,200,0.07)"; ctx.fillRect(x, y, bw - m, 3);            // highlight top
      ctx.fillStyle = "rgba(0,0,0,0.10)";       ctx.fillRect(x, y + bh - m - 3, bw - m, 3); // shadow bottom
    }
  }
  // Speckle for surface variation
  const img = ctx.getImageData(0, 0, 256, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i]     + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function _makeBrickBumpTex() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, 256, 128); // mortar = recessed
  const bw = 128, bh = 64, m = 6;
  for (let row = 0; row < 2; row++) {
    const xs = row === 1 ? -bw / 2 : 0;
    for (let col = -1; col <= 2; col++) {
      const x = col * bw + xs + m / 2;
      const y = row * bh + m / 2;
      const cx = x + (bw - m) / 2, cy = y + (bh - m) / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bw / 2);
      grad.addColorStop(0,    "#ffffff");
      grad.addColorStop(0.78, "#d8d8d8");
      grad.addColorStop(1,    "#5a5a5a");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, bw - m, bh - m);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function _makeCMUColorTex() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#5e6260"; ctx.fillRect(0, 0, 256, 128); // mortar
  const bw = 256, bh = 128, m = 8;
  // Single CMU block per tile (16" × 8")
  ctx.fillStyle = "#8b8e8c";
  ctx.fillRect(m / 2, m / 2, bw - m, bh - m);
  // Pock-marked aggregate noise
  const img = ctx.getImageData(0, 0, 256, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 30;
    img.data[i]     = Math.max(0, Math.min(255, img.data[i]     + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function _makeCMUBumpTex() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, 256, 128); // mortar recess
  ctx.fillStyle = "#dddddd";
  ctx.fillRect(4, 4, 248, 120);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
let _brickColor, _brickBump, _cmuColor, _cmuBump;
function getWallTextureSet(material) {
  if (material === "Brick") {
    if (!_brickColor) { _brickColor = _makeBrickColorTex(); _brickBump = _makeBrickBumpTex(); }
    return { map: _brickColor, bumpMap: _brickBump, bumpScale: 0.05 };
  }
  if (material === "CMU / Block") {
    if (!_cmuColor) { _cmuColor = _makeCMUColorTex(); _cmuBump = _makeCMUBumpTex(); }
    return { map: _cmuColor, bumpMap: _cmuBump, bumpScale: 0.04 };
  }
  return null;
}

// ─── Floor materials (procedural textures, lazy + cached) ────────────────────
const FLOOR_MATERIAL_PBR = {
  "Wood":     { color: "#C8A878", roughness: 0.50, metalness: 0.05 },
  "Concrete": { color: "#AEABA4", roughness: 0.70, metalness: 0.05 },
  "Vinyl":    { color: "#BFA889", roughness: 0.40, metalness: 0.05 },
  "Carpet":   { color: "#786758", roughness: 0.95, metalness: 0.00 },
};
const FLOOR_MATERIAL_TILE_FT = {
  "Wood":     { x: 4.0, y: 0.5 },   // 4-ft plank × 6-in board
  "Concrete": { x: 4.0, y: 4.0 },
  "Vinyl":    { x: 1.0, y: 1.0 },   // 12-in tile
  "Carpet":   { x: 2.0, y: 2.0 },
};
function _makeWoodTex() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#C8A878"; ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = "rgba(40,25,10,0.7)"; ctx.fillRect(0, 0, 512, 2); ctx.fillRect(0, 62, 512, 2);
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(80,50,25,${0.18 + Math.random() * 0.32})`; ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath(); const y = Math.random() * 64; ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y + (Math.random() - 0.5) * 2); ctx.stroke();
  }
  for (let i = 0; i < 3; i++) { const x = Math.random() * 512, y = 12 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, "#5a3a20"); g.addColorStop(0.5, "#8a6a40"); g.addColorStop(1, "rgba(200,168,120,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 12, y - 12, 24, 24); }
  const img = ctx.getImageData(0, 0, 512, 64);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 16; img.data[i] += n; img.data[i+1] += n; img.data[i+2] += n; }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function _makeNoiseTex(base, speckle, splotch) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const ctx = c.getContext("2d"); ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  if (splotch) for (let i = 0; i < 60; i++) { const x = Math.random()*256, y = Math.random()*256, r = 4 + Math.random()*22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); const lum = (0.45 + Math.random()*0.35)*255;
    g.addColorStop(0, `rgba(${lum},${lum},${lum},0.3)`); g.addColorStop(1, `rgba(${lum},${lum},${lum},0)`); ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2); }
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * speckle; img.data[i] += n; img.data[i+1] += n; img.data[i+2] += n; }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function _makeVinylTex() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const ctx = c.getContext("2d"); ctx.fillStyle = "#BFA889"; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(60,40,25,0.4)"; ctx.fillRect(0, 0, 256, 2); ctx.fillRect(0, 254, 256, 2); ctx.fillRect(0, 0, 2, 256); ctx.fillRect(254, 0, 2, 256);
  for (let i = 0; i < 35; i++) { const x = 6 + Math.random()*244, y = 6 + Math.random()*244, r = 3 + Math.random()*10;
    ctx.fillStyle = `rgba(${100+Math.random()*60},${80+Math.random()*50},${50+Math.random()*30},0.32)`;
    ctx.beginPath(); ctx.ellipse(x, y, r*1.6, r, Math.random()*Math.PI, 0, Math.PI*2); ctx.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const _floorTexCache = {};
function getFloorTexture(material) {
  if (_floorTexCache[material] !== undefined) return _floorTexCache[material];
  let t = null;
  if (material === "Wood") t = _makeWoodTex();
  else if (material === "Concrete") t = _makeNoiseTex("#aeaba4", 24, true);
  else if (material === "Vinyl") t = _makeVinylTex();
  else if (material === "Carpet") t = _makeNoiseTex("#786758", 42, false);
  _floorTexCache[material] = t;
  return t;
}

// Wall-base AO strip texture — vertical alpha ramp, dark at the wall edge fading to
// clear. Linear (no colorSpace): it's an alpha ramp, not color data. Cached module-wide.
let _aoStripTex = null;
function getAOStripTex() {
  if (_aoStripTex) return _aoStripTex;
  const c = document.createElement("canvas");
  c.width = 16; c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(0,0,0,0.45)");
  g.addColorStop(0.4, "rgba(0,0,0,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 64);
  _aoStripTex = new THREE.CanvasTexture(c);
  return _aoStripTex;
}

// Floor bump maps — relief aligned with the color maps' painted seams (same canvas
// rows/cols, same tile size). Gray canvases, linear, RepeatWrapping like the wall bumps.
function _grayCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, w, h);
  return { c, ctx };
}
function _wrapTex(c, aniso = 4) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
function _makeWoodBumpTex() {
  const { c, ctx } = _grayCanvas(512, 64);
  ctx.fillStyle = "#303030";           // grooves on the plank-border rows
  ctx.fillRect(0, 0, 512, 2); ctx.fillRect(0, 62, 512, 2);
  for (let i = 0; i < 10; i++) {       // faint grain streaks
    const y = 6 + Math.floor(Math.random() * 52);
    const v = 128 + Math.floor((Math.random() - 0.5) * 20);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * 512, y, 60 + Math.random() * 200, 1);
  }
  return _wrapTex(c, 8);
}
function _makeGrayNoiseTex(speckle = 24) {
  const { c, ctx } = _grayCanvas(256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + Math.floor((Math.random() - 0.5) * 2 * speckle);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return _wrapTex(c);
}
function _makeVinylBumpTex() {
  const { c, ctx } = _grayCanvas(256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + Math.floor((Math.random() - 0.5) * 16);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = "#303030";           // tile-edge grooves on the seam lines
  ctx.fillRect(0, 0, 256, 2); ctx.fillRect(0, 254, 256, 2);
  ctx.fillRect(0, 0, 2, 256); ctx.fillRect(254, 0, 2, 256);
  return _wrapTex(c);
}
const _floorBumpCache = {};
function getFloorBump(material) {
  if (_floorBumpCache[material] !== undefined) return _floorBumpCache[material];
  let b = null;
  if (material === "Wood") b = { bumpMap: _makeWoodBumpTex(), bumpScale: 0.015 };
  else if (material === "Concrete") b = { bumpMap: _makeGrayNoiseTex(24), bumpScale: 0.01 };
  else if (material === "Vinyl") b = { bumpMap: _makeVinylBumpTex(), bumpScale: 0.012 };
  _floorBumpCache[material] = b; // Carpet/unknown cache null
  return b;
}

// Zone colors come from the editable zoneLibrary prop passed by TestFit3D.
const zoneColor = (zone, zoneLibrary) =>
  zoneLibrary?.[zone.type]?.color ?? zone.paintColor ?? "#8B7355";

const DOOR_HEIGHT_FT = 7;   // standard door height; masthead fills above
// Painted trim (baseboards + corner plinths) — same finish family as WindowFrame,
// already proven to stay under the 2.3 bloom threshold in detailed lighting.
const BASE_H = 4 / 12;      // 4" baseboard height
const BASE_D = 0.05;        // 0.6" proud of the wall face
const TRIM_MAT = { color: "#F0EDE6", roughness: 0.5, metalness: 0.0, envMapIntensity: 0.7 };
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
  "htrack_4","htrack_8",
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

// Device finish (white/black) overrides the M3D base color when a marker carries one.
const finishColor = (marker, cfg) => (marker.finish && FINISH_COLORS[marker.finish]) ? FINISH_COLORS[marker.finish].body : cfg.color;

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

// Translucent coverage cone — apex at the device, opening into the room along local +Z.
// Used to preview a camera's field of view or a speaker's dispersion.
function CoverageCone({ color = "#3FC8E8", half = 40, dist = 8, opacity = 0.12 }) {
  const r = dist * Math.tan(Math.min(80, half) * Math.PI / 180);
  return <mesh position={[0, 0, dist / 2]} rotation={[-Math.PI / 2, 0, 0]}>
    <coneGeometry args={[r, dist, 22, 1, true]} />
    <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
  </mesh>;
}

// ─── Warm 2700 K light glow (detailed mode only) ───────────────────────────────
function WarmGlow({ r = 0.28, intensity = 1.0, distance = 9, position = [0, 0, 0] }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.opacity = 0.10 + 0.05 * Math.sin(clock.getElapsedTime() * 0.5);
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

// ─── Wall solid — one mitered-footprint extrusion per wall ────────────────────
// Renders the geometry produced by buildWallSolidGeometry (already in the wall-local
// frame, floor at y=0). Material branches mirror WallBox; the demo two-pass
// depth-prepass/EqualDepth union carries over unchanged (exact footprints eliminate
// wall-wall overlap, but junction cap solids still overlap demo quads).
function WallSolid({ geometry, edges = null, color, material, wallId, onSelect, isDemo, isSelected, style3d = "clay", interactive = true }) {
  const [hov, setHov] = useState(false);
  const matSpec = WALL_MATERIAL_PBR[material || "Drywall"];
  const detailedColor = matSpec?.color ?? color;
  const detailedRough = matSpec?.roughness ?? 0.92;
  const detailedMetal = matSpec?.metalness ?? 0.0;
  const tex = (style3d === "detailed" && !isDemo) ? getWallTextureSet(material) : null;
  // Print style reads like a black-and-white line drawing: flat near-white surfaces with
  // black outlines on every wall (hidden-line look), no textures/shadows/bloom.
  const outlined = style3d === "xray" || style3d === "print" || isDemo;
  const edgeColor = (style3d === "print" && !isDemo) ? "#111111" : color;
  // Outline: callers with CSG'd geometry pass procedural `edges` (T-vertices in CSG
  // output break EdgesGeometry); plain solids (caps) fall back to solidEdgesGeometry.
  const fallbackEdges = useMemo(
    () => (!edges && outlined) ? solidEdgesGeometry(geometry) : null,
    [edges, geometry, outlined]);
  useEffect(() => () => fallbackEdges?.dispose(), [fallbackEdges]);
  const edgesGeo = outlined ? (edges || fallbackEdges) : null;
  const glowBB = useMemo(() => {
    if (!isSelected) return null;
    geometry.computeBoundingBox();
    return geometry.boundingBox;
  }, [geometry, isSelected]);
  const demoUnion = isDemo && style3d !== "xray";
  return (
    <group>
      {demoUnion && (
        <mesh key={style3d + "-demoprep"} geometry={geometry} renderOrder={10} userData={{ noAutoShadow: true }}>
          <meshBasicMaterial transparent colorWrite={false} depthWrite />
        </mesh>
      )}
      <mesh
        key={style3d + (demoUnion ? "-demo" : "")}
        geometry={geometry}
        renderOrder={demoUnion ? 11 : undefined}
        onClick={interactive ? (e => { e.stopPropagation(); onSelect(wallId, "wall"); }) : undefined}
        onPointerOver={interactive ? (e => { e.stopPropagation(); setHov(true); }) : undefined}
        onPointerOut={interactive ? (() => setHov(false)) : undefined}
        castShadow={style3d === "detailed" && !isDemo}
        receiveShadow={style3d === "detailed" && !isDemo}
        userData={isDemo ? { noAutoShadow: true } : undefined}
      >
        {/* Unlit (basic) demo fill on purpose — see WallBox demo notes. */}
        {demoUnion && <meshBasicMaterial
          color={(interactive && hov) ? "#ffffff" : color}
          transparent opacity={hov ? 0.7 : 0.4}
          depthWrite={false} depthFunc={THREE.EqualDepth} />}
        {!demoUnion && style3d === "xray" && <meshBasicMaterial color={(interactive && hov) ? "#ffffff" : color} transparent opacity={hov ? 0.25 : 0.08} depthWrite={false} />}
        {!demoUnion && style3d === "detailed" && <meshStandardMaterial
          color={interactive && hov ? "#ffffff" : (tex ? "#ffffff" : detailedColor)}
          roughness={detailedRough}
          metalness={detailedMetal}
          envMapIntensity={0.6}
          map={tex?.map}
          bumpMap={tex?.bumpMap}
          bumpScale={tex?.bumpScale}
        />}
        {!demoUnion && style3d === "print" && <meshLambertMaterial
          color={(interactive && hov) ? "#DCE8F6" : "#F5F5F5"} emissive="#EDEDED" emissiveIntensity={0.5} />}
        {!demoUnion && style3d === "clay" && (() => {
          const claySelf = lightenHex(color, CLAY_WALL_LIGHTEN);
          return <meshLambertMaterial
            color={(interactive && hov) ? "#ffffff" : claySelf}
            emissive={(interactive && hov) ? "#000000" : claySelf}
            emissiveIntensity={0.4}
            transparent={hov} opacity={hov ? 0.85 : 1} />;
        })()}
      </mesh>
      {edgesGeo && <lineSegments geometry={edgesGeo} renderOrder={isDemo ? 12 : undefined}>
        <lineBasicMaterial color={edgeColor} />
      </lineSegments>}
      {isSelected && glowBB && (
        <group position={[(glowBB.min.x + glowBB.max.x) / 2, (glowBB.min.y + glowBB.max.y) / 2, (glowBB.min.z + glowBB.max.z) / 2]}>
          <BoxGlow w={glowBB.max.x - glowBB.min.x} h={glowBB.max.y - glowBB.min.y} d={glowBB.max.z - glowBB.min.z} />
        </group>
      )}
    </group>
  );
}

// ─── Door with swing arc ───────────────────────────────────────────────────────
// ─── Door casing — interior + exterior trim around the opening ─────────────
// Detailed-mode only. Three boards (left jamb, right jamb, head) sit slightly
// proud of each wall face. Wood-stained material reads as painted/stained pine.
function DoorCasing({ segLenFt, heightFt, thickFt, offsetFt, style3d = "clay" }) {
  if (style3d !== "detailed") return null;
  const cw = 0.21;   // 2.5" casing width
  const cd = 0.06;   // 0.75" projection from wall face
  const sideH = heightFt + cw;        // jamb tops align with head bottom
  const headW = segLenFt + cw * 2;
  const proud = thickFt / 2 + cd / 2 + 0.001;
  const matProps = { color: "#A87545", roughness: 0.55, metalness: 0.05, envMapIntensity: 0.7 };
  return (
    <group position={[offsetFt, 0, 0]}>
      {[1, -1].map(face => (
        <group key={face} position={[0, 0, face * proud]}>
          <mesh position={[-segLenFt / 2 - cw / 2, sideH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[cw, sideH, cd]} /><meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[segLenFt / 2 + cw / 2, sideH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[cw, sideH, cd]} /><meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[0, heightFt + cw / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[headW, cw, cd]} /><meshStandardMaterial {...matProps} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Baseboard — painted trim along a wall segment's base ──────────────────
// Detailed-mode only. One board proud of each wall face (DoorCasing's proud math);
// callers skip door segments (casing meets the floor) and demo walls.
function Baseboard({ segLenFt, thickFt, offsetFt = 0, style3d = "clay" }) {
  if (style3d !== "detailed") return null;
  const proud = thickFt / 2 + BASE_D / 2 + 0.001;
  return (
    <group position={[offsetFt, 0, 0]}>
      {[1, -1].map(face => (
        <mesh key={face} position={[0, BASE_H / 2, face * proud]} castShadow receiveShadow>
          <boxGeometry args={[segLenFt, BASE_H, BASE_D]} />
          <meshStandardMaterial {...TRIM_MAT} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Wall-base AO strip — soft inner-corner shading on the floor ───────────
// Detailed-mode only. A gradient quad along each wall face, dark edge hugging the
// wall — the inner-corner ambient occlusion the top-down ContactShadows can't give.
// noAutoShadow: the shadow depth pass ignores texture alpha (would cast rectangles).
function BaseAOStrip({ segLenFt, thickFt, offsetFt = 0, widthFt = 0.6, style3d = "clay" }) {
  if (style3d !== "detailed") return null;
  const AO_Y = 0.008; // floor stack: base 0.001 / regions 0.004 / AO / selection 0.012
  return (
    <group position={[offsetFt, 0, 0]}>
      {[1, -1].map(face => (
        <group key={face} rotation={[0, face === 1 ? 0 : Math.PI, 0]}>
          <mesh position={[0, AO_Y, thickFt / 2 + widthFt / 2]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noAutoShadow: true }}>
            <planeGeometry args={[segLenFt, widthFt]} />
            <meshBasicMaterial map={getAOStripTex()} transparent depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Window frame — sill + side jambs + head ───────────────────────────────
// Detailed-mode only. Painted-white finish with a slightly proud sill that
// projects further than the jambs (typical interior stool detail).
function WindowFrame({ segLenFt, winHFt, sillFt, thickFt, style3d = "clay" }) {
  if (style3d !== "detailed") return null;
  const fw = 0.17;    // 2" frame width
  const fd = 0.05;    // jamb / head projection
  const sillH = 0.10;
  const sillD = 0.10; // sill projects further than jambs
  const proud = thickFt / 2 + fd / 2 + 0.001;
  const sillProud = thickFt / 2 + sillD / 2 + 0.001;
  const wTop = sillFt + winHFt;
  const matProps = { color: "#F0EDE6", roughness: 0.4, metalness: 0.0, envMapIntensity: 0.7 };
  return (
    <>
      {[1, -1].map(face => (
        <group key={face}>
          {/* Side jambs */}
          <mesh position={[-segLenFt / 2 - fw / 2, sillFt + winHFt / 2, face * proud]} castShadow receiveShadow>
            <boxGeometry args={[fw, winHFt, fd]} /><meshStandardMaterial {...matProps} />
          </mesh>
          <mesh position={[segLenFt / 2 + fw / 2, sillFt + winHFt / 2, face * proud]} castShadow receiveShadow>
            <boxGeometry args={[fw, winHFt, fd]} /><meshStandardMaterial {...matProps} />
          </mesh>
          {/* Head */}
          <mesh position={[0, wTop + fw / 2, face * proud]} castShadow receiveShadow>
            <boxGeometry args={[segLenFt + fw * 2, fw, fd]} /><meshStandardMaterial {...matProps} />
          </mesh>
          {/* Stool / sill — projects further on each face */}
          <mesh position={[0, sillFt - sillH / 2, face * sillProud]} castShadow receiveShadow>
            <boxGeometry args={[segLenFt + fw * 2, sillH, sillD]} /><meshStandardMaterial {...matProps} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function DoorSwing3D({ door, segLenFt, heightFt, offsetFt, thickFt, onSelect, isSelected, style3d = "clay", interactive = true }) {
  const isCaseOpening = door.doorType === "Case Opening";
  const isGlass       = door.doorType === "Glass";
  const st            = DOOR_TYPE_STYLES[door.doorType] || DOOR_TYPE_STYLES.Wood;
  const hingeRight    = door.hingeRight ?? false;
  const swingZ        = door.flipped ? -1 : 1;
  const doorH         = heightFt; // caller passes door-height only (DOOR_HEIGHT_FT)
  const hingeX        = offsetFt + (hingeRight ? segLenFt / 2 : -segLenFt / 2);
  const closedAngle   = hingeRight ? Math.PI : 0;
  const sweepSign     = (hingeRight ? -1 : 1) * swingZ;
  const isDetailed    = style3d === "detailed";

  const tubeGeo = useMemo(() => {
    const N = 24, pts = [];
    for (let i = 0; i <= N; i++) {
      const a = closedAngle + sweepSign * (Math.PI / 2) * (i / N);
      pts.push(new THREE.Vector3(hingeX + segLenFt * Math.cos(a), 0.015, segLenFt * Math.sin(a)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.025, 6, false);
  }, [hingeX, segLenFt, closedAngle, sweepSign]);

  const click = interactive ? (e => { e.stopPropagation(); onSelect(door.id, "door"); }) : undefined;
  const showSel = isSelected && interactive;
  return (
    <group onClick={click}>
      <mesh position={[offsetFt, doorH / 2, 0]}>
        <boxGeometry args={[segLenFt, doorH, thickFt * 2.5]} /><meshLambertMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {!isCaseOpening && (<>
        <group position={[hingeX, doorH / 2, swingZ * segLenFt / 2]}>
          {isGlass ? (() => {
            // Stile/rail frame + transparent pane (leaf local axes: x=thickness, y=height, z=width)
            const fw = 0.15; // ~1.8" stiles/rails
            const frameMat = isDetailed
              ? <meshStandardMaterial {...st.frame.pbr} envMapIntensity={0.7} />
              : <meshLambertMaterial color={st.frame.clay} />;
            return <>
              <mesh position={[0, 0, (segLenFt - fw) / 2]}><boxGeometry args={[0.08, doorH, fw]} />{frameMat}</mesh>
              <mesh position={[0, 0, -(segLenFt - fw) / 2]}><boxGeometry args={[0.08, doorH, fw]} />{frameMat}</mesh>
              <mesh position={[0, (doorH - fw) / 2, 0]}><boxGeometry args={[0.08, fw, segLenFt - 2 * fw]} />{frameMat}</mesh>
              <mesh position={[0, -(doorH - fw) / 2, 0]}><boxGeometry args={[0.08, fw, segLenFt - 2 * fw]} />{frameMat}</mesh>
              <mesh>
                <boxGeometry args={[0.02, doorH - 2 * fw, segLenFt - 2 * fw]} />
                {isDetailed
                  ? <meshPhysicalMaterial {...st.pbr} thickness={0.4} ior={1.5} transparent envMapIntensity={1.2} side={THREE.DoubleSide} />
                  : <meshLambertMaterial color={st.clay.color} transparent opacity={st.clay.opacity} side={THREE.DoubleSide} depthWrite={false} />}
              </mesh>
            </>;
          })() : (
            <mesh>
              <boxGeometry args={[0.08, doorH, segLenFt]} />
              {isDetailed
                ? <meshStandardMaterial {...st.pbr} envMapIntensity={0.7} />
                : <meshLambertMaterial color={st.clay.color} transparent opacity={st.clay.opacity} />}
            </mesh>
          )}
          {/* Knob — latch edge (free end of the leaf), through both faces, brass in detailed */}
          {(() => {
            const knobMat = isDetailed
              ? <meshStandardMaterial color="#C8A060" roughness={0.35} metalness={0.85} envMapIntensity={1.2} />
              : <meshLambertMaterial color={showSel ? GLOW_COLOR : "#C8A060"} />;
            return <group position={[0, DOOR_KNOB_HEIGHT_IN / 12 - doorH / 2, swingZ * (segLenFt / 2 - 0.25)]}>
              <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 0.22, 6]} />{knobMat}</mesh>
              <mesh position={[0.1, 0, 0]}><sphereGeometry args={[0.05, 10, 8]} />{knobMat}</mesh>
              <mesh position={[-0.1, 0, 0]}><sphereGeometry args={[0.05, 10, 8]} />{knobMat}</mesh>
            </group>;
          })()}
          {showSel && <BoxGlow w={0.08} h={doorH} d={segLenFt} />}
        </group>
        {/* Swing arc — drafting annotation, hidden in detailed mode */}
        {!isDetailed && (
          <mesh geometry={tubeGeo}>
            <meshLambertMaterial color={showSel ? GLOW_COLOR : "#C8A060"} transparent opacity={showSel ? 0.85 : 0.55} />
          </mesh>
        )}
      </>)}
      {isCaseOpening && showSel && (
        <mesh position={[offsetFt, doorH / 2, 0]}>
          <boxGeometry args={[segLenFt + GLOW_OFFSET * 2, doorH + GLOW_OFFSET * 2, thickFt + GLOW_OFFSET * 2]} /><meshLambertMaterial color={GLOW_COLOR} transparent opacity={0.3} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
      {/* Access reader (Openpath) on the jamb at ~44" AFF */}
      {door.accessControl && (() => {
        const hingeXloc = offsetFt + (hingeRight ? segLenFt / 2 : -segLenFt / 2);
        const latchXloc = offsetFt + (hingeRight ? -segLenFt / 2 : segLenFt / 2);
        const baseX = door.accessSide === "hinge" ? hingeXloc : latchXloc;
        const outward = Math.sign(baseX - offsetFt) || 1;
        return (
          <group position={[baseX + outward * 0.34, 44 / 12, thickFt * 0.7]}>
            <mesh><boxGeometry args={[0.14, 0.5, 0.05]} /><meshLambertMaterial color="#ECEAE3" /></mesh>
            <mesh position={[0, 0.12, 0.03]}><boxGeometry args={[0.07, 0.18, 0.02]} />
              {isDetailed
                ? <meshStandardMaterial color="#3FC8E8" emissive="#3FC8E8" emissiveIntensity={3.2} toneMapped={false} />
                : <meshLambertMaterial color="#3FC8E8" />}
            </mesh>
          </group>
        );
      })()}
    </group>
  );
}

// ─── Window glass / glow ───────────────────────────────────────────────────────
function WindowGlass({ lenFt, winHFt, sillFt, thickFt, style3d = "clay" }) {
  return (
    <mesh position={[0, sillFt + winHFt / 2, 0]}>
      <boxGeometry args={[lenFt, winHFt, thickFt * 0.1]} />
      {style3d === "detailed"
        ? <meshPhysicalMaterial color="#a8c8e0" roughness={0.05} metalness={0}
            transmission={0.85} thickness={0.4} ior={1.5}
            transparent opacity={0.55} envMapIntensity={1.2} side={THREE.DoubleSide} />
        : <meshLambertMaterial color="#90CAF9" transparent opacity={0.28} side={THREE.DoubleSide} />}
    </mesh>
  );
}
function WindowGlow({ lenFt, winHFt, sillFt, thickFt }) {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.material.opacity = 0.38 + 0.22 * Math.sin(clock.getElapsedTime() * 3.5); });
  const G = GLOW_OFFSET;
  return <mesh ref={ref} position={[0, sillFt + winHFt / 2, 0]}><boxGeometry args={[lenFt + G * 2, winHFt + G * 2, thickFt + G * 2]} /><meshLambertMaterial color={GLOW_COLOR} transparent opacity={0.5} side={THREE.BackSide} depthWrite={false} /></mesh>;
}

// ─── Wall with openings ────────────────────────────────────────────────────────
function Wall3D({ w, fp, nodes, doors, windows, cx, cz, pxPerFoot, ceilingHeight, onSelect, selectedId, selType, showDims, style3d = "clay", interactive = true }) {
  const n1 = nodes.find(n => n.id === w.n1), n2 = nodes.find(n => n.id === w.n2);
  const wk       = WALL_KINDS[w.kind || "existing"];
  const thickFt  = (w.kind === "pony" ? (w.ponyDepth || 6) : (wk.thickness || 5)) / 12;
  const ceilFt   = ceilingHeight / 12;
  const heightFt = w.kind === "pony" ? (w.ponyHeight || 42) / 12 : ceilFt;
  const x1 = n1?.x ?? 0, y1 = n1?.y ?? 0, x2 = n2?.x ?? 0, y2 = n2?.y ?? 0;
  const wLen     = dst(x1, y1, x2, y2);
  // A mounted wall can transition to/from degenerate (endpoint dragged onto the other
  // node in split view, node deleted mid-frame) — hooks below must run UNCONDITIONALLY
  // or React throws a hook-count error and the whole canvas ErrorBoundaries. Guard the
  // hook BODIES instead and bail at the render at the bottom.
  const ok = !!(n1 && n2 && fp) && wLen >= 1;
  const wallLenFt = wLen / pxPerFoot;
  const angle     = Math.atan2(y2 - y1, x2 - x1);
  const midX      = ((x1 + x2) / 2 - cx) / pxPerFoot;
  const midZ      = ((y1 + y2) / 2 - cz) / pxPerFoot;
  const wallSel   = selectedId === w.id && selType === "wall";
  const dx = x2 - x1, dy = y2 - y1;
  const doorHFt   = Math.min(DOOR_HEIGHT_FT, heightFt);

  const segs = useMemo(() => {
    if (!ok) return [];
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
  }, [w, doors, windows, x1, y1, dx, dy, wLen, pxPerFoot, ok]);

  // The wall body is ONE mitered-footprint extrusion with CSG-cut openings — walls tile
  // gap-free with zero overlap at junctions by construction (shared miter points from
  // computeWallFootprints), so there are no end extensions and no cover-up posts.
  // Demo walls cut their openings too, so a demoed wall still SHOWS its doors/windows as
  // real outlined holes in the translucent red mass (they'd otherwise vanish, hiding the
  // fact there was an opening). The fixtures themselves — leaf, glass, casing, trim — are
  // still not drawn: they're being removed with the wall, and solid finished parts inside
  // a ghost wall read as "these stay", which is backwards.
  const isDemo = w.kind === "demo";
  const tileFt = (style3d === "detailed" && !isDemo) ? WALL_MATERIAL_TILE_FT[w.material] : null;
  const { solidGeo, edgeGeo } = useMemo(() => {
    if (!ok) return { solidGeo: null, edgeGeo: null };
    const midPx = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    const localQuad = footprintToLocal(fp.quad, midPx, angle, pxPerFoot);
    const cuts = segs.filter(s => !s.solid).map(seg => {
      const x0 = (seg.t0 - 0.5) * wallLenFt, x1c = (seg.t1 - 0.5) * wallLenFt;
      if (seg.isDoor) return { x0, x1: x1c, y0: 0, y1: doorHFt };
      const sillFt = (seg.item?.sill ?? 30) / 12, winHFt = (seg.item?.height ?? 48) / 12;
      return { x0, x1: x1c, y0: sillFt, y1: Math.min(sillFt + winHFt, heightFt) };
    });
    return {
      // cutDepth safely exceeds any miter-widened footprint (runaway cap ≤ 6×halfT per side)
      solidGeo: buildWallSolidGeometry(localQuad, heightFt, cuts, { cutDepth: 12, tileFt }),
      edgeGeo: buildWallEdgeSegments(localQuad, heightFt, cuts),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fp, segs, heightFt, doorHFt, wallLenFt, angle, pxPerFoot, isDemo, tileFt, x1, y1, x2, y2, ok]);
  useEffect(() => () => { solidGeo?.dispose(); edgeGeo?.dispose(); }, [solidGeo, edgeGeo]);

  if (!ok || !solidGeo) return null;
  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      <WallSolid geometry={solidGeo} edges={edgeGeo} color={wk.color} material={w.material} wallId={w.id}
        onSelect={onSelect} isDemo={isDemo} isSelected={wallSel && interactive}
        style3d={style3d} interactive={interactive} />
      {!isDemo && segs.map((seg, i) => {
        const segLenFt = (seg.t1 - seg.t0) * wallLenFt;
        if (segLenFt < 0.001) return null;
        const offsetFt = ((seg.t0 + seg.t1) / 2 - 0.5) * wallLenFt;
        if (seg.solid) return <group key={i}>
          <Baseboard segLenFt={segLenFt} thickFt={thickFt} offsetFt={offsetFt} style3d={style3d} />
          <BaseAOStrip segLenFt={segLenFt} thickFt={thickFt} offsetFt={offsetFt} style3d={style3d} />
        </group>;
        if (seg.isDoor) return (
          <group key={i}>
            <DoorSwing3D door={seg.item} segLenFt={segLenFt} heightFt={doorHFt} offsetFt={offsetFt} thickFt={thickFt} onSelect={onSelect} isSelected={selectedId === seg.item.id && selType === "door" && interactive} style3d={style3d} interactive={interactive} />
            <DoorCasing segLenFt={segLenFt} heightFt={doorHFt} thickFt={thickFt} offsetFt={offsetFt} style3d={style3d} />
          </group>
        );
        const winSel = selectedId === seg.item.id && selType === "window" && interactive;
        const isCut = seg.item?.type === "Cut Opening";
        const sillFt = (seg.item?.sill ?? 30) / 12, winHFt = (seg.item?.height ?? 48) / 12;
        return (
          <group key={i} position={[offsetFt, 0, 0]} onClick={interactive ? (e => { e.stopPropagation(); onSelect(seg.item.id, "window"); }) : undefined}>
            <mesh position={[0, sillFt + winHFt / 2, 0]}><boxGeometry args={[segLenFt, winHFt, thickFt * 2.5]} /><meshLambertMaterial transparent opacity={0} depthWrite={false} /></mesh>
            {!isCut && <WindowGlass lenFt={segLenFt} winHFt={winHFt} sillFt={sillFt} thickFt={thickFt} style3d={style3d} />}
            <WindowFrame segLenFt={segLenFt} winHFt={winHFt} sillFt={sillFt} thickFt={thickFt} style3d={style3d} />
            {sillFt > 0.4 && <Baseboard segLenFt={segLenFt} thickFt={thickFt} offsetFt={0} style3d={style3d} />}
            {sillFt > 0.05 && <BaseAOStrip segLenFt={segLenFt} thickFt={thickFt} offsetFt={0} style3d={style3d} />}
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

// ─── Corner posts ────────────────────────────────────────────────────────────
// Adjacent wall boxes overlap at every junction, so their coplanar end-cap / face
// pairs z-fight — a speckled "frizz" (worst where two materials meet, e.g. brick
// against drywall) plus thin slivers and a notch at the base. One clean post per
// junction, sized a hair proud of the walls, caps the corner crisply and hides
// the overlap behind a single solid box. The cladding (textured) material wins so
// brick wraps the corner the way real masonry returns.
const TEXTURED_WALL_MATERIALS = new Set(Object.keys(WALL_MATERIAL_TILE_FT));
const NOOP = () => {};

// ─── Junction cap solids ───────────────────────────────────────────────────────
// The per-wall mitered footprints tile exactly at 2-wall corners, but 3+-way and
// odd-angle junctions leave a small uncovered wedge (same as the 2D plan). Extrude the
// shared junctionCapPolys wedges as real solids in the WORLD frame. Height is the MIN
// of the adjacent walls (a cap between a pony and a full wall must not poke above the
// pony; the taller wall's exposed mitered end face above it is correct). All-demo
// junctions get the demo treatment (they join the EqualDepth union); mixed junctions
// stay solid and take their look from the first non-demo wall (textured material wins).
function CapSolid({ poly, heightFt, material, color, allDemo, style3d }) {
  const tileFt = (style3d === "detailed" && !allDemo) ? WALL_MATERIAL_TILE_FT[material] : null;
  const geo = useMemo(() => buildCapSolidGeometry(poly, heightFt, { tileFt }), [poly, heightFt, tileFt]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return <WallSolid geometry={geo} color={color} material={material} wallId={null} onSelect={NOOP}
    isDemo={allDemo} isSelected={false} style3d={style3d} interactive={false} />;
}

function CapSolids({ fps, walls = [], cx, cz, pxPerFoot, ceilingHeight, style3d = "clay" }) {
  const caps = useMemo(() => {
    const entries = [...fps.entries()].map(([id, e]) => ({ id, ...e }));
    const wallById = new Map(walls.map(w => [w.id, w]));
    return junctionCapPolys(entries).map((cp, i) => {
      const adj = cp.wallIds.map(id => wallById.get(id)).filter(Boolean);
      if (!adj.length) return null;
      const allDemo = adj.every(w => (w.kind || "existing") === "demo");
      const pick = allDemo ? adj : adj.filter(w => (w.kind || "existing") !== "demo");
      let heightFt = Infinity, material = null, color = null;
      for (const w of pick) {
        const wk = WALL_KINDS[w.kind || "existing"];
        const h = w.kind === "pony" ? (w.ponyHeight || 42) / 12 : (w.ceilingHeight ?? ceilingHeight) / 12;
        heightFt = Math.min(heightFt, h);
        if (!color) color = wk.color;
        if (!material || (TEXTURED_WALL_MATERIALS.has(w.material) && !TEXTURED_WALL_MATERIALS.has(material))) material = w.material;
      }
      const poly = cp.pts.map(p => ({ x: (p.x - cx) / pxPerFoot, z: (p.y - cz) / pxPerFoot }));
      return { key: i + "_" + Math.round(cp.x) + "_" + Math.round(cp.y), poly, heightFt, material, color, allDemo };
    }).filter(Boolean);
  }, [fps, walls, cx, cz, pxPerFoot, ceilingHeight]);
  return caps.map(c => <CapSolid key={c.key} poly={c.poly} heightFt={c.heightFt}
    material={c.material} color={c.color} allDemo={c.allDemo} style3d={style3d} />);
}

// ─── Junction baseboard plinths ────────────────────────────────────────────────
// Detailed-mode only: perpendicular baseboard runs overlap at corners with coplanar
// top faces — a slightly taller, prouder block swallows the overlap so nothing
// z-fights. (The old full-height corner "posts" are gone: mitered footprints make
// walls tile exactly, so there is nothing to cover up.)
function JunctionTrim({ walls = [], nodes = [], cx, cz, pxPerFoot, style3d = "clay" }) {
  const ni = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const junctions = useMemo(() => {
    const byNode = {};
    walls.forEach(w => { (byNode[w.n1] ||= []).push(w); (byNode[w.n2] ||= []).push(w); });
    const out = [];
    for (const [id, adj] of Object.entries(byNode)) {
      const node = ni[id];
      if (!node || adj.length < 2) continue;
      if (!adj.some(w => (w.kind || "existing") !== "demo")) continue; // all-demo → no trim
      // Skip straight pass-throughs (two near-collinear walls): no real corner there.
      if (adj.length === 2) {
        const dir = (w) => { const o = ni[w.n1 === id ? w.n2 : w.n1]; return o ? Math.atan2(o.y - node.y, o.x - node.x) : null; };
        const a = dir(adj[0]), b = dir(adj[1]);
        if (a != null && b != null) {
          let d = Math.abs(a - b); if (d > Math.PI) d = 2 * Math.PI - d;
          if (Math.abs(d - Math.PI) < 0.26) continue; // within ~15° of straight
        }
      }
      let thickFt = 0;
      for (const w of adj) {
        const wk = WALL_KINDS[w.kind || "existing"];
        const t = (w.kind === "pony" ? (w.ponyDepth || 6) : (wk.thickness || 5)) / 12;
        if (t > thickFt) thickFt = t;
      }
      out.push({ id, x: (node.x - cx) / pxPerFoot, z: (node.y - cz) / pxPerFoot, thickFt });
    }
    return out;
  }, [walls, ni, cx, cz, pxPerFoot]);

  if (style3d !== "detailed") return null;
  return junctions.map(j => {
    const side = j.thickFt + 2 * (BASE_D + 0.03);
    const h = BASE_H + 0.02;
    return <mesh key={"plinth-" + j.id} position={[j.x, h / 2, j.z]} castShadow receiveShadow>
      <boxGeometry args={[side, h, side]} />
      <meshStandardMaterial {...TRIM_MAT} />
    </mesh>;
  });
}

// ─── Column ────────────────────────────────────────────────────────────────────
function Column3D({ col, cx, cz, pxPerFoot, ceilingHeight, onSelect, isSelected, style3d = "clay", interactive = true }) {
  const [hov, setHov] = useState(false);
  const r = col.size / 12 / 2, h = ceilingHeight / 12;
  const x = (col.x - cx) / pxPerFoot, z = (col.y - cz) / pxPerFoot;
  const colColor = (interactive && hov) ? "#ffffff" : "#888888";
  return (
    <group position={[x, h / 2, z]}>
      <mesh
        key={style3d}
        onClick={interactive ? (e => { e.stopPropagation(); onSelect(col.id, "column"); }) : undefined}
        onPointerOver={interactive ? (e => { e.stopPropagation(); setHov(true); }) : undefined}
        onPointerOut={interactive ? (() => setHov(false)) : undefined}
        castShadow={style3d === "detailed"}
        receiveShadow={style3d === "detailed"}
      >
        {col.shape === "circle" ? <cylinderGeometry args={[r, r, h, 24]} /> : <boxGeometry args={[r * 2, h, r * 2]} />}
        {style3d === "xray"     && <meshBasicMaterial    color={colColor} transparent opacity={0.1} />}
        {style3d === "detailed" && <meshStandardMaterial color={colColor} roughness={0.85} metalness={0.05} envMapIntensity={0.5} />}
        {style3d === "clay"     && <meshLambertMaterial  color={colColor} />}
      </mesh>
      {isSelected && (col.shape === "circle" ? <CylGlow r={r} h={h} /> : <BoxGlow w={r * 2} h={h} d={r * 2} />)}
    </group>
  );
}

// ─── IT / MEP / Electrical Marker 3D ─────────────────────────────────────────
function Marker3D({ marker, cx, cz, pxPerFoot, ceilingHeight, onSelect, isSelected, style3d = "clay", interactive = true }) {
  const [hov, setHov] = useState(false);
  const wx = (marker.x - cx) / pxPerFoot;
  const wz = (marker.y - cz) / pxPerFoot;
  const cH = ceilingHeight / 12;

  const cfg = M3D[marker.componentType] ?? { y: 2.0, shape: "sphere", color: "#9A9488" };
  const baseColor = finishColor(marker, cfg);
  const c = hov ? "#ffffff" : isSelected ? GLOW_COLOR : baseColor;
  const wy = resolveY(cfg.y, cH);

  const click = interactive ? (e => { e.stopPropagation(); onSelect(marker.id, "marker"); }) : undefined;
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
      <mesh><cylinderGeometry args={[cfg.r, cfg.r, 0.06, 16]} />
        {isLight
          ? <meshStandardMaterial color={WARM_HALO} emissive={WARM_HALO} emissiveIntensity={4.0} roughness={0.3} metalness={0} toneMapped={false} />
          : <meshLambertMaterial color={c} />}
      </mesh>
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
      <mesh position={[0, -0.033, 0]}><boxGeometry args={[cfg.len - 0.04, 0.005, 0.24]} />
        {isLight
          ? <meshStandardMaterial color={WARM_HALO} emissive={WARM_HALO} emissiveIntensity={4.0} transparent opacity={0.9} toneMapped={false} />
          : <meshLambertMaterial color="#FFFFFF" transparent opacity={0.6} />}
      </mesh>
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

  // ── Wall speaker (JBL Control 23-1) — drivers face the room (local +Z = aim) ─
  if (shape === "speaker") {
    const w = cfg.w, h = cfg.h, d = cfg.d;
    return (
      <group position={[wx, wy, wz]} rotation={[0, Math.PI / 2 - angle, 0]} onClick={click} {...hp}>
        <group position={[0, 0, WALL_SURFACE]}>
          <mesh><boxGeometry args={[w, h, d]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
          {/* 3" woofer + tweeter on the room-facing (+Z) face */}
          <mesh position={[0, -h * 0.12, d / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[w * 0.33, w * 0.33, 0.02, 18]} /><meshLambertMaterial color="#161616" /></mesh>
          <mesh position={[0, h * 0.28, d / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[w * 0.11, w * 0.11, 0.02, 12]} /><meshLambertMaterial color="#2A2A2A" /></mesh>
          {isSelected && <CoverageCone color="#E06040" half={50} dist={8} />}
          {isSelected && <BoxGlow w={w} h={h} d={d} />}
        </group>
      </group>
    );
  }

  // ── Pendant speaker (JBL Control 64P/T cylinder, down-firing) ─────────────
  if (shape === "pendant_spkr") {
    const r = cfg.r, h = cfg.h, topY = cH - 1.0;
    return (
      <group position={[wx, 0, wz]} rotation={floorRot} onClick={click} {...hp}>
        <mesh position={[0, cH - 0.5, 0]}><cylinderGeometry args={[0.01, 0.01, 1.0, 4]} /><meshLambertMaterial color="#606060" /></mesh>
        <mesh position={[0, topY - h / 2, 0]}><cylinderGeometry args={[r, r, h, 22]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
        {/* down-firing grille */}
        <mesh position={[0, topY - h - 0.005, 0]}><cylinderGeometry args={[r * 0.82, r * 0.82, 0.02, 22]} /><meshLambertMaterial color="#161616" /></mesh>
        {isSelected && <group position={[0, topY - h / 2, 0]}><CylGlow r={r} h={h} /></group>}
      </group>
    );
  }

  // ── Subwoofer (JBL Control SB2210, dual 10" front-firing) ─────────────────
  if (shape === "sub") return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><boxGeometry args={[cfg.w, cfg.h, cfg.d]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
      {[cfg.h * 0.2, -cfg.h * 0.2].map((oy, i) => (
        <mesh key={i} position={[0, oy, cfg.d / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.42, 0.42, 0.02, 22]} /><meshLambertMaterial color="#161616" /></mesh>
      ))}
      {isSelected && <BoxGlow w={cfg.w} h={cfg.h} d={cfg.d} />}
    </group>
  );

  // ── Speaker drop — ceiling box, cable, 1/4" TS plug ───────────────────────
  if (shape === "speaker_drop") return (
    <group position={[wx, 0, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh position={[0, cH - 0.03, 0]}><cylinderGeometry args={[0.08, 0.08, 0.06, 12]} /><meshLambertMaterial color={c} /></mesh>
      <mesh position={[0, cH - 0.5, 0]}><cylinderGeometry args={[0.012, 0.012, 0.85, 6]} /><meshLambertMaterial color="#3A3A3A" /></mesh>
      {/* 1/4" plug: sleeve + tip */}
      <mesh position={[0, cH - 1.0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.14, 12]} /><meshLambertMaterial color="#C6C6C6" /></mesh>
      <mesh position={[0, cH - 1.12, 0]}><cylinderGeometry args={[0.017, 0.017, 0.06, 12]} /><meshLambertMaterial color="#9A9A9A" /></mesh>
      {isSelected && <group position={[0, cH - 1.0, 0]}><CylGlow r={0.05} h={0.34} /></group>}
    </group>
  );

  // ── IT rack (9U open-frame, wall-mounted) ─────────────────────────────────
  if (shape === "rack") {
    const w = cfg.w, h = cfg.h, d = cfg.d;
    const posts = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
    return (
      <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
        <group position={[0, 0, interiorZ + d / 2 - 0.05]}>
          {posts.map(([ox, oz], i) => (
            <mesh key={"p" + i} position={[ox, 0, oz]}><boxGeometry args={[0.05, h, 0.05]} /><meshLambertMaterial color={c} /></mesh>
          ))}
          {[h / 2, -h / 2].map((oy, i) => [-d / 2, d / 2].map((oz, j) => (
            <mesh key={"r" + i + j} position={[0, oy, oz]}><boxGeometry args={[w, 0.05, 0.05]} /><meshLambertMaterial color={c} /></mesh>
          )))}
          {/* mounted equipment (switch, patch panel, UPS) */}
          {[0.34, 0.04, -0.32].map((f, i) => (
            <mesh key={"e" + i} position={[0, f * h, 0]}><boxGeometry args={[w * 0.92, h * 0.15, d * 0.78]} /><meshLambertMaterial color={i === 0 ? "#23262B" : "#33363C"} /></mesh>
          ))}
        </group>
        {isSelected && <BoxGlow w={w} h={h} d={d} />}
      </group>
    );
  }

  // ── Router (Ubiquiti U7 Lite flat disc, LED ring + Wi-Fi fan) ─────────────
  if (shape === "router") {
    const wcol = "#88C8E8";
    const wmat = () => style3d === "detailed"
      ? <meshStandardMaterial color={wcol} emissive={wcol} emissiveIntensity={3.2} toneMapped={false} />
      : <meshLambertMaterial color={wcol} />;
    return (
      <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
        <mesh><cylinderGeometry args={[cfg.r, cfg.r, cfg.d, 28]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
        {/* Wi-Fi fan on the underside (room-facing): concentric arcs + source dot */}
        <group position={[0, -cfg.d / 2 - 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
          {[0.09, 0.15, 0.21].map((R, i) => <mesh key={i}><torusGeometry args={[R, 0.007, 6, 18, Math.PI]} />{wmat()}</mesh>)}
          <mesh><sphereGeometry args={[0.02, 8, 6]} />{wmat()}</mesh>
        </group>
        {isSelected && <CylGlow r={cfg.r} h={cfg.d} />}
      </group>
    );
  }

  // ── Wall drain / cleanout (round cover on the wall face) ───────────────────
  if (shape === "drain") {
    const faceSign = interiorZ > 0 ? 1 : -1;
    return (
      <group position={[wx, wy, wz]} rotation={wallRot} onClick={click} {...hp}>
        <group position={[0, 0, interiorZ]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[cfg.r, cfg.r, 0.05, 20]} /><meshLambertMaterial color={c} /></mesh>
          {[-0.05, 0, 0.05].map((ox, i) => (
            <mesh key={i} position={[ox, 0, faceSign * 0.03]}><boxGeometry args={[0.012, cfg.r * 1.5, 0.006]} /><meshLambertMaterial color="#23262B" /></mesh>
          ))}
        </group>
        {isSelected && <CylGlow r={cfg.r} h={0.05} />}
      </group>
    );
  }

  // ── Water line stub + valve wheel ─────────────────────────────────────────
  if (shape === "water") return (
    <group position={[wx, wy, wz]} rotation={floorRot} onClick={click} {...hp}>
      <mesh><cylinderGeometry args={[0.04, 0.04, 0.2, 8]} /><meshLambertMaterial color={c} /></mesh>
      <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.01, 6, 12]} /><meshLambertMaterial color="#888888" />
      </mesh>
      {isSelected && <CylGlow r={0.06} h={0.2} />}
    </group>
  );

  // ── Security camera / floodlight (Ring) — faces the room (local +Z = aim) ──
  if (shape === "camera" || shape === "floodlight") {
    const isFlood = shape === "floodlight";
    const covDist = isSelected ? (isFlood ? 12 : 10) : 1.7; // extend coverage when selected
    const covHalf = isFlood ? 55 : 38;
    const covColor = isFlood ? "#FFD24A" : "#3FC8E8";
    return (
      <group position={[wx, wy, wz]} rotation={[0, Math.PI / 2 - angle, 0]} onClick={click} {...hp}>
        <group position={[0, 0, WALL_SURFACE]}>
          {/* mount arm to the wall (behind, -Z) */}
          <mesh position={[0, 0.02, -0.09]}><boxGeometry args={[0.06, 0.18, 0.12]} /><meshLambertMaterial color="#6A6A66" /></mesh>
          <group rotation={[THREE.MathUtils.degToRad(18), 0, 0]}>
            <mesh><boxGeometry args={[0.2, 0.13, 0.16]} /><meshLambertMaterial color={c} transparent={isNew} opacity={isNew ? 0.55 : 1} /></mesh>
            {/* lens, into the room (+Z) */}
            <mesh position={[0, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.06, 0.06, 12]} /><meshLambertMaterial color="#111111" /></mesh>
            {isFlood && [-0.22, 0.22].map((ox, i) => (
              <mesh key={i} position={[ox, 0.02, 0.04]}><boxGeometry args={[0.16, 0.1, 0.04]} />
                {style3d === "detailed"
                  ? <meshStandardMaterial color="#FFF6DC" emissive="#FFE9A8" emissiveIntensity={3.2} toneMapped={false} />
                  : <meshLambertMaterial color="#F4F1E6" />}
              </mesh>
            ))}
          </group>
          <CoverageCone color={covColor} half={covHalf} dist={covDist} opacity={isSelected ? 0.12 : 0.07} />
          {isSelected && <BoxGlow w={0.24} h={0.3} d={0.2} />}
        </group>
      </group>
    );
  }

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
  // Do NOT early-return before the hook: a mounted dim can be dragged to near-zero
  // length, and skipping the useMemo then crashes the canvas with a hook-count error.
  const ok = len >= 0.1;
  const dx = ok ? (x2 - x1) / len : 1, dz = ok ? (z2 - z1) / len : 0;
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
  if (!ok) return null;
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
      {style3d === "detailed"
        ? <meshStandardMaterial color={zoneColor(zone, zoneLibrary)} transparent opacity={0.55} roughness={0.8} metalness={0} depthWrite={false} side={THREE.DoubleSide} />
        : <meshLambertMaterial color={zoneColor(zone, zoneLibrary)} transparent opacity={style3d === "xray" ? 0.05 : 0.4} depthWrite={false} side={THREE.DoubleSide} />}
    </mesh>
  );
}

// Build a flat ShapeGeometry from canvas-space points, with world-foot UVs so
// a single texture tiles correctly across any room size.
function buildFloorGeo(points, cx, cz, pxPerFoot, tile) {
  if (!points || points.length < 3) return null;
  const toSX = sx =>  (sx - cx) / pxPerFoot;
  const toSY = sy => -((sy - cz) / pxPerFoot);
  const shape = new THREE.Shape();
  shape.moveTo(toSX(points[0].x), toSY(points[0].y));
  for (let i = 1; i < points.length; i++) shape.lineTo(toSX(points[i].x), toSY(points[i].y));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  if (tile) {
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i*2] = pos.getX(i) / tile.x; uv[i*2+1] = pos.getY(i) / tile.y; }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }
  return geo;
}

function FloorPlane({ walls = [], nodes = [], zones, cx, cz, pxPerFoot, T, zoneLibrary, style3d = "clay",
  floorMaterial = "Wood", floorRegions = [], onSelectFloor, isSelected }) {
  const isDetailed = style3d === "detailed";
  const baseTex = isDetailed ? getFloorTexture(floorMaterial) : null;
  const baseSpec = FLOOR_MATERIAL_PBR[floorMaterial];
  const baseTile = FLOOR_MATERIAL_TILE_FT[floorMaterial];

  const roomGeo = useMemo(() => {
    const boundary = traceOuterBoundary(nodes, walls);
    return buildFloorGeo(boundary, cx, cz, pxPerFoot, baseTile);
  }, [walls, nodes, cx, cz, pxPerFoot, baseTile]);
  useEffect(() => () => roomGeo?.dispose(), [roomGeo]);

  const regionGeos = useMemo(() => floorRegions.map(fr =>
    buildFloorGeo(fr.points, cx, cz, pxPerFoot, FLOOR_MATERIAL_TILE_FT[fr.material])
  ), [floorRegions, cx, cz, pxPerFoot]);
  useEffect(() => () => regionGeos.forEach(g => g?.dispose()), [regionGeos]);

  const clickHandler = onSelectFloor ? (e => { e.stopPropagation(); onSelectFloor(); }) : undefined;
  const baseBump = isDetailed ? getFloorBump(floorMaterial) : null;
  const baseMat = isDetailed
    ? <meshStandardMaterial color={baseTex ? "#ffffff" : (baseSpec?.color ?? T.canvas)} roughness={baseSpec?.roughness ?? 0.55} metalness={baseSpec?.metalness ?? 0.05} envMapIntensity={0.8} map={baseTex} bumpMap={baseBump?.bumpMap} bumpScale={baseBump?.bumpScale} side={THREE.DoubleSide} />
    : <meshLambertMaterial color={style3d === "print" ? "#FCFCFC" : T.canvas} side={THREE.DoubleSide} />;

  return (
    <group>
      {style3d !== "xray" && (
        roomGeo
          ? <mesh geometry={roomGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow={isDetailed} onClick={clickHandler}>{baseMat}</mesh>
          : <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={isDetailed} onClick={clickHandler}><planeGeometry args={[500, 500]} />{baseMat}</mesh>
      )}
      {isSelected && roomGeo && (
        <mesh geometry={roomGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <meshBasicMaterial color={GLOW_COLOR} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {style3d !== "xray" && floorRegions.map((fr, i) => {
        const geo = regionGeos[i]; if (!geo) return null;
        const rTex = isDetailed ? getFloorTexture(fr.material) : null;
        const rSpec = FLOOR_MATERIAL_PBR[fr.material];
        const rBump = isDetailed ? getFloorBump(fr.material) : null;
        return <mesh key={fr.id} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow={isDetailed}>
          {isDetailed
            ? <meshStandardMaterial color={rTex ? "#ffffff" : (rSpec?.color ?? "#C8A878")} roughness={rSpec?.roughness ?? 0.55} metalness={rSpec?.metalness ?? 0.05} envMapIntensity={0.8} map={rTex} bumpMap={rBump?.bumpMap} bumpScale={rBump?.bumpScale} side={THREE.DoubleSide} />
            : <meshLambertMaterial color={style3d === "print" ? "#EDEDED" : (rSpec?.color ?? "#C8A878")} side={THREE.DoubleSide} />}
        </mesh>;
      })}
      {zones.map(z => <ZoneFloor key={z.id} zone={z} cx={cx} cz={cz} pxPerFoot={pxPerFoot} zoneLibrary={zoneLibrary} style3d={style3d} />)}
    </group>
  );
}

// ─── Ceiling plane ──────────────────────────────────────────────────────────
// One slab over the traced outer boundary at the global ceiling height, rendered
// BackSide-only: visible from below (interior views read as rooms; recessed cans at
// ceilH−0.04 sit just beneath it), automatically culled from above — bird's-eye
// orbits see straight into the model with zero cutaway logic. Never casts/receives
// shadows (the sun never hits an underside; noAutoShadow stops ShadowEnabler).
// v1 limitation: single slab at the global height — per-wall ceilingHeight overrides
// poke through (culled from above anyway) or leave a band gap in interior views.
function CeilingPlane({ walls = [], nodes = [], cx, cz, pxPerFoot, ceilingHeight, style3d = "clay" }) {
  const geo = useMemo(() => {
    const boundary = traceOuterBoundary(nodes, walls);
    return boundary ? buildFloorGeo(boundary, cx, cz, pxPerFoot, null) : null;
  }, [nodes, walls, cx, cz, pxPerFoot]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (style3d === "xray" || !geo) return null; // open plan (no closed loop) → no ceiling
  const y = ceilingHeight / 12 - 0.005; // edge dies inside the wall volume — no sky slit
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}
      castShadow={false} receiveShadow={false} userData={{ noAutoShadow: true }}>
      {style3d === "detailed"
        ? <meshStandardMaterial color="#EAE6DD" roughness={0.95} metalness={0} envMapIntensity={0.5} side={THREE.BackSide} />
        : <meshLambertMaterial color="#D6D2C8" side={THREE.BackSide} />}
    </mesh>
  );
}

// Detailed-mode post-FX: just bloom for warm-light bleed. SSAO and FilmPass
// were dropped — they were the dominant GPU cost and ContactShadows already
// provides the corner-darkening AO read at a fraction of the price.
// renderPriority=1 tells R3F to skip its default auto-render; the composer's
// RenderPass owns the frame instead.
function PostFX() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const bloomRef = useRef();

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    // Bloom limited to the explicitly emissive lens meshes (toneMapped={false}
    // pushes them to emissiveIntensity 3.2–4.0, above the 2.3 threshold). Sun-lit
    // walls/floor peak ~2.0 — including bright corner junctions where two lit walls
    // overlap — so they stay below threshold and don't bleed or flicker.
    // (resolution, strength, radius, threshold)
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.6, 0.6, 2.3);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composerRef.current = composer;
    bloomRef.current = bloom;
    return () => { composer.dispose(); };
  }, [gl, scene, camera]);

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
    bloomRef.current?.setSize(size.width, size.height);
  }, [size.width, size.height]);

  useFrame((_, delta) => {
    composerRef.current?.render(delta);
  }, 1);

  return null;
}

// Walks the scene each time `enabled` flips and turns on castShadow /
// receiveShadow for every regular Mesh — *except* the back-side glow halos
// (BoxGlow / CylGlow / WindowGlow / WarmGlow), which would double-cast.
function ShadowEnabler({ enabled }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      const isHalo = m && m.transparent && (m.side === THREE.BackSide) && m.depthWrite === false;
      if (isHalo) { o.castShadow = false; o.receiveShadow = false; return; }
      // Opt-out for meshes that must never shadow: the ceiling (would block the sun and
      // black out interiors) and the AO gradient strips (the shadow depth pass ignores
      // texture alpha — they'd cast solid rectangles).
      if (o.userData?.noAutoShadow) { o.castShadow = false; o.receiveShadow = false; return; }
      o.castShadow = enabled;
      o.receiveShadow = enabled;
    });
  });
  return null;
}

// ─── Camera auto-fit on every mount ───────────────────────────────────────────
// ─── Isometric camera ─────────────────────────────────────────────────────────
// True isometric = PARALLEL projection down the (±1, 1, ±1) diagonal: all three axes
// foreshorten equally and parallel edges stay parallel, so the drawing measures. Plan
// axes map x→world x and y→world z, so plan-north is −z: hence the corner vectors below.
export const ISO_CORNERS = {
  ne: { label: "NE", v: [1, 1, -1] },
  se: { label: "SE", v: [1, 1, 1] },
  sw: { label: "SW", v: [-1, 1, 1] },
  nw: { label: "NW", v: [-1, 1, -1] },
};

// Clockwise around the building — each neighbour is a 90° swing, so the rotate
// arrows just step through this list.
export const ISO_ORDER = ["ne", "se", "sw", "nw"];

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const ISO_SPIN_S = 0.42;                       // seconds for a 90° swing
const isoAz = (v) => Math.atan2(v[0], v[2]);   // horizontal azimuth of a direction
// Shortest signed way round, so nw→ne swings +90° rather than −270°.
const shortAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

// Places the orthographic camera on the chosen corner and sizes the frustum to fit.
// r3f's default ortho frustum is the canvas size in world units, so visible height =
// size.height / zoom — fit by solving that for the model's extent.
//
// Rotating (corner change) deliberately does NOT re-fit: it swings the camera 90° around
// the CURRENT target, keeping zoom, pan and distance, so you orbit the building without
// losing the framing you set up. `fitNonce` bumps to force an explicit re-fit (Reset).
function IsoCameraRig({ corner, fitR, controlsRef, fitNonce = 0, initialCamera = null }) {
  const { camera, size } = useThree();
  const prev = useRef(null);
  const fitted = useRef(false);
  const spin = useRef(null); // { from: offset Vector3, angle, t, dur } — in-flight swing

  // Drives the swing. Priority 0 runs AFTER drei's OrbitControls update (priority -1), so
  // the tweened position is what survives to render. The pivot is read live each frame,
  // so panning mid-swing still tracks.
  useFrame((_, dt) => {
    const a = spin.current;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / a.dur);
    const c = controlsRef?.current;
    const pivot = c ? c.target : new THREE.Vector3();
    camera.position.copy(pivot).add(a.from.clone().applyAxisAngle(Y_AXIS, a.angle * easeInOutCubic(a.t)));
    camera.lookAt(pivot);
    camera.updateProjectionMatrix();
    c?.update();
    if (a.t >= 1) spin.current = null;
  });

  const applyFit = useCallback(() => {
    spin.current = null; // a re-fit supersedes any in-flight swing
    const v = (ISO_CORNERS[corner] || ISO_CORNERS.se).v;
    const D = 400; // ortho: distance doesn't scale the image, just keep it outside the model
    const n = Math.sqrt(3);
    camera.position.set((v[0] / n) * D, (v[1] / n) * D, (v[2] / n) * D);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    // 1.15 padding; the projected diagonal runs a bit wider than the plan radius.
    const span = Math.max(fitR * 2 * 1.15, 1);
    camera.zoom = Math.min(size.width, size.height) / span;
    camera.updateProjectionMatrix();
    const c = controlsRef?.current;
    if (c) { c.target.set(0, 0, 0); c.update(); c.saveState(); }
  }, [camera, corner, fitR, size.width, size.height, controlsRef]);

  // First real frame → restore the saved pose (Docs slides) or fit. (Waits for a non-zero
  // canvas size, else the fit's zoom would be 0.)
  // A saved ortho pose MUST carry `zoom`: position alone doesn't set the image scale for
  // an orthographic camera, so restoring position-only would silently re-fit the model.
  useEffect(() => {
    if (fitted.current || size.width <= 0 || size.height <= 0) return;
    if (initialCamera?.position) {
      const tgt = initialCamera.target ?? [0, 0, 0];
      camera.position.fromArray(initialCamera.position);
      camera.up.set(0, 1, 0);
      camera.lookAt(tgt[0], tgt[1], tgt[2]);
      if (initialCamera.zoom) camera.zoom = initialCamera.zoom;
      camera.updateProjectionMatrix();
      const c = controlsRef?.current;
      if (c) { c.target.set(tgt[0], tgt[1], tgt[2]); c.update(); c.saveState(); }
    } else {
      applyFit();
    }
    fitted.current = true;
    prev.current = corner;
  }, [applyFit, size.width, size.height, corner, initialCamera, camera, controlsRef]);

  // Corner change → swing about the current target, preserving zoom/pan/distance.
  // The swing targets the corner's ABSOLUTE azimuth (not a relative +90°), so clicking
  // again mid-animation re-aims from wherever the camera currently is and still lands
  // exactly on a corner instead of drifting off-axis.
  useEffect(() => {
    if (!fitted.current || prev.current == null || prev.current === corner) { prev.current = corner; return; }
    prev.current = corner;
    const to = ISO_CORNERS[corner]?.v;
    if (!to) return;
    const c = controlsRef?.current;
    const pivot = c ? c.target : new THREE.Vector3();
    const from = camera.position.clone().sub(pivot);
    const angle = shortAngle(isoAz(to) - Math.atan2(from.x, from.z));
    if (Math.abs(angle) < 1e-6) return;
    if (prefersReducedMotion()) {
      spin.current = null;
      camera.position.copy(pivot).add(from.applyAxisAngle(Y_AXIS, angle));
      camera.lookAt(pivot);
      camera.updateProjectionMatrix();
      c?.update();
      return;
    }
    spin.current = { from, angle, t: 0, dur: ISO_SPIN_S };
  }, [corner, camera, controlsRef]);

  // Explicit re-fit (Reset button).
  useEffect(() => {
    if (!fitNonce || !fitted.current) return;
    applyFit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce]);
  return null;
}

// Runs inside the Canvas so it can access useThree(). Imperatively sets the
// camera position and tells OrbitControls to treat it as the "home" state so
// the reset button always returns to the same fit-all view.
function CameraRig({ camDist, controlsRef, initialCamera }) {
  const { camera } = useThree();
  useEffect(() => {
    // initialCamera: restore a saved pose (Docs slides) instead of the fit-all heuristic.
    // Coordinates are feet relative to the node centroid — heavy geometry edits shift it.
    const pos = initialCamera?.position ?? [camDist * 0.7, camDist * 0.8, camDist * 0.7];
    const tgt = initialCamera?.target ?? [0, 0, 0];
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(tgt[0], tgt[1], tgt[2]);
    camera.updateProjectionMatrix();
    // Give OrbitControls one frame to initialise before saving home state.
    const id = setTimeout(() => {
      if (controlsRef?.current) {
        controlsRef.current.target.set(tgt[0], tgt[1], tgt[2]);
        controlsRef.current.update();
        controlsRef.current.saveState();
      }
    }, 0);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once per mount
  return null;
}

// Fills `captureRef` with a capture() → JPEG dataURL of the current frame, downscaled to
// ≤1280px wide (Docs deck thumbnails + print; keeps localStorage autosave lean). Renders a
// fresh frame right before readback so the buffer is valid even without preserveDrawingBuffer.
function CaptureBridge({ captureRef }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = () => {
      gl.render(scene, camera);
      const src = gl.domElement;
      const s = Math.min(1, 1280 / (src.width || 1280));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(src.width * s));
      c.height = Math.max(1, Math.round(src.height * s));
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.8);
    };
    return () => { captureRef.current = null; };
  }, [captureRef, gl, scene, camera]);
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
  floorMaterial = "Wood",
  floorRegions = [],
  visibleLayers = {},
  visibleBuildElectrical = true,
  visibleBuildLighting = true,
  show3dCeiling = true,   // toggleable ceiling slab (clay + detailed; never x-ray)
  controlsEnabled = true, // false → camera locked (Docs slides until "Edit view")
  initialCamera = null,   // { position:[3], target:[3] } — Docs slide pose restore
  isoCorner = null,       // "ne"|"se"|"sw"|"nw" → locked orthographic isometric view
  isoFitNonce = 0,        // bump to re-fit the isometric (Reset); rotation preserves zoom/pan
  preserveBuffer = false, // keep the drawing buffer readable (Docs capture instance)
  captureRef = null,      // ref filled with capture() → JPEG dataURL
  onCameraEnd = null,     // (pose) => void — fires when an orbit/pan/zoom gesture ends
}) {
  // Detailed mode is presentation-only — no selection, no hover affordances, no selection glows.
  const interactive = style3d !== "detailed";
  const safeSelect = (id, type) => {
    if (!interactive) return;
    if ((MODE_SELECT[mode] ?? new Set()).has(type)) onSelect(id, type);
  };
  const effSelectedId = interactive ? selectedId : null;
  const effSelType    = interactive ? selType    : null;

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

  // Mitered wall footprints (plan px), shared with the 2D renderer — computed once at
  // scene level because each wall's miters depend on ALL its neighbours.
  const wallFps = useMemo(() => computeWallFootprints(walls, nodes, {
    halfTOf: w => ((w.kind === "pony" ? (w.ponyDepth || 6) : (WALL_KINDS[w.kind || "existing"]?.thickness || 5)) / 12) * pxPerFoot / 2,
  }), [walls, nodes, pxPerFoot]);

  const camDist = useMemo(() => {
    if (!nodes.length) return 18;
    let maxR = 0;
    nodes.forEach(n => { const dx = (n.x - cx) / pxPerFoot, dz = (n.y - cz) / pxPerFoot; maxR = Math.max(maxR, Math.sqrt(dx * dx + dz * dz)); });
    return Math.max(10, maxR * 2.2);
  }, [nodes, cx, cz, pxPerFoot]);

  const isDark = themeMode === "dark";
  const bgColor   = style3d === "print"    ? "#ffffff"
                  : style3d === "xray"     ? (isDark ? "#0d1117" : "#f0f4f8")
                  : style3d === "detailed" ? (isDark ? "#1a1d22" : "#e8ecf1")
                  : T.canvas;
  const gridCell  = style3d === "print" ? "#E4E4E4" : style3d === "xray" ? (isDark ? "#1a2233" : "#a0c0ff") : T.accentDim;
  const gridSec   = style3d === "print" ? "#CFCFCF" : style3d === "xray" ? (isDark ? "#2a3a55" : "#4060cc") : T.gridSub;

  // Offset the grid so its lines align with the 2D 1-foot boundaries.
  // In 3D, world-origin = centroid of nodes. A 2D foot-boundary n is at
  // world position (n - cx/pxPerFoot). We shift the grid by the fractional
  // foot of the centroid so lines land on the same marks as in 2D.
  const mod1 = x => ((x % 1) + 1) % 1; // positive modulo 1
  const gridOffX = mod1(-(cx / pxPerFoot));
  const gridOffZ = mod1(-(cz / pxPerFoot));

  return (
    <div style={{ position: "absolute", inset: 0, background: bgColor }}>
      {controlsEnabled && <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 10, color: T.textFaint, zIndex: 10, userSelect: "none" }}>
        {isoCorner ? "Pan: drag · Zoom: scroll · Click to inspect — angle locked (isometric)"
                   : "Orbit: drag · Pan: right-drag · Zoom: scroll · Click to inspect"}
      </div>}

      <Canvas
        key={isoCorner ? "ortho" : "persp"} // switching projection needs a fresh camera
        orthographic={!!isoCorner}
        shadows={style3d === "detailed" ? "soft" : false}
        dpr={[1, 1.5]}
        // offsetSize: measure layout size, not getBoundingClientRect — inside the Docs
        // sheet (CSS transform: scale) the rect is the SCALED size, which left the canvas
        // filling only a fraction of the slide body. Pane containers are untransformed,
        // so offset == rect there and behavior is unchanged.
        resize={{ offsetSize: true }}
        camera={isoCorner ? { near: -2000, far: 4000, zoom: 12 } : { fov: 50, near: 0.1, far: 1000 }}
        gl={{
          antialias: true,
          // Uniform depth precision across distance — without it the floor / grid /
          // floor-region surfaces z-fight (flicker) when zoomed out, where the
          // standard depth buffer's far-side precision is too coarse to separate them.
          logarithmicDepthBuffer: true,
          preserveDrawingBuffer: preserveBuffer,
          toneMapping: style3d === "detailed" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping,
          toneMappingExposure: 0.95,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        style={{ width: "100%", height: "100%" }}>
        <color attach="background" args={[bgColor]} />

        {style3d === "detailed" ? <>
          {/* HDRI image-based lighting — provides ambient + reflections for PBR materials */}
          <Environment preset="apartment" environmentIntensity={0.7} />
          {/* small ambient ensures Lambert-only meshes (markers) aren't pitch black */}
          <ambientLight intensity={0.25} />
          {/* warm late-morning sun — primary shadow caster */}
          <directionalLight
            position={[18, 28, 14]}
            intensity={1.6}
            color="#fff4e0"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.5}
            shadow-camera-far={250}
            shadow-camera-left={-80}
            shadow-camera-right={80}
            shadow-camera-top={80}
            shadow-camera-bottom={-80}
            shadow-bias={-0.0005}
            shadow-normalBias={0.02}
            shadow-radius={4}
          />
          {/* cool fill from opposite side — fakes sky bounce */}
          <directionalLight position={[-12, 10, -8]} intensity={0.35} color="#bcd4ff" />
        </> : style3d === "xray" ? <>
          <ambientLight intensity={1.0} />
        </> : style3d === "print" ? <>
          {/* Bright + nearly flat: enough directional to hint the massing, but faces stay
              pale so the black wall outlines carry the drawing. */}
          <ambientLight intensity={0.9} />
          <directionalLight position={[8, 16, 10]} intensity={0.45} />
        </> : <>
          <ambientLight intensity={0.65} />
          <directionalLight position={[8, 15, 8]} intensity={0.9} />
        </>}

        {/* Isometric locks rotation (that's what keeps it isometric) but keeps pan/zoom;
            left-drag pans since there's no orbit to spend it on. */}
        <OrbitControls ref={controlsRef} enabled={controlsEnabled} enableDamping dampingFactor={0.08} zoomSpeed={0.5}
          enableRotate={!isoCorner}
          mouseButtons={isoCorner ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN } : undefined}
          minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.04} target={[0, 0, 0]}
          onEnd={onCameraEnd ? () => { const c = controlsRef?.current; if (c) onCameraEnd({ position: c.object.position.toArray(), target: c.target.toArray(), zoom: c.object.zoom }); } : undefined} />
        {isoCorner
          ? <IsoCameraRig corner={isoCorner} fitR={camDist / 2.1} controlsRef={controlsRef} fitNonce={isoFitNonce} initialCamera={initialCamera} />
          : <CameraRig camDist={camDist} controlsRef={controlsRef} initialCamera={initialCamera} />}
        {captureRef && <CaptureBridge captureRef={captureRef} />}
        {style3d === "detailed" && <PostFX />}
        <ShadowEnabler enabled={style3d === "detailed"} />

        <FloorPlane walls={walls} nodes={nodes} zones={zones} cx={cx} cz={cz} pxPerFoot={pxPerFoot} T={T} zoneLibrary={zoneLibrary} style3d={style3d}
          floorMaterial={floorMaterial} floorRegions={floorRegions}
          isSelected={selType === "floor"} onSelectFloor={() => onSelect(null, "floor")} />
        {style3d === "detailed" && (
          <ContactShadows
            position={[0, 0.02, 0]}
            opacity={0.55}
            blur={2.4}
            far={6}
            resolution={512}
            color="#000000"
            frames={1}
          />
        )}
        {style3d !== "detailed" && (
          // Sits clearly above the floor stack (base 0.001, regions 0.004, selection 0.012)
          // so it never z-fights with the floor — a 0.001 gap flickered at camera distance.
          <Grid args={[500, 500]} cellSize={1} sectionSize={10} cellColor={gridCell} sectionColor={gridSec} position={[gridOffX, 0.02, gridOffZ]} fadeDistance={camDist * 2.5} fadeStrength={1.2} />
        )}

        {walls.map(w => (
          <Wall3D key={w.id} w={w} fp={wallFps.get(w.id)} nodes={nodes} doors={doors} windows={windows}
            cx={cx} cz={cz} pxPerFoot={pxPerFoot} ceilingHeight={w.ceilingHeight ?? ceilingHeight}
            onSelect={safeSelect} selectedId={effSelectedId} selType={effSelType} showDims={show3dDims} style3d={style3d} interactive={interactive} />
        ))}
        <CapSolids fps={wallFps} walls={walls} cx={cx} cz={cz} pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight} style3d={style3d} />
        <JunctionTrim walls={walls} nodes={nodes} cx={cx} cz={cz} pxPerFoot={pxPerFoot} style3d={style3d} />
        {show3dCeiling && <CeilingPlane walls={walls} nodes={nodes} cx={cx} cz={cz} pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight} style3d={style3d} />}
        {columns.map(col => (
          <Column3D key={col.id} col={col} cx={cx} cz={cz} pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight}
            onSelect={safeSelect} isSelected={effSelectedId === col.id && effSelType === "column"} style3d={style3d} interactive={interactive} />
        ))}
        {visibleMarkers.map(m => (
          <Marker3D key={m.id} marker={m} cx={cx} cz={cz} pxPerFoot={pxPerFoot} ceilingHeight={ceilingHeight}
            onSelect={safeSelect} isSelected={effSelectedId === m.id && effSelType === "marker"} style3d={style3d} interactive={interactive} />
        ))}
        {show3dLabels && zones.map(z => <ZoneLabel3D key={z.id} zone={z} cx={cx} cz={cz} pxPerFoot={pxPerFoot} zoneLibrary={zoneLibrary} />)}
        {show3dDims   && dims.map(d =>  <DimLine3D  key={d.id} dim={d}  cx={cx} cz={cz} pxPerFoot={pxPerFoot} />)}
      </Canvas>
    </div>
  );
}
