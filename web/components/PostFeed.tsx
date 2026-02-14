"use client";

import { Filter, RotateCcw, X } from "lucide-react";
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
import { POSTS_PER_PAGE } from "@/lib/utils";
import { cn } from "@/lib/utils";

import { BulkActionBar } from "./BulkActionBar";
import { FeedSearchBar } from "./FeedSearchBar";
import { FilterSidebar } from "./FilterSidebar";
import { PostCard } from "./PostCard";
import { Card } from "./ui/Card";

import type { PostWithScores } from "@/lib/types";

export interface PostFeedSearchSlotProps {
  debouncedQuery: string;
  embeddingBacklog: number;
  loadDefaultsError: null | string;
  loading: boolean;
  markingSaved: Set<string>;
  onMarkSaved: (postId: string) => void;
  onMarkUsed: (postId: string) => void;
  onQueryChange: (value: string) => void;
  onResetAll?: () => void;
  onSearch: () => void;
  onSimilarityThresholdChange: (value: number) => void;
  onUseKeywordSearchChange: (value: boolean) => void;
  onViewDetails: (postId: string) => void;
  query: string;
  results: PostWithScores[];
  searchError: null | string;
  searchTotal: number;
  similarityThreshold: number;
  useKeywordSearch: boolean;
}

const SORT_OPTIONS = [
  { label: "Score (High to Low)", sort: "score" as const, sortOrder: "desc" as const },
  { label: "Score (Low to High)", sort: "score" as const, sortOrder: "asc" as const },
  { label: "Podcast Score (High to Low)", sort: "podcast_score" as const, sortOrder: "desc" as const },
  { label: "Podcast Score (Low to High)", sort: "podcast_score" as const, sortOrder: "asc" as const },
  { label: "Newest First", sort: "date" as const, sortOrder: "desc" as const },
  { label: "Oldest First", sort: "date" as const, sortOrder: "asc" as const },
];

/**
 * PostFeed displays a list of Nextdoor posts with filtering and infinite scroll.
 * Layout: side panel (filters) + main (optional search bar, then sort/chips/feed or search results).
 * When searchSlot is provided, the search bar is the first element in the main column; search results or feed follow.
 */
export function PostFeed({
  searchSlot = null,
}: {
  searchSlot?: null | PostFeedSearchSlotProps;
} = {}) {
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

  const currentSortOption =
    SORT_OPTIONS.find(
      (o) => o.sort === filters.sort && o.sortOrder === filters.sortOrder
    ) ?? SORT_OPTIONS[0];

  return (
    <div className="flex min-h-0 flex-1 gap-4 sm:gap-6">
      {/* Desktop sidebar */}
      <div className="hidden h-full w-64 shrink-0 md:block">
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4 pt-4 pr-4 sm:pb-6 sm:pt-6 sm:pr-6">
        {searchSlot && (
          <div className="flex w-full items-stretch gap-2">
            <div className="flex h-9 min-w-0 max-w-full flex-1 overflow-hidden">
              <FeedSearchBar
                embeddingBacklog={searchSlot.embeddingBacklog}
                loadDefaultsError={searchSlot.loadDefaultsError}
                loading={searchSlot.loading}
                onQueryChange={searchSlot.onQueryChange}
                onSearch={searchSlot.onSearch}
                onSimilarityThresholdChange={searchSlot.onSimilarityThresholdChange}
                onUseKeywordSearchChange={searchSlot.onUseKeywordSearchChange}
                query={searchSlot.query}
                similarityThreshold={searchSlot.similarityThreshold}
                useKeywordSearch={searchSlot.useKeywordSearch}
              />
            </div>
            <div className="flex h-9 shrink-0 items-center gap-2">
              <button
                className="border-border bg-surface hover:bg-surface-hover flex h-9 items-center gap-2 rounded border px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
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
                aria-label="Sort Posts"
                className="select-caret h-9 min-w-[11rem] shrink-0 rounded-card border border-border bg-surface-hover py-0 pl-3 pr-10 text-sm leading-9 text-foreground focus:border-border-focus focus:outline-none focus:ring-2"
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
              {(searchSlot.query.trim() || activeFilterCount > 0) && (
                <button
                  aria-label="Reset filters"
                  className="text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                  type="button"
                  onClick={() => {
                    handleResetFilters();
                    searchSlot.onResetAll?.();
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {searchSlot && searchSlot.query.trim() ? (
          <div className="space-y-6">
            {searchSlot.searchError && (
              <Card className="border-destructive bg-destructive/10 text-destructive text-sm">
                {searchSlot.searchError}
              </Card>
            )}
            {!searchSlot.loading &&
              searchSlot.debouncedQuery === searchSlot.query &&
              searchSlot.query.trim() &&
              searchSlot.searchTotal > 0 && (
                <p className="text-muted-foreground text-sm">
                  Found {searchSlot.searchTotal}{" "}
                  {searchSlot.searchTotal === 1 ? "Post" : "Posts"}
                </p>
              )}
            {!searchSlot.loading &&
              searchSlot.query.trim() &&
              searchSlot.debouncedQuery === searchSlot.query &&
              searchSlot.searchTotal === 0 &&
              !searchSlot.searchError && (
                <Card className="py-8 text-center">
                  <p className="text-foreground mb-1 font-medium">
                    No Posts Found
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Try Different Search Terms or Lower the Similarity
                    Threshold.
                  </p>
                </Card>
              )}
            {searchSlot.results.length > 0 && (
              <div className="space-y-4">
                {searchSlot.results.map((post) => (
                  <PostCard
                    key={post.id}
                    isMarkingSaved={searchSlot.markingSaved.has(post.id)}
                    post={post}
                    onMarkSaved={() => searchSlot.onMarkSaved(post.id)}
                    onMarkUsed={() => searchSlot.onMarkUsed(post.id)}
                    onViewDetails={() => searchSlot.onViewDetails(post.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {!searchSlot && (
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
                    aria-label="Sort Posts"
                    className="select-caret h-9 min-w-[11rem] rounded-card border border-border bg-surface-hover py-0 pl-3 pr-10 text-sm leading-9 text-foreground focus:border-border-focus focus:outline-none focus:ring-2"
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
                    aria-label="Reset filters"
                    className="text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={handleResetFilters}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

        <div className="text-muted-foreground text-sm">
          Showing {posts.length} of {total} Posts
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
            <p className="text-muted">No Posts Found</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Try Adjusting Your Filters or Run the Scraper to Collect Posts.
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
                No More Posts to Load
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
