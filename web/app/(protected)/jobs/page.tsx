"use client";

import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { JobsList } from "@/components/JobsList";
import { JobsPageSkeleton } from "@/components/JobsPageSkeleton";
import { JobStats } from "@/components/JobStats";
import { PermalinkQueueSection } from "@/components/PermalinkQueueSection";
import { ScraperRunsSection } from "@/components/ScraperRunsSection";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/lib/ToastContext";

import type { Job, ScraperRun } from "@/lib/types";

const JOBS_LIMIT = 50;
const POLL_INTERVAL_MS = 8000;

type FinishedStatusFilter =
  | ""
  | "cancelled"
  | "completed"
  | "error";

export default function JobsPage() {
  const { toast } = useToast();
  const [cancelConfirmJobId, setCancelConfirmJobId] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [retryConfirmJobId, setRetryConfirmJobId] = useState<null | string>(null);
  const [scraperRetryConfirmRun, setScraperRetryConfirmRun] =
    useState<null | ScraperRun>(null);
  const [finishedFilter, setFinishedFilter] =
    useState<FinishedStatusFilter>("");
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [permalinkJobs, setPermalinkJobs] = useState<Job[]>([]);
  const [queuedRetryRunIds, setQueuedRetryRunIds] = useState<string[]>([]);
  const [runScraperJobs, setRunScraperJobs] = useState<Job[]>([]);
  const [scraperRuns, setScraperRuns] = useState<ScraperRun[]>([]);

  const fetchJobs = useCallback(async () => {
    setError(null);
    try {
      const [res, permalinkRes] = await Promise.all([
        fetch(
          `/api/admin/jobs?type=recompute_final_scores&limit=${JOBS_LIMIT}`
        ),
        fetch("/api/admin/jobs?type=fetch_permalink&limit=20"),
      ]);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to load jobs"
        );
      }
      const data: { data: Job[] } = await res.json();
      setJobs(data.data ?? []);
      if (permalinkRes.ok) {
        const permalinkData: { data: Job[] } = await permalinkRes.json();
        setPermalinkJobs(permalinkData.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchScraperRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/scraper-runs?days=7");
      if (!res.ok) return;
      const json: {
        data: ScraperRun[];
        queued_retry_run_ids?: string[];
      } = await res.json();
      setScraperRuns(json.data ?? []);
      setQueuedRetryRunIds(json.queued_retry_run_ids ?? []);
    } catch {
      // Non-fatal; leave scraper runs as-is
    }
  }, []);

  const fetchRunScraperJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/jobs?type=run_scraper&limit=20");
      if (!res.ok) return;
      const json: { data: Job[] } = await res.json();
      setRunScraperJobs(json.data ?? []);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    void fetchScraperRuns();
  }, [fetchScraperRuns]);

  useEffect(() => {
    void fetchRunScraperJobs();
  }, [fetchRunScraperJobs]);

  useEffect(() => {
    const hasActiveRecompute = jobs.some(
      (j) => j.status === "pending" || j.status === "running"
    );
    const hasActivePermalink = permalinkJobs.some(
      (j) => j.status === "pending" || j.status === "running"
    );
    const hasActiveRunScraper = runScraperJobs.some(
      (j) => j.status === "pending" || j.status === "running"
    );
    if (!hasActiveRecompute && !hasActivePermalink && !hasActiveRunScraper)
      return;
    const interval = setInterval(() => {
      void fetchJobs();
      void fetchRunScraperJobs();
      if (hasActiveRunScraper) void fetchScraperRuns();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [
    fetchJobs,
    fetchRunScraperJobs,
    fetchScraperRuns,
    jobs,
    permalinkJobs,
    runScraperJobs,
  ]);

  const handleRequestCancel = useCallback((jobId: string) => {
    setCancelConfirmJobId(jobId);
  }, []);

  const handleConfirmCancel = useCallback(() => {
    if (cancelConfirmJobId == null) return;
    const jobId = cancelConfirmJobId;
    const job =
      jobs.find((j) => j.id === jobId) ??
      permalinkJobs.find((j) => j.id === jobId);
    const isPermalink = job?.type === "fetch_permalink";
    setCancelConfirmJobId(null);
    (async () => {
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
        toast.success(isPermalink ? "Removed from queue." : "Job cancelled.");
      } catch {
        toast.error("Failed to cancel job.");
        await fetchJobs();
      }
    })();
  }, [cancelConfirmJobId, fetchJobs, jobs, permalinkJobs, toast]);

  const handleRetry = useCallback(
    (jobId: string) => {
      (async () => {
        try {
          const res = await fetch(`/api/admin/jobs/${jobId}/retry`, {
            method: "POST",
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              (data as { error?: string }).error ?? "Failed to retry job"
            );
          }
          await fetchJobs();
          toast.success("Job queued for retry.");
        } catch {
          toast.error("Failed to retry job.");
          await fetchJobs();
        }
      })();
    },
    [fetchJobs, toast]
  );

  const handleRequestRetry = useCallback((jobId: string) => {
    setRetryConfirmJobId(jobId);
  }, []);

  const handleRequestScraperRetry = useCallback((run: ScraperRun) => {
    setScraperRetryConfirmRun(run);
  }, []);

  const handleScraperRetry = useCallback(
    async (run: ScraperRun) => {
      try {
        const res = await fetch("/api/admin/trigger-scrape", {
          body: JSON.stringify({
            feed_type: run.feed_type === "trending" ? "trending" : "recent",
            scraper_run_id: run.id,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? "Failed to trigger scrape"
          );
        }
        await fetchScraperRuns();
        toast.success("Scrape job queued; the worker will run it shortly.");
      } catch {
        toast.error("Failed to trigger scrape.");
      }
    },
    [fetchScraperRuns, toast]
  );

  // Queue: all pending/running (no filter). Finished: filter by outcome.
  const queueJobs = jobs
    .filter((j) => j.status === "pending" || j.status === "running")
    .sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  const allFinished = jobs.filter(
    (j) =>
      j.status === "completed" || j.status === "error" || j.status === "cancelled"
  );
  const finishedJobs = (finishedFilter === ""
    ? allFinished
    : allFinished.filter((j) => j.status === finishedFilter)
  ).sort((a, b) => {
    const aEnd = a.completed_at ?? a.cancelled_at ?? a.created_at;
    const bEnd = b.completed_at ?? b.cancelled_at ?? b.created_at;
    return new Date(bEnd).getTime() - new Date(aEnd).getTime();
  });

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target as Node)
      ) {
        setFilterMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [filterMenuOpen]);

  const finishedFilterOptions: { label: string; value: FinishedStatusFilter }[] =
    [
      { label: "All", value: "" },
      { label: "Completed", value: "completed" },
      { label: "Error", value: "error" },
      { label: "Cancelled", value: "cancelled" },
    ];

  const finishedFilterControl = (
    <div className="relative" ref={filterMenuRef}>
      <button
        aria-expanded={filterMenuOpen}
        aria-haspopup="menu"
        aria-label="Filter finished jobs"
        className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
        type="button"
        onClick={() => setFilterMenuOpen((o) => !o)}
      >
        <MoreHorizontal
          aria-hidden
          className="h-4 w-4 text-foreground"
        />
      </button>
      {filterMenuOpen && (
        <ul
          className="border-border bg-surface absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-card border py-1 shadow-lg"
          role="menu"
        >
          {finishedFilterOptions.map((opt) => (
            <li key={opt.value || "all"} role="none">
              <button
                className="cursor-pointer w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                role="menuitem"
                type="button"
                onClick={() => {
                  setFinishedFilter(opt.value);
                  setFilterMenuOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-3xl font-semibold text-foreground">
            Jobs
          </h1>
          <p
            className="text-foreground mb-8 text-sm"
            style={{ opacity: 0.85 }}
          >
            View stats and manage jobs.
          </p>
          <JobsPageSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
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

        <ScraperRunsSection
          queuedRetryRunIds={queuedRetryRunIds}
          runs={scraperRuns}
          onRetry={handleRequestScraperRetry}
        />

        <section className="mb-8">
          <PermalinkQueueSection
            permalinkJobs={permalinkJobs}
            setPermalinkJobs={setPermalinkJobs}
            onCancel={handleRequestCancel}
          />
        </section>

        <JobsList
          description="Pending and running jobs, in queue order. One job runs at a time."
          emptyMessage="No jobs in queue."
          jobs={queueJobs}
          showManageLink={false}
          showStats={false}
          title="Job Queue"
          variant="queue"
          onCancel={handleRequestCancel}
        />

        <JobsList
          description="Jobs that are done—completed, failed, or cancelled. The badge on each card shows what happened."
          emptyMessage="No finished jobs."
          headerRightContent={finishedFilterControl}
          jobs={finishedJobs}
          showManageLink={false}
          showStats={false}
          title="Finished Jobs"
          variant="finished"
          onCancel={handleRequestCancel}
          onRetry={handleRequestRetry}
        />

        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Submit"
          message="Are you sure you want to cancel this job?"
          open={cancelConfirmJobId != null}
          title="Cancel Job"
          onCancel={() => setCancelConfirmJobId(null)}
          onConfirm={handleConfirmCancel}
        />

        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Retry"
          message="Are you sure you want to re-queue the job again?"
          open={retryConfirmJobId != null}
          title="Retry Job"
          onCancel={() => setRetryConfirmJobId(null)}
          onConfirm={() => {
            if (retryConfirmJobId != null) {
              handleRetry(retryConfirmJobId);
              setRetryConfirmJobId(null);
            }
          }}
        />

        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Retry"
          message="Re-run this scrape? The worker will process it shortly."
          open={scraperRetryConfirmRun != null}
          title="Retry scrape?"
          onCancel={() => setScraperRetryConfirmRun(null)}
          onConfirm={() => {
            if (scraperRetryConfirmRun != null) {
              void handleScraperRetry(scraperRetryConfirmRun);
              setScraperRetryConfirmRun(null);
            }
          }}
        />
      </div>
    </main>
  );
}
