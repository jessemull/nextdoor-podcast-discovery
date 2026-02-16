"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { useToast } from "@/lib/ToastContext";
import { formatRelativeTime } from "@/lib/utils";

import type { Job } from "@/lib/types";

function makeOptimisticJob(url: string): Job {
  return {
    cancelled_at: null,
    cancelled_by: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    created_by: null,
    error_message: null,
    id: `opt-${Date.now()}`,
    last_retry_at: null,
    max_retries: null,
    params: { url },
    progress: null,
    retry_count: null,
    started_at: null,
    status: "pending",
    total: null,
    type: "fetch_permalink",
  };
}

interface PermalinkQueueSectionProps {
  permalinkJobs: Job[];
  setPermalinkJobs: (jobs: Job[]) => void;
}

function formatStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Done";
    case "error":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-500/70 bg-amber-500/10 text-amber-600";
    case "running":
      return "border-blue-500/70 bg-blue-500/10 text-blue-600";
    case "completed":
      return "border-emerald-500/60 bg-emerald-500/10 text-emerald-600";
    case "error":
      return "border-red-500/70 bg-red-500/10 text-red-600";
    default:
      return "border-border bg-surface-hover text-muted-foreground";
  }
}

function truncateUrl(url: string, maxLen: number = 50): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}

function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aActive = a.status === "running" ? 2 : a.status === "pending" ? 1 : 0;
    const bActive = b.status === "running" ? 2 : b.status === "pending" ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

export function PermalinkQueueSection({
  permalinkJobs,
  setPermalinkJobs,
}: PermalinkQueueSectionProps) {
  const { toast } = useToast();
  const [inputUrl, setInputUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const sortedJobs = useMemo(() => sortJobs(permalinkJobs), [permalinkJobs]);

  const handleAdd = useCallback(async () => {
    const url = inputUrl.trim();
    if (!url || isAdding) return;

    setIsAdding(true);
    try {
      const response = await fetch("/api/admin/permalink-queue", {
        body: JSON.stringify({ url }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to add to queue");
      }

      toast.success("Added to queue.");
      setInputUrl("");

      const optimistic = makeOptimisticJob(url);
      setPermalinkJobs((prev) => [optimistic, ...prev]);

      const jobsResponse = await fetch(
        "/api/admin/jobs?type=fetch_permalink&limit=20"
      );
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        const serverJobs = jobsData.data || [];
        setPermalinkJobs((prev) => {
          const hasOurJob = serverJobs.some(
            (j: Job) => (j.params as { url?: string })?.url === url
          );
          if (hasOurJob) return serverJobs;
          const opt = prev.find((j) => j.id.startsWith("opt-"));
          if (!opt) return serverJobs;
          return [opt, ...serverJobs];
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add to queue"
      );
    } finally {
      setIsAdding(false);
    }
  }, [inputUrl, isAdding, setPermalinkJobs, toast]);

  return (
    <Card className="border-border bg-surface p-6">
      <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
        Upsert Posts
      </h2>
      <p
        className="text-foreground mb-6 text-sm"
        style={{ opacity: 0.85 }}
      >
        Add a permalink to update or add a post.
      </p>
      <div className="mb-6 flex gap-2">
        <input
          aria-label="Nextdoor permalink URL"
          className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus"
          disabled={isAdding}
          placeholder="https://nextdoor.com/p/..."
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
        />
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-border-focus disabled:opacity-50"
          disabled={isAdding || !inputUrl.trim()}
          type="button"
          onClick={handleAdd}
        >
          {isAdding ? "Adding…" : "Add"}
        </button>
      </div>
      <div>
        <h3 className="text-foreground mb-2 text-sm font-medium">
          Permalink jobs
        </h3>
        {sortedJobs.length > 0 ? (
          <ul className="space-y-2">
            {sortedJobs.map((job) => {
              const params = job.params as { post_id?: string; url?: string };
              const url = params?.url ?? "unknown";
              const postId = params?.post_id;
              return (
                <li
                  key={job.id}
                  className="border-border flex flex-col gap-1 rounded-md border bg-surface-hover px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center justify-between gap-4">
                    <span
                      className="text-muted-foreground min-w-0 truncate"
                      title={url}
                    >
                      {truncateUrl(url)}
                    </span>
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${statusClass(job.status)}`}
                    >
                      {formatStatus(job.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                    <span>{formatRelativeTime(job.created_at)}</span>
                    {postId && (
                      <Link
                        className="hover:text-foreground text-primary"
                        href={`/posts/${postId}`}
                      >
                        View post
                      </Link>
                    )}
                  </div>
                  {job.status === "error" && job.error_message && (
                    <p
                      className="text-destructive text-xs"
                      title={job.error_message}
                    >
                      {job.error_message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No permalink jobs yet. Add a URL above or use Refresh Post on a post
            card.
          </p>
        )}
      </div>
    </Card>
  );
}
