"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { Card } from "@/components/ui/Card";
import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import { useDebounce } from "@/lib/hooks";
import { cn } from "@/lib/utils";

import type { PostWithScores } from "@/lib/types";

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

interface SearchResponse {
  data: PostWithScores[];
  total: number;
}

/**
 * Search Page - Semantic search for posts using vector embeddings.
 *
 * Features:
 * - Search input with debouncing to reduce API calls
 * - Semantic search using OpenAI embeddings
 * - Display results with similarity scores
 * - Loading and error states
 * - Empty state when no results found
 */
interface SettingsResponse {
  data: {
    ranking_weights: Record<string, number>;
    search_defaults: {
      similarity_threshold: number;
    };
  };
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<null | string>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [useKeywordSearch, setUseKeywordSearch] = useState(false);

  // Pre-fill query from URL (e.g. /search?q=... from "Find similar" on feed)
  useEffect(() => {
    const q = searchParams.get("q");
    if (typeof q === "string" && q.trim()) setQuery(q.trim());
  }, [searchParams]);
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<PostWithScores[]>([]);
  const [minScore, setMinScore] = useState<"" | number>("");
  const [similarityThreshold, setSimilarityThreshold] = useState(0.2);
  const [total, setTotal] = useState(0);
  const [loadDefaultsError, setLoadDefaultsError] = useState<null | string>(null);
  const [embeddingBacklog, setEmbeddingBacklog] = useState(0);

  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY_MS);

  // Load default similarity threshold from settings, and sync with URL
  useEffect(() => {
    const thresholdParam = searchParams.get("threshold");
    if (thresholdParam != null) {
      const n = parseFloat(thresholdParam);
      if (!isNaN(n) && n >= 0 && n <= 1) {
        setSimilarityThreshold(n);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const [settingsRes, statsRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/stats"),
        ]);
        if (settingsRes.ok) {
          const data: SettingsResponse = await settingsRes.json();
          if (
            data.data.search_defaults?.similarity_threshold !== undefined &&
            typeof data.data.search_defaults.similarity_threshold === "number"
          ) {
            const urlThreshold = searchParams.get("threshold");
            if (!urlThreshold) {
              setSimilarityThreshold(data.data.search_defaults.similarity_threshold);
            }
          }
        } else {
          setLoadDefaultsError("Failed to load search defaults. Using default threshold.");
        }
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setEmbeddingBacklog(stats.embedding_backlog ?? 0);
        }
      } catch (err) {
        console.error("Error loading search defaults:", err);
        setLoadDefaultsError(
          err instanceof Error
            ? `Error loading search defaults: ${err.message}`
            : "Failed to load search defaults. Using default threshold."
        );
      }
    };

    void loadDefaults();
  }, [searchParams]);

  const updateUrlThreshold = useCallback(
    (value: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("threshold", value.toFixed(1));
      const newUrl = `/search${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setTotal(0);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = useKeywordSearch
          ? await fetch(
              `/api/search?q=${encodeURIComponent(searchQuery.trim())}&limit=20`
            )
          : await fetch("/api/search", {
              body: JSON.stringify({
                limit: 20,
                min_score: typeof minScore === "number" ? minScore : undefined,
                query: searchQuery.trim(),
                similarity_threshold: similarityThreshold,
              }),
              headers: {
                "Content-Type": "application/json",
              },
              method: "POST",
            });

        if (!response.ok) {
          let errorMessage = "Search failed";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data: SearchResponse = await response.json();
        setResults(data.data || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error("Search error:", err);
        setError(err instanceof Error ? err.message : "Failed to search posts");
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [minScore, similarityThreshold, useKeywordSearch]
  );

  // Trigger search when debounced query changes
  useEffect(() => {
    handleSearch(debouncedQuery);
  }, [debouncedQuery, handleSearch]);

  const handleMarkSaved = useCallback(async (postId: string, saved: boolean) => {
    if (markingSaved.has(postId)) return;
    setMarkingSaved((prev) => new Set(prev).add(postId));
    try {
      const response = await fetch(`/api/posts/${postId}/saved`, {
        body: JSON.stringify({ saved }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (response.ok) {
        setResults((prev) =>
          prev.map((post) =>
            post.id === postId ? { ...post, saved } : post
          )
        );
      }
    } finally {
      setMarkingSaved((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }, [markingSaved]);

  const handleMarkUsed = useCallback(async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/used`, {
        body: JSON.stringify({ used: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to mark post as used");
      }

      // Update the post in results
      setResults((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, used_on_episode: true } : post
        )
      );
    } catch (err) {
      console.error("Error marking post as used:", err);
    }
  }, []);

  const chipClass =
    "rounded border border-border px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground";

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-semibold text-foreground">
          Search Posts
        </h1>
        <p className="text-muted mb-8 text-sm">
          Find similar posts using semantic search. Search by meaning, not just
          keywords.
        </p>

        {/* Load Defaults Error */}
        {loadDefaultsError && (
          <Card className="border-border-focus mb-6">
            <p className="text-muted text-sm">{loadDefaultsError}</p>
          </Card>
        )}

        {/* Search Input + Submit */}
        <div className="mb-4 flex gap-2">
          <input
            aria-label="Search posts"
            className="flex-1 rounded-card border border-border bg-surface px-4 py-3 text-foreground placeholder-muted-foreground focus:border-border-focus focus:outline-none focus:ring-2"
            placeholder="e.g., noisy neighbors, lost pet, suspicious activity..."
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSearch(query.trim());
              }
            }}
          />
          <button
            aria-label="Search"
            className={cn(
              "flex items-center justify-center gap-2 rounded-card border border-border bg-surface-hover px-4 py-3 text-foreground transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-50"
            )}
            disabled={loading}
            type="button"
            onClick={() => void handleSearch(query.trim())}
          >
            <Search aria-hidden className="h-5 w-5" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
        {loading && (
          <p className="text-muted-foreground mt-2 text-sm">Searching...</p>
        )}

        {/* Search suggestions */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-muted-foreground self-center text-xs">
            Try:
          </span>
          {SEARCH_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              className={chipClass}
              type="button"
              onClick={() => setQuery(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Embedding backlog note */}
        {embeddingBacklog > 0 && (
          <p className="text-muted mb-4 text-xs">
            {embeddingBacklog} post{embeddingBacklog !== 1 ? "s" : ""} still need
            embeddings. Semantic search may miss some recent posts until the
            daily embed job runs.
          </p>
        )}

        {/* Search mode toggle */}
        <div className="mb-4 flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              checked={useKeywordSearch}
              className="rounded border-border bg-surface-hover focus:ring-border-focus"
              type="checkbox"
              onChange={(e) => setUseKeywordSearch(e.target.checked)}
            />
            <span className="text-muted-foreground text-sm">
              Keyword search (exact terms, no AI)
            </span>
          </label>
        </div>

        {/* Min score filter */}
        {query.trim() && (
          <div className="mb-4 flex items-center gap-2">
            <label
              className="text-muted-foreground text-sm"
              htmlFor="min-score"
            >
              Min score:
            </label>
            <input
              className="w-20 rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
              id="min-score"
              max={10}
              min={0}
              placeholder="Any"
              type="number"
              value={minScore}
              onChange={(e) => {
                const v = e.target.value;
                setMinScore(v === "" ? "" : parseFloat(v) || 0);
              }}
            />
          </div>
        )}

        {/* Similarity Threshold Control */}
        {query.trim() && !useKeywordSearch && (
          <Card className="mb-6 p-4">
            <label
              className="text-muted-foreground mb-2 block text-sm"
              htmlFor="similarity-threshold"
            >
              Similarity threshold: {similarityThreshold.toFixed(1)} (lower =
              more results, higher = more precise)
            </label>
            <input
              className="h-2 w-full appearance-none rounded-full bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
              id="similarity-threshold"
              max={1}
              min={0}
              step={0.1}
              type="range"
              value={similarityThreshold}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setSimilarityThreshold(v);
                updateUrlThreshold(v);
              }}
            />
            <div className="text-muted-foreground mt-1 flex justify-between text-xs">
              <span>0.0 (loose)</span>
              <span>0.5 (balanced)</span>
              <span>1.0 (strict)</span>
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive bg-destructive/10 mb-6 text-destructive text-sm">
            {error}
          </Card>
        )}

        {/* Results Count */}
        {!loading && query.trim() && total > 0 && (
          <p className="text-muted-foreground mb-4 text-sm">
            Found {total} {total === 1 ? "post" : "posts"}
          </p>
        )}

        {/* Empty State */}
        {!loading &&
          query.trim() &&
          debouncedQuery === query &&
          total === 0 &&
          !error && (
            <Card className="py-8 text-center">
              <Search
                aria-hidden
                className="text-muted mx-auto mb-2 h-10 w-10"
              />
              <p className="text-foreground mb-1 font-medium">No posts found</p>
              <p className="text-muted-foreground text-sm">
                Try different search terms or lower the similarity threshold.
              </p>
            </Card>
          )}

        {/* Initial State */}
        {!query.trim() && (
          <Card className="py-8 text-center">
            <Search
              aria-hidden
              className="text-muted mx-auto mb-2 h-10 w-10"
            />
            <p className="text-foreground mb-1 font-medium">
              Enter a search query to find similar posts
            </p>
            <p className="text-muted-foreground text-sm">
              Semantic search finds posts by meaning, not just exact words.
            </p>
          </Card>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((post) => (
              <PostCard
                key={post.id}
                isMarkingSaved={markingSaved.has(post.id)}
                post={post}
                onMarkSaved={handleMarkSaved}
                onMarkUsed={handleMarkUsed}
                onViewDetails={() => router.push(`/posts/${post.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-8">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-4 text-2xl font-semibold text-foreground">
              Search Posts
            </h1>
            <div className="h-96 animate-pulse rounded-card bg-surface" />
          </div>
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
