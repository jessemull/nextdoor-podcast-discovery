"use client";

import { useCallback, useState } from "react";

import { Card } from "@/components/ui/Card";

import type {
  ScoreDistribution,
  ScoreDistributionStats,
  StatsResponse,
} from "@/lib/types";

const DIMENSION_LABELS: Record<string, string> = {
  absurdity: "Absurdity",
  discussion_spark: "Discussion Spark",
  drama: "Drama",
  emotional_intensity: "Emotional Intensity",
  news_value: "News Value",
  podcast_worthy: "Podcast Worthy",
  readability: "Readability",
};

function StatRow({
  label,
  stats,
}: {
  label: string;
  stats: ScoreDistributionStats;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-medium text-foreground">{label}</td>
      <td className="py-2 pr-4 text-right text-muted-foreground">
        {stats.min}
      </td>
      <td className="py-2 pr-4 text-right text-muted-foreground">
        {stats.max}
      </td>
      <td className="py-2 pr-4 text-right text-muted-foreground">
        {stats.mean}
      </td>
      <td className="py-2 pr-4 text-right text-muted-foreground">
        {stats.p50}
      </td>
      <td className="py-2 pr-4 text-right text-muted-foreground">
        {stats.p90}
      </td>
    </tr>
  );
}

/**
 * Collapsible score distribution section for tuning visibility.
 */
export function SettingsScoreDistribution() {
  const [distribution, setDistribution] =
    useState<null | ScoreDistribution>(null);
  const [error, setError] = useState<null | string>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDistribution = useCallback(async () => {
    if (distribution != null) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stats");
      const data: StatsResponse = await res.json();
      if (!res.ok) {
        setError("Failed to load score distribution");
        return;
      }
      if (data.score_distribution) {
        setDistribution(data.score_distribution);
      } else {
        setError("No score distribution available");
      }
    } catch {
      setError("Failed to load score distribution");
    } finally {
      setIsLoading(false);
    }
  }, [distribution]);

  const handleToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) {
      fetchDistribution();
    }
  };

  return (
    <Card className="mb-8 p-6">
      <button
        className="text-foreground flex w-full items-center justify-between text-left"
        type="button"
        onClick={handleToggle}
      >
        <h2 className="text-2xl font-semibold tracking-wide">
          Score Distribution
        </h2>
        <span className="text-muted-foreground text-sm">
          {isExpanded ? "▼" : "▶"}
        </span>
      </button>
      <p
        className="text-foreground mb-4 mt-2 text-sm"
        style={{ opacity: 0.85 }}
      >
        Min, max, mean, p50, p90 per dimension and final_score for tuning.
      </p>
      {isExpanded && (
        <>
          {isLoading && (
            <p className="text-muted-foreground py-4 text-sm">
              Loading...
            </p>
          )}
          {error && (
            <p className="text-destructive py-4 text-sm">{error}</p>
          )}
          {!isLoading && !error && distribution && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left font-medium text-foreground">
                      Dimension
                    </th>
                    <th className="pb-2 pr-4 text-right font-medium text-foreground">
                      Min
                    </th>
                    <th className="pb-2 pr-4 text-right font-medium text-foreground">
                      Max
                    </th>
                    <th className="pb-2 pr-4 text-right font-medium text-foreground">
                      Mean
                    </th>
                    <th className="pb-2 pr-4 text-right font-medium text-foreground">
                      P50
                    </th>
                    <th className="pb-2 pr-4 text-right font-medium text-foreground">
                      P90
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(distribution.dimensions)
                    .sort()
                    .map((dim) => (
                      <StatRow
                        key={dim}
                        label={DIMENSION_LABELS[dim] ?? dim}
                        stats={distribution.dimensions[dim]}
                      />
                    ))}
                  {distribution.final_score && (
                    <StatRow
                      label="Final Score"
                      stats={distribution.final_score}
                    />
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
