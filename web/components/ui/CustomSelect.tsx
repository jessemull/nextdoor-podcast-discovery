"use client";

import { ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export interface CustomSelectOption {
  label: string;
  value: string;
}

interface CustomSelectProps {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  value: string;
}

/**
 * Dropdown select anchored below the trigger. Options use cursor-pointer.
 * Use when you need the menu to open downward and consistent option styling.
 */
export function CustomSelect({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          "border-border bg-surface-hover text-foreground flex h-full min-h-0 w-full cursor-pointer items-center justify-between gap-2 rounded-card border pl-3 pr-3 text-sm focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus",
          className
        )}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="min-w-0 truncate">{selectedOption.label}</span>
        <ChevronDown
          aria-hidden
          className={cn("h-4 w-4 shrink-0 text-muted-foreground", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul
          className="border-border bg-surface absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-card border py-1 shadow-lg"
          role="listbox"
        >
          {options.map((opt) => (
            <li
              aria-selected={opt.value === value}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm text-foreground hover:bg-surface-hover",
                opt.value === value && "bg-surface-hover"
              )}
              key={opt.value}
              role="option"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                close();
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
