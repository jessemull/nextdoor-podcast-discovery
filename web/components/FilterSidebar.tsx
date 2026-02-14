"use client";

import { TOPIC_CATEGORIES } from "@/lib/constants";
import { formatCategoryLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

import type { PostFeedFilters } from "@/lib/hooks/usePostFeedFilters";
import type { Neighborhood } from "@/lib/hooks/usePostFeedFilters";

export interface PicksDefaultsSidebar {
  picks_limit: number;
  picks_min: number;
  picks_min_podcast?: number;
}

export interface FilterSidebarProps {
  filterLoadError: null | string;
  filters: PostFeedFilters;
  neighborhoods: Neighborhood[];
  onReset: () => void;
  onSimilarityThresholdChange?: (value: number) => void;
  picksDefaults: null | PicksDefaultsSidebar;
  setFilters: React.Dispatch<React.SetStateAction<PostFeedFilters>>;
  similarityThreshold?: number;
}

const inputClass =
  "w-16 rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1";
const sectionHeadingClass =
  "text-foreground mb-2 mt-4 text-sm font-semibold first:mt-0";
const checkboxLabelClass =
  "flex cursor-pointer items-center gap-2 text-muted-foreground text-sm";

function NumInput({
  id,
  max,
  min,
  onChange,
  placeholder,
  value,
}: {
  id: string;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <input
      className={inputClass}
      id={id}
      max={max}
      min={min}
      placeholder={placeholder}
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FilterSidebar({
  filterLoadError,
  filters,
  neighborhoods,
  onReset,
  onSimilarityThresholdChange,
  picksDefaults,
  setFilters,
  similarityThreshold,
}: FilterSidebarProps) {
  const picksOnlyChecked =
    picksDefaults != null &&
    filters.minScore === String(picksDefaults.picks_min) &&
    (picksDefaults.picks_min_podcast == null
      ? filters.minPodcastWorthy === ""
      : filters.minPodcastWorthy === String(picksDefaults.picks_min_podcast));

  const handlePicksOnlyChange = (checked: boolean) => {
    if (checked && picksDefaults) {
      setFilters((prev) => ({
        ...prev,
        minPodcastWorthy:
          picksDefaults.picks_min_podcast != null
            ? String(picksDefaults.picks_min_podcast)
            : "",
        minScore: String(picksDefaults.picks_min),
        sort:
          picksDefaults.picks_min_podcast != null ? "podcast_score" : "score",
        sortOrder: "desc",
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        minPodcastWorthy: "",
        minScore: "",
        sort: "score",
        sortOrder: "desc",
      }));
    }
  };
  return (
    <aside
      aria-label="Filter posts"
      className="border-border bg-surface flex h-full min-h-0 flex-col border-r pb-4 pl-4"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="pr-4 pt-4">
        {filterLoadError && (
          <p className="mb-4 text-destructive text-sm" role="alert">
            {filterLoadError}
          </p>
        )}

        <h2 className={sectionHeadingClass}>Category</h2>
        <div className="flex flex-col gap-2">
          {TOPIC_CATEGORIES.map((cat) => (
            <label key={cat} className={checkboxLabelClass}>
              <input
                checked={filters.category === cat}
                className="rounded border-border bg-surface-hover focus:ring-border-focus"
                type="checkbox"
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    category: e.target.checked ? cat : "",
                  }))
                }
              />
              {formatCategoryLabel(cat)}
            </label>
          ))}
        </div>

        <h2 className={sectionHeadingClass}>Status</h2>
        <div className="flex flex-col gap-2">
          <label className={checkboxLabelClass}>
            <input
              checked={filters.savedOnly}
              className="rounded border-border bg-surface-hover focus:ring-border-focus"
              type="checkbox"
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, savedOnly: e.target.checked }))
              }
            />
            Saved Only
          </label>
          <label className={checkboxLabelClass}>
            <input
              checked={filters.ignoredOnly}
              className="rounded border-border bg-surface-hover focus:ring-border-focus"
              type="checkbox"
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, ignoredOnly: e.target.checked }))
              }
            />
            Ignored Only
          </label>
          <label className={checkboxLabelClass}>
            <input
              checked={filters.unusedOnly}
              className="rounded border-border bg-surface-hover focus:ring-border-focus"
              type="checkbox"
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, unusedOnly: e.target.checked }))
              }
            />
            Unused Only
          </label>
        </div>

        {picksDefaults != null && (
          <>
            <h2 className={sectionHeadingClass}>Quick Filter</h2>
            <label className={checkboxLabelClass}>
              <input
                checked={picksOnlyChecked}
                className="rounded border-border bg-surface-hover focus:ring-border-focus"
                type="checkbox"
                onChange={(e) => handlePicksOnlyChange(e.target.checked)}
              />
              Top Picks
            </label>
          </>
        )}

        <h2 className={sectionHeadingClass}>Score Range</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="filter-min-score">
            Min Score
          </label>
          <NumInput
            id="filter-min-score"
            min={0}
            placeholder="0"
            value={filters.minScore}
            onChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                minScore:
                  v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0)
                    ? v
                    : prev.minScore,
              }))
            }
          />
          <span className="text-muted-foreground text-sm">to</span>
          <label className="sr-only" htmlFor="filter-max-score">
            Max Score
          </label>
          <NumInput
            id="filter-max-score"
            min={0}
            placeholder="10"
            value={filters.maxScore}
            onChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                maxScore:
                  v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0)
                    ? v
                    : prev.maxScore,
              }))
            }
          />
        </div>

        <h2 className={sectionHeadingClass}>Podcast Score Range</h2>
        <div className="flex flex-wrap items-center gap-2">
          <NumInput
            id="filter-min-podcast"
            max={10}
            min={0}
            placeholder="0"
            value={filters.minPodcastWorthy}
            onChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                minPodcastWorthy:
                  v === "" ||
                  (!isNaN(parseFloat(v)) &&
                    parseFloat(v) >= 0 &&
                    parseFloat(v) <= 10)
                    ? v
                    : prev.minPodcastWorthy,
              }))
            }
          />
          <span className="text-muted-foreground text-sm">to</span>
          <NumInput
            id="filter-max-podcast"
            max={10}
            min={0}
            placeholder="10"
            value={filters.maxPodcastWorthy}
            onChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                maxPodcastWorthy:
                  v === "" ||
                  (!isNaN(parseFloat(v)) &&
                    parseFloat(v) >= 0 &&
                    parseFloat(v) <= 10)
                    ? v
                    : prev.maxPodcastWorthy,
              }))
            }
          />
        </div>

        <h2 className={sectionHeadingClass}>Reactions Range</h2>
        <div className="flex flex-wrap items-center gap-2">
          <NumInput
            id="filter-min-reactions"
            min={0}
            placeholder="0"
            value={filters.minReactionCount}
            onChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                minReactionCount:
                  v === "" ||
                  (!isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 0)
                    ? v
                    : prev.minReactionCount,
              }))
            }
          />
          <span className="text-muted-foreground text-sm">to</span>
          <NumInput
            id="filter-max-reactions"
            min={0}
            placeholder="—"
            value={filters.maxReactionCount}
            onChange={(v) =>
              setFilters((prev) => ({
                ...prev,
                maxReactionCount:
                  v === "" ||
                  (!isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 0)
                    ? v
                    : prev.maxReactionCount,
              }))
            }
          />
        </div>

        {similarityThreshold !== undefined &&
          onSimilarityThresholdChange && (
            <>
              <h2 className={sectionHeadingClass}>Search Similarity</h2>
              <div className="space-y-1">
                <label
                  className="text-muted-foreground block text-xs"
                  htmlFor="sidebar-similarity-threshold"
                >
                  {(similarityThreshold * 10).toFixed(1)} (Loose → Strict)
                </label>
                <input
                  className="similarity-slider h-1.5 w-full appearance-none rounded-full bg-surface-hover focus:outline-none focus:ring-1 focus:ring-border-focus"
                  id="sidebar-similarity-threshold"
                  max={10}
                  min={0}
                  step={0.5}
                  type="range"
                  value={similarityThreshold * 10}
                  onChange={(e) =>
                    onSimilarityThresholdChange(
                      parseFloat(e.target.value) / 10
                    )
                  }
                />
              </div>
            </>
          )}

        <h2 className={sectionHeadingClass}>Neighborhood</h2>
        <div className="flex flex-col gap-2">
          <label className={checkboxLabelClass}>
            <input
              checked={filters.neighborhoodId === ""}
              className="rounded border-border bg-surface-hover focus:ring-border-focus"
              type="checkbox"
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  neighborhoodId: e.target.checked ? "" : prev.neighborhoodId,
                }))
              }
            />
            All
          </label>
          {neighborhoods.map((n) => (
            <label key={n.id} className={cn(checkboxLabelClass, "truncate")}>
              <input
                checked={filters.neighborhoodId === n.id}
                className="rounded border-border bg-surface-hover focus:ring-border-focus"
                type="checkbox"
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    neighborhoodId: e.target.checked ? n.id : "",
                  }))
                }
              />
              {n.name}
            </label>
          ))}
        </div>
        </div>
      </div>

      <div className="shrink-0 pr-4 pt-4">
        <button
          className="border-border bg-surface-hover text-foreground w-full rounded border px-3 py-2 text-sm transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus"
          type="button"
          onClick={onReset}
        >
          Clear All Filters
        </button>
      </div>
    </aside>
  );
}
