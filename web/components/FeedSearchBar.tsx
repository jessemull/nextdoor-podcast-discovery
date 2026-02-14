"use client";

import { Search } from "lucide-react";
import { useCallback } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const SEARCH_SUGGESTIONS = [
  "coyote",
  "lost dog",
  "lost cat",
  "HOA",
  "noisy neighbors",
  "suspicious",
  "package stolen",
  "wildlife",
];

export interface FeedSearchBarProps {
  embeddingBacklog: number;
  loadDefaultsError: null | string;
  loading: boolean;
  minScore: "" | number;
  onMinScoreChange: (value: "" | number) => void;
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
  minScore,
  onMinScoreChange,
  onQueryChange,
  onSearch,
  onSimilarityThresholdChange,
  onUseKeywordSearchChange,
  query,
  similarityThreshold,
  useKeywordSearch,
}: FeedSearchBarProps) {
  const chipClass =
    "rounded border border-border px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground";

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSearch();
      }
    },
    [onSearch]
  );

  return (
    <div className="mb-6 space-y-4">
      {loadDefaultsError && (
        <Card className="border-border-focus">
          <p className="text-muted text-sm">{loadDefaultsError}</p>
        </Card>
      )}

      <div className="flex gap-2">
        <input
          aria-label="Search posts"
          className="flex-1 rounded-card border border-border bg-surface px-4 py-3 text-foreground placeholder-muted-foreground focus:border-border-focus focus:outline-none focus:ring-2"
          placeholder="e.g., noisy neighbors, lost pet, suspicious activity..."
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          aria-label="Search"
          className={cn(
            "flex items-center justify-center gap-2 rounded-card border border-border bg-surface-hover px-4 py-3 text-foreground transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-50"
          )}
          disabled={loading}
          type="button"
          onClick={() => onSearch()}
        >
          <Search aria-hidden className="h-5 w-5" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {loading && (
        <p className="text-muted-foreground text-sm">Searching...</p>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="text-muted-foreground self-center text-xs">
          Try:
        </span>
        {SEARCH_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            className={chipClass}
            type="button"
            onClick={() => onQueryChange(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {embeddingBacklog > 0 && (
        <p className="text-muted text-xs">
          {embeddingBacklog} post{embeddingBacklog !== 1 ? "s" : ""} still need
          embeddings. Semantic search may miss some recent posts until the daily
          embed job runs.
        </p>
      )}

      <div className="flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            checked={useKeywordSearch}
            className="rounded border-border bg-surface-hover focus:ring-border-focus"
            type="checkbox"
            onChange={(e) => onUseKeywordSearchChange(e.target.checked)}
          />
          <span className="text-muted-foreground text-sm">
            Keyword search (exact terms, no AI)
          </span>
        </label>
      </div>

      {query.trim() && (
        <div className="flex items-center gap-2">
          <label
            className="text-muted-foreground text-sm"
            htmlFor="feed-min-score"
          >
            Min score:
          </label>
          <input
            className="w-20 rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
            id="feed-min-score"
            max={10}
            min={0}
            placeholder="Any"
            type="number"
            value={minScore}
            onChange={(e) => {
              const v = e.target.value;
              onMinScoreChange(v === "" ? "" : parseFloat(v) || 0);
            }}
          />
        </div>
      )}

      {query.trim() && !useKeywordSearch && (
        <Card className="p-4">
          <label
            className="text-muted-foreground mb-2 block text-sm"
            htmlFor="feed-similarity-threshold"
          >
            Similarity threshold: {similarityThreshold.toFixed(1)} (lower = more
            results, higher = more precise)
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
            <span>0.0 (loose)</span>
            <span>0.5 (balanced)</span>
            <span>1.0 (strict)</span>
          </div>
        </Card>
      )}
    </div>
  );
}
