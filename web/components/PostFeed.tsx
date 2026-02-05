"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEBOUNCE_DELAY_MS, TOPIC_CATEGORIES } from "@/lib/constants";
import { useDebounce } from "@/lib/hooks";
import { POSTS_PER_PAGE } from "@/lib/utils";

import { PostCard } from "./PostCard";

import type { PostsResponse, PostWithScores } from "@/lib/types";

type SortOption = "date" | "score";

interface Filters {
  category: string;
  minScore: string;
  sort: SortOption;
  unusedOnly: boolean;
}

/**
 * PostFeed component displays a list of Nextdoor posts with filtering and infinite scroll.
 *
 * Features:
 * - Sort by score or date
 * - Filter by category, minimum score, and unused status
 * - Infinite scroll pagination
 * - Retry logic for failed requests
 * - Debounced filter inputs to reduce API calls
 *
 * @example
 * ```tsx
 * <PostFeed />
 * ```
 */
export function PostFeed() {
  const [error, setError] = useState<null | string>(null);
  const [filters, setFilters] = useState<Filters>({
    category: "",
    minScore: "",
    sort: "score",
    unusedOnly: false,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posts, setPosts] = useState<PostWithScores[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce minScore to avoid excessive API calls
  const debouncedMinScore = useDebounce(filters.minScore, DEBOUNCE_DELAY_MS);

  const fetchPosts = useCallback(
    async (currentOffset = 0, append = false) => {
      // Only show initial loading on first load
      if (currentOffset === 0 && !append) {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", String(POSTS_PER_PAGE));
        params.set("offset", String(currentOffset));
        params.set("sort", filters.sort);

        if (filters.category) params.set("category", filters.category);

        // Validate and parse minScore
        if (debouncedMinScore) {
          const minScoreNum = parseFloat(debouncedMinScore);
          if (!isNaN(minScoreNum) && minScoreNum >= 0) {
            params.set("min_score", String(minScoreNum));
          }
        }

        if (filters.unusedOnly) params.set("unused_only", "true");

        const response = await fetch(`/api/posts?${params.toString()}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch posts");
        }

        const data: PostsResponse = await response.json();
        setPosts((prev) => (append ? [...prev, ...data.data] : data.data));
        setTotal(data.total);
        setOffset(currentOffset);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        console.error("Failed to fetch posts:", err);
        setError(errorMessage);
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedMinScore, filters.category, filters.sort, filters.unusedOnly]
  );

  useEffect(() => {
    fetchPosts(0, false); // Reset posts when filters change
  }, [fetchPosts]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const hasMore = offset + POSTS_PER_PAGE < total;
    if (!hasMore || loadingMore || initialLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          const nextOffset = offset + POSTS_PER_PAGE;
          if (nextOffset < total) {
            fetchPosts(nextOffset, true);
          }
        }
      },
      {
        rootMargin: "200px", // Start loading 200px before reaching bottom
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchPosts, loadingMore, initialLoading, offset, total]);

  const handleMarkUsed = async (postId: string) => {
    if (markingUsed.has(postId)) return; // Prevent double-clicks

    setMarkingUsed((prev) => new Set(prev).add(postId));

    try {
      const response = await fetch(`/api/posts/${postId}/used`, {
        body: JSON.stringify({ used: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to mark post as used");
      }

      // Refresh the list
      fetchPosts(offset);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update post";
      console.error("Failed to mark post as used:", err);
      setError(errorMessage);
    } finally {
      setMarkingUsed((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleRetry = () => {
    fetchPosts(0, false); // Reset to first page on retry
  };

  const hasMore = offset + POSTS_PER_PAGE < total;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400" htmlFor="sort">Sort:</label>
            <select
              className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
              id="sort"
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortOption })}
            >
              <option value="score">Highest Score</option>
              <option value="date">Most Recent</option>
            </select>
          </div>
          {/* Category */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400" htmlFor="category">Category:</label>
            <select
              className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
              id="category"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All</option>
              {TOPIC_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          {/* Min Score */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400" htmlFor="minScore">Min Score:</label>
            <input
              className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600 w-16"
              id="minScore"
              min="0"
              placeholder="0"
              type="number"
              value={filters.minScore}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow valid numbers or empty string
                if (value === "" || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                  setFilters({ ...filters, minScore: value });
                }
              }}
            />
          </div>
          {/* Unused Only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              checked={filters.unusedOnly}
              className="rounded bg-gray-700 border-gray-600"
              type="checkbox"
              onChange={(e) => setFilters({ ...filters, unusedOnly: e.target.checked })}
            />
            <span className="text-sm text-gray-400">Unused only</span>
          </label>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        Showing {posts.length} of {total} posts
      </div>

      {/* Error with retry */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              className="ml-4 px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm transition-colors"
              type="button"
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Initial Loading */}
      {initialLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
        </div>
      )}

      {/* Posts */}
      {!initialLoading && posts.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No posts found</p>
          <p className="text-sm text-gray-500 mt-2">
            Try adjusting your filters or run the scraper to collect posts.
          </p>
        </div>
      )}

      {!initialLoading && posts.length > 0 && (
        <>
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                isMarkingUsed={markingUsed.has(post.id)}
                post={post}
                onMarkUsed={handleMarkUsed}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex justify-center py-4"
              data-testid="infinite-scroll-sentinel"
            >
              {loadingMore && (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500" />
              )}
            </div>
          )}

          {/* End of results */}
          {!hasMore && posts.length > 0 && (
            <div className="text-center text-sm text-gray-500 py-4">
              No more posts to load
            </div>
          )}
        </>
      )}
    </div>
  );
}
