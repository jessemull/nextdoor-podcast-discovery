"use client";

import { useEffect, useState } from "react";

import type { StatsResponse, TopicFrequency } from "@/lib/types";

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
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-24 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 bg-gray-700 rounded" />
          <div className="h-16 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200 text-sm">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Stats</h3>

      {/* Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard color="blue" label="Total Posts" value={stats.posts_total} />
        <StatCard color="green" label="Scored" value={stats.posts_scored} />
        <StatCard color="yellow" label="Unscored" value={stats.posts_unscored} />
        <StatCard color="purple" label="Used" value={stats.posts_used} />
      </div>

      {/* Top Categories */}
      {stats.top_categories.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 mb-2">
            Top Categories (30 days)
          </h4>
          <div className="flex flex-wrap gap-2">
            {stats.top_categories.slice(0, 5).map((cat: TopicFrequency) => (
              <span
                key={cat.category}
                className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
              >
                {cat.category}: {cat.count_30d}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Internal component for displaying individual statistic cards.
 * Color-coded for visual distinction.
 */
function StatCard({
  color,
  label,
  value,
}: {
  color: "blue" | "green" | "purple" | "yellow";
  label: string;
  value: number;
}) {
  const colorClasses = {
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="bg-gray-700/50 rounded p-3">
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
