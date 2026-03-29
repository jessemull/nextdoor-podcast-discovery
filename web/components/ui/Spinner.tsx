import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "md" | "sm";
}

/**
 * CSS-only spinner for loading states. Use sm inside buttons, md for
 * centered page/section loading.
 */
export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-8 w-8";
  return (
    <div
      aria-hidden
      className={cn(
        "animate-spin rounded-full border-2 border-border-focus border-t-transparent",
        sizeClass,
        className
      )}
    />
  );
}
