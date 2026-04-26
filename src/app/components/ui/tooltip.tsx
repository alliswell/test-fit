"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

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
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        style={{
          zIndex: 9999,
          background: "rgba(28, 26, 22, 0.95)",
          color: "#E8E0D0",
          fontSize: "11px",
          fontFamily: "inherit",
          fontWeight: 500,
          lineHeight: 1.4,
          padding: "5px 10px",
          borderRadius: "6px",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          backdropFilter: "blur(8px)",
          ...style,
        }}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          style={{
            fill: "rgba(28, 26, 22, 0.95)",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
          }}
          width={10}
          height={5}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
