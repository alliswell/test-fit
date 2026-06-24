// ─── Marker mounting config (pure — no three.js) ────────────────────────────────
// Kept separate from testfit3d.jsx so the 2D elevation view can import markerMountYFt
// WITHOUT pulling the heavy three.js / r3f / drei bundle into the main chunk.
//
// y      : AFF in feet; "ceil" = flush ceiling; "hangN" = N ft below ceiling
// shape  : 3D geometry variant key (consumed by Marker3D in testfit3d.jsx)
// All dimensional values in feet unless noted.
export const M3D = {
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
  // H-Track (ceiling, 1" below)
  htrack_4:              { y: "ceil",   shape: "htrack",   color: "#E8D070", len: 4               },
  htrack_8:              { y: "ceil",   shape: "htrack",   color: "#E8D070", len: 8               },
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
  // ── AV (modeled to product spec) ──────────────────────────
  wall_speaker:          { y: 7.0,      shape: "speaker",      color: "#D07840", w: 0.47, h: 0.66, d: 0.37 }, // JBL Control 23-1
  subwoofer:             { y: 0.97,     shape: "sub",          color: "#704020", w: 1.17, h: 1.94, d: 1.88 }, // JBL Control SB2210 (floor)
  pendant_speaker:       { y: "hang1.0",shape: "pendant_spkr", color: "#D07840", r: 0.39, h: 0.85 },          // JBL Control 64P/T
  speaker_drop:          { y: "ceil",   shape: "speaker_drop", color: "#D07840"                       },
  // ── IT ────────────────────────────────────────────────────
  it_rack:               { y: 4.5,      shape: "rack",     color: "#3A3D42", w: 1.67, h: 1.6, d: 1.5 },       // 9U wall-mount rack
  router:                { y: "ceil",   shape: "router",   color: "#E8E8E8", r: 0.285, d: 0.11 },             // Ubiquiti U7 Lite
  // ── MEP ───────────────────────────────────────────────────
  drain_line:            { y: 0.5,      shape: "drain",    color: "#50A070", r: 0.12, d: 0.04  },
  water_line:            { y: 1.5,      shape: "water",    color: "#5070C0"                       },
  // ── Security (Ring) — color driven by finish ──────────────
  camera_indoor:         { y: 7.0,      shape: "camera",     color: "#E8E0D0"                     },
  camera_floodlight:     { y: 9.0,      shape: "floodlight", color: "#E8E0D0"                     },
};

// Mounting height (center, AFF in feet) for a marker component, resolving the M3D table's
// "ceil" (flush ceiling) and "hangN" (N ft below ceiling) forms. Single source of truth so
// the 2D elevation view places IT/MEP markers at the same height the 3D scene uses.
export function markerMountYFt(componentType, ceilingHeightFt) {
  const y = M3D[componentType]?.y ?? 4.0; // unknown component → mid-wall fallback
  if (y === "ceil") return ceilingHeightFt;
  if (typeof y === "string" && y.startsWith("hang")) return Math.max(0, ceilingHeightFt - (parseFloat(y.slice(4)) || 0));
  return y;
}
