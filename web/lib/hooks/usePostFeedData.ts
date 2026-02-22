"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { authFetch } from "@/lib/authFetch.client";
import { POSTS_PER_PAGE } from "@/lib/utils";

import type { PostFeedFilters } from "./usePostFeedFilters";
import type { PostsResponse, PostWithScores } from "@/lib/types";

const STALE_TIME_MS = 45_000;

function buildPostsQueryParams(
  filters: PostFeedFilters,
  debouncedMaxPodcastWorthy: string,
  debouncedMaxReactionCount: string,
  debouncedMaxScore: string,
  debouncedMinPodcastWorthy: string,
  debouncedMinReactionCount: string,
  debouncedMinScore: string
): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(POSTS_PER_PAGE));
  searchParams.set("sort", filters.sort);
  searchParams.set("order", filters.sortOrder);

  filters.categoryIds.forEach((id) => {
    searchParams.append("categories", id);
  });
  filters.neighborhoodIds.forEach((id) => {
    searchParams.append("neighborhood_ids", id);
  });
  if (filters.ignoredOnly) searchParams.set("ignored_only", "true");
  if (filters.savedOnly) searchParams.set("saved_only", "true");

  if (debouncedMinScore) {
    const minScoreNum = parseFloat(debouncedMinScore);
    if (!isNaN(minScoreNum) && minScoreNum >= 0) {
      searchParams.set("min_score", String(minScoreNum));
    }
  }
  if (debouncedMaxScore) {
    const maxScoreNum = parseFloat(debouncedMaxScore);
    if (!isNaN(maxScoreNum) && maxScoreNum >= 0) {
      searchParams.set("max_score", String(maxScoreNum));
    }
  }

  if (debouncedMinPodcastWorthy) {
    const minPw = parseFloat(debouncedMinPodcastWorthy);
    if (!isNaN(minPw) && minPw >= 0 && minPw <= 10) {
      searchParams.set("min_podcast_worthy", String(minPw));
    }
  }
  if (debouncedMaxPodcastWorthy) {
    const maxPw = parseFloat(debouncedMaxPodcastWorthy);
    if (!isNaN(maxPw) && maxPw >= 0 && maxPw <= 10) {
      searchParams.set("max_podcast_worthy", String(maxPw));
    }
  }

  if (debouncedMinReactionCount) {
    const minReaction = parseInt(debouncedMinReactionCount, 10);
    if (!isNaN(minReaction) && minReaction >= 0) {
      searchParams.set("min_reaction_count", String(minReaction));
    }
  }
  if (debouncedMaxReactionCount) {
    const maxReaction = parseInt(debouncedMaxReactionCount, 10);
    if (!isNaN(maxReaction) && maxReaction >= 0) {
      searchParams.set("max_reaction_count", String(maxReaction));
    }
  }

  if (filters.unusedOnly) searchParams.set("unused_only", "true");

  if (filters.preview) {
    searchParams.set("preview", "true");
    if (
      filters.previewWeights &&
      Object.keys(filters.previewWeights).length > 0
    ) {
      searchParams.set("weights", JSON.stringify(filters.previewWeights));
    }
  }

  return searchParams;
}

export interface UsePostFeedDataParams {
  debouncedMaxPodcastWorthy: string;
  debouncedMaxReactionCount: string;
  debouncedMaxScore: string;
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
    debouncedMaxPodcastWorthy,
    debouncedMaxReactionCount,
    debouncedMaxScore,
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filters,
  } = params;

  const queryParams = buildPostsQueryParams(
    filters,
    debouncedMaxPodcastWorthy,
    debouncedMaxReactionCount,
    debouncedMaxScore,
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

      const response = await authFetch(`/api/posts?${params.toString()}`);

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Failed to fetch posts");
      }

      return response.json();
    },
    queryKey: [
      "posts",
      debouncedMaxPodcastWorthy,
      debouncedMaxReactionCount,
      debouncedMaxScore,
      debouncedMinPodcastWorthy,
      debouncedMinReactionCount,
      debouncedMinScore,
      filters.categoryIds,
      filters.ignoredOnly,
      filters.neighborhoodIds,
      filters.preview,
      filters.previewWeights,
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
