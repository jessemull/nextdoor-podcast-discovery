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

const SUGGESTIONS_DEBOUNCE_MS = 250;

export interface FeedSearchBarProps {
  embeddingBacklog: number;
  loadDefaultsError: null | string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSimilarityThresholdChange: (value: number) => void;
  onUseKeywordSearchChange: (value: boolean) => void;
  query: string;
  similarityThreshold: number;
  useKeywordSearch: boolean;
}

export function FeedSearchBar({
  embeddingBacklog,
  loadDefaultsError,
  loading,
  onQueryChange,
  onSearch,
  onSimilarityThresholdChange,
  onUseKeywordSearchChange,
  query,
  similarityThreshold,
  useKeywordSearch,
}: FeedSearchBarProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, SUGGESTIONS_DEBOUNCE_MS);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([...SEARCH_SUGGESTIONS]);
      return;
    }
    const q = debouncedQuery.trim().toLowerCase();
    fetch(
      `/api/search/suggestions?q=${encodeURIComponent(q)}&limit=10`
    )
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => setSuggestions(data.data ?? []))
      .catch(() => setSuggestions([]));
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

  const showDropdown = suggestionsOpen && suggestions.length > 0;

  return (
    <div className="mb-6 w-full min-w-0 space-y-4">
      {loadDefaultsError && (
        <Card className="border-border-focus">
          <p className="text-muted text-sm">{loadDefaultsError}</p>
        </Card>
      )}

      <div className="relative flex h-full min-h-9 w-full min-w-0 overflow-hidden rounded-card border-[1px] border-border bg-surface focus-within:border-border-focus focus-within:ring-1 focus-within:ring-border-focus" ref={containerRef}>
        <input
          aria-activedescendant={
            showDropdown && highlightedIndex >= 0
              ? `search-suggestion-${highlightedIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-label="Search for posts"
          className="min-h-0 min-w-0 flex-1 border-0 bg-transparent px-3 py-0 text-sm leading-9 text-foreground placeholder-muted-foreground focus:outline-none"
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
        <div className="border-border border-l bg-surface-hover shrink-0" aria-hidden />
        <select
          aria-label="Search type"
          className="select-caret border-border bg-surface-hover text-foreground h-full min-h-0 min-w-[7rem] shrink-0 cursor-pointer rounded-r-card border-0 border-l pl-3 pr-10 text-sm focus:outline-none focus:ring-0"
          value={useKeywordSearch ? "keyword" : "ai"}
          onChange={(e) =>
            onUseKeywordSearchChange(e.target.value === "keyword")
          }
        >
          <option value="ai">AI Powered</option>
          <option value="keyword">Keyword</option>
        </select>

        {showDropdown && (
          <ul
            ref={listRef}
            className="border-border bg-surface absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-card border py-1 shadow-lg"
            role="listbox"
          >
            {suggestions.map((s, i) => (
              <li
                id={`search-suggestion-${i}`}
                key={s}
                aria-selected={i === highlightedIndex}
                className={cn(
                  "cursor-pointer px-4 py-2 text-sm text-foreground",
                  i === highlightedIndex && "bg-surface-hover"
                )}
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
            ))}
          </ul>
        )}
      </div>

      {loading && (
        <p className="text-muted-foreground text-sm">Searching…</p>
      )}

      {embeddingBacklog > 0 && (
        <p className="text-muted text-xs">
          {embeddingBacklog} post{embeddingBacklog !== 1 ? "s" : ""} still need
          embeddings. Semantic search may miss some recent posts until the
          daily embed job runs.
        </p>
      )}

      {query.trim() && !useKeywordSearch && (
        <Card className="p-4">
          <label
            className="text-muted-foreground mb-2 block text-sm"
            htmlFor="feed-similarity-threshold"
          >
            Similarity Threshold: {similarityThreshold.toFixed(1)} (Lower = More
            Results, Higher = More Precise)
          </label>
          <input
            className="h-2 w-full appearance-none rounded-full bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
            id="feed-similarity-threshold"
            max={1}
            min={0}
            step={0.1}
            type="range"
            value={similarityThreshold}
            onChange={(e) =>
              onSimilarityThresholdChange(parseFloat(e.target.value))
            }
          />
          <div className="text-muted-foreground mt-1 flex justify-between text-xs">
            <span>0.0 (Loose)</span>
            <span>0.5 (Balanced)</span>
            <span>1.0 (Strict)</span>
          </div>
        </Card>
      )}
    </div>
  );
}
