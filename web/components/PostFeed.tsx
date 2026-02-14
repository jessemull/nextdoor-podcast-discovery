"use client";

import { Filter, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import { useFeedKeyboardNav } from "@/lib/hooks/useFeedKeyboardNav";
import { useBulkActions } from "@/lib/hooks/useBulkActions";
import {
  DEFAULT_FILTERS,
  usePostFeedFilters,
} from "@/lib/hooks/usePostFeedFilters";
import { usePostFeedData } from "@/lib/hooks/usePostFeedData";
import type { BulkQuery } from "@/lib/hooks/useBulkActions";
import { POSTS_PER_PAGE } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card } from "./ui/Card";
import { CustomSelect } from "./ui/CustomSelect";
import { FeedSearchBar } from "./FeedSearchBar";
import { FilterSidebar } from "./FilterSidebar";
import { PostCard } from "./PostCard";

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
  const [bulkMode, setBulkMode] = useState(false);
  const [openFilterDrawer, setOpenFilterDrawer] = useState(false);
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

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

  const getCurrentQuery = useCallback((): BulkQuery => {
    const minScoreNum = parseFloat(debouncedMinScore);
    const minPodcastWorthy = parseFloat(debouncedMinPodcastWorthy);
    const minReactionCount = parseInt(debouncedMinReactionCount, 10);
    return {
      category: filters.category || undefined,
      ignored_only: filters.ignoredOnly,
      min_podcast_worthy:
        !isNaN(minPodcastWorthy) && minPodcastWorthy >= 0 && minPodcastWorthy <= 10
          ? minPodcastWorthy
          : undefined,
      min_reaction_count:
        !isNaN(minReactionCount) && minReactionCount >= 0
          ? minReactionCount
          : undefined,
      min_score:
        !isNaN(minScoreNum) && minScoreNum >= 0 ? minScoreNum : undefined,
      neighborhood_id: filters.neighborhoodId || undefined,
      order: filters.sortOrder,
      saved_only: filters.savedOnly,
      sort: filters.sort,
      unused_only: filters.unusedOnly,
    };
  }, [
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filters.category,
    filters.ignoredOnly,
    filters.neighborhoodId,
    filters.savedOnly,
    filters.sort,
    filters.sortOrder,
    filters.unusedOnly,
  ]);

  const {
    bulkActionLoading,
    handleBulkAction,
    handleMarkIgnored,
    handleMarkSaved,
    handleMarkUsed,
    markingIgnored,
    markingSaved,
    markingUsed,
    selectedIds,
    setSelectedIds,
    toggleSelect,
  } = useBulkActions({
    fetchPosts,
    getCurrentQuery,
    offset,
    setError,
  });

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

  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (el)
      el.indeterminate =
        selectedIds.size > 0 && selectedIds.size < posts.length;
  }, [selectedIds.size, posts.length]);

  useEffect(() => {
    if (selectedIds.size < posts.length) setSelectAllChecked(false);
  }, [selectedIds.size, posts.length]);

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
          onSimilarityThresholdChange={searchSlot?.onSimilarityThresholdChange}
          setFilters={setFilters}
          similarityThreshold={searchSlot?.similarityThreshold}
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
              onSimilarityThresholdChange={searchSlot?.onSimilarityThresholdChange}
              setFilters={setFilters}
              similarityThreshold={searchSlot?.similarityThreshold}
            />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4 pt-4 pr-4 sm:pb-6 sm:pt-6 sm:pr-6">
        {searchSlot && (
          <div className="mb-2 flex w-full items-stretch">
            <div className="mr-3 flex h-10 min-w-0 max-w-full flex-1">
              <FeedSearchBar
                embeddingBacklog={searchSlot.embeddingBacklog}
                loadDefaultsError={searchSlot.loadDefaultsError}
                loading={searchSlot.loading}
                onQueryChange={searchSlot.onQueryChange}
                onSearch={searchSlot.onSearch}
                onUseKeywordSearchChange={searchSlot.onUseKeywordSearchChange}
                query={searchSlot.query}
                useKeywordSearch={searchSlot.useKeywordSearch}
              />
            </div>
            <div className="flex h-10 min-w-0 shrink-0 items-center">
              <button
                className="border-border bg-surface hover:bg-surface-hover flex h-10 items-center gap-2 rounded border px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
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
              <CustomSelect
                ariaLabel="Sort Posts"
                className="h-10 min-w-[11rem] shrink-0"
                onChange={(val) => {
                  const opt = SORT_OPTIONS[Number(val)];
                  if (opt) {
                    setFilters((prev) => ({
                      ...prev,
                      sort: opt.sort,
                      sortOrder: opt.sortOrder,
                    }));
                  }
                }}
                options={SORT_OPTIONS.map((o, i) => ({
                  label: o.label,
                  value: String(i),
                }))}
                value={String(SORT_OPTIONS.indexOf(currentSortOption))}
              />
              {bulkMode ? (
                <div className="ml-3 flex items-center gap-3">
                  <CustomSelect
                    ariaLabel="Bulk action"
                    className="h-10 min-w-[11rem] shrink-0"
                    onChange={async (val) => {
                      if (!val) return;
                      const action = val as "ignore" | "mark_used" | "save" | "unignore";
                      await handleBulkAction(action, {
                        applyToQuery: selectAllChecked,
                      });
                      setBulkMode(false);
                      setSelectAllChecked(false);
                    }}
                    options={[
                      { label: "Ignore", value: "ignore" },
                      { label: "Mark as used", value: "mark_used" },
                      { label: "Save", value: "save" },
                      { label: "Unignore", value: "unignore" },
                    ]}
                    placeholder="Actions"
                    value=""
                  />
                  <button
                    className="text-foreground hover:opacity-80 flex h-10 w-28 shrink-0 items-center justify-center rounded-card border border-border bg-transparent text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => {
                      setBulkMode(false);
                      setSelectAllChecked(false);
                      setSelectedIds(new Set());
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="text-foreground hover:opacity-80 ml-3 flex h-10 w-28 shrink-0 items-center justify-center rounded-card border border-border bg-transparent text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                  type="button"
                  onClick={() => setBulkMode(true)}
                >
                  Bulk Actions
                </button>
              )}
              {(searchSlot.query.trim() || activeFilterCount > 0) && (
                <button
                  aria-label="Reset filters"
                  className="text-foreground hover:opacity-80 flex h-10 min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                  type="button"
                  onClick={() => {
                    handleResetFilters();
                    searchSlot.onResetAll?.();
                  }}
                >
                  <RotateCcw className="h-5 w-5" />
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
                  <CustomSelect
                    ariaLabel="Sort Posts"
                    className="h-10 min-w-[11rem]"
                    onChange={(val) => {
                      const opt = SORT_OPTIONS[Number(val)];
                      if (opt) {
                        setFilters((prev) => ({
                          ...prev,
                          sort: opt.sort,
                          sortOrder: opt.sortOrder,
                        }));
                      }
                    }}
                    options={SORT_OPTIONS.map((o, i) => ({
                      label: o.label,
                      value: String(i),
                    }))}
                    value={String(SORT_OPTIONS.indexOf(currentSortOption))}
                  />
                  <button
                    aria-label="Reset filters"
                    className="text-foreground hover:opacity-80 flex h-10 min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={handleResetFilters}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Showing {posts.length} of {total} Posts
          </span>
          {bulkMode && (
            <label className="flex cursor-pointer items-center gap-2 pr-4">
              <span className="text-muted-foreground text-sm">
                Select All
              </span>
              <input
                aria-label="Select All"
                checked={selectedIds.size === posts.length && posts.length > 0}
                className="rounded border-border bg-surface-hover"
                ref={selectAllCheckboxRef}
                type="checkbox"
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(new Set(posts.map((p) => p.id)));
                    setSelectAllChecked(true);
                  } else {
                    setSelectedIds(new Set());
                    setSelectAllChecked(false);
                  }
                }}
              />
            </label>
          )}
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
                    showCheckbox={bulkMode}
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
