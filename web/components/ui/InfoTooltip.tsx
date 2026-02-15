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
 * Icon matches label color by inheriting from parent (label usually has text-foreground and opacity 0.85).
 */
export function InfoTooltip({ description }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help shrink-0 text-inherit">
          <Info className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side="top">{description}</TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
