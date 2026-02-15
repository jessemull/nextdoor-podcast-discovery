"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

/**
 * Provider for tooltips. Wrap the app (or a subtree) once.
 * delayDuration={0} makes tooltips show immediately on hover.
 */
export const TooltipProvider = TooltipPrimitive.Provider;

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipPortal = TooltipPrimitive.Portal;

export function TooltipContent({
  children,
  className,
  ...props
}: TooltipPrimitive.TooltipContentProps) {
  return (
    <TooltipPrimitive.Content
      className={cn(
        "border-border bg-surface text-foreground z-50 max-w-xs rounded-md border px-3 py-2 text-sm shadow-md",
        className
      )}
      sideOffset={6}
      {...props}
    >
      {children}
    </TooltipPrimitive.Content>
  );
}
