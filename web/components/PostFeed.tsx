"use client";

import {
  AlertTriangle,
  ArrowUpDown,
  Bookmark,
  BookmarkX,
  Check,
  CheckSquare,
  Eye,
  EyeOff,
  Filter,
  Inbox,
  ListPlus,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DEBOUNCE_DELAY_MS,
  GENERIC_ERROR_MESSAGE,
  GENERIC_ERROR_MESSAGE_LINE_1,
  GENERIC_ERROR_MESSAGE_LINE_2,
} from "@/lib/constants";
import { useAddPostsToScoringFewShot } from "@/lib/hooks/useAddPostsToScoringFewShot";
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
import { SCORING_FEW_SHOT_MAX_EXAMPLES } from "@/lib/validators";

import { FeedSearchBar } from "./FeedSearchBar";
import { FilterSidebar } from "./FilterSidebar";
import { PostCard } from "./PostCard";
import { PostCardSkeleton } from "./PostCardSkeleton";
import { Card } from "./ui/Card";
import { ConfirmModal } from "./ui/ConfirmModal";
import { CustomSelect, type CustomSelectOption } from "./ui/CustomSelect";

import type { PostWithScores } from "@/lib/types";

export interface PostFeedSearchSlotProps {
  debouncedQuery: string;
  embeddingBacklog: number;
  loadDefaultsError: null | string;
  loading: boolean;
  markingSaved: Set<string>;
  onMarkSaved: (postId: string, saved: boolean) => void;
  onMarkUsedChange: (postId: string, used: boolean) => void;
  onQueryChange: (value: string) => void;
  onResetAll?: () => void;
  onSearch: (queryOverride?: string) => void;
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

const BULK_ADD_AS_EXAMPLE_VALUE = "add_as_example";

const BULK_ACTION_LABELS: Record<BulkActionType, string> = {
  ignore: "Ignore",
  mark_unused: "Mark As Unused",
  mark_used: "Mark As Used",
  reprocess: "Refresh Posts",
  save: "Save",
  unsave: "Unsave",
  unignore: "Unignore",
};

const BULK_ACTION_SUCCESS: Record<BulkActionType, string> = {
  ignore: "Ignored",
  mark_unused: "Marked as unused",
  mark_used: "Marked as used",
  reprocess: "Queued for refresh",
  save: "Saved",
  unsave: "Unsaved",
  unignore: "Unignored",
};

const BULK_ACTION_TITLES: Record<BulkActionType, string> = {
  ignore: "Ignore Posts",
  mark_unused: "Mark Posts As Unused",
  mark_used: "Mark Posts As Used",
  reprocess: "Refresh Posts",
  save: "Save Posts",
  unsave: "Unsave Posts",
  unignore: "Unignore Posts",
};

const BULK_ACTION_OPTIONS = [
  // Ignore / Unignore
  { icon: <EyeOff aria-hidden className="h-4 w-4" />, label: "Ignore", value: "ignore" },
  {
    icon: <Eye aria-hidden className="h-4 w-4" />,
    label: "Unignore",
    value: "unignore",
  },
  // Mark used / unused
  {
    icon: <Check aria-hidden className="h-4 w-4" />,
    label: "Mark As Used",
    value: "mark_used",
  },
  {
    icon: <RotateCcw aria-hidden className="h-4 w-4" />,
    label: "Mark As Unused",
    value: "mark_unused",
  },
  // Save / Unsave
  { icon: <Bookmark aria-hidden className="h-4 w-4" />, label: "Save", value: "save" },
  {
    icon: <BookmarkX aria-hidden className="h-4 w-4" />,
    label: "Unsave",
    value: "unsave",
  },
  // Refresh
  {
    icon: <RefreshCw aria-hidden className="h-4 w-4" />,
    label: "Refresh Posts",
    value: "reprocess",
  },
];

const SKELETON_CARD_COUNT = 8;

const SORT_OPTIONS = [
  { label: "Comments (Least First)", sort: "comment_count" as const, sortOrder: "asc" as const },
  { label: "Comments (Most First)", sort: "comment_count" as const, sortOrder: "desc" as const },
  { label: "Newest First", sort: "date" as const, sortOrder: "desc" as const },
  { label: "Oldest First", sort: "date" as const, sortOrder: "asc" as const },
  { label: "Podcast Score (High to Low)", sort: "podcast_score" as const, sortOrder: "desc" as const },
  { label: "Podcast Score (Low to High)", sort: "podcast_score" as const, sortOrder: "asc" as const },
  { label: "Score (High to Low)", sort: "score" as const, sortOrder: "desc" as const },
  { label: "Score (Low to High)", sort: "score" as const, sortOrder: "asc" as const },
];

/**
 * PostFeed displays a list of Nextdoor posts with filtering and infinite scroll.
 * Layout: side panel (filters) + main (optional search bar, then sort/chips/feed or search results).
 * When searchSlot is provided, the search bar is the first element in the main column; search results or feed follow.
 */
export interface PicksDefaultsForFeed {
  picks_min: number;
}

export function PostFeed({
  initialCategoryIds,
  picksDefaults = null,
  searchSlot = null,
  postType = "standard",
}: {
  initialCategoryIds?: string[];
  picksDefaults?: null | PicksDefaultsForFeed;
  searchSlot?: null | PostFeedSearchSlotProps;
  postType?: "classified" | "standard";
} = {}) {
  const router = useRouter();
  const similarSearchListPath =
    postType === "classified" ? "/admin/classifieds" : "/admin/feed";
  const appliedInitialCategoriesRef = useRef(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    action: BulkActionType;
    count?: number;
  } | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [pendingPostAction, setPendingPostAction] = useState<{
    action: "cancelRefresh";
    jobId: string;
  } | {
    action: "ignore" | "queueRefresh" | "used";
    postId: string;
    value?: boolean;
  } | null>(null);
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
    debouncedMaxCommentCount,
    debouncedMaxPodcastWorthy,
    debouncedMaxReactionCount,
    debouncedMaxScore,
    debouncedMinCommentCount,
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filterLoadError,
    filters,
    neighborhoods,
    setFilters,
  } = usePostFeedFilters(DEBOUNCE_DELAY_MS);

