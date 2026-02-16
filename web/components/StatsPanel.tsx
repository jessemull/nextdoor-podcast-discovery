"use client";

import {
  AlertTriangle,
  AudioLines,
  BadgeAlert,
  BadgeCheck,
  Bird,
  BookmarkCheck,
  Cctv,
  Clock,
  Drama,
  Files,
  Layers,
  Newspaper,
  PartyPopper,
  PawPrint,
  Percent,
  RefreshCw,
  Tag,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { formatCategoryLabel } from "@/lib/utils";

import type { StatsResponse, TopicFrequency } from "@/lib/types";
import type { ReactNode } from "react";

const STATS_GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4";

/** Compact datetime for "Last scrape" so it fits in the stat card. */
function formatLastScrape(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
  crime: <Cctv aria-hidden className="h-9 w-9" strokeWidth={1.5} />,
  drama: <Drama aria-hidden className="h-9 w-9" strokeWidth={1.5} />,
  humor: <PartyPopper aria-hidden className="h-9 w-9" strokeWidth={1.5} />,
  local_news: <Newspaper aria-hidden className="h-9 w-9" strokeWidth={1.5} />,
  lost_pet: <PawPrint aria-hidden className="h-9 w-9" strokeWidth={1.5} />,
  noise: <AudioLines aria-hidden className="h-9 w-9" strokeWidth={1.5} />,
  suspicious: <AlertTriangle aria-hidden className="h-9 w-9" strokeWidth={1.5} />,
  wildlife: <Bird aria-hidden className="h-9 w-9" strokeWidth={1.5} />,
};

const ALERT_SLOT_MIN_H = "min-h-[4.5rem]";

/**
 * Compact stat cell: icon + value + label, fixed min-height, no aspect ratio.
 * Value is primary; label is secondary. Optional title for full value on hover (e.g. datetime).
 */
function StatCell({
  icon,
  label,
  title,
  value,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 rounded-lg border border-white/20 bg-surface-hover/50 p-3">
      <div className="flex shrink-0 items-center justify-center text-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          className="text-foreground truncate text-xl font-bold leading-tight"
          title={title}
        >
          {value}
        </div>
        <div className="text-muted-foreground truncate text-sm">{label}</div>
      </div>
    </div>
  );
}

function StatsSection({
  hideHeading,
  loading,
  stats,
}: {
  hideHeading?: boolean;
  loading: boolean;
  stats: null | StatsResponse;
}) {
  return (
    <section>
      {!hideHeading && (
        <h2 className="mb-8 text-center text-3xl font-bold tracking-tight text-foreground">
          Stats
        </h2>
      )}
      <div className={STATS_GRID_CLASS}>
        {loading
          ? [...Array(8)].map((_, i) => (
              <div
                key={i}
                className="flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 rounded-lg border border-white/20 bg-surface-hover/50 p-3"
              >
                <div className="h-9 w-9 shrink-0 rounded bg-surface-hover animate-pulse" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-6 w-12 rounded bg-surface-hover animate-pulse" />
                  <div className="h-4 w-20 rounded bg-surface-hover animate-pulse" />
                </div>
              </div>
            ))
          : stats && (
              <>
                <StatCell
                  icon={<Files aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
                  label="Total Posts"
                  value={String(stats.posts_total)}
                />
                <StatCell
                  icon={<BadgeCheck aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
                  label="Scored"
                  value={String(stats.posts_scored)}
                />
                <StatCell
                  icon={<BadgeAlert aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
                  label="Unscored"
                  value={String(stats.posts_unscored)}
                />
                <StatCell
                  icon={<Percent aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
                  label="Scored %"
                  value={
                    stats.posts_total > 0
                      ? `${Math.round((stats.posts_scored / stats.posts_total) * 100)}%`
                      : "—"
                  }
                />
                <StatCell
                  icon={<BookmarkCheck aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
                  label="Used"
                  value={String(stats.posts_used)}
                />
                <StatCell
                  icon={<Clock aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
                  label="Posts (24h)"
                  value={String(stats.posts_last_24h ?? 0)}
                />
                <StatCell
                  icon={<Layers aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
                  label="Embedding Backlog"
                  value={String(stats.embedding_backlog ?? 0)}
                />
                <StatCell
                  icon={<RefreshCw aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
                  label="Last Scrape"
                  title={
                    stats.last_scrape_at
                      ? new Date(stats.last_scrape_at).toLocaleString()
                      : undefined
                  }
                  value={
                    stats.last_scrape_at
                      ? formatLastScrape(stats.last_scrape_at)
                      : "—"
                  }
                />
              </>
            )}
      </div>
    </section>
  );
}

function CategoriesSection({
  categories,
  hideHeading,
  loading,
}: {
  categories: TopicFrequency[];
  hideHeading?: boolean;
  loading: boolean;
}) {
  return (
    <section>
      {!hideHeading && (
        <h3 className="mb-8 text-center text-3xl font-bold tracking-tight text-foreground">
          Top Categories (30 Days)
        </h3>
      )}
      <div className={STATS_GRID_CLASS}>
        {loading
          ? [...Array(8)].map((_, i) => (
              <div
                key={i}
                className="flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 rounded-lg border border-white/20 bg-surface-hover/50 p-3"
              >
                <div className="h-9 w-9 shrink-0 rounded bg-surface-hover animate-pulse" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-6 w-12 rounded bg-surface-hover animate-pulse" />
                  <div className="h-4 w-20 rounded bg-surface-hover animate-pulse" />
                </div>
              </div>
            ))
          : categories.map((cat: TopicFrequency) => (
              <StatCell
                key={cat.category}
                icon={
                  CATEGORY_ICONS[cat.category] ?? (
                    <Tag
                      aria-hidden
                      className="h-9 w-9"
                      strokeWidth={1.5}
                    />
                  )
                }
                label={formatCategoryLabel(cat.category)}
                value={String(cat.count_30d)}
              />
            ))}
      </div>
    </section>
  );
}

type StatsPanelVariant = "categories-only" | "full" | "posts-only";

interface StatsPanelProps {
  hideStatsHeading?: boolean;
  stats?: null | StatsResponse;
  variant?: StatsPanelVariant;
}

/**
 * StatsPanel component displays dashboard statistics about posts and categories.
 *
 * Shows:
 * - Total posts count
 * - Scored vs unscored posts
 * - Posts used in episodes
 * - Top categories by frequency (30-day window)
 *
 * Features:
 * - Loading state with skeleton UI
 * - Error handling with user-friendly messages
 * - Responsive grid layout
 *
 * @example
 * ```tsx
 * <StatsPanel />
 * <StatsPanel stats={stats} hideStatsHeading />
 * ```
 */
export function StatsPanel({
  hideStatsHeading = false,
  stats: statsProp,
  variant = "full",
}: StatsPanelProps = {}) {
  const [error, setError] = useState<null | string>(null);
  const [loading, setLoading] = useState(statsProp == null);
  const [stats, setStats] = useState<null | StatsResponse>(statsProp ?? null);

  useEffect(() => {
    if (statsProp != null) {
      setStats(statsProp);
      setLoading(false);
      return;
    }

    async function fetchStats() {
      try {
        const response = await fetch("/api/stats");

        if (!response.ok) {
          throw new Error("Failed to fetch stats");
        }

        const data: StatsResponse = await response.json();
        setStats(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        console.error("Failed to fetch stats:", err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    void fetchStats();
  }, [statsProp]);

  if (loading) {
    return (
      <div className={variant === "full" ? "space-y-24" : ""}>
        {variant !== "categories-only" && (
          <>
            <div aria-hidden className="h-0" />
            <StatsSection
              hideHeading={hideStatsHeading}
              loading
              stats={null}
            />
          </>
        )}
        {variant !== "posts-only" && (
          <CategoriesSection
            categories={[]}
            hideHeading={variant === "categories-only"}
            loading
          />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive bg-destructive/10 text-destructive text-sm">
        {error}
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <div className={variant === "full" ? "space-y-24" : ""}>
      {variant !== "categories-only" && (
        <StatsSection
          hideHeading={hideStatsHeading}
          loading={false}
          stats={stats}
        />
      )}
      {variant !== "posts-only" && (
        <CategoriesSection
          categories={stats.top_categories}
          hideHeading={variant === "categories-only"}
          loading={false}
        />
      )}
    </div>
  );
}
