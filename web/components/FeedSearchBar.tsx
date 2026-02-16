"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/Card";
import { SEARCH_SUGGESTIONS } from "@/lib/constants";
import { useDebounce } from "@/lib/hooks";
import { cn } from "@/lib/utils";

import { CustomSelect } from "./ui/CustomSelect";

const SUGGESTIONS_DEBOUNCE_MS = 250;

export interface FeedSearchBarProps {
  embeddingBacklog: number;
  loadDefaultsError: null | string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onUseKeywordSearchChange: (value: boolean) => void;
  query: string;
  useKeywordSearch: boolean;
}

export function FeedSearchBar({
  embeddingBacklog,
  loadDefaultsError,
  loading,
  onQueryChange,
  onSearch,
  onUseKeywordSearchChange,
  query,
  useKeywordSearch,
}: FeedSearchBarProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, SUGGESTIONS_DEBOUNCE_MS);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([...SEARCH_SUGGESTIONS]);
      setSuggestionsLoading(false);
      return;
    }
    const q = debouncedQuery.trim().toLowerCase();
    setSuggestionsLoading(true);
    fetch(
      `/api/search/suggestions?q=${encodeURIComponent(q)}&limit=10`
    )
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        setSuggestions(data.data ?? []);
        setSuggestionsLoading(false);
      })
      .catch(() => {
        setSuggestions([]);
        setSuggestionsLoading(false);
      });
  }, [debouncedQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (suggestionsOpen && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          e.preventDefault();
          onQueryChange(suggestions[highlightedIndex]);
          onSearch();
          setSuggestionsOpen(false);
          setHighlightedIndex(-1);
        } else {
          e.preventDefault();
          onSearch();
        }
        return;
      }
      if (e.key === "Escape") {
        setSuggestionsOpen(false);
        setHighlightedIndex(-1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) =>
          i < suggestions.length - 1 ? i + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) =>
          i > 0 ? i - 1 : suggestions.length - 1
        );
      }
    },
    [highlightedIndex, onQueryChange, onSearch, suggestions, suggestionsOpen]
  );

  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown =
    suggestionsOpen && (suggestionsLoading || suggestions.length > 0);

  return (
    <div className="mb-6 w-full min-w-0 space-y-4">
      {loadDefaultsError && (
        <Card className="border-border-focus">
          <p className="text-muted text-sm">{loadDefaultsError}</p>
        </Card>
      )}

      <div className="relative flex h-full min-h-10 w-full min-w-0 rounded-card border-[1px] border-border bg-surface focus-within:border-border-focus focus-within:ring-1 focus-within:ring-border-focus" ref={containerRef}>
        <input
          aria-activedescendant={
            showDropdown && highlightedIndex >= 0
              ? `search-suggestion-${highlightedIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-label="Search for posts"
          className="min-h-0 min-w-0 flex-1 border-0 bg-transparent mr-2 px-3 py-0 text-sm leading-10 text-foreground placeholder-muted-foreground focus:outline-none"
          placeholder="Search for posts..."
          type="text"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setSuggestionsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setSuggestionsOpen(true);
            setSuggestions([...SEARCH_SUGGESTIONS]);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
        />
        <div aria-hidden className="border-border border-l bg-surface-hover shrink-0" />
        <CustomSelect
          ariaLabel="Search type"
          className="h-full min-h-0 min-w-[7rem] shrink-0 rounded-l-none rounded-r-card border-0 border-l focus:ring-0"
          options={[
            { label: "AI Powered", value: "ai" },
            { label: "Keyword", value: "keyword" },
          ]}
          value={useKeywordSearch ? "keyword" : "ai"}
          onChange={(val) => onUseKeywordSearchChange(val === "keyword")}
        />

        {showDropdown && (
          <ul
            className="border-border bg-surface absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-card border py-1 shadow-lg"
            ref={listRef}
            role="listbox"
          >
            {suggestionsLoading ? (
              <li className="px-4 py-3 text-muted-foreground text-sm">
                Loading suggestions…
              </li>
            ) : (
              suggestions.map((s, i) => (
              <li
                key={s}
                aria-selected={i === highlightedIndex}
                className={cn(
                  "cursor-pointer px-4 py-2 text-sm text-foreground",
                  i === highlightedIndex && "bg-surface-hover"
                )}
                id={`search-suggestion-${i}`}
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onQueryChange(s);
                  onSearch();
                  setSuggestionsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                {s}
              </li>
            ))
            )}
          </ul>
        )}
      </div>

      {loading && (
        <p className="text-muted-foreground text-sm">Searching…</p>
      )}

    </div>
  );
}