  useEffect(() => {
    if (
      appliedInitialCategoriesRef.current ||
      !initialCategoryIds?.length
    ) {
      return;
    }
    appliedInitialCategoriesRef.current = true;
    setFilters((prev) => ({ ...prev, categoryIds: initialCategoryIds }));
  }, [initialCategoryIds, setFilters]);

  const {
    error,
    fetchPosts,
    hasMore,
    initialLoading,
    loadingMore,
    offset,
    posts,
    setError,
    total,
  } = usePostFeedData({
    activeConfigWeights,
    debouncedMaxCommentCount,
    debouncedMaxPodcastWorthy,
    debouncedMaxReactionCount,
    debouncedMaxScore,
    debouncedMinCommentCount,
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filters,
    postType,
  });

  const getCurrentQuery = useCallback((): BulkQuery => {
    const maxCommentCount = parseInt(debouncedMaxCommentCount, 10);
    const maxPodcastWorthy = parseFloat(debouncedMaxPodcastWorthy);
    const maxReactionCount = parseInt(debouncedMaxReactionCount, 10);
    const maxScoreNum = parseFloat(debouncedMaxScore);
    const minCommentCount = parseInt(debouncedMinCommentCount, 10);
    const minPodcastWorthy = parseFloat(debouncedMinPodcastWorthy);
    const minReactionCount = parseInt(debouncedMinReactionCount, 10);
    const minScoreNum = parseFloat(debouncedMinScore);
    return {
      categories:
        filters.categoryIds?.length ? filters.categoryIds : undefined,
      ignored_only: filters.ignoredOnly,
      max_comment_count:
        !isNaN(maxCommentCount) && maxCommentCount >= 0
          ? maxCommentCount
          : undefined,
      max_podcast_worthy:
        !isNaN(maxPodcastWorthy) &&
        maxPodcastWorthy >= 0 &&
        maxPodcastWorthy <= 10
          ? maxPodcastWorthy
          : undefined,
      max_reaction_count:
        !isNaN(maxReactionCount) && maxReactionCount >= 0
          ? maxReactionCount
          : undefined,
      max_score:
        !isNaN(maxScoreNum) && maxScoreNum >= 0 ? maxScoreNum : undefined,
      min_comment_count:
        !isNaN(minCommentCount) && minCommentCount >= 0
          ? minCommentCount
          : undefined,
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
      neighborhood_ids:
        filters.neighborhoodIds?.length ? filters.neighborhoodIds : undefined,
      order: filters.sortOrder,
      saved_only: filters.savedOnly,
      sort: filters.sort,
      unused_only: filters.unusedOnly,
    };
  }, [
    debouncedMaxCommentCount,
    debouncedMaxPodcastWorthy,
    debouncedMaxReactionCount,
    debouncedMaxScore,
    debouncedMinCommentCount,
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filters.categoryIds,
    filters.ignoredOnly,
    filters.neighborhoodIds,
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
    handleMarkUsedChange,
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
  const { addPosts, addingIds, examplesFull } = useAddPostsToScoringFewShot();
  const { toast } = useToast();

  const handleAddToScoringFewShot = useCallback(
    (postId: string) => {
      if (examplesFull) {
        return;
      }
      void addPosts([postId]);
    },
    [addPosts, examplesFull]
  );

  const handleBulkAddToScoringFewShot = useCallback(async () => {
    if (
      examplesFull ||
      selectAllChecked ||
      selectedIds.size === 0 ||
      bulkActionLoading
    ) {
      return;
    }
    const ids = Array.from(selectedIds);
    await addPosts(ids);
    setBulkMode(false);
    setSelectAllChecked(false);
    setSelectedIds(new Set());
  }, [
    addPosts,
    bulkActionLoading,
    examplesFull,
    selectAllChecked,
    selectedIds,
    setSelectedIds,
  ]);

  const feedBulkActionOptions: CustomSelectOption[] = useMemo(
    () => [
      {
        disabled: examplesFull || selectAllChecked,
        icon: <ListPlus aria-hidden className="h-4 w-4" />,
        label: "Add As Example",
        title: examplesFull
          ? `Already have ${SCORING_FEW_SHOT_MAX_EXAMPLES} examples (max). Remove one in Settings.`
          : selectAllChecked
            ? "Turn off Select all to add specific posts as examples."
            : undefined,
        value: BULK_ADD_AS_EXAMPLE_VALUE,
      },
      ...BULK_ACTION_OPTIONS,
    ],
    [examplesFull, selectAllChecked]
  );

  const handleBulkActionMenuChange = useCallback(
    async (val: string) => {
      if (!val) {
        return;
      }
      if (!selectAllChecked && selectedIds.size === 0) {
        return;
      }

      if (val === BULK_ADD_AS_EXAMPLE_VALUE) {
        if (selectAllChecked) {
          toast.error(
            "Turn off Select all to add specific posts as scoring examples."
          );
          return;
        }
        if (examplesFull) {
          return;
        }
        await handleBulkAddToScoringFewShot();
        return;
      }

      const action = val as BulkActionType;
      if (selectAllChecked) {
        setConfirmModal({ action });
        setCountLoading(true);
        try {
          const response = await fetch("/api/posts/bulk/count", {
            body: JSON.stringify({ query: getCurrentQuery() }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          if (!response.ok) {
            const data = await response.json();
            setError((data.error as string) ?? "Failed to get count");
            setConfirmModal(null);
            return;
          }
          const {
            data: { count },
          } = await response.json();
          if (count === 0) {
            setError("No posts match the current filters.");
            setConfirmModal(null);
            return;
          }
          setConfirmModal((prev) =>
            prev && prev.count === undefined ? { action: prev.action, count } : prev
          );
        } finally {
          setCountLoading(false);
        }
      } else {
        setConfirmModal({ action, count: selectedIds.size });
      }
    },
    [
      examplesFull,
      getCurrentQuery,
      handleBulkAddToScoringFewShot,
      selectAllChecked,
      selectedIds.size,
      setError,
      toast,
    ]
  );

  const {
    getActiveJobForPost,
    getQueueStatusForPost,
    refetch: refetchPermalinkJobs,
  } = usePermalinkJobs();
  const handleCancelRefresh = useCallback(
    (jobId: string) => {
      (async () => {
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
          await refetchPermalinkJobs();
        }
      })();
    },
    [refetchPermalinkJobs, toast]
  );

  const handleQueueRefresh = useCallback(
    (postId: string) => {
      const post =
        posts.find((p) => p.id === postId) ??
        searchSlot?.results?.find((p) => p.id === postId);
      if (!post?.url) return;
      (async () => {
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
          refetchPermalinkJobs();
        }
      })();
    },
    [posts, refetchPermalinkJobs, searchSlot?.results, toast]
  );

  const requestMarkIgnored = useCallback((postId: string, value: boolean) => {
    setPendingPostAction({ action: "ignore", postId, value });
  }, []);
  const requestMarkUsedChange = useCallback((postId: string, value: boolean) => {
    setPendingPostAction({ action: "used", postId, value });
  }, []);
  const requestCancelRefresh = useCallback((jobId: string) => {
    setPendingPostAction({ action: "cancelRefresh", jobId });
  }, []);
  const requestQueueRefresh = useCallback((postId: string) => {
    setPendingPostAction({ action: "queueRefresh", postId });
  }, []);

  const {
    focusedIndex,
    postRefs,
    sentinelRef,
  } = useFeedKeyboardNav({
    onOpenPost: (postId) => router.push(`/admin/posts/${postId}`),
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
    filters.categoryIds.length > 0,
    filters.ignoredOnly,
    filters.maxCommentCount,
    filters.maxPodcastWorthy,
    filters.maxReactionCount,
    filters.maxScore,
    filters.minCommentCount,
    filters.minPodcastWorthy,
    filters.minReactionCount,
    filters.minScore,
    filters.neighborhoodIds.length > 0,
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
        if (entries[0]?.isIntersecting && !loadingMore && offset < total) {
          void fetchPosts(undefined, true);
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
              aria-label="Filter options"
              className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 touch-pan-y [-webkit-overflow-scrolling:touch]"
              role="region"
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
            <div className="border-border flex shrink-0 flex-col gap-2 border-t p-3">
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
              <button
                aria-label="Done"
                className="border-border bg-surface-hover text-foreground w-full rounded border px-3 py-2 text-sm font-medium transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus"
                type="button"
                onClick={() => setOpenFilterDrawer(false)}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content: fixed header + scrollable cards (scrollbar at viewport edge) */}
      <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden py-6 sm:py-8">
        <div className="relative z-10 flex shrink-0 flex-col gap-3 bg-background px-6 sm:px-8">
          <h1 className="text-foreground text-left text-2xl font-semibold sm:text-3xl">
            Nextdoor Discovery
          </h1>

          {searchSlot && (
          <>
            {/* Compact search (<lg): contents = hoists rows into parent flex so gap-3 matches count row */}
            <div className="contents lg:hidden">
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
              {bulkMode ? (
                <div className="mt-1 flex w-full items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <CustomSelect
                      ariaLabel="Bulk action"
                      className="h-8 w-full text-sm"
                      disabled={!selectAllChecked && selectedIds.size === 0}
                      options={feedBulkActionOptions}
                      placeholder="Actions"
                      value=""
                      onChange={(val) => {
                        void handleBulkActionMenuChange(val);
                      }}
                    />
                  </div>
                  <button
                    className="text-foreground hover:opacity-80 flex h-8 w-16 shrink-0 items-center justify-center rounded px-2 text-xs focus:outline-none focus:ring-2 focus:ring-border-focus"
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
              ) : null}
            </div>
            {searchSlot.loadDefaultsError && (
              <p
                className="hidden text-destructive text-xs lg:block"
                role="alert"
              >
                Defaults failed to load.
              </p>
            )}

            {/* Desktop: from lg – single row, all controls exactly 40px tall */}
            <div className="mb-0 hidden h-[40px] w-full items-center gap-3 lg:mb-2 lg:flex">
              <FeedSearchBar
                embeddingBacklog={searchSlot.embeddingBacklog}
                loadDefaultsError={searchSlot.loadDefaultsError}
                loading={searchSlot.loading}
                query={searchSlot.query}
                toolbar
                useKeywordSearch={searchSlot.useKeywordSearch}
                onQueryChange={searchSlot.onQueryChange}
                onSearch={searchSlot.onSearch}
                onUseKeywordSearchChange={searchSlot.onUseKeywordSearchChange}
              />
              <div className="flex shrink-0 items-center gap-2">
                <button
                  aria-label="Filters"
                  className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-[40px] items-center gap-2 rounded border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
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
                  className="h-[40px] min-w-0 w-full shrink sm:min-w-[11rem] sm:w-auto"
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
                      className="h-[40px] min-w-0 w-full shrink sm:min-w-[11rem] sm:w-auto"
                      disabled={!selectAllChecked && selectedIds.size === 0}
                      options={feedBulkActionOptions}
                      placeholder="Actions"
                      value=""
                      onChange={(val) => {
                        void handleBulkActionMenuChange(val);
                      }}
                    />
                    <button
                      className="text-foreground hover:opacity-80 flex h-[40px] shrink-0 items-center justify-center rounded-card border border-border bg-transparent px-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus sm:w-28"
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
                    className="text-foreground hover:opacity-80 flex h-[40px] min-w-[7.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-card border border-border bg-transparent px-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => setBulkMode(true)}
                  >
                    Bulk Actions
                  </button>
                )}
                {(searchSlot.query.trim() || activeFilterCount > 0) && (
                  <button
                    aria-label="Reset filters"
                    className="text-foreground hover:opacity-80 flex h-[40px] min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
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

        {!searchSlot && (
          <>
            <div className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">
              <button
                aria-label="Filters"
                className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-10 min-h-[44px] items-center gap-2 rounded border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
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

        {(!searchSlot || !searchSlot.query.trim()) && (
          <div
            className={cn(
              "bg-background",
              bulkMode && "pr-[17px] lg:pr-7"
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  aria-label="Filters"
                  className="text-foreground hover:opacity-80 relative flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
                  type="button"
                  onClick={() => setOpenFilterDrawer(true)}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="bg-border text-foreground absolute -right-0.5 -top-0.5 rounded-full px-1 py-0.5 text-[10px]">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <span className="text-muted-foreground shrink-0 text-sm">
                  Showing {posts.length} of {total} Posts
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div
                  className={cn(
                    "flex min-w-0 shrink-0 items-center gap-0 lg:hidden",
                    bulkMode && "hidden"
                  )}
                >
                  {searchSlot ? (
                    <>
                      <button
                        aria-label="Bulk Actions"
                        className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                        type="button"
                        onClick={() => setBulkMode(true)}
                      >
                        <CheckSquare className="h-4 w-4" />
                      </button>
                      <div className="relative" ref={sortMenuRef}>
                        <button
                          aria-expanded={sortMenuOpen}
                          aria-haspopup="menu"
                          aria-label="Sort"
                          className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => setSortMenuOpen((o) => !o)}
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </button>
                        {sortMenuOpen && (
                          <div
                            className="border-border bg-surface absolute right-0 left-auto top-full z-10 mt-1 min-w-[12rem] rounded-card border py-1 shadow-lg"
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
                      {(searchSlot.query.trim() || activeFilterCount > 0) && (
                        <button
                          aria-label="Reset filters"
                          className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => {
                            handleResetFilters();
                            searchSlot.onResetAll?.();
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      <div className="relative" ref={searchTypeMenuRef}>
                        <button
                          aria-expanded={searchTypeMenuOpen}
                          aria-haspopup="menu"
                          aria-label="Search type"
                          className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => setSearchTypeMenuOpen((o) => !o)}
                        >
                          <Search className="h-4 w-4" />
                        </button>
                        {searchTypeMenuOpen && (
                          <div
                            className="border-border bg-surface absolute right-0 left-auto top-full z-10 mt-1 min-w-[8rem] rounded-card border py-1 shadow-lg"
                            role="menu"
                          >
                            <button
                              className={cn(
                                "flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus",
                                !searchSlot.useKeywordSearch &&
                                  "bg-surface-hover font-medium"
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
                                searchSlot.useKeywordSearch &&
                                  "bg-surface-hover font-medium"
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
                    </>
                  ) : (
                    <>
                      <div className="relative" ref={sortMenuRef}>
                        <button
                          aria-expanded={sortMenuOpen}
                          aria-haspopup="menu"
                          aria-label="Sort"
                          className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => setSortMenuOpen((open) => !open)}
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </button>
                        {sortMenuOpen && (
                          <div className="border-border bg-surface absolute right-0 left-auto top-full z-20 mt-1 min-w-[11rem] rounded border py-1 shadow-lg">
                            {SORT_OPTIONS.map((opt, i) => (
                              <button
                                key={opt.label}
                                className="text-foreground hover:bg-surface-hover w-full px-3 py-2 text-left text-sm"
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
                        className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                        type="button"
                        onClick={handleResetFilters}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                {bulkMode ? (
                  <label
                    className="flex h-8 cursor-pointer items-center gap-2"
                    htmlFor="select-all-feed"
                  >
                    <span className="text-muted-foreground text-sm">
                      Select All
                    </span>
                    <input
                      aria-label="Select All"
                      checked={
                        selectedIds.size === posts.length && posts.length > 0
                      }
                      className="rounded border-border bg-surface-hover"
                      id="select-all-feed"
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
                ) : null}
              </div>
            </div>
          </div>
        )}

        </div>

        <div
          aria-label="Feed posts"
          className="relative z-0 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background pb-6 pt-3 sm:pb-8 sm:pt-4"
          role="region"
          style={{ scrollbarGutter: "stable" }}
        >
        <div className="min-w-0 bg-background px-6 sm:px-8">
        {searchSlot && searchSlot.query.trim() ? (
          <div className="space-y-6">
            {searchSlot.loading && searchSlot.query.trim()
              ? null
              : searchSlot.searchError && (
                <div className="flex justify-center mt-24">
                  <div className="border border-destructive rounded-lg px-6 py-4 text-center text-destructive">
                    <div className="mb-2 flex justify-center">
                      <AlertTriangle aria-hidden className="h-12 w-12" />
                    </div>
                    <p className="text-base font-medium">
                      {GENERIC_ERROR_MESSAGE_LINE_1}
                    </p>
                    <p className="text-base font-medium">
                      {GENERIC_ERROR_MESSAGE_LINE_2}
                    </p>
                  </div>
                </div>
              )}
            {!searchSlot.loading &&
              !searchSlot.searchError &&
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
                <div className="py-10 text-center">
                  <span className="text-muted-foreground text-sm">
                    <SearchX
                      aria-hidden
                      className="mx-auto mb-4 block h-12 w-12"
                    />
                  </span>
                  <p className="text-foreground mb-3 font-medium">
                    No posts found.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Try different search terms or lower the similarity
                    threshold.
                  </p>
                </div>
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
              !searchSlot.searchError &&
              searchSlot.results.length > 0 && (
              <div className="space-y-4">
                {searchSlot.results.map((post) => {
                  const activeJob = getActiveJobForPost(post);
                  return (
                    <PostCard
                      key={post.id}
                      activeJobId={activeJob?.id ?? null}
                      isAddAsExampleDisabled={examplesFull}
                      isAddingToScoringFewShot={addingIds.has(post.id)}
                      isMarkingSaved={searchSlot.markingSaved.has(post.id)}
                      post={post}
                      queueStatus={getQueueStatusForPost(post)}
                      similarSearchListPath={similarSearchListPath}
                      onAddToScoringFewShot={handleAddToScoringFewShot}
                      onCancelRefresh={requestCancelRefresh}
                      onMarkSaved={(id, saved) =>
                        searchSlot.onMarkSaved(id, saved)
                      }
                      onMarkUsedChange={(id, used) =>
                        searchSlot.onMarkUsedChange(id, used)
                      }
                      onQueueRefresh={requestQueueRefresh}
                      onViewDetails={() => searchSlot.onViewDetails(post.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {(!searchSlot || !searchSlot.query.trim()) && error ? (
              <div className="mt-24 flex justify-center">
                <div className="border border-destructive rounded-lg px-6 py-4 text-center text-destructive">
                  <div className="mb-2 flex justify-center">
                    <AlertTriangle aria-hidden className="h-12 w-12" />
                  </div>
                  <p className="text-base font-medium">
                    {GENERIC_ERROR_MESSAGE_LINE_1}
                  </p>
                  <p className="text-base font-medium">
                    {GENERIC_ERROR_MESSAGE_LINE_2}
                  </p>
                </div>
              </div>
            ) : null}

        {!error && initialLoading && (
          <div aria-busy="true" aria-label="Loading feed" className="space-y-4">
            {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!error && !initialLoading && posts.length === 0 && (
          <div className="py-10 text-center">
            <span className="text-muted-foreground text-sm">
              <Inbox
                aria-hidden
                className="mx-auto mb-4 block h-12 w-12"
              />
            </span>
            <p className="text-foreground mb-3 font-medium">
              No posts found.
            </p>
            <p className="text-muted-foreground text-sm">
              Try adjusting your filters or run the scraper to collect posts.
            </p>
          </div>
        )}

        {!error && !initialLoading && posts.length > 0 && (
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
                    isAddAsExampleDisabled={examplesFull}
                    isAddingToScoringFewShot={addingIds.has(post.id)}
                    isMarkingIgnored={markingIgnored.has(post.id)}
                    isMarkingSaved={markingSaved.has(post.id)}
                    isMarkingUsed={markingUsed.has(post.id)}
                    post={post}
                    queueStatus={getQueueStatusForPost(post)}
                    selected={selectedIds.has(post.id)}
                    showCheckbox={bulkMode}
                    similarSearchListPath={similarSearchListPath}
                    onAddToScoringFewShot={handleAddToScoringFewShot}
                    onCancelRefresh={requestCancelRefresh}
                    onMarkIgnored={requestMarkIgnored}
                    onMarkSaved={handleMarkSaved}
                    onMarkUsedChange={requestMarkUsedChange}
                    onQueueRefresh={requestQueueRefresh}
                    onSelect={toggleSelect}
                    onViewDetails={() => router.push(`/admin/posts/${post.id}`)}
                  />
                </div>
              ))}
            </div>

            {hasMore && (
              <div
                className="flex justify-center pb-4 pt-10"
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
              <div className="text-muted-foreground pt-10 pb-4 text-center text-sm">
                No more posts to load.
              </div>
            )}
          </>
        )}
          </>
        )}
        </div>
        </div>
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

      <ConfirmModal
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        message={
          pendingPostAction?.action === "ignore"
            ? pendingPostAction.value
              ? "Ignore this post? It will be hidden from the feed."
              : "Show this post in the feed again?"
            : pendingPostAction?.action === "used"
              ? pendingPostAction.value
                ? "Mark this post as used on an episode?"
                : "Mark this post as unused?"
              : pendingPostAction?.action === "cancelRefresh"
                ? "Remove this post from the refresh queue?"
                : pendingPostAction?.action === "queueRefresh"
                  ? "Queue this post for refresh?"
                  : undefined
        }
        open={pendingPostAction != null}
        title={
          pendingPostAction?.action === "ignore"
            ? pendingPostAction.value
              ? "Ignore post?"
              : "Unignore post?"
            : pendingPostAction?.action === "used"
              ? pendingPostAction.value
                ? "Mark as used?"
                : "Mark as unused?"
              : pendingPostAction?.action === "cancelRefresh"
                ? "Cancel refresh?"
                : pendingPostAction?.action === "queueRefresh"
                  ? "Queue refresh?"
                  : ""
        }
        onCancel={() => setPendingPostAction(null)}
        onConfirm={() => {
          if (pendingPostAction == null) return;
          if (pendingPostAction.action === "ignore") {
            handleMarkIgnored(pendingPostAction.postId, pendingPostAction.value ?? false);
          } else if (pendingPostAction.action === "used") {
            handleMarkUsedChange(pendingPostAction.postId, pendingPostAction.value ?? false);
          } else if (pendingPostAction.action === "cancelRefresh") {
            handleCancelRefresh(pendingPostAction.jobId);
          } else if (pendingPostAction.action === "queueRefresh") {
            handleQueueRefresh(pendingPostAction.postId);
          }
          setPendingPostAction(null);
        }}
      />
    </div>
  );
}
