"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger,
} from "@/components/ui/Tooltip";

interface InfoTooltipProps {
  description: string;
}

/**
 * Small info icon that shows a styled tooltip on hover.
 * Icon matches label styling (text-foreground, opacity 0.85, text-sm size).
 */
export function InfoTooltip({ description }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="cursor-help shrink-0 text-foreground text-sm"
          style={{ opacity: 0.85 }}
        >
          <Info className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side="top">{description}</TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
