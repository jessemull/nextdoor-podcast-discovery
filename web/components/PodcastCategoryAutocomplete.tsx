"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { adminFormInputClass } from "@/lib/admin-form-classes";
import { cn } from "@/lib/utils";

export interface PodcastCategoryOption {
  id: string;
  name: string;
}

interface PodcastCategoryAutocompleteProps {
  categories: PodcastCategoryOption[];
  className?: string;
  disabled?: boolean;
  id?: string;
  onAdd: (categoryId: string) => void;
  onRemove: (categoryId: string) => void;
  selectedIds: Set<string>;
}

/**
 * Compact multi-select: selected categories as removable chips plus a search field
 * that opens a dropdown of matches to add.
 */
export function PodcastCategoryAutocomplete({
  categories,
  className,
  disabled = false,
  id,
  onAdd,
  onRemove,
  selectedIds,
}: PodcastCategoryAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSorted = useMemo(() => {
    return categories
      .filter((c) => selectedIds.has(c.id))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
  }, [categories, selectedIds]);

  const filteredToAdd = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((c) => !selectedIds.has(c.id))
      .filter(
        (c) =>
          q === "" || c.name.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
  }, [categories, query, selectedIds]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  const handlePick = useCallback(
    (categoryId: string) => {
      onAdd(categoryId);
      setQuery("");
      inputRef.current?.focus();
    },
    [onAdd]
  );

  return (
    <div
      className={cn("relative min-w-0", className)}
      id={id}
      ref={rootRef}
    >
      {categories.length === 0 ? (
        <p className="text-muted text-xs">No categories yet.</p>
      ) : (
        <>
          <div
            className={cn(
              adminFormInputClass,
              "flex min-h-[2.75rem] flex-wrap items-center gap-2 py-2",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            {selectedSorted.map((cat) => (
              <span
                key={cat.id}
                className="bg-surface-hover text-foreground inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs"
              >
                <span className="min-w-0 truncate">{cat.name}</span>
                <button
                  aria-label={`Remove ${cat.name}`}
                  className="text-muted hover:text-foreground shrink-0 rounded p-0.5 focus:outline-none focus:ring-1 focus:ring-border-focus"
                  disabled={disabled}
                  type="button"
                  onClick={() => onRemove(cat.id)}
                >
                  <X aria-hidden className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={open}
              aria-haspopup="listbox"
              className="placeholder:text-muted min-w-[10rem] flex-1 border-0 bg-transparent p-0 font-sans text-sm text-foreground outline-none disabled:cursor-not-allowed"
              disabled={disabled}
              placeholder={
                selectedIds.size === 0
                  ? "Search to add categories…"
                  : "Search to add more…"
              }
              ref={inputRef}
              role="combobox"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
          </div>
          {open && !disabled && (
            <div
              className="border-border bg-surface absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border py-1 shadow-lg"
              id={listboxId}
              role="listbox"
            >
              {filteredToAdd.length === 0 ? (
                <p className="text-muted px-3 py-2 text-xs">
                  {query.trim()
                    ? "No matching categories."
                    : "All categories are selected."}
                </p>
              ) : (
                filteredToAdd.map((cat) => (
                  <button
                    key={cat.id}
                    aria-selected={false}
                    className="text-foreground hover:bg-surface-hover w-full cursor-pointer px-3 py-2 text-left text-sm"
                    role="option"
                    type="button"
                    onClick={() => handlePick(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
