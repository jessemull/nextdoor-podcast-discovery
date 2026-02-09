"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import { useBulkActions } from "@/lib/hooks/useBulkActions";
import { useFeedKeyboardNav } from "@/lib/hooks/useFeedKeyboardNav";
import { usePostFeedData } from "@/lib/hooks/usePostFeedData";
import { usePostFeedFilters } from "@/lib/hooks/usePostFeedFilters";
import { POSTS_PER_PAGE } from "@/lib/utils";

import { BulkActionBar } from "./BulkActionBar";
import { FeedFilters } from "./FeedFilters";
import { PostCard } from "./PostCard";

/**
 * PostFeed displays a list of Nextdoor posts with filtering and infinite scroll.
 *
 * Uses usePostFeedFilters (debounced filters), usePostFeedData (fetch + pagination),
 * useBulkActions (mark saved/used, bulk bar), and useFeedKeyboardNav (keyboard nav).
 */
export function PostFeed() {
  const router = useRouter();
  const [showRefineFilters, setShowRefineFilters] = useState(true);

  const {
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filterLoadError,
    filters,
    neighborhoods,
    setFilters,
  } = usePostFeedFilters(DEBOUNCE_DELAY_MS);

  const {
    error,
    fetchPosts,
    handleRetry,
    hasMore,
    initialLoading,
    loadingMore,
    offset,
    posts,
    setError,
    total,
  } = usePostFeedData({
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filters,
  });

  const {
    bulkActionLoading,
    handleBulkIgnore,
    handleBulkMarkUsed,
    handleBulkSave,
    handleBulkUnignore,
    handleMarkIgnored,
    handleMarkSaved,
    handleMarkUsed,
    markingIgnored,
    markingSaved,
    markingUsed,
    selectedIds,
    setSelectedIds,
    toggleSelect,
  } = useBulkActions({ fetchPosts, offset, setError });

  const {
    focusedIndex,
    postRefs,
    sentinelRef,
  } = useFeedKeyboardNav({
    onOpenPost: (postId) => router.push(`/posts/${postId}`),
    posts,
  });

  // Infinite scroll: load more when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (!hasMore || loadingMore || initialLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          const nextOffset = offset + POSTS_PER_PAGE;
          if (nextOffset < total) {
            void fetchPosts(nextOffset, true);
          }
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchPosts, hasMore, initialLoading, loadingMore, offset, sentinelRef, total]);

  return (
    <div className="space-y-6">
      <FeedFilters
        filterLoadError={filterLoadError}
        filters={filters}
        neighborhoods={neighborhoods}
        setFilters={setFilters}
        setShowRefineFilters={setShowRefineFilters}
        showRefineFilters={showRefineFilters}
      />

      <BulkActionBar
        bulkActionLoading={bulkActionLoading}
        onBulkIgnore={handleBulkIgnore}
        onBulkMarkUsed={handleBulkMarkUsed}
        onBulkSave={handleBulkSave}
        onBulkUnignore={handleBulkUnignore}
        onClear={() => setSelectedIds(new Set())}
        selectedCount={selectedIds.size}
      />

      <div className="text-sm text-gray-500">
        Showing {posts.length} of {total} posts
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/50 p-4 text-red-200">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              className="ml-4 rounded bg-red-800 px-3 py-1 text-sm transition-colors hover:bg-red-700"
              type="button"
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {initialLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-yellow-500" />
        </div>
      )}

      {!initialLoading && posts.length === 0 && (
        <div className="rounded-lg bg-gray-800 p-8 text-center">
          <p className="text-gray-400">No posts found</p>
          <p className="mt-2 text-sm text-gray-500">
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
                className={focusedIndex === index ? "rounded-lg ring-2 ring-yellow-500" : ""}
                ref={(el) => {
                  postRefs.current[index] = el;
                }}
              >
                <PostCard
                  isMarkingIgnored={markingIgnored.has(post.id)}
                  isMarkingSaved={markingSaved.has(post.id)}
                  isMarkingUsed={markingUsed.has(post.id)}
                  post={post}
                  selected={selectedIds.has(post.id)}
                  showCheckbox
                  onMarkIgnored={handleMarkIgnored}
                  onMarkSaved={handleMarkSaved}
                  onMarkUsed={handleMarkUsed}
                  onSelect={toggleSelect}
                  onViewDetails={() => router.push(`/posts/${post.id}`)}
                />
              </div>
            ))}
          </div>

          {hasMore && (
            <div
              className="flex justify-center py-4"
              data-testid="infinite-scroll-sentinel"
              ref={sentinelRef}
            >
              {loadingMore && (
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-yellow-500" />
              )}
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <div className="py-4 text-center text-sm text-gray-500">
              No more posts to load
            </div>
          )}
        </>
      )}
    </div>
  );
}
