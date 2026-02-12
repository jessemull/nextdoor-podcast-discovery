import { cn } from "@/lib/utils";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "danger" | "ghost" | "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  danger:
    "border-border bg-transparent text-destructive hover:bg-destructive/10 focus:ring-border-focus",
  ghost:
    "border-transparent bg-transparent text-foreground hover:bg-surface-hover focus:ring-border-focus",
  primary:
    "border-border bg-primary text-background hover:opacity-90 focus:ring-border-focus",
  secondary:
    "border-border bg-surface text-foreground hover:bg-surface-hover focus:ring-border-focus",
};

/**
 * Shared button styles: primary, secondary, ghost, danger.
 * Use design tokens; supports focus ring for a11y.
 */
export function Button({
  children,
  className,
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
