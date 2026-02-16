"use client";

import { useCallback, useState } from "react";

import { Card } from "@/components/ui/Card";
import { useToast } from "@/lib/ToastContext";

import type { Job } from "@/lib/types";

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

export function PermalinkQueueSection({
  permalinkJobs,
  setPermalinkJobs,
}: PermalinkQueueSectionProps) {
  const { toast } = useToast();
  const [inputUrl, setInputUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);

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

      const jobsResponse = await fetch(
        "/api/admin/jobs?type=fetch_permalink&limit=20"
      );
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setPermalinkJobs(jobsData.data || []);
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
      {permalinkJobs.length > 0 && (
        <div>
          <h3 className="text-foreground mb-2 text-sm font-medium">
            Recent jobs
          </h3>
          <ul className="space-y-2">
            {permalinkJobs.map((job) => {
              const url =
                (job.params as { url?: string })?.url ?? "unknown";
              return (
                <li
                  key={job.id}
                  className="border-border flex items-center justify-between gap-4 rounded-md border bg-surface-hover px-3 py-2 text-sm"
                >
                  <span
                    className="text-muted-foreground truncate"
                    title={url}
                  >
                    {truncateUrl(url)}
                  </span>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${statusClass(job.status)}`}
                  >
                    {formatStatus(job.status)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
