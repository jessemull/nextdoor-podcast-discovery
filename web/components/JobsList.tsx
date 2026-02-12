import Link from "next/link";

import { Card } from "@/components/ui/Card";

import { JobStats } from "./JobStats";

import type { Job } from "@/lib/types";

interface JobsListProps {
  cancellingJobId: null | string;
  jobs: Job[];
  onCancel: (jobId: string) => void;
  showManageLink?: boolean;
  title?: string;
}

/**
 * JobsList Component
 *
 * Displays a short list of background jobs with link to full Jobs page.
 */
export function JobsList({
  cancellingJobId,
  jobs,
  onCancel,
  showManageLink = true,
  title = "Recent jobs",
}: JobsListProps) {
  const pendingJobs = jobs.filter((job) => job.status === "pending");

  return (
    <Card className="mb-8 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">{title}</h2>
          <p className="text-muted mt-1 text-sm">
            Weight change jobs. Jobs process one at a time in order.
          </p>
        </div>
        {showManageLink && (
          <Link
            className="text-muted text-sm hover:text-foreground"
            href="/jobs"
          >
            Manage jobs →
          </Link>
        )}
      </div>
      {jobs.length > 0 && (
        <>
          <div className="mb-6">
            <JobStats jobs={jobs} />
          </div>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {jobs.map((job) => {
              const queuePosition =
                job.status === "pending"
                  ? pendingJobs.findIndex((j) => j.id === job.id) + 1
                  : null;

              return (
                <div
                  key={job.id}
                  className="rounded border border-border bg-surface-hover/50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground text-sm font-medium">
                        Job #{job.id.substring(0, 8)}
                      </span>
                      {queuePosition !== null && queuePosition > 0 && (
                        <span className="text-muted-foreground text-xs">
                          (Queue: #{queuePosition})
                        </span>
                      )}
                      {job.created_by && (
                        <span className="text-muted-foreground text-xs">
                          by {job.created_by}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-border bg-surface px-2 py-1 text-muted text-xs font-medium">
                        {job.status}
                      </span>
                      {(job.status === "pending" ||
                        job.status === "running") && (
                        <button
                          className="rounded border border-border px-2 py-1 text-destructive text-xs transition-colors hover:bg-destructive/10 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-border-focus"
                          disabled={cancellingJobId === job.id}
                          type="button"
                          onClick={() => onCancel(job.id)}
                        >
                          {cancellingJobId === job.id
                            ? "Cancelling..."
                            : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-muted text-xs">
                    <p>
                      Created: {new Date(job.created_at).toLocaleString()}
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
                      <p className="text-destructive mt-2">
                        Error: {job.error_message}
                      </p>
                    )}
                    {job.retry_count !== null && job.retry_count > 0 && (
                      <p className="text-muted-foreground mt-1">
                        Retries: {job.retry_count}
                        {job.max_retries !== null &&
                          ` / ${job.max_retries}`}
                        {job.last_retry_at &&
                          ` (Last: ${new Date(job.last_retry_at).toLocaleString()})`}
                      </p>
                    )}
                    {job.cancelled_at && (
                      <p className="text-muted-foreground mt-1">
                        Cancelled:{" "}
                        {new Date(job.cancelled_at).toLocaleString()}
                        {job.cancelled_by && ` by ${job.cancelled_by}`}
                      </p>
                    )}
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
