"use client";

import { useEffect, useState } from "react";

import { useDebounce } from "@/lib/hooks";

type SortOption = "date" | "podcast_score" | "score";

export interface PostFeedFilters {
  category: string;
  ignoredOnly: boolean;
  minPodcastWorthy: string;
  minReactionCount: string;
  minScore: string;
  neighborhoodId: string;
  savedOnly: boolean;
  sort: SortOption;
  unusedOnly: boolean;
}

export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
}

export interface UsePostFeedFiltersResult {
  debouncedMinPodcastWorthy: string;
  debouncedMinReactionCount: string;
  debouncedMinScore: string;
  filterLoadError: null | string;
  filters: PostFeedFilters;
  neighborhoods: Neighborhood[];
  setFilters: React.Dispatch<React.SetStateAction<PostFeedFilters>>;
}

const DEFAULT_FILTERS: PostFeedFilters = {
  category: "",
  ignoredOnly: false,
  minPodcastWorthy: "",
  minReactionCount: "",
  minScore: "",
  neighborhoodId: "",
  savedOnly: false,
  sort: "score",
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

  const debouncedMinScore = useDebounce(filters.minScore, debounceDelayMs);
  const debouncedMinPodcastWorthy = useDebounce(
    filters.minPodcastWorthy,
    debounceDelayMs
  );
  const debouncedMinReactionCount = useDebounce(
    filters.minReactionCount,
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
    debouncedMinPodcastWorthy,
    debouncedMinReactionCount,
    debouncedMinScore,
    filterLoadError,
    filters,
    neighborhoods,
    setFilters,
  };
}
