"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { POSTS_PER_PAGE } from "@/lib/utils";

import type { PostFeedFilters } from "./usePostFeedFilters";
import type { PostsResponse, PostWithScores } from "@/lib/types";

const STALE_TIME_MS = 45_000;

function buildPostsQueryParams(
  filters: PostFeedFilters,
  debouncedMinPodcastWorthy: string,
  debouncedMinReactionCount: string,
  debouncedMinScore: string
): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(POSTS_PER_PAGE));
  searchParams.set("sort", filters.sort);
  searchParams.set("order", filters.sortOrder);

  if (filters.category) searchParams.set("category", filters.category);
  if (filters.neighborhoodId) {
    searchParams.set("neighborhood_id", filters.neighborhoodId);
  }
  if (filters.ignoredOnly) searchParams.set("ignored_only", "true");
  if (filters.savedOnly) searchParams.set("saved_only", "true");

  if (debouncedMinScore) {
    const minScoreNum = parseFloat(debouncedMinScore);
    if (!isNaN(minScoreNum) && minScoreNum >= 0) {
      searchParams.set("min_score", String(minScoreNum));
    }
  }

  if (debouncedMinPodcastWorthy) {
    const minPw = parseFloat(debouncedMinPodcastWorthy);
    if (!isNaN(minPw) && minPw >= 0 && minPw <= 10) {
      searchParams.set("min_podcast_worthy", String(minPw));
    }
  }

  if (debouncedMinReactionCount) {
    const minReaction = parseInt(debouncedMinReactionCount, 10);
    if (!isNaN(minReaction) && minReaction >= 0) {
      searchParams.set("min_reaction_count", String(minReaction));
    }
  }

  if (filters.unusedOnly) searchParams.set("unused_only", "true");

  return searchParams;
}

export interface UsePostFeedDataParams {
  debouncedMinPodcastWorthy: string;
  debouncedMinReactionCount: string;
  debouncedMinScore: string;
  filters: PostFeedFilters;
}

export interface UsePostFeedDataResult {
  error: null | string;
  fetchPosts: (currentOffset?: number, append?: boolean) => Promise<void>;
  handleRetry: () => void;
  hasMore: boolean;
  initialLoading: boolean;
  loadingMore: boolean;
  offset: number;
  posts: PostWithScores[];
  setError: (value: null | string) => void;
  total: number;
}

export function usePostFeedData(
  params: UsePostFeedDataParams
): UsePostFeedDataResult {
  const {
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filters,
  } = params;

  const queryParams = buildPostsQueryParams(
    filters,
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore
  );

  const [manualError, setManualError] = useState<null | string>(null);

  const {
    data,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery<PostsResponse>({
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (sum, p) => sum + p.data.length,
        0
      );
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams(queryParams);
      params.set("offset", String(pageParam));

      const response = await fetch(`/api/posts?${params.toString()}`);

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Failed to fetch posts");
      }

      return response.json();
    },
    queryKey: [
      "posts",
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
    ],
    staleTime: STALE_TIME_MS,
  });

  const posts = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const offset = data?.pages.reduce(
    (sum, p) => sum + p.data.length,
    0
  ) ?? 0;

  const fetchPosts = useCallback(
    async (currentOffset = 0, append = false) => {
      if (append) {
        await fetchNextPage();
      } else if (currentOffset === 0) {
        await refetch();
      }
    },
    [fetchNextPage, refetch]
  );

  const handleRetry = useCallback(() => {
    setManualError(null);
    void refetch();
  }, [refetch]);

  const setError = useCallback((value: null | string) => {
    setManualError(value);
  }, []);

  return {
    error: manualError ?? queryError?.message ?? null,
    fetchPosts,
    handleRetry,
    hasMore: hasNextPage ?? false,
    initialLoading: isLoading,
    loadingMore: isFetchingNextPage,
    offset,
    posts,
    setError,
    total,
  };
}
