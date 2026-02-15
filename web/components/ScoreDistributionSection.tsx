"use client";

import type {
  ScoreDistribution,
  ScoreDistributionStats,
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

interface ScoreDistributionSectionProps {
  distribution: null | ScoreDistribution;
  error: null | string;
  loading: boolean;
}

/**
 * Always-open score distribution table for tuning visibility.
 */
export function ScoreDistributionSection({
  distribution,
  error,
  loading,
}: ScoreDistributionSectionProps) {
  if (loading) {
    return (
      <p className="text-muted-foreground py-4 text-sm">
        Loading...
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-destructive py-4 text-sm">{error}</p>
    );
  }

  if (!distribution || Object.keys(distribution.dimensions).length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-sm">
        No score distribution available.
      </p>
    );
  }

  return (
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
  );
}
