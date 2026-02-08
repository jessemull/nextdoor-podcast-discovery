"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import { useDebounce } from "@/lib/hooks";

import type { PostWithScores } from "@/lib/types";

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

  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY_MS);

  // Load default similarity threshold from settings on mount
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data: SettingsResponse = await response.json();
          if (
            data.data.search_defaults?.similarity_threshold !== undefined &&
            typeof data.data.search_defaults.similarity_threshold === "number"
          ) {
            setSimilarityThreshold(data.data.search_defaults.similarity_threshold);
          }
        } else {
          setLoadDefaultsError("Failed to load search defaults. Using default threshold.");
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
  }, []);

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

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Search Posts</h1>
        <p className="text-gray-400 mb-8">
          Find similar posts using semantic search. Search by meaning, not just
          keywords.
        </p>

        {/* Load Defaults Error */}
        {loadDefaultsError && (
          <div className="mb-6 rounded-lg border border-yellow-800 bg-yellow-900/20 p-4">
            <p className="text-yellow-400 text-sm">{loadDefaultsError}</p>
          </div>
        )}

        {/* Search Input */}
        <div className="mb-6">
          <input
            aria-label="Search posts"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., noisy neighbors, lost pet, suspicious activity..."
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <p className="text-sm text-gray-500 mt-2">Searching...</p>
          )}
        </div>

        {/* Search mode toggle */}
        <div className="mb-4 flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              checked={useKeywordSearch}
              className="rounded border-gray-600 bg-gray-700"
              type="checkbox"
              onChange={(e) => setUseKeywordSearch(e.target.checked)}
            />
            <span className="text-sm text-gray-400">
              Keyword search (exact terms, no AI)
            </span>
          </label>
        </div>

        {/* Min score filter */}
        {query.trim() && (
          <div className="mb-4 flex items-center gap-2">
            <label className="text-sm text-gray-400" htmlFor="min-score">
              Min score:
            </label>
            <input
              className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
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
          <div className="mb-6 bg-gray-800 rounded-lg p-4">
            <label
              className="block text-sm text-gray-400 mb-2"
              htmlFor="similarity-threshold"
            >
              Similarity Threshold: {similarityThreshold.toFixed(1)} (lower =
              more results, higher = more precise)
            </label>
            <input
              className="w-full"
              id="similarity-threshold"
              max={1}
              min={0}
              step={0.1}
              type="range"
              value={similarityThreshold}
              onChange={(e) =>
                setSimilarityThreshold(parseFloat(e.target.value))
              }
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.0 (loose)</span>
              <span>0.5 (balanced)</span>
              <span>1.0 (strict)</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results Count */}
        {!loading && query.trim() && total > 0 && (
          <p className="text-sm text-gray-400 mb-4">
            Found {total} {total === 1 ? "post" : "posts"}
          </p>
        )}

        {/* Empty State */}
        {!loading &&
          query.trim() &&
          debouncedQuery === query &&
          total === 0 &&
          !error && (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 mb-2">No posts found</p>
              <p className="text-sm text-gray-500">
                Try different search terms or lower the similarity threshold.
              </p>
            </div>
          )}

        {/* Initial State */}
        {!query.trim() && (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-2">
              Enter a search query to find similar posts
            </p>
            <p className="text-sm text-gray-500">
              Semantic search finds posts by meaning, not just exact words.
            </p>
          </div>
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
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-4">Search Posts</h1>
            <div className="h-96 animate-pulse rounded-lg bg-gray-800" />
          </div>
        </main>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
