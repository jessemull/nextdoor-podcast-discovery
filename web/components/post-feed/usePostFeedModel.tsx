"use client";

import { ListPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEBOUNCE_DELAY_MS } from "@/lib/constants";
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
import { SCORING_FEW_SHOT_MAX_EXAMPLES } from "@/lib/validators";

import {
  BULK_ACTION_OPTIONS,
  BULK_ADD_AS_EXAMPLE_VALUE,
  SORT_OPTIONS,
} from "./post-feed-constants";

import type { CustomSelectOption } from "../ui/CustomSelect";
import type { PicksDefaultsForFeed, PostFeedSearchSlotProps } from "./post-feed-types";

export interface UsePostFeedModelInput {
  initialCategoryIds?: string[];
  picksDefaults?: null | PicksDefaultsForFeed;
  postType?: "classified" | "standard";
  searchSlot?: null | PostFeedSearchSlotProps;
}

export function usePostFeedModel({
  initialCategoryIds,
  picksDefaults = null,
  postType = "standard",
  searchSlot = null,
}: UsePostFeedModelInput = {}) {
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


  return {
    activeConfigWeights,
    activeFilterCount,
    addingIds,
    bulkMode,
    confirmModal,
    countLoading,
    currentSortOption,
    error,
    examplesFull,
    feedBulkActionOptions,
    fetchPosts,
    filterLoadError,
    filters,
    focusedIndex,
    getActiveJobForPost,
    getCurrentQuery,
    getQueueStatusForPost,
    handleAddToScoringFewShot,
    handleBulkAction,
    handleBulkActionMenuChange,
    handleCancelRefresh,
    handleMarkIgnored,
    handleMarkSaved,
    handleMarkUsedChange,
    handleQueueRefresh,
    handleResetFilters,
    hasMore,
    initialLoading,
    loadingMore,
    markingIgnored,
    markingSaved,
    markingUsed,
    neighborhoods,
    openFilterDrawer,
    pendingPostAction,
    picksDefaults,
    postRefs,
    posts,
    refetchPermalinkJobs,
    requestCancelRefresh,
    requestMarkIgnored,
    requestMarkUsedChange,
    requestQueueRefresh,
    router,
    searchSlot,
    searchTypeMenuOpen,
    searchTypeMenuRef,
    selectAllCheckboxRef,
    selectAllChecked,
    selectedIds,
    sentinelRef,
    setBulkMode,
    setConfirmModal,
    setCountLoading,
    setError,
    setFilters,
    setOpenFilterDrawer,
    setPendingPostAction,
    setSearchTypeMenuOpen,
    setSelectAllChecked,
    setSelectedIds,
    setSortMenuOpen,
    similarSearchListPath,
    sortMenuOpen,
    sortMenuRef,
    toast,
    toggleSelect,
    total,
  };
}

export type PostFeedViewModel = ReturnType<typeof usePostFeedModel>;
