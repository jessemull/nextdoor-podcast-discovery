"use client";

import { TOPIC_CATEGORIES } from "@/lib/constants";
import { formatCategoryLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

import type { PostFeedFilters } from "@/lib/hooks/usePostFeedFilters";
import type { Neighborhood } from "@/lib/hooks/usePostFeedFilters";

export interface FilterSidebarProps {
  filterLoadError: null | string;
  filters: PostFeedFilters;
  neighborhoods: Neighborhood[];
  onReset: () => void;
  setFilters: React.Dispatch<React.SetStateAction<PostFeedFilters>>;
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
  setFilters,
}: FilterSidebarProps) {
  return (
    <aside
      aria-label="Filter posts"
      className="flex flex-col rounded-card border border-border bg-surface p-4"
    >
      {filterLoadError && (
        <p className="mb-4 text-destructive text-sm" role="alert">
          {filterLoadError}
        </p>
      )}

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

      <h2 className={sectionHeadingClass}>Neighborhood</h2>
      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
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

      <button
        className="border-border bg-surface-hover text-foreground mt-6 rounded border px-3 py-2 text-sm transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus"
        type="button"
        onClick={onReset}
      >
        Clear All Filters
      </button>
    </aside>
  );
}
