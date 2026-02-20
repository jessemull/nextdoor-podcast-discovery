"use client";

import {
  ArrowUpDown,
  Bookmark,
  Check,
  CheckSquare,
  Eye,
  EyeOff,
  Filter,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
import {
  type BulkActionType,
  type BulkQuery,
  useBulkActions,
} from "@/lib/hooks/useBulkActions";
import { useFeedKeyboardNav } from "@/lib/hooks/useFeedKeyboardNav";
import { usePermalinkJobs } from "@/lib/hooks/usePermalinkJobs";
import { usePostFeedData } from "@/lib/hooks/usePostFeedData";
import {
  DEFAULT_FILTERS,
  usePostFeedFilters,
} from "@/lib/hooks/usePostFeedFilters";
import { useWeightConfigs } from "@/lib/hooks/useWeightConfigs";
import { useToast } from "@/lib/ToastContext";
import { POSTS_PER_PAGE } from "@/lib/utils";
import { cn } from "@/lib/utils";

import { FeedSearchBar } from "./FeedSearchBar";
import { FilterSidebar } from "./FilterSidebar";
import { PostCard } from "./PostCard";
import { PostCardSkeleton } from "./PostCardSkeleton";
import { Card } from "./ui/Card";
import { ConfirmModal } from "./ui/ConfirmModal";
import { CustomSelect } from "./ui/CustomSelect";

import type { PostWithScores } from "@/lib/types";

export interface PostFeedSearchSlotProps {
  debouncedQuery: string;
  embeddingBacklog: number;
  loadDefaultsError: null | string;
  loading: boolean;
  markingSaved: Set<string>;
  onMarkSaved: (postId: string, saved: boolean) => void;
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

const BULK_ACTION_LABELS: Record<BulkActionType, string> = {
  ignore: "Ignore",
  mark_used: "Mark As Used",
  reprocess: "Refresh Posts",
  save: "Save",
  unignore: "Unignore",
};

const BULK_ACTION_SUCCESS: Record<BulkActionType, string> = {
  ignore: "Ignored",
  mark_used: "Marked as used",
  reprocess: "Queued for refresh",
  save: "Saved",
  unignore: "Unignored",
};

const BULK_ACTION_TITLES: Record<BulkActionType, string> = {
  ignore: "Ignore Posts",
  mark_used: "Mark Posts As Used",
  reprocess: "Refresh Posts",
  save: "Save Posts",
  unignore: "Unignore Posts",
};

const BULK_ACTION_OPTIONS = [
  { icon: <EyeOff aria-hidden className="h-4 w-4" />, label: "Ignore", value: "ignore" },
  {
    icon: <Check aria-hidden className="h-4 w-4" />,
    label: "Mark As Used",
    value: "mark_used",
  },
  {
    icon: <RefreshCw aria-hidden className="h-4 w-4" />,
    label: "Refresh Posts",
    value: "reprocess",
  },
  { icon: <Bookmark aria-hidden className="h-4 w-4" />, label: "Save", value: "save" },
  {
    icon: <Eye aria-hidden className="h-4 w-4" />,
    label: "Unignore",
    value: "unignore",
  },
].sort((a, b) => a.label.localeCompare(b.label));

const SKELETON_CARD_COUNT = 8;

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
export interface PicksDefaultsForFeed {
  picks_limit: number;
  picks_min: number;
  picks_min_podcast?: number;
}

export function PostFeed({
  picksDefaults = null,
  searchSlot = null,
}: {
  picksDefaults?: null | PicksDefaultsForFeed;
  searchSlot?: null | PostFeedSearchSlotProps;
} = {}) {
  const router = useRouter();
  const [bulkMode, setBulkMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    action: BulkActionType;
    count?: number;
  } | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [openFilterDrawer, setOpenFilterDrawer] = useState(false);
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [searchTypeMenuOpen, setSearchTypeMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const searchTypeMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchTypeMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchTypeMenuRef.current &&
        !searchTypeMenuRef.current.contains(e.target as Node)
      ) {
        setSearchTypeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchTypeMenuOpen]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(e.target as Node)
      ) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sortMenuOpen]);

  useEffect(() => {
    if (!openFilterDrawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openFilterDrawer]);

  const { activeConfigId, weightConfigs } = useWeightConfigs();
  const activeConfigWeights =
    weightConfigs.find((c) => c.id === activeConfigId)?.weights ?? null;
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
  const { toast } = useToast();
  const {
    getActiveJobForPost,
    getQueueStatusForPost,
    refetch: refetchPermalinkJobs,
  } = usePermalinkJobs();
  const [cancellingJobId, setCancellingJobId] = useState<null | string>(null);
  const [queuingRefreshPostId, setQueuingRefreshPostId] = useState<null | string>(null);

  const handleCancelRefresh = useCallback(
    async (jobId: string) => {
      if (cancellingJobId != null) return;
      setCancellingJobId(jobId);
      try {
        const response = await fetch(`/api/admin/jobs/${jobId}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || data.details || "Failed to remove");
        }
        await refetchPermalinkJobs();
        toast.success("Removed from queue.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove from queue"
        );
      } finally {
        setCancellingJobId(null);
      }
    },
    [cancellingJobId, refetchPermalinkJobs, toast]
  );

  const handleQueueRefresh = useCallback(
    async (postId: string) => {
      const post =
        posts.find((p) => p.id === postId) ??
        searchSlot?.results?.find((p) => p.id === postId);
      if (!post?.url || queuingRefreshPostId != null) return;
      setQueuingRefreshPostId(postId);
      try {
        const response = await fetch("/api/admin/permalink-queue", {
          body: JSON.stringify({ post_id: postId, url: post.url }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || data.details || "Failed to queue refresh");
        }
        toast.success("Added to queue successfully.");
        refetchPermalinkJobs();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to queue refresh"
        );
      } finally {
        setQueuingRefreshPostId(null);
      }
    },
    [posts, queuingRefreshPostId, refetchPermalinkJobs, searchSlot?.results, toast]
  );

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
    filters.preview,
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
          activeConfigWeights={
            activeConfigWeights as null | Record<string, number>
          }
          filterLoadError={filterLoadError}
          filters={filters}
          neighborhoods={neighborhoods}
          picksDefaults={picksDefaults}
          setFilters={setFilters}
          similarityThreshold={searchSlot?.similarityThreshold}
          onReset={handleResetFilters}
          onSimilarityThresholdChange={searchSlot?.onSimilarityThresholdChange}
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
          <div className="border-border bg-surface fixed left-0 top-0 z-50 flex h-full w-full flex-col overflow-hidden border-r shadow-lg sm:w-72 sm:max-w-[85vw] md:hidden">
            <div className="flex shrink-0 items-center justify-between p-3">
              <div className="flex min-h-[44px] flex-1 items-center px-4 py-2">
                <h2 className="text-foreground text-lg font-semibold">
                  Filters
                </h2>
              </div>
              <button
                aria-label="Close filters"
                className="flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
                type="button"
                onClick={() => setOpenFilterDrawer(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div
              className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 touch-pan-y [-webkit-overflow-scrolling:touch]"
              role="region"
              aria-label="Filter options"
              style={{ minHeight: 0 }}
            >
              <FilterSidebar
                activeConfigWeights={
                  activeConfigWeights as null | Record<string, number>
                }
                filterLoadError={filterLoadError}
                filters={filters}
                hideTitle
                neighborhoods={neighborhoods}
                picksDefaults={picksDefaults}
                setFilters={setFilters}
                similarityThreshold={searchSlot?.similarityThreshold}
                onReset={() => {
                  handleResetFilters();
                  setOpenFilterDrawer(false);
                }}
                onSimilarityThresholdChange={searchSlot?.onSimilarityThresholdChange}
              />
            </div>
            <div className="border-border shrink-0 border-t p-3">
              <button
                className="border-border bg-surface-hover text-foreground w-full rounded border px-3 py-2 text-sm transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus"
                type="button"
                onClick={() => {
                  handleResetFilters();
                  setOpenFilterDrawer(false);
                }}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
        <h1 className="text-foreground mb-4 text-2xl font-semibold text-left sm:text-3xl">
          Nextdoor Discovery
        </h1>
        {searchSlot && (
          <>
            {/* Compact: below md – two rows, search type in "..." next to input */}
            <div className="mb-2 flex w-full flex-col gap-2.5 md:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1 shrink-0">
                  <FeedSearchBar
                    compact
                    embeddingBacklog={searchSlot.embeddingBacklog}
                    loadDefaultsError={searchSlot.loadDefaultsError}
                    loading={searchSlot.loading}
                    query={searchSlot.query}
                    useKeywordSearch={searchSlot.useKeywordSearch}
                    onQueryChange={searchSlot.onQueryChange}
                    onSearch={searchSlot.onSearch}
                    onUseKeywordSearchChange={searchSlot.onUseKeywordSearchChange}
                  />
                </div>
                <div className="relative shrink-0" ref={searchTypeMenuRef}>
                  <button
                    aria-expanded={searchTypeMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Search type"
                    className="border-border bg-surface-hover text-foreground flex h-10 min-h-[44px] min-w-10 items-center justify-center rounded border transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => setSearchTypeMenuOpen((o) => !o)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {searchTypeMenuOpen && (
                    <div
                      className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[8rem] rounded-card border py-1 shadow-lg"
                      role="menu"
                    >
                      <button
                        className={cn(
                          "flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus",
                          !searchSlot.useKeywordSearch && "bg-surface-hover font-medium"
                        )}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          searchSlot.onUseKeywordSearchChange(false);
                          setSearchTypeMenuOpen(false);
                        }}
                      >
                        AI Powered
                      </button>
                      <button
                        className={cn(
                          "flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus",
                          searchSlot.useKeywordSearch && "bg-surface-hover font-medium"
                        )}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          searchSlot.onUseKeywordSearchChange(true);
                          setSearchTypeMenuOpen(false);
                        }}
                      >
                        Keyword
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  aria-label="Filters"
                  className="border-border bg-surface-hover text-foreground hover:bg-surface relative flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                  type="button"
                  onClick={() => setOpenFilterDrawer(true)}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="bg-border text-foreground absolute -right-0.5 -top-0.5 rounded-full px-1.5 py-0.5 text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <div className="relative" ref={sortMenuRef}>
                  <button
                    aria-expanded={sortMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Sort"
                    className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => setSortMenuOpen((o) => !o)}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                  {sortMenuOpen && (
                    <div
                      className="border-border bg-surface absolute left-0 top-full z-10 mt-1 min-w-[12rem] rounded-card border py-1 shadow-lg"
                      role="menu"
                    >
                      {SORT_OPTIONS.map((o, i) => (
                        <button
                          key={o.label}
                          className={cn(
                            "flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus",
                            currentSortOption.sort === o.sort &&
                              currentSortOption.sortOrder === o.sortOrder &&
                              "bg-surface-hover font-medium"
                          )}
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setFilters((prev) => ({
                              ...prev,
                              sort: o.sort,
                              sortOrder: o.sortOrder,
                            }));
                            setSortMenuOpen(false);
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {bulkMode ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <CustomSelect
                      ariaLabel="Bulk action"
                      className="h-10 min-h-[44px] min-w-0 shrink sm:min-w-[11rem]"
                      disabled={!selectAllChecked && selectedIds.size === 0}
                      options={BULK_ACTION_OPTIONS}
                      placeholder="Actions"
                      value=""
                      onChange={async (val) => {
                        if (!val) return;
                        const action = val as BulkActionType;
                        if (!selectAllChecked && selectedIds.size === 0) return;
                        if (selectAllChecked) {
                          setConfirmModal({ action });
                          setCountLoading(true);
                          try {
                            const response = await fetch(
                              "/api/posts/bulk/count",
                              {
                                body: JSON.stringify({
                                  query: getCurrentQuery(),
                                }),
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                method: "POST",
                              }
                            );
                            if (!response.ok) {
                              const data = await response.json();
                              setError(
                                (data.error as string) ?? "Failed to get count"
                              );
                              setConfirmModal(null);
                              return;
                            }
                            const {
                              data: { count },
                            } = await response.json();
                            if (count === 0) {
                              setError(
                                "No posts match the current filters."
                              );
                              setConfirmModal(null);
                              return;
                            }
                            setConfirmModal((prev) =>
                              prev && prev.count === undefined
                                ? { action: prev.action, count }
                                : prev
                            );
                          } finally {
                            setCountLoading(false);
                          }
                        } else {
                          setConfirmModal({
                            action,
                            count: selectedIds.size,
                          });
                        }
                      }}
                    />
                    <button
                      className="text-foreground hover:opacity-80 flex h-10 min-h-[44px] shrink-0 items-center justify-center rounded-card border border-border bg-transparent px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
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
                    aria-label="Bulk Actions"
                    className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => setBulkMode(true)}
                  >
                    <CheckSquare className="h-4 w-4" />
                  </button>
                )}
                {(searchSlot.query.trim() || activeFilterCount > 0) && (
                  <button
                    aria-label="Reset filters"
                    className="text-foreground hover:opacity-80 flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
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

            {/* Desktop: from md – single row */}
            <div className="mb-2 hidden w-full flex-wrap items-stretch gap-3 md:flex">
              <div className="flex h-10 min-w-0 w-full flex-1 basis-full sm:mr-0 sm:basis-0">
                <FeedSearchBar
                  embeddingBacklog={searchSlot.embeddingBacklog}
                  loadDefaultsError={searchSlot.loadDefaultsError}
                  loading={searchSlot.loading}
                  query={searchSlot.query}
                  useKeywordSearch={searchSlot.useKeywordSearch}
                  onQueryChange={searchSlot.onQueryChange}
                  onSearch={searchSlot.onSearch}
                  onUseKeywordSearchChange={searchSlot.onUseKeywordSearchChange}
                />
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
                <button
                  aria-label="Filters"
                  className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-10 min-h-[44px] items-center gap-2 rounded border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                  type="button"
                  onClick={() => setOpenFilterDrawer(true)}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-border text-foreground rounded-full px-1.5 py-0.5 text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <CustomSelect
                  ariaLabel="Sort Posts"
                  className="h-10 min-w-0 w-full shrink sm:min-w-[11rem] sm:w-auto"
                  options={SORT_OPTIONS.map((o, i) => ({
                    label: o.label,
                    value: String(i),
                  }))}
                  value={String(SORT_OPTIONS.indexOf(currentSortOption))}
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
                />
                {bulkMode ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <CustomSelect
                      ariaLabel="Bulk action"
                      className="h-10 min-w-0 w-full shrink sm:min-w-[11rem] sm:w-auto"
                      disabled={!selectAllChecked && selectedIds.size === 0}
                      options={BULK_ACTION_OPTIONS}
                      placeholder="Actions"
                      value=""
                      onChange={async (val) => {
                        if (!val) return;
                        const action = val as BulkActionType;
                        if (!selectAllChecked && selectedIds.size === 0) return;
                        if (selectAllChecked) {
                          setConfirmModal({ action });
                          setCountLoading(true);
                          try {
                            const response = await fetch(
                              "/api/posts/bulk/count",
                              {
                                body: JSON.stringify({
                                  query: getCurrentQuery(),
                                }),
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                method: "POST",
                              }
                            );
                            if (!response.ok) {
                              const data = await response.json();
                              setError(
                                (data.error as string) ?? "Failed to get count"
                              );
                              setConfirmModal(null);
                              return;
                            }
                            const {
                              data: { count },
                            } = await response.json();
                            if (count === 0) {
                              setError(
                                "No posts match the current filters."
                              );
                              setConfirmModal(null);
                              return;
                            }
                            setConfirmModal((prev) =>
                              prev && prev.count === undefined
                                ? { action: prev.action, count }
                                : prev
                            );
                          } finally {
                            setCountLoading(false);
                          }
                        } else {
                          setConfirmModal({
                            action,
                            count: selectedIds.size,
                          });
                        }
                      }}
                    />
                    <button
                      className="text-foreground hover:opacity-80 flex h-10 min-h-[44px] shrink-0 items-center justify-center rounded-card border border-border bg-transparent px-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus sm:w-28"
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
                    className="text-foreground hover:opacity-80 flex h-10 min-h-[44px] min-w-[7.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-card border border-border bg-transparent px-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => setBulkMode(true)}
                  >
                    Bulk Actions
                  </button>
                )}
                {(searchSlot.query.trim() || activeFilterCount > 0) && (
                  <button
                    aria-label="Reset filters"
                    className="text-foreground hover:opacity-80 flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
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
          </>
        )}

        {searchSlot && searchSlot.query.trim() ? (
          <div className="space-y-6">
            {searchSlot.loading && searchSlot.query.trim() ? null : searchSlot.searchError && (
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
            {searchSlot.loading && searchSlot.query.trim() && (
              <div
                aria-busy="true"
                aria-label="Loading search results"
                className="space-y-4"
              >
                {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                  <PostCardSkeleton key={i} />
                ))}
              </div>
            )}
            {!searchSlot.loading &&
              searchSlot.results.length > 0 && (
              <div className="space-y-4">
                {searchSlot.results.map((post) => {
                  const activeJob = getActiveJobForPost(post);
                  return (
                    <PostCard
                      key={post.id}
                      activeJobId={activeJob?.id ?? null}
                      isCancellingRefresh={
                        activeJob != null &&
                        cancellingJobId === activeJob.id
                      }
                      isMarkingSaved={searchSlot.markingSaved.has(post.id)}
                      isQueuingRefresh={queuingRefreshPostId === post.id}
                      post={post}
                      queueStatus={getQueueStatusForPost(post)}
                      onCancelRefresh={handleCancelRefresh}
                      onMarkSaved={(id, saved) =>
                        searchSlot.onMarkSaved(id, saved)
                      }
                      onMarkUsed={() => searchSlot.onMarkUsed(post.id)}
                      onQueueRefresh={handleQueueRefresh}
                      onViewDetails={() => searchSlot.onViewDetails(post.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {!searchSlot && (
              <>
                <div className="flex min-w-0 flex-wrap items-center gap-2 md:hidden">
                  <button
                    aria-label="Filters"
                    className="border-border bg-surface-hover text-foreground hover:bg-surface relative flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => setOpenFilterDrawer(true)}
                  >
                    <Filter className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="bg-border text-foreground absolute -right-0.5 -top-0.5 rounded-full px-1.5 py-0.5 text-xs">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <div className="relative" ref={sortMenuRef}>
                    <button
                      aria-label="Sort"
                      className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                      type="button"
                      onClick={() => setSortMenuOpen((open) => !open)}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </button>
                    {sortMenuOpen && (
                      <div className="border-border bg-surface absolute left-0 top-full z-20 mt-1 min-w-[11rem] rounded border py-1 shadow-lg">
                        {SORT_OPTIONS.map((opt, i) => (
                          <button
                            className="text-foreground hover:bg-surface-hover w-full px-3 py-2 text-left text-sm"
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              setFilters((prev) => ({
                                ...prev,
                                sort: opt.sort,
                                sortOrder: opt.sortOrder,
                              }));
                              setSortMenuOpen(false);
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    aria-label="Reset filters"
                    className="text-foreground hover:opacity-80 flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={handleResetFilters}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                </div>
                <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
                  <button
                    aria-label="Filters"
                    className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-10 min-h-[44px] items-center gap-2 rounded border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => setOpenFilterDrawer(true)}
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="bg-border text-foreground rounded-full px-1.5 py-0.5 text-xs">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <CustomSelect
                    ariaLabel="Sort Posts"
                    className="h-10 min-w-0 w-full shrink sm:min-w-[11rem] sm:w-auto"
                    options={SORT_OPTIONS.map((o, i) => ({
                      label: o.label,
                      value: String(i),
                    }))}
                    value={String(SORT_OPTIONS.indexOf(currentSortOption))}
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
                  />
                  <button
                    aria-label="Reset filters"
                    className="text-foreground hover:opacity-80 flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={handleResetFilters}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}

        {filters.preview && (
          <div
            className="border-primary bg-primary/10 mb-4 rounded-card border px-4 py-2 text-sm"
            role="status"
          >
            Previewing scores — run Recompute to save
          </div>
        )}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground shrink-0 text-sm">
            Showing {posts.length} of {total} Posts
          </span>
          {bulkMode && (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
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
          <div aria-busy="true" aria-label="Loading feed" className="space-y-4">
            {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
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
                    activeJobId={getActiveJobForPost(post)?.id ?? null}
                    isCancellingRefresh={
                      cancellingJobId === getActiveJobForPost(post)?.id
                    }
                    isMarkingIgnored={markingIgnored.has(post.id)}
                    isMarkingSaved={markingSaved.has(post.id)}
                    isMarkingUsed={markingUsed.has(post.id)}
                    isQueuingRefresh={queuingRefreshPostId === post.id}
                    post={post}
                    queueStatus={getQueueStatusForPost(post)}
                    selected={selectedIds.has(post.id)}
                    showCheckbox={bulkMode}
                    onCancelRefresh={handleCancelRefresh}
                    onMarkIgnored={handleMarkIgnored}
                    onMarkSaved={handleMarkSaved}
                    onMarkUsed={handleMarkUsed}
                    onQueueRefresh={handleQueueRefresh}
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

      <ConfirmModal
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        counting={countLoading && confirmModal?.count === undefined}
        message={
          confirmModal?.count != null
            ? `Are you sure you want to ${BULK_ACTION_LABELS[confirmModal.action].toLowerCase()} ${confirmModal.count} post(s)?`
            : undefined
        }
        open={confirmModal != null}
        title={confirmModal ? BULK_ACTION_TITLES[confirmModal.action] : ""}
        onCancel={() => {
          setConfirmModal(null);
          if (countLoading) setCountLoading(false);
        }}
        onConfirm={() => {
          if (confirmModal?.count == null) return;
          const { action, count } = confirmModal;
          const successMessage = `${BULK_ACTION_SUCCESS[action]} ${count} post(s).`;
          const applyToQuery = selectAllChecked;
          setConfirmModal(null);
          setBulkMode(false);
          setSelectAllChecked(false);
          handleBulkAction(action, {
            applyToQuery,
            onError: (message) => toast.error(message),
            onSuccess: (data) => {
              if (
                action === "reprocess" &&
                data?.data?.jobs_queued != null
              ) {
                let msg = `${data.data.jobs_queued} post(s) queued for reprocessing.`;
                if ((data.data.skipped ?? 0) > 0) {
                  msg += ` ${data.data.skipped} skipped (no URL).`;
                }
                toast.success(msg);
                refetchPermalinkJobs();
              } else {
                toast.success(successMessage);
              }
            },
          });
        }}
      />
    </div>
  );
}
