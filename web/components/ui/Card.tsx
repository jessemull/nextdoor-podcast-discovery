import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Canonical card surface: border, background, padding, radius.
 * Use for stats, post list/detail, settings sections, jobs list items.
 */
export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface p-4",
        className
      )}
    >
      {children}
    </div>
  );
}
