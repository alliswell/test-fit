// ─── Keyboard shortcuts ──────────────────────────────────────────────────────
// The single source of truth for the in-app cheat sheet (? / the Help button). Keep this
// in step with the keydown handler in testfit.jsx — the README table used to be the only
// reference and it drifted (it still documented four stages after we shipped six).
export const SHORTCUT_GROUPS = [
  {
    title: "Stages",
    items: [
      { keys: ["1"], label: "Build" },
      { keys: ["2"], label: "IT / MEP" },
      { keys: ["3"], label: "Zones" },
      { keys: ["4"], label: "Furnish" },
      { keys: ["5"], label: "Budget" },
      { keys: ["6"], label: "Docs" },
    ],
  },
  {
    title: "Tools",
    items: [
      { keys: ["V"], label: "Select" },
      { keys: ["H"], label: "Pan (or hold Space)" },
      { keys: ["W"], label: "Wall" },
      { keys: ["R"], label: "Rect room" },
      { keys: ["C"], label: "Column" },
      { keys: ["A"], label: "Floor region" },
      { keys: ["K"], label: "Flow path" },
      { keys: ["M"], label: "Dimension" },
      { keys: ["T"], label: "Label" },
      { keys: ["N"], label: "Revision cloud" },
      { keys: ["Z"], label: "Zone (Zones stage)" },
      { keys: ["E"], label: "Outlet (IT/MEP)" },
      { keys: ["L"], label: "Lighting (IT/MEP)" },
      { keys: ["P"], label: "Component (IT/MEP)" },
    ],
  },
  {
    title: "Drawing",
    items: [
      { keys: ["type"], label: "Wall: type a length to lock it" },
      { keys: ["type"], label: "Rect room: type a size — 20x30, 20'6\"x30'" },
      { keys: ["Shift"], label: "Hold: 45° / ortho lock" },
      { keys: ["Alt"], label: "Hold: suspend grid snapping" },
      { keys: ["Alt", "drag"], label: "Duplicate what you drag" },
      { keys: ["/"], label: "Repeat the last copy N times" },
      { keys: ["Esc"], label: "Cancel drag → draw → selection → tool" },
    ],
  },
  {
    title: "Edit",
    items: [
      { keys: ["⌘", "Z"], label: "Undo" },
      { keys: ["⌘", "⇧", "Z"], label: "Redo" },
      { keys: ["⌘", "C"], label: "Copy" },
      { keys: ["⌘", "V"], label: "Paste" },
      { keys: ["⌘", "D"], label: "Duplicate selection" },
      { keys: ["⌘", "A"], label: "Select all in this stage" },
      { keys: ["⌘", "⇧", "A"], label: "Select all of the same type" },
      { keys: ["←↑↓→"], label: "Nudge 1 inch" },
      { keys: ["⇧", "←↑↓→"], label: "Nudge 1 foot" },
      { keys: ["Del"], label: "Delete selection" },
      { keys: ["R"], label: "Rotate selected marker / track" },
      { keys: ["F"], label: "Flip selected door" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: ["0"], label: "Fit everything" },
      { keys: ["F"], label: "Zoom to selection" },
      { keys: ["⌘", "+"], label: "Zoom in" },
      { keys: ["⌘", "−"], label: "Zoom out" },
      { keys: ["`"], label: "Toggle Plan | 3D split" },
      { keys: ["G"], label: "Toggle grid" },
      { keys: ["D"], label: "Toggle auto dimensions" },
      { keys: ["?"], label: "This cheat sheet" },
    ],
  },
];
