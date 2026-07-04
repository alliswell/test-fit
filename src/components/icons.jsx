// ─── Custom tool-rail icons ───────────────────────────────────────────────────
// Pure SVG components (no props, currentColor-driven) for wall/window/column tools.

export const WallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="8" width="14" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const DemoWallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="8" width="14" height="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" fill="none"/>
    <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2"/>
  </svg>
);

export const NewWallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="8" width="14" height="4" stroke="currentColor" strokeWidth="2" fill="none"/>
    <line x1="10" y1="8" x2="10" y2="12" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export const RectRoomIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3.5" y="4.5" width="13" height="11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="3.5" cy="4.5" r="1.6" fill="currentColor"/>
    <circle cx="16.5" cy="15.5" r="1.6" fill="currentColor"/>
  </svg>
);

export const WindowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="12" height="12" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const CutoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="3" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="2"/>
    <line x1="13" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="2"/>
    <line x1="7" y1="7" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5"/>
    <line x1="13" y1="7" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5"/>
  </svg>
);

export const PonyWallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="9" width="14" height="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <line x1="6" y1="12" x2="6" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5"/>
    <line x1="14" y1="12" x2="14" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5"/>
  </svg>
);

export const ColumnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="10" cy="10" r="3" fill="currentColor"/>
  </svg>
);
