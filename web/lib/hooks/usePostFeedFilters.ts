"use client";

import { useEffect, useState } from "react";

import { useDebounce } from "@/lib/hooks";

type SortOption = "date" | "score";

export interface PostFeedFilters {
  category: string;
  episodeDate: string;
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
  debouncedMinScore: string;
  episodeDates: string[];
  filterLoadError: null | string;
  filters: PostFeedFilters;
  neighborhoods: Neighborhood[];
  setFilters: React.Dispatch<React.SetStateAction<PostFeedFilters>>;
}

const DEFAULT_FILTERS: PostFeedFilters = {
  category: "",
  episodeDate: "",
  minScore: "",
  neighborhoodId: "",
  savedOnly: false,
  sort: "score",
  unusedOnly: false,
};

/**
 * Hook for PostFeed filter state and filter options (neighborhoods, episodes).
 * Loads neighborhoods and episode dates on mount.
 */
export function usePostFeedFilters(
  debounceDelayMs: number
): UsePostFeedFiltersResult {
  const [episodeDates, setEpisodeDates] = useState<string[]>([]);
  const [filterLoadError, setFilterLoadError] = useState<null | string>(null);
  const [filters, setFilters] = useState<PostFeedFilters>(DEFAULT_FILTERS);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);

  const debouncedMinScore = useDebounce(filters.minScore, debounceDelayMs);

  useEffect(() => {
    Promise.all([
      fetch("/api/neighborhoods").then((res) =>
        res.ok ? res.json() : { data: [] }
      ),
      fetch("/api/episodes").then((res) =>
        res.ok ? res.json() : { data: [] }
      ),
    ])
      .then(([neighborhoodsResult, episodesResult]) => {
        setFilterLoadError(null);
        setNeighborhoods(neighborhoodsResult.data || []);
        setEpisodeDates(episodesResult.data || []);
      })
      .catch((err) => {
        console.error("Failed to load filter options (neighborhoods/episodes):", err);
        setFilterLoadError("Could not load filter options. Some filters may be empty.");
      });
  }, []);

  return {
    debouncedMinScore,
    episodeDates,
    filterLoadError,
    filters,
    neighborhoods,
    setFilters,
  };
}
