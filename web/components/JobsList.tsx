import Link from "next/link";

import { Card } from "@/components/ui/Card";

import { JobStats } from "./JobStats";

import type { Job } from "@/lib/types";
import type { ReactNode } from "react";

function formatJobType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function DetailRow({
  children,
  label,
  value,
  valueClass = "",
}: {
  children?: ReactNode;
  label: string;
  value?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
        {label}
      </span>
      {children != null ? (
        <div className="min-w-0">{children}</div>
      ) : (
        <span
          className={`text-foreground min-w-0 break-words text-xs ${valueClass}`}
          style={{ opacity: 0.85 }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

interface JobsListProps {
  description?: string;
  emptyMessage?: string;
  jobs: Job[];
  onCancel: (jobId: string) => void;
  showManageLink?: boolean;
  showStats?: boolean;
  title?: string;
  variant?: "finished" | "queue";
}

/**
 * JobsList Component
 *
 * Displays a short list of background jobs with link to full Jobs page.
 */
const DEFAULT_DESCRIPTION =
  "Weight change jobs. Jobs process one at a time in order.";

function getStatusBadgeClass(status: string): string {
  return status === "completed"
    ? "shrink-0 rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600"
    : status === "running" || status === "pending"
      ? "shrink-0 rounded border border-amber-500/70 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600"
      : status === "error"
        ? "shrink-0 rounded border border-red-500/70 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600"
        : status === "cancelled"
          ? "shrink-0 rounded border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-medium text-muted-foreground"
          : "shrink-0 rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground";
}

export function JobsList({
  description = DEFAULT_DESCRIPTION,
  emptyMessage = "No recent jobs.",
  jobs,
  onCancel,
  showManageLink = true,
  showStats = true,
  title = "Recent jobs",
  variant = "queue",
}: JobsListProps) {
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
              const statusBadgeClass = getStatusBadgeClass(job.status);
              const statusBadge = (
                <span className={statusBadgeClass}>
                  {formatStatusLabel(job.status)}
                </span>
              );

              return (
                <div
                  key={job.id}
                  className="rounded border border-border bg-surface-hover/50 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="text-foreground min-w-0 flex-1 truncate text-base font-semibold">
                      {formatJobType(job.type)} (#{job.id.substring(0, 8)})
                    </span>
                    {variant === "queue" ? (
                      <button
                        className="border-destructive text-destructive hover:bg-surface-hover shrink-0 rounded border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-border-focus"
                        type="button"
                        onClick={() => onCancel(job.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      statusBadge
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                      {variant === "queue" && (
                        <DetailRow label="Status">
                          {statusBadge}
                        </DetailRow>
                      )}
                      <DetailRow
                        label="Created"
                        value={new Date(job.created_at).toLocaleString()}
                      />
                      <DetailRow
                        label="User"
                        value={job.created_by ?? "—"}
                      />
                      <DetailRow
                        label="Job type"
                        value={formatJobType(job.type)}
                      />
                      {job.started_at != null && (
                        <DetailRow
                          label="Started"
                          value={new Date(
                            job.started_at
                          ).toLocaleString()}
                        />
                      )}
                      {job.completed_at != null && (
                        <DetailRow
                          label="Completed"
                          value={new Date(
                            job.completed_at
                          ).toLocaleString()}
                        />
                      )}
                      {job.progress != null && job.total != null && (
                        <DetailRow
                          label="Progress"
                          value={`${job.progress.toLocaleString()} / ${job.total.toLocaleString()} (${Math.round((job.progress / job.total) * 100)}%)`}
                        />
                      )}
                      {job.cancelled_at != null && (
                        <DetailRow
                          label="Cancelled"
                          value={
                            job.cancelled_by != null
                              ? `${new Date(job.cancelled_at).toLocaleString()} by ${job.cancelled_by}`
                              : new Date(
                                  job.cancelled_at
                                ).toLocaleString()
                          }
                        />
                      )}
                      {job.error_message != null && (
                        <DetailRow
                          label="Error"
                          value={job.error_message}
                          valueClass="text-destructive"
                        />
                      )}
                      {job.retry_count != null && job.retry_count > 0 && (
                        <DetailRow
                          label="Retries"
                          value={
                            job.max_retries != null
                              ? `${job.retry_count} / ${job.max_retries}`
                              : String(job.retry_count)
                          }
                        />
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
        <p className="text-muted text-sm">{emptyMessage}</p>
      )}
    </Card>
  );
}
