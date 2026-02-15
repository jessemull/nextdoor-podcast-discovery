"use client";

import { useCallback, useEffect, useState } from "react";

import { JobStats } from "@/components/JobStats";
import { JobsList } from "@/components/JobsList";
import { Card } from "@/components/ui/Card";

import type { Job } from "@/lib/types";

const JOBS_LIMIT = 50;
const POLL_INTERVAL_MS = 8000;

type StatusFilter = "" | "cancelled" | "completed" | "error" | "pending" | "running";

export default function JobsPage() {
  const [cancellingJobId, setCancellingJobId] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const fetchJobs = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/jobs?type=recompute_final_scores&limit=${JOBS_LIMIT}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to load jobs"
        );
      }
      const data: { data: Job[] } = await res.json();
      setJobs(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const hasActive = jobs.some(
      (j) => j.status === "pending" || j.status === "running"
    );
    if (!hasActive) return;
    const interval = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  const handleCancel = useCallback(
    async (jobId: string) => {
      if (cancellingJobId) return;
      setCancellingJobId(jobId);
      setError(null);
      try {
        const res = await fetch(`/api/admin/jobs/${jobId}/cancel`, {
          method: "PUT",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? "Failed to cancel job"
          );
        }
        await fetchJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to cancel");
      } finally {
        setCancellingJobId(null);
      }
    },
    [cancellingJobId, fetchJobs]
  );

  const filteredJobs =
    statusFilter === ""
      ? jobs
      : jobs.filter((j) => j.status === statusFilter);

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-3xl font-semibold text-foreground">Jobs</h1>
        <p
          className="text-foreground mb-8 text-sm"
          style={{ opacity: 0.85 }}
        >
          View stats and manage jobs.
        </p>

        {error && (
          <Card className="border-destructive bg-destructive/10 mb-6 text-destructive text-sm">
            {error}
          </Card>
        )}

        <Card className="mb-8 p-6">
          <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
            Stats
          </h2>
          <p
            className="text-foreground mb-6 text-sm"
            style={{ opacity: 0.85 }}
          >
            Summary of all compute jobs.
          </p>
          <JobStats jobs={jobs} />
        </Card>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              Filter by status:
            </span>
            <select
              className="rounded border border-border bg-surface-hover px-2 py-1 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="error">Error</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>

        {filteredJobs.length === 0 && !error && (
          <Card className="p-6">
            <p className="text-muted text-sm">
              {jobs.length === 0
                ? "No jobs yet."
                : `No jobs with status "${statusFilter}".`}
            </p>
          </Card>
        )}

        {filteredJobs.length > 0 && (
          <JobsList
            cancellingJobId={cancellingJobId}
            description="Jobs run one at a time in queue order. Filter by status below or cancel pending and running jobs."
            jobs={filteredJobs}
            showManageLink={false}
            showStats={false}
            title="Job Queue"
            onCancel={handleCancel}
          />
        )}
      </div>
    </main>
  );
}
