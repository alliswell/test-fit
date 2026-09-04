import { useShallow } from "zustand/react/shallow";
import { useHoverStore } from "../store/hoverStore";

// ─── HoverSubscriber ─────────────────────────────────────────────────────────
// A render island for per-mouse-move state. The plan canvas is one big render function
// inside TestfitTool; anything drawn from the cursor ghost / proximity ring / smart guides
// / hovered node used to re-render the WHOLE editor on every mousemove. Wrapping just
// those few SVG groups in this component moves the subscription down here: the editor
// renders once per real change, and a hover repaints only these islands.
//
//   <HoverSubscriber>{({ ghostPos, cursorPos, proxHover, smartGuides, hoverNid }) =>
//     tool === "door" && ghostPos && <DoorSvg … />
//   }</HoverSubscriber>
//
// The render prop closes over the parent's CURRENT render scope (it's re-created every
// time the parent renders), so it always sees fresh tool/theme/geometry values; only the
// hover fields come from the store. A falsy result renders nothing.
const pick = (s) => ({
  cursorPos: s.cursorPos, ghostPos: s.ghostPos, proxHover: s.proxHover,
  smartGuides: s.smartGuides, hoverNid: s.hoverNid,
});

export default function HoverSubscriber({ children }) {
  const hover = useHoverStore(useShallow(pick));
  return children(hover) || null;
}
