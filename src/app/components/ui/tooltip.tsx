"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

// Yardstick tooltip: an ink plate with paper lettering, square, no shadow. It portals to
// <body>, outside the app root, so it reads the theme through the :root custom properties
// (constants/theme.js ysVars) rather than the `T` object. Styling lives in
// styles/yardstick.css (.ys-tip) so a <kbd> inside can be styled too.
function TooltipProvider({
  delayDuration = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  sideOffset = 6,
  children,
  className,
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={["ys-tip", className].filter(Boolean).join(" ")}
        style={style}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow style={{ fill: "var(--ink, #211d18)" }} width={10} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
