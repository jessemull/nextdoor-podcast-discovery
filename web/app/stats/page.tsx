"use client";

import { useCallback, useEffect, useState } from "react";

import { JobStats } from "@/components/JobStats";
import { ScoreDistributionSection } from "@/components/ScoreDistributionSection";
import { StatsPanel } from "@/components/StatsPanel";
import { Card } from "@/components/ui/Card";

import type { Job, StatsResponse } from "@/lib/types";

const JOBS_LIMIT = 50;

function StatsPageSkeleton() {
  return (
    <>
      <Card className="mb-8 p-6">
        <div className="text-foreground mb-2 h-8 w-48 animate-pulse rounded bg-surface-hover" />
        <div className="text-foreground mb-6 h-4 max-w-md animate-pulse rounded bg-surface-hover" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 rounded-lg border border-white/20 bg-surface-hover/50 p-3"
            >
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-surface-hover" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-12 animate-pulse rounded bg-surface-hover" />
                <div className="h-4 w-20 animate-pulse rounded bg-surface-hover" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mb-8 p-6">
        <div className="text-foreground mb-2 h-8 w-56 animate-pulse rounded bg-surface-hover" />
        <div className="text-foreground mb-6 h-4 max-w-md animate-pulse rounded bg-surface-hover" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 rounded-lg border border-white/20 bg-surface-hover/50 p-3"
            >
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-surface-hover" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-12 animate-pulse rounded bg-surface-hover" />
                <div className="h-4 w-20 animate-pulse rounded bg-surface-hover" />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="mb-8 p-6">
        <div className="text-foreground mb-2 h-8 w-40 animate-pulse rounded bg-surface-hover" />
        <div className="text-foreground mb-6 h-4 max-w-sm animate-pulse rounded bg-surface-hover" />
        <div className="h-48 animate-pulse rounded bg-surface-hover" />
      </Card>
      <Card className="mb-8 p-6">
        <div className="text-foreground mb-2 h-8 w-32 animate-pulse rounded bg-surface-hover" />
        <div className="text-foreground mb-6 h-4 max-w-md animate-pulse rounded bg-surface-hover" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 rounded-lg border border-white/20 bg-surface-hover/50 p-3"
            >
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-surface-hover" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-12 animate-pulse rounded bg-surface-hover" />
                <div className="h-4 w-20 animate-pulse rounded bg-surface-hover" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

export default function StatsPage() {
  const [error, setError] = useState<null | string>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<null | StatsResponse>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [statsRes, jobsRes] = await Promise.all([
        fetch("/api/stats"),
        fetch(
          `/api/admin/jobs?type=recompute_final_scores&limit=${JOBS_LIMIT}`
        ),
      ]);

      if (!statsRes.ok) {
        const data = await statsRes.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to load stats"
        );
      }

      const statsData: StatsResponse = await statsRes.json();
      setStats(statsData);

      if (jobsRes.ok) {
        const jobsData: { data: Job[] } = await jobsRes.json();
        setJobs(jobsData.data ?? []);
      } else {
        setJobs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStats(null);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <main className="min-h-screen p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-3xl font-semibold text-foreground">
            Stats
          </h1>
          <p
            className="text-foreground mb-8 text-sm"
            style={{ opacity: 0.85 }}
          >
            Overview of posts, scores, and jobs.
          </p>
          <StatsPageSkeleton />
        </div>
      </main>
    );
  }

  const scoreDistribution = stats?.score_distribution ?? null;

  return (
    <main className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-3xl font-semibold text-foreground">Stats</h1>
        <p
          className="text-foreground mb-8 text-sm"
          style={{ opacity: 0.85 }}
        >
          Overview of posts, scores, and jobs.
        </p>

        {error && (
          <Card className="border-destructive bg-destructive/10 mb-6 text-destructive text-sm">
            {error}
          </Card>
        )}

        {!error && stats && (
          <>
            <Card className="mb-8 p-6">
              <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
                Post Stats
              </h2>
              <p
                className="text-foreground mb-6 text-sm"
                style={{ opacity: 0.85 }}
              >
                Post counts, scoring status, embedding backlog, and last scrape.
              </p>
              <StatsPanel
                hideStatsHeading
                stats={stats}
                variant="posts-only"
              />
            </Card>

            <Card className="mb-8 p-6">
              <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
                Top Categories (30 Days)
              </h2>
              <p
                className="text-foreground mb-6 text-sm"
                style={{ opacity: 0.85 }}
              >
                Most frequent content categories over the last 30 days.
              </p>
              <StatsPanel
                hideStatsHeading
                stats={stats}
                variant="categories-only"
              />
            </Card>

            <Card className="mb-8 p-6">
              <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
                Score Distribution
              </h2>
              <p
                className="text-foreground mb-6 text-sm"
                style={{ opacity: 0.85 }}
              >
                Min, max, mean, p50, p90 per dimension and final score for
                tuning.
              </p>
              <ScoreDistributionSection
                distribution={scoreDistribution}
                error={null}
                loading={false}
              />
            </Card>

            <Card className="mb-8 p-6">
              <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
                Job Stats
              </h2>
              <p
                className="text-foreground mb-6 text-sm"
                style={{ opacity: 0.85 }}
              >
                Summary of all compute jobs.
              </p>
              <JobStats jobs={jobs} />
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
