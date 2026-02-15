import Link from "next/link";

import { Card } from "@/components/ui/Card";

import { JobStats } from "./JobStats";

import type { Job } from "@/lib/types";

interface JobsListProps {
  cancellingJobId: null | string;
  description?: string;
  jobs: Job[];
  onCancel: (jobId: string) => void;
  showManageLink?: boolean;
  showStats?: boolean;
  title?: string;
}

/**
 * JobsList Component
 *
 * Displays a short list of background jobs with link to full Jobs page.
 */
const DEFAULT_DESCRIPTION =
  "Weight change jobs. Jobs process one at a time in order.";

export function JobsList({
  cancellingJobId,
  description = DEFAULT_DESCRIPTION,
  jobs,
  onCancel,
  showManageLink = true,
  showStats = true,
  title = "Recent jobs",
}: JobsListProps) {
  const pendingJobs = jobs.filter((job) => job.status === "pending");

  return (
    <Card className="mb-8 p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
            {title}
          </h2>
          <p
            className="text-foreground text-sm"
            style={{ opacity: 0.85 }}
          >
            {description}
          </p>
        </div>
        {showManageLink && (
          <Link
            className="text-muted shrink-0 text-sm hover:text-foreground"
            href="/jobs"
          >
            Manage jobs →
          </Link>
        )}
      </div>
      {jobs.length > 0 && (
        <>
          {showStats && (
            <div className="mb-6">
              <JobStats jobs={jobs} />
            </div>
          )}
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {jobs.map((job) => {
              const queuePosition =
                job.status === "pending"
                  ? pendingJobs.findIndex((j) => j.id === job.id) + 1
                  : null;
              const statusBadgeClass =
                job.status === "completed"
                  ? "shrink-0 rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600"
                  : job.status === "running" || job.status === "pending"
                    ? "shrink-0 rounded border border-amber-500/70 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600"
                    : job.status === "error"
                      ? "shrink-0 rounded border border-red-500/70 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600"
                      : job.status === "cancelled"
                        ? "shrink-0 rounded border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        : "shrink-0 rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground";

              return (
                <div
                  key={job.id}
                  className="rounded border border-border bg-surface-hover/50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-foreground min-w-0 truncate text-base font-semibold">
                        Job #{job.id.substring(0, 8)}
                        {queuePosition !== null &&
                          queuePosition > 0 &&
                          ` (Queue #${queuePosition})`}
                      </span>
                      <span className={statusBadgeClass}>
                        {job.status === "pending" &&
                        cancellingJobId === job.id
                          ? "Cancelling…"
                          : job.status}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {(job.status === "pending" ||
                        job.status === "running") && (
                        <button
                          className="rounded border border-border px-2 py-1.5 text-left text-sm text-destructive hover:bg-surface-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-border-focus"
                          disabled={cancellingJobId === job.id}
                          type="button"
                          onClick={() => onCancel(job.id)}
                        >
                          {cancellingJobId === job.id
                            ? "Cancelling…"
                            : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
                      Details
                    </h4>
                    <div
                      className="text-foreground space-y-1 text-xs"
                      style={{ opacity: 0.85 }}
                    >
                      <p>
                        Created: {new Date(job.created_at).toLocaleString()}
                        {job.created_by && ` by ${job.created_by}`}
                      </p>
                      {job.started_at && (
                        <p>
                          Started:{" "}
                          {new Date(job.started_at).toLocaleString()}
                        </p>
                      )}
                      {job.completed_at && (
                        <p>
                          Completed:{" "}
                          {new Date(job.completed_at).toLocaleString()}
                        </p>
                      )}
                      {job.progress !== null && job.total !== null && (
                        <p>
                          Progress: {job.progress.toLocaleString()} /{" "}
                          {job.total.toLocaleString()} (
                          {Math.round((job.progress / job.total) * 100)}%)
                        </p>
                      )}
                      {job.error_message && (
                        <p className="text-destructive mt-1">
                          Error: {job.error_message}
                        </p>
                      )}
                      {job.retry_count !== null && job.retry_count > 0 && (
                        <p>
                          Retries: {job.retry_count}
                          {job.max_retries != null &&
                            ` / ${job.max_retries}`}
                          {job.last_retry_at != null &&
                            ` (Last: ${new Date(job.last_retry_at).toLocaleString()})`}
                        </p>
                      )}
                      {job.cancelled_at && (
                        <p>
                          Cancelled:{" "}
                          {new Date(job.cancelled_at).toLocaleString()}
                          {job.cancelled_by != null &&
                            ` by ${job.cancelled_by}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {jobs.length === 0 && (
        <p className="text-muted text-sm">No recent jobs.</p>
      )}
    </Card>
  );
}
