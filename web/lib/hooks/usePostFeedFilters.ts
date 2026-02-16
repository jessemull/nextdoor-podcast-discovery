"use client";

import { useEffect, useState } from "react";

import { DEFAULT_PREVIEW_WEIGHTS } from "@/lib/constants";
import { useDebounce } from "@/lib/hooks";

import type { RankingWeights } from "@/lib/types";

type SortOption = "date" | "podcast_score" | "score";

export type SortOrder = "asc" | "desc";

export interface PostFeedFilters {
  category: string;
  ignoredOnly: boolean;
  maxPodcastWorthy: string;
  maxReactionCount: string;
  maxScore: string;
  minPodcastWorthy: string;
  minReactionCount: string;
  minScore: string;
  neighborhoodId: string;
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
  debouncedPreviewWeights: RankingWeights;
  filterLoadError: null | string;
  filters: PostFeedFilters;
  neighborhoods: Neighborhood[];
  setFilters: React.Dispatch<React.SetStateAction<PostFeedFilters>>;
}

export const DEFAULT_FILTERS: PostFeedFilters = {
  category: "",
  ignoredOnly: false,
  maxPodcastWorthy: "",
  maxReactionCount: "",
  maxScore: "",
  minPodcastWorthy: "",
  minReactionCount: "",
  minScore: "",
  neighborhoodId: "",
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
  const [filterLoadError, setFilterLoadError] = useState<null | string>(null);
  const [filters, setFilters] = useState<PostFeedFilters>(DEFAULT_FILTERS);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);

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
  const debouncedPreviewWeights = useDebounce(
    filters.previewWeights,
    debounceDelayMs
  );

  useEffect(() => {
    fetch("/api/neighborhoods")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((result) => {
        setFilterLoadError(null);
        setNeighborhoods(result.data || []);
      })
      .catch((err) => {
        console.error("Failed to load filter options (neighborhoods):", err);
        setFilterLoadError("Could not load filter options. Some filters may be empty.");
      });
  }, []);

  return {
    debouncedMaxPodcastWorthy,
    debouncedMaxReactionCount,
    debouncedMaxScore,
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    debouncedPreviewWeights,
    filterLoadError,
    filters,
    neighborhoods,
    setFilters,
  };
}
