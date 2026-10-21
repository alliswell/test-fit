// ─── UI icons (Yardstick construction) ──────────────────────────────────────────
// Pure SVG components, currentColor-driven. Drawn on a 24px grid at the `line-icon`
// weight (1.25) with SQUARE caps and MITRED joins, built only from circles, squares and
// lines at 0°, 45° and 90° — the Yardstick iconography rule — and rendered at 20px in the
// tool rail / 18px in buttons. Tool glyphs read as their plan symbol where one exists
// (door = leaf + quarter swing, column = filled square, outlet = circle + two ticks).

const Svg = ({ children, size = 20, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"
    strokeLinecap="square" strokeLinejoin="miter" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

// ── Universal tools ────────────────────────────────────────────────────────────
export const SelectIcon = (p) => (
  <Svg {...p}><path d="M6 4v14l4-4h7L6 4z" /><path d="M13 14l4 5" /></Svg>
);
export const DimIcon = (p) => (
  <Svg {...p}><path d="M4 12h16" /><path d="M4 7v10M20 7v10" /><path d="M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3" /></Svg>
);
export const LabelIcon = (p) => (
  <Svg {...p}><path d="M5 6h14M12 6v13" /><path d="M5 6v2M19 6v2" /></Svg>
);
export const RevCloudIcon = (p) => (
  <Svg {...p}>
    <path d="M8 19a3 3 0 0 1-3-3 3 3 0 0 1-1-5 3 3 0 0 1 3-4 3 3 0 0 1 5-1 3 3 0 0 1 5 1 3 3 0 0 1 3 4 3 3 0 0 1-1 5 3 3 0 0 1-3 3z" />
  </Svg>
);
export const FlowPathIcon = (p) => (
  <Svg {...p}><path d="M4 19l5-5 4 4 7-7" strokeDasharray="2.5 2" /><path d="M16 11h4v4" /></Svg>
);
export const FloorIcon = (p) => (
  <Svg {...p}><rect x="4" y="4" width="16" height="16" /><path d="M4 9h16M4 14h16M4 19" opacity="0.6" /></Svg>
);

// ── Build ──────────────────────────────────────────────────────────────────────
export const WallIcon = (p) => (
  <Svg {...p}><rect x="3" y="9.5" width="18" height="5" /><path d="M12 9.5v5" /></Svg>
);
export const DemoWallIcon = (p) => (
  <Svg {...p}><rect x="3" y="9.5" width="18" height="5" strokeDasharray="2.5 2" /><path d="M12 9.5v5" strokeDasharray="2.5 2" /></Svg>
);
export const NewWallIcon = (p) => (
  <Svg {...p} strokeWidth="2"><rect x="3" y="9.5" width="18" height="5" /><path d="M12 9.5v5" /></Svg>
);
export const PonyWallIcon = (p) => (
  <Svg {...p}><rect x="3" y="10" width="18" height="3" /><path d="M7 13v4M17 13v4" strokeDasharray="1.5 1.5" /></Svg>
);
export const RectRoomIcon = (p) => (
  <Svg {...p}><rect x="4" y="5" width="16" height="14" /><rect x="2.5" y="3.5" width="3" height="3" fill="currentColor" /><rect x="18.5" y="17.5" width="3" height="3" fill="currentColor" /></Svg>
);
export const DoorIcon = (p) => (
  <Svg {...p}><path d="M4 18h16" /><path d="M7 18V6" /><path d="M7 6a12 12 0 0 1 12 12" /></Svg>
);
export const WindowIcon = (p) => (
  <Svg {...p}><rect x="3" y="9" width="18" height="6" /><path d="M3 12h18" /><path d="M8 9v6M16 9v6" /></Svg>
);
export const ColumnIcon = (p) => (
  <Svg {...p}><rect x="6" y="6" width="12" height="12" /><rect x="9" y="9" width="6" height="6" fill="currentColor" /></Svg>
);
export const CutoutIcon = (p) => (
  <Svg {...p}><path d="M3 12h5M16 12h5" strokeWidth="2" /><path d="M8 8v8M16 8v8" strokeDasharray="2 1.5" /></Svg>
);
export const CalibrateIcon = (p) => (
  <Svg {...p}><rect x="3" y="8" width="18" height="8" /><path d="M7 8v3M11 8v4M15 8v3M19 8v4" /></Svg>
);

// ── IT/MEP ─────────────────────────────────────────────────────────────────────
export const OutletIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="7" /><path d="M3 12h18" /><path d="M10 8.5v2M14 8.5v2" /></Svg>
);
export const LightingIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="4.5" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><path d="M5 5l2.5 2.5M19 5l-2.5 2.5M5 19l2.5-2.5M19 19l-2.5-2.5" /></Svg>
);

// ── Top bar ────────────────────────────────────────────────────────────────────
export const ChevronIcon = ({ open = false, ...p }) => (
  <Svg size={14} {...p} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", ...(p.style || {}) }}><path d="M5 9l7 7 7-7" /></Svg>
);
export const PanelIcon = ({ open = true, ...p }) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" /><path d="M9 4v16" />{open ? <path d="M6 9l-0 0M4.5 8.5" /> : <path d="M13 12h5M16 10l2 2-2 2" />}</Svg>
);
export const UndoIcon = (p) => (
  <Svg {...p}><path d="M8 7H4v4" /><path d="M4 11a8 8 0 1 1 2.5 5.8" /></Svg>
);
export const RedoIcon = (p) => (
  <Svg {...p}><path d="M16 7h4v4" /><path d="M20 11a8 8 0 1 0-2.5 5.8" /></Svg>
);
export const GearIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7.5" strokeDasharray="3.9 2" /></Svg>
);
export const SingleIcon = (p) => (<Svg {...p}><rect x="4" y="5" width="16" height="14" /></Svg>);
export const SplitIcon = (p) => (<Svg {...p}><rect x="4" y="5" width="16" height="14" /><path d="M12 5v14" /></Svg>);
export const QuadIcon = (p) => (<Svg {...p}><rect x="4" y="5" width="16" height="14" /><path d="M12 5v14M4 12h16" /></Svg>);
export const PlusIcon = (p) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const CloseIcon = (p) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>);
export const CheckIcon = (p) => (<Svg {...p}><path d="M5 12l5 5 9-9" /></Svg>);
export const PencilIcon = (p) => (<Svg {...p}><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></Svg>);
export const ChevronRightIcon = (p) => (<Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>);
export const ChevronLeftIcon = (p) => (<Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>);
