"use client";

import { useState } from "react";

import { TOPIC_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

import type { PostFeedFilters } from "@/lib/hooks/usePostFeedFilters";
import type { Neighborhood } from "@/lib/hooks/usePostFeedFilters";

type SortOption = "date" | "podcast_score" | "score";

export interface FeedFiltersProps {
  filterLoadError: null | string;
  filters: PostFeedFilters;
  neighborhoods: Neighborhood[];
  setFilters: React.Dispatch<React.SetStateAction<PostFeedFilters>>;
  setShowRefineFilters: React.Dispatch<React.SetStateAction<boolean>>;
  showRefineFilters: boolean;
}

/**
 * Filter UI for the post feed: quick chips (Saved, Unused, Drama, Humor)
 * and collapsible refine section (sort, neighborhood, category, min score).
 */
const neighborhoodSearchInputClass =
  "border-border bg-surface-hover placeholder:text-muted-foreground text-foreground min-w-[12rem] w-full rounded border px-2 py-1.5 text-sm focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus";

export function FeedFilters({
  filterLoadError,
  filters,
  neighborhoods,
  setFilters,
  setShowRefineFilters,
  showRefineFilters,
}: FeedFiltersProps) {
  const [neighborhoodSearch, setNeighborhoodSearch] = useState("");
  const neighborhoodSearchLower = neighborhoodSearch.trim().toLowerCase();
  const filteredNeighborhoods =
    neighborhoodSearchLower === ""
      ? neighborhoods
      : neighborhoods.filter((n) =>
          n.name.toLowerCase().includes(neighborhoodSearchLower)
        );
  const chipBase =
    "rounded border px-3 py-1 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus";
  const chipInactive =
    "border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground";
  const chipActive =
    "border-border bg-surface-hover text-foreground";

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      {filterLoadError && (
        <p className="mb-4 text-destructive text-sm" role="alert">
          {filterLoadError}
        </p>
      )}
      {/* Quick filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-muted-foreground self-center text-xs">
          Quick:
        </span>
        <button
          className={cn(
            chipBase,
            filters.savedOnly ? chipActive : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => ({ ...prev, savedOnly: !prev.savedOnly }))
          }
        >
          Saved
        </button>
        <button
          className={cn(
            chipBase,
            filters.ignoredOnly ? chipActive : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => ({ ...prev, ignoredOnly: !prev.ignoredOnly }))
          }
        >
          Ignored
        </button>
        <button
          className={cn(
            chipBase,
            filters.unusedOnly ? chipActive : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => ({ ...prev, unusedOnly: !prev.unusedOnly }))
          }
        >
          Unused
        </button>
        <button
          className={cn(
            chipBase,
            filters.minPodcastWorthy === "7" && filters.sort === "podcast_score"
              ? chipActive
              : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => {
              const isPodcastChipActive =
                prev.minPodcastWorthy === "7" && prev.sort === "podcast_score";
              return {
                ...prev,
                minPodcastWorthy: isPodcastChipActive ? "" : "7",
                sort: isPodcastChipActive ? "score" : "podcast_score",
              };
            })
          }
        >
          Podcast ≥7
        </button>
        <button
          className={cn(
            chipBase,
            filters.minReactionCount !== "" ? chipActive : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              minReactionCount: prev.minReactionCount !== "" ? "" : "5",
            }))
          }
        >
          High engagement
        </button>
        <button
          className={cn(
            chipBase,
            filters.category === "drama" ? chipActive : chipInactive
          )}
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
          className={cn(
            chipBase,
            filters.category === "humor" ? chipActive : chipInactive
          )}
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
        <button
          className={cn(
            chipBase,
            filters.category === "wildlife" ? chipActive : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              category: prev.category === "wildlife" ? "" : "wildlife",
            }))
          }
        >
          Wildlife
        </button>
        <button
          className={cn(
            chipBase,
            filters.category === "crime" ? chipActive : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              category: prev.category === "crime" ? "" : "crime",
            }))
          }
        >
          Crime
        </button>
        <button
          className={cn(
            chipBase,
            filters.category === "lost_pet" ? chipActive : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              category: prev.category === "lost_pet" ? "" : "lost_pet",
            }))
          }
        >
          Lost Pet
        </button>
        <button
          className={cn(
            chipBase,
            filters.category === "local_news" ? chipActive : chipInactive
          )}
          type="button"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              category: prev.category === "local_news" ? "" : "local_news",
            }))
          }
        >
          Local News
        </button>
      </div>
      {/* Refine filters (collapsible) */}
      <div>
        <button
          className="text-muted mb-2 text-sm hover:text-foreground"
          type="button"
          onClick={() => setShowRefineFilters((prev) => !prev)}
        >
          {showRefineFilters ? "▼" : "▶"} Refine filters
        </button>
        {showRefineFilters && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="sort"
              >
                Sort:
              </label>
              <select
                className="rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
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
                <option value="podcast_score">Podcast Score</option>
                <option value="date">Most Recent</option>
              </select>
            </div>
            {/* Neighborhood (multi-select with search) */}
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-sm">
                Neighborhood:
              </span>
              <input
                aria-label="Search neighborhoods"
                className={neighborhoodSearchInputClass}
                placeholder="Search neighborhoods"
                type="search"
                value={neighborhoodSearch}
                onChange={(e) => setNeighborhoodSearch(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    checked={filters.neighborhoodIds.length === 0}
                    className="rounded border-border bg-surface-hover focus:ring-border-focus"
                    type="checkbox"
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        neighborhoodIds: e.target.checked
                          ? []
                          : filters.neighborhoodIds,
                      })
                    }
                  />
                  <span className="text-muted-foreground text-sm">All</span>
                </label>
                {filteredNeighborhoods.map((n) => (
                  <label
                    key={n.id}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      checked={filters.neighborhoodIds.includes(n.id)}
                      className="rounded border-border bg-surface-hover focus:ring-border-focus"
                      type="checkbox"
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          neighborhoodIds: e.target.checked
                            ? [...filters.neighborhoodIds, n.id]
                            : filters.neighborhoodIds.filter(
                                (id) => id !== n.id
                              ),
                        })
                      }
                    />
                    <span className="text-muted-foreground text-sm">
                      {n.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {/* Category */}
            <div className="flex items-center gap-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="category"
              >
                Category:
              </label>
              <select
                className="rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
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
              <label
                className="text-muted-foreground text-sm"
                htmlFor="minScore"
              >
                Min Score:
              </label>
              <input
                className="w-16 rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
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
            {/* Min Podcast Worthy */}
            <div className="flex items-center gap-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="minPodcastWorthy"
              >
                Min Podcast:
              </label>
              <input
                className="w-16 rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
                id="minPodcastWorthy"
                max="10"
                min="0"
                placeholder="0"
                type="number"
                value={filters.minPodcastWorthy}
                onChange={(e) => {
                  const value = e.target.value;
                  if (
                    value === "" ||
                    (!isNaN(parseFloat(value)) &&
                      parseFloat(value) >= 0 &&
                      parseFloat(value) <= 10)
                  ) {
                    setFilters({ ...filters, minPodcastWorthy: value });
                  }
                }}
              />
            </div>
            {/* Min Reactions */}
            <div className="flex items-center gap-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="minReactionCount"
              >
                Min reactions:
              </label>
              <input
                className="w-16 rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
                id="minReactionCount"
                min="0"
                placeholder="0"
                type="number"
                value={filters.minReactionCount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (
                    value === "" ||
                    (!isNaN(parseInt(value, 10)) && parseInt(value, 10) >= 0)
                  ) {
                    setFilters({ ...filters, minReactionCount: value });
                  }
                }}
              />
            </div>
            {/* Saved Only */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={filters.savedOnly}
                className="rounded border-border bg-surface-hover focus:ring-border-focus"
                type="checkbox"
                onChange={(e) =>
                  setFilters({ ...filters, savedOnly: e.target.checked })
                }
              />
              <span className="text-muted-foreground text-sm">
                Saved only
              </span>
            </label>
            {/* Ignored Only */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={filters.ignoredOnly}
                className="rounded border-border bg-surface-hover focus:ring-border-focus"
                type="checkbox"
                onChange={(e) =>
                  setFilters({ ...filters, ignoredOnly: e.target.checked })
                }
              />
              <span className="text-muted-foreground text-sm">
                Ignored only
              </span>
            </label>
            {/* Unused Only */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={filters.unusedOnly}
                className="rounded border-border bg-surface-hover focus:ring-border-focus"
                type="checkbox"
                onChange={(e) =>
                  setFilters({ ...filters, unusedOnly: e.target.checked })
                }
              />
              <span className="text-muted-foreground text-sm">
                Unused only
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
