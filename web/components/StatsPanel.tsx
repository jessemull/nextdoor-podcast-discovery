"use client";

import {
  CheckCircle,
  Clock,
  Database,
  FileText,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";

import type { StatsResponse, TopicFrequency } from "@/lib/types";
import type { ReactNode } from "react";

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
 * ```
 */
export function StatsPanel() {
  const [error, setError] = useState<null | string>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<null | StatsResponse>(null);

  useEffect(() => {
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

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="mb-4 h-4 w-24 rounded bg-surface-hover" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 rounded bg-surface-hover" />
          <div className="h-16 rounded bg-surface-hover" />
        </div>
      </Card>
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

  const embeddingBacklog = stats.embedding_backlog ?? 0;

  return (
    <div className="space-y-4">
      {embeddingBacklog > 100 && (
        <Card className="border-border-focus" role="alert">
          <p className="text-muted text-sm">
            <strong className="text-foreground">
              {embeddingBacklog} posts need embeddings.
            </strong>{" "}
            Semantic search may miss recent posts until the daily embed job runs.
            Embeddings are generated after each scrape.
          </p>
        </Card>
      )}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Stats</h3>

        {/* Counts */}
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={<FileText aria-hidden className="h-4 w-4" />}
            label="Total Posts"
            value={stats.posts_total}
          />
          <StatCard
            icon={<CheckCircle aria-hidden className="h-4 w-4" />}
            label="Scored"
            value={stats.posts_scored}
          />
          <StatCard
            icon={<Clock aria-hidden className="h-4 w-4" />}
            label="Unscored"
            value={stats.posts_unscored}
          />
          <StatCard
            icon={<Database aria-hidden className="h-4 w-4" />}
            label="Used"
            value={stats.posts_used}
          />
        </div>

        {/* Health */}
        <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded bg-surface-hover/50 p-3">
            <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted" />
            <div>
              <div className="text-muted-foreground">Posts (24h)</div>
              <div className="text-lg font-semibold text-foreground">
                {stats.posts_last_24h ?? 0}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded bg-surface-hover/50 p-3">
            <Database aria-hidden className="h-4 w-4 shrink-0 text-muted" />
            <div>
              <div className="text-muted-foreground">Embedding backlog</div>
              <div className="text-lg font-semibold text-foreground">
                {stats.embedding_backlog ?? 0}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded bg-surface-hover/50 p-3">
            <Clock aria-hidden className="h-4 w-4 shrink-0 text-muted" />
            <div>
              <div className="text-muted-foreground">Last scrape</div>
              <div className="text-muted text-xs font-medium">
                {stats.last_scrape_at
                  ? new Date(stats.last_scrape_at).toLocaleString()
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Top Categories */}
        {stats.top_categories.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
              Top Categories (30 days)
            </h4>
            <div className="flex flex-wrap gap-2">
              {stats.top_categories.slice(0, 5).map((cat: TopicFrequency) => (
                <span
                  key={cat.category}
                  className="rounded bg-surface-hover px-2 py-1 text-muted text-xs"
                >
                  {cat.category}: {cat.count_30d}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Internal component for displaying individual statistic cards.
 * Neutral style per design system.
 */
function StatCard({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded bg-surface-hover/50 p-3">
      {icon && (
        <span className="shrink-0 text-muted">{icon}</span>
      )}
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-muted-foreground text-xs">{label}</div>
      </div>
    </div>
  );
}
