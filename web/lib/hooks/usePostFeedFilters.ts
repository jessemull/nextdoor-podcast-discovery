"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { DEFAULT_PREVIEW_WEIGHTS } from "@/lib/constants";
import { useDebounce } from "@/lib/hooks";

import type { RankingWeights } from "@/lib/types";

type SortOption = "date" | "podcast_score" | "score";

export type SortOrder = "asc" | "desc";

export interface PostFeedFilters {
  categoryIds: string[];
  ignoredOnly: boolean;
  maxPodcastWorthy: string;
  maxReactionCount: string;
  maxScore: string;
  minPodcastWorthy: string;
  minReactionCount: string;
  minScore: string;
  neighborhoodIds: string[];
  preview: boolean;
  previewWeights: RankingWeights;
  savedOnly: boolean;
  sort: SortOption;
  sortOrder: SortOrder;
  unusedOnly: boolean;
}

export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
}

export interface UsePostFeedFiltersResult {
  debouncedMaxPodcastWorthy: string;
  debouncedMaxReactionCount: string;
  debouncedMaxScore: string;
  debouncedMinPodcastWorthy: string;
  debouncedMinReactionCount: string;
  debouncedMinScore: string;
  filterLoadError: null | string;
  filters: PostFeedFilters;
  neighborhoods: Neighborhood[];
  setFilters: React.Dispatch<React.SetStateAction<PostFeedFilters>>;
}

export const DEFAULT_FILTERS: PostFeedFilters = {
  categoryIds: [],
  ignoredOnly: false,
  maxPodcastWorthy: "",
  maxReactionCount: "",
  maxScore: "",
  minPodcastWorthy: "",
  minReactionCount: "",
  minScore: "",
  neighborhoodIds: [],
  preview: false,
  previewWeights: { ...DEFAULT_PREVIEW_WEIGHTS },
  savedOnly: false,
  sort: "score",
  sortOrder: "desc",
  unusedOnly: false,
};

/**
 * Hook for PostFeed filter state and filter options (neighborhoods).
 * Loads neighborhoods on mount.
 */
export function usePostFeedFilters(
  debounceDelayMs: number
): UsePostFeedFiltersResult {
  const [filters, setFilters] = useState<PostFeedFilters>(DEFAULT_FILTERS);

  const { data: neighborhoodsData, isError: neighborhoodsError } = useQuery({
    queryFn: async () => {
      const res = await fetch("/api/neighborhoods");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { data: [] as Neighborhood[] };
      return json as { data: Neighborhood[] };
    },
    queryKey: ["neighborhoods"],
    staleTime: 60_000,
  });

  const neighborhoods = neighborhoodsData?.data ?? [];
  const filterLoadError = neighborhoodsError
    ? "Could not load filter options. Some filters may be empty."
    : null;

  const debouncedMaxPodcastWorthy = useDebounce(
    filters.maxPodcastWorthy,
    debounceDelayMs
  );
  const debouncedMaxReactionCount = useDebounce(
    filters.maxReactionCount,
    debounceDelayMs
  );
  const debouncedMaxScore = useDebounce(filters.maxScore, debounceDelayMs);
  const debouncedMinScore = useDebounce(filters.minScore, debounceDelayMs);
  const debouncedMinPodcastWorthy = useDebounce(
    filters.minPodcastWorthy,
    debounceDelayMs
  );
  const debouncedMinReactionCount = useDebounce(
    filters.minReactionCount,
    debounceDelayMs
  );

  return {
    debouncedMaxPodcastWorthy,
    debouncedMaxReactionCount,
    debouncedMaxScore,
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filterLoadError,
    filters,
    neighborhoods,
    setFilters,
  };
}
