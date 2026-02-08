"use client";

import { useCallback, useEffect, useState } from "react";

import { POSTS_PER_PAGE } from "@/lib/utils";

import type { PostFeedFilters } from "./usePostFeedFilters";
import type { PostsResponse, PostWithScores } from "@/lib/types";

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

  const [error, setError] = useState<null | string>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [posts, setPosts] = useState<PostWithScores[]>([]);
  const [total, setTotal] = useState(0);

  const fetchPosts = useCallback(
    async (currentOffset = 0, append = false) => {
      if (currentOffset === 0 && !append) {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const searchParams = new URLSearchParams();
        searchParams.set("limit", String(POSTS_PER_PAGE));
        searchParams.set("offset", String(currentOffset));
        searchParams.set("sort", filters.sort);

        if (filters.category) searchParams.set("category", filters.category);
        if (filters.episodeDate) {
          searchParams.set("episode_date", filters.episodeDate);
        }
        if (filters.neighborhoodId) {
          searchParams.set("neighborhood_id", filters.neighborhoodId);
        }
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

        const response = await fetch(`/api/posts?${searchParams.toString()}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch posts");
        }

        const data: PostsResponse = await response.json();
        setPosts((prev) => (append ? [...prev, ...data.data] : data.data));
        setTotal(data.total);
        setOffset(currentOffset);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
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
    void fetchPosts(0, false);
  }, [fetchPosts]);

  const handleRetry = useCallback(() => {
    void fetchPosts(0, false);
  }, [fetchPosts]);

  const hasMore = offset + POSTS_PER_PAGE < total;

  return {
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
  };
}
