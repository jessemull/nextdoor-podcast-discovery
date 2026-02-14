"use client";

import { Filter, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import {
  DEFAULT_FILTERS,
  usePostFeedFilters,
} from "@/lib/hooks/usePostFeedFilters";
import { useBulkActions } from "@/lib/hooks/useBulkActions";
import { useFeedKeyboardNav } from "@/lib/hooks/useFeedKeyboardNav";
import { usePostFeedData } from "@/lib/hooks/usePostFeedData";
import { formatCategoryLabel, POSTS_PER_PAGE } from "@/lib/utils";
import { cn } from "@/lib/utils";

import { BulkActionBar } from "./BulkActionBar";
import { FilterSidebar } from "./FilterSidebar";
import { PostCard } from "./PostCard";

const SORT_OPTIONS = [
  { label: "Score (high to low)", sort: "score" as const, sortOrder: "desc" as const },
  { label: "Score (low to high)", sort: "score" as const, sortOrder: "asc" as const },
  { label: "Podcast score (high to low)", sort: "podcast_score" as const, sortOrder: "desc" as const },
  { label: "Podcast score (low to high)", sort: "podcast_score" as const, sortOrder: "asc" as const },
  { label: "Newest first", sort: "date" as const, sortOrder: "desc" as const },
  { label: "Oldest first", sort: "date" as const, sortOrder: "asc" as const },
];

const QUICK_CATEGORIES = [
  "crime",
  "drama",
  "humor",
  "lost_pet",
  "wildlife",
] as const;

/**
 * PostFeed displays a list of Nextdoor posts with filtering and infinite scroll.
 * Layout: side panel (filters) + main (sort, chips, feed). Mobile: Filters drawer.
 */
export function PostFeed() {
  const router = useRouter();
  const [openFilterDrawer, setOpenFilterDrawer] = useState(false);

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

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  const activeFilterCount = [
    filters.category,
    filters.ignoredOnly,
    filters.minPodcastWorthy,
    filters.minReactionCount,
    filters.minScore,
    filters.maxScore,
    filters.maxPodcastWorthy,
    filters.maxReactionCount,
    filters.neighborhoodId,
    filters.savedOnly,
    filters.unusedOnly,
  ].filter((v) => v !== "" && v !== false).length;

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

  const chipBase =
    "rounded border px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus";
  const chipInactive =
    "border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground";
  const chipActive = "border-border bg-surface-hover text-foreground";

  const currentSortOption =
    SORT_OPTIONS.find(
      (o) => o.sort === filters.sort && o.sortOrder === filters.sortOrder
    ) ?? SORT_OPTIONS[0];

  return (
    <div className="flex gap-6">
      {/* Desktop sidebar */}
      <div className="hidden w-64 shrink-0 md:block">
        <FilterSidebar
          filterLoadError={filterLoadError}
          filters={filters}
          neighborhoods={neighborhoods}
          onReset={handleResetFilters}
          setFilters={setFilters}
        />
      </div>

      {/* Mobile drawer */}
      {openFilterDrawer && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setOpenFilterDrawer(false)}
          />
          <div className="border-border bg-surface fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto border-r p-4 shadow-lg md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-foreground text-lg font-semibold">Filters</h2>
              <button
                aria-label="Close filters"
                className="rounded p-1 text-muted hover:bg-surface-hover hover:text-foreground focus:outline-none focus:ring-2 focus:ring-border-focus"
                type="button"
                onClick={() => setOpenFilterDrawer(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <FilterSidebar
              filterLoadError={filterLoadError}
              filters={filters}
              neighborhoods={neighborhoods}
              onReset={() => {
                handleResetFilters();
                setOpenFilterDrawer(false);
              }}
              setFilters={setFilters}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Toolbar: mobile Filters button, sort, reset */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              className="border-border bg-surface hover:bg-surface-hover flex items-center gap-2 rounded border px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
              type="button"
              onClick={() => setOpenFilterDrawer(true)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-border text-foreground rounded-full px-1.5 py-0.5 text-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <select
              aria-label="Sort posts"
              className="rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-2"
              value={SORT_OPTIONS.indexOf(currentSortOption)}
              onChange={(e) => {
                const opt = SORT_OPTIONS[Number(e.target.value)];
                if (opt) {
                  setFilters((prev) => ({
                    ...prev,
                    sort: opt.sort,
                    sortOrder: opt.sortOrder,
                  }));
                }
              }}
            >
              {SORT_OPTIONS.map((opt, i) => (
                <option key={opt.label} value={i}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              className="text-muted-foreground hover:text-foreground text-sm underline focus:outline-none focus:ring-2 focus:ring-border-focus"
              type="button"
              onClick={handleResetFilters}
            >
              Reset filters
            </button>
          </div>
        </div>

        {/* Quick filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground self-center text-xs">
            Status:
          </span>
          <button
            className={cn(chipBase, filters.savedOnly ? chipActive : chipInactive)}
            type="button"
            onClick={() =>
              setFilters((prev) => ({ ...prev, savedOnly: !prev.savedOnly }))
            }
          >
            Saved
          </button>
          <button
            className={cn(
              chipBase,
              filters.ignoredOnly ? chipActive : chipInactive
            )}
            type="button"
            onClick={() =>
              setFilters((prev) => ({ ...prev, ignoredOnly: !prev.ignoredOnly }))
            }
          >
            Ignored
          </button>
          <button
            className={cn(
              chipBase,
              filters.unusedOnly ? chipActive : chipInactive
            )}
            type="button"
            onClick={() =>
              setFilters((prev) => ({ ...prev, unusedOnly: !prev.unusedOnly }))
            }
          >
            Unused
          </button>
          <span className="text-muted-foreground ml-2 self-center text-xs">
            Topic:
          </span>
          {QUICK_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={cn(
                chipBase,
                filters.category === cat ? chipActive : chipInactive
              )}
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  category: prev.category === cat ? "" : cat,
                }))
              }
            >
              {formatCategoryLabel(cat)}
            </button>
          ))}
        </div>

        <BulkActionBar
          bulkActionLoading={bulkActionLoading}
          selectedCount={selectedIds.size}
          onBulkIgnore={handleBulkIgnore}
          onBulkMarkUsed={handleBulkMarkUsed}
          onBulkSave={handleBulkSave}
          onBulkUnignore={handleBulkUnignore}
          onClear={() => setSelectedIds(new Set())}
        />

        <div className="text-muted-foreground text-sm">
          Showing {posts.length} of {total} posts
        </div>

        {error && (
          <div className="rounded-card border border-destructive bg-destructive/10 p-4 text-destructive">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button
                className="border-border bg-surface hover:bg-surface-hover ml-4 rounded border px-3 py-1 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
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
            <div
              aria-hidden
              className="border-border-focus h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            />
          </div>
        )}

        {!initialLoading && posts.length === 0 && (
          <div className="rounded-card border border-border bg-surface p-8 text-center">
            <p className="text-muted">No posts found</p>
            <p className="text-muted-foreground mt-2 text-sm">
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
                  className={
                    focusedIndex === index
                      ? "rounded-card ring-2 ring-border-focus"
                      : ""
                  }
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
                  <div
                    aria-hidden
                    className="border-border-focus h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                  />
                )}
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="text-muted-foreground py-4 text-center text-sm">
                No more posts to load
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
