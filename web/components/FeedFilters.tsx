"use client";

import { TOPIC_CATEGORIES } from "@/lib/constants";

import type { PostFeedFilters } from "@/lib/hooks/usePostFeedFilters";
import type { Neighborhood } from "@/lib/hooks/usePostFeedFilters";

type SortOption = "date" | "score";

export interface FeedFiltersProps {
  episodeDates: string[];
  filterLoadError: null | string;
  filters: PostFeedFilters;
  neighborhoods: Neighborhood[];
  setFilters: React.Dispatch<React.SetStateAction<PostFeedFilters>>;
  setShowRefineFilters: React.Dispatch<React.SetStateAction<boolean>>;
  showRefineFilters: boolean;
}

/**
 * Filter UI for the post feed: quick chips (Saved, Unused, Drama, Humor)
 * and collapsible refine section (sort, neighborhood, episode, category, min score).
 */
export function FeedFilters({
  episodeDates,
  filterLoadError,
  filters,
  neighborhoods,
  setFilters,
  setShowRefineFilters,
  showRefineFilters,
}: FeedFiltersProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      {filterLoadError && (
        <p className="mb-4 text-sm text-amber-400" role="alert">
          {filterLoadError}
        </p>
      )}
      {/* Quick filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="self-center text-xs text-gray-500">Quick:</span>
        <button
          className={`rounded px-3 py-1 text-sm transition-colors ${
            filters.savedOnly
              ? "bg-blue-600 text-white"
              : "border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          type="button"
          onClick={() =>
            setFilters((prev) => ({ ...prev, savedOnly: !prev.savedOnly }))
          }
        >
          Saved
        </button>
        <button
          className={`rounded px-3 py-1 text-sm transition-colors ${
            filters.unusedOnly
              ? "bg-amber-600 text-white"
              : "border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          type="button"
          onClick={() =>
            setFilters((prev) => ({ ...prev, unusedOnly: !prev.unusedOnly }))
          }
        >
          Unused
        </button>
        <button
          className={`rounded px-3 py-1 text-sm transition-colors ${
            filters.category === "drama"
              ? "bg-purple-600 text-white"
              : "border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              category: prev.category === "drama" ? "" : "drama",
            }))
          }
        >
          Drama
        </button>
        <button
          className={`rounded px-3 py-1 text-sm transition-colors ${
            filters.category === "humor"
              ? "bg-yellow-600 text-yellow-900"
              : "border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              category: prev.category === "humor" ? "" : "humor",
            }))
          }
        >
          Humor
        </button>
      </div>
      {/* Refine filters (collapsible) */}
      <div>
        <button
          className="mb-2 text-sm text-gray-400 hover:text-white"
          type="button"
          onClick={() => setShowRefineFilters((prev) => !prev)}
        >
          {showRefineFilters ? "▼" : "▶"} Refine filters
        </button>
        {showRefineFilters && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400" htmlFor="sort">
                Sort:
              </label>
              <select
                className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
                id="sort"
                value={filters.sort}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    sort: e.target.value as SortOption,
                  })
                }
              >
                <option value="score">Highest Score</option>
                <option value="date">Most Recent</option>
              </select>
            </div>
            {/* Neighborhood */}
            <div className="flex items-center gap-2">
              <label
                className="text-sm text-gray-400"
                htmlFor="neighborhood"
              >
                Neighborhood:
              </label>
              <select
                className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
                id="neighborhood"
                value={filters.neighborhoodId}
                onChange={(e) =>
                  setFilters({ ...filters, neighborhoodId: e.target.value })
                }
              >
                <option value="">All</option>
                {neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Episode */}
            {episodeDates.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400" htmlFor="episode">
                  Episode:
                </label>
                <select
                  className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
                  id="episode"
                  value={filters.episodeDate}
                  onChange={(e) =>
                    setFilters({ ...filters, episodeDate: e.target.value })
                  }
                >
                  <option value="">All</option>
                  {episodeDates.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Category */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400" htmlFor="category">
                Category:
              </label>
              <select
                className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
                id="category"
                value={filters.category}
                onChange={(e) =>
                  setFilters({ ...filters, category: e.target.value })
                }
              >
                <option value="">All</option>
                {TOPIC_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {/* Min Score */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400" htmlFor="minScore">
                Min Score:
              </label>
              <input
                className="w-16 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
                id="minScore"
                min="0"
                placeholder="0"
                type="number"
                value={filters.minScore}
                onChange={(e) => {
                  const value = e.target.value;
                  if (
                    value === "" ||
                    (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)
                  ) {
                    setFilters({ ...filters, minScore: value });
                  }
                }}
              />
            </div>
            {/* Saved Only */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={filters.savedOnly}
                className="rounded border-gray-600 bg-gray-700"
                type="checkbox"
                onChange={(e) =>
                  setFilters({ ...filters, savedOnly: e.target.checked })
                }
              />
              <span className="text-sm text-gray-400">Saved only</span>
            </label>
            {/* Unused Only */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={filters.unusedOnly}
                className="rounded border-gray-600 bg-gray-700"
                type="checkbox"
                onChange={(e) =>
                  setFilters({ ...filters, unusedOnly: e.target.checked })
                }
              />
              <span className="text-sm text-gray-400">Unused only</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
