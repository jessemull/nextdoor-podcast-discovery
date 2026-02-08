"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import { useFeedKeyboardNav } from "@/lib/hooks/useFeedKeyboardNav";
import { usePostFeedFilters } from "@/lib/hooks/usePostFeedFilters";
import { POSTS_PER_PAGE } from "@/lib/utils";

import { BulkActionBar } from "./BulkActionBar";
import { FeedFilters } from "./FeedFilters";
import { PostCard } from "./PostCard";

import type { PostsResponse, PostWithScores } from "@/lib/types";

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
  const router = useRouter();
  const {
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    episodeDates,
    filterLoadError,
    filters,
    neighborhoods,
    setFilters,
  } = usePostFeedFilters(DEBOUNCE_DELAY_MS);
  const [error, setError] = useState<null | string>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posts, setPosts] = useState<PostWithScores[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [episodeDateForUse, setEpisodeDateForUse] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [showRefineFilters, setShowRefineFilters] = useState(true);

  const {
    focusedIndex,
    postRefs,
    sentinelRef,
  } = useFeedKeyboardNav({
    onOpenPost: (postId) => router.push(`/posts/${postId}`),
    posts,
  });

  const toggleSelect = useCallback((postId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(postId);
      else next.delete(postId);
      return next;
    });
  }, []);

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
        if (filters.episodeDate) params.set("episode_date", filters.episodeDate);
        if (filters.neighborhoodId) params.set("neighborhood_id", filters.neighborhoodId);
        if (filters.savedOnly) params.set("saved_only", "true");

        // Validate and parse minScore
        if (debouncedMinScore) {
          const minScoreNum = parseFloat(debouncedMinScore);
          if (!isNaN(minScoreNum) && minScoreNum >= 0) {
            params.set("min_score", String(minScoreNum));
          }
        }

        // Validate and parse minPodcastWorthy
        if (debouncedMinPodcastWorthy) {
          const minPw = parseFloat(debouncedMinPodcastWorthy);
          if (!isNaN(minPw) && minPw >= 0 && minPw <= 10) {
            params.set("min_podcast_worthy", String(minPw));
          }
        }

        // Validate and parse minReactionCount (integer >= 0)
        if (debouncedMinReactionCount) {
          const minReaction = parseInt(debouncedMinReactionCount, 10);
          if (!isNaN(minReaction) && minReaction >= 0) {
            params.set("min_reaction_count", String(minReaction));
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
    [
      debouncedMinPodcastWorthy,
      debouncedMinReactionCount,
      debouncedMinScore,
      filters.category,
      filters.episodeDate,
      filters.neighborhoodId,
      filters.savedOnly,
      filters.sort,
      filters.unusedOnly,
    ]
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
  }, [fetchPosts, loadingMore, initialLoading, offset, sentinelRef, total]);

  const handleMarkSaved = async (postId: string, saved: boolean) => {
    if (markingSaved.has(postId)) return;
    setMarkingSaved((prev) => new Set(prev).add(postId));
    try {
      const response = await fetch(`/api/posts/${postId}/saved`, {
        body: JSON.stringify({ saved }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save post");
      }
      fetchPosts(offset);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update post";
      setError(errorMessage);
    } finally {
      setMarkingSaved((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleMarkUsed = async (postId: string) => {
    if (markingUsed.has(postId)) return; // Prevent double-clicks

    setMarkingUsed((prev) => new Set(prev).add(postId));

    try {
      const response = await fetch(`/api/posts/${postId}/used`, {
        body: JSON.stringify({
          episode_date: episodeDateForUse,
          used: true,
        }),
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

  const handleBulkMarkUsed = useCallback(async () => {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/posts/${id}/used`, {
            body: JSON.stringify({
              episode_date: episodeDateForUse,
              used: true,
            }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          })
        )
      );
      setSelectedIds(new Set());
      fetchPosts(offset);
    } catch (err) {
      console.error("Bulk mark used failed:", err);
      setError("Failed to mark some posts as used");
    } finally {
      setBulkActionLoading(false);
    }
  }, [bulkActionLoading, episodeDateForUse, fetchPosts, offset, selectedIds]);

  const handleBulkSave = useCallback(async () => {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/posts/${id}/saved`, {
            body: JSON.stringify({ saved: true }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          })
        )
      );
      setSelectedIds(new Set());
      fetchPosts(offset);
    } catch (err) {
      console.error("Bulk save failed:", err);
      setError("Failed to save some posts");
    } finally {
      setBulkActionLoading(false);
    }
  }, [bulkActionLoading, fetchPosts, offset, selectedIds]);

  const hasMore = offset + POSTS_PER_PAGE < total;

  return (
    <div className="space-y-6">
      <FeedFilters
        episodeDates={episodeDates}
        filterLoadError={filterLoadError}
        filters={filters}
        neighborhoods={neighborhoods}
        setFilters={setFilters}
        setShowRefineFilters={setShowRefineFilters}
        showRefineFilters={showRefineFilters}
      />

      <BulkActionBar
        bulkActionLoading={bulkActionLoading}
        episodeDateForUse={episodeDateForUse}
        selectedCount={selectedIds.size}
        setEpisodeDateForUse={setEpisodeDateForUse}
        onBulkMarkUsed={handleBulkMarkUsed}
        onBulkSave={handleBulkSave}
        onClear={() => setSelectedIds(new Set())}
      />

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
            {posts.map((post, index) => (
              <div
                key={post.id}
                className={focusedIndex === index ? "ring-2 ring-yellow-500 rounded-lg" : ""}
                ref={(el) => {
                  postRefs.current[index] = el;
                }}
              >
                <PostCard
                  isMarkingSaved={markingSaved.has(post.id)}
                  isMarkingUsed={markingUsed.has(post.id)}
                  post={post}
                  selected={selectedIds.has(post.id)}
                  showCheckbox
                  onMarkSaved={handleMarkSaved}
                  onMarkUsed={handleMarkUsed}
                  onSelect={toggleSelect}
                  onViewDetails={() => router.push(`/posts/${post.id}`)}
                />
              </div>
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div
              className="flex justify-center py-4"
              data-testid="infinite-scroll-sentinel"
              ref={sentinelRef}
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
