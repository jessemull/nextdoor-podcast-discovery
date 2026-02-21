"use client";

import { ChevronDown } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export interface CustomSelectOption {
  icon?: ReactNode;
  label: string;
  value: string;
}

interface CustomSelectProps {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  value: string;
}

/**
 * Dropdown select anchored below the trigger. Options use cursor-pointer.
 * Use when you need the menu to open downward and consistent option styling.
 */
export function CustomSelect({
  ariaLabel,
  className,
  disabled = false,
  onChange,
  options,
  placeholder,
  value,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption =
    value !== ""
      ? options.find((o) => o.value === value) ?? options[0]
      : { icon: undefined, label: placeholder ?? options[0]?.label ?? "", value: "" };
  const listOptions = placeholder != null ? options.filter((o) => o.value !== "") : options;

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
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        disabled={disabled}
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedOption.icon != null ? (
            <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center">
              {selectedOption.icon}
            </span>
          ) : null}
          {selectedOption.label}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground",
            open && "rotate-180"
          )}
        />
      </button>
      {open && !disabled && (
        <ul
          className="border-border bg-surface absolute left-0 top-full z-50 mt-1 max-h-60 min-w-[12rem] w-max overflow-auto rounded-card border py-1 shadow-lg"
          role="listbox"
        >
          {listOptions.map((opt) => (
            <li
              key={opt.value}
              aria-selected={opt.value === value}
              className={cn(
                "flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-2 text-sm text-foreground hover:bg-surface-hover",
                opt.value === value && "bg-surface-hover"
              )}
              role="option"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                close();
              }}
            >
              {opt.icon != null ? (
                <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {opt.icon}
                </span>
              ) : null}
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
