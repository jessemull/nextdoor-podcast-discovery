import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Ban, MoreHorizontal } from "lucide-react";

import { Card } from "@/components/ui/Card";

import { JobStats } from "./JobStats";

import type { Job } from "@/lib/types";

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
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`text-foreground min-w-0 break-words text-xs ${valueClass}`}
        style={{ opacity: 0.85 }}
      >
        {value}
      </span>
    </div>
  );
}

interface JobsListProps {
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
  description = DEFAULT_DESCRIPTION,
  jobs,
  onCancel,
  showManageLink = true,
  showStats = true,
  title = "Recent jobs",
}: JobsListProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpenJobId, setMenuOpenJobId] = useState<null | string>(null);
  const pendingJobs = jobs.filter((job) => job.status === "pending");

  const onMenuToggle = useCallback((jobId: string) => {
    setMenuOpenJobId((current) => (current === jobId ? null : jobId));
  }, []);

  useEffect(() => {
    if (menuOpenJobId == null) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpenJobId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenJobId(null);
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpenJobId]);

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
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="text-foreground min-w-0 shrink-0 truncate text-base font-semibold">
                        {formatJobType(job.type)} (#{job.id.substring(0, 8)})
                      </span>
                      <span className={statusBadgeClass}>
                        {formatStatusLabel(job.status)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {(job.status === "pending" ||
                        job.status === "running") && (
                        <button
                          aria-label="Cancel job"
                          className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => onCancel(job.id)}
                        >
                          <Ban
                            aria-hidden
                            className="h-4 w-4 text-destructive"
                          />
                        </button>
                      )}
                      {job.status !== "cancelled" && (
                        <div
                          className="relative"
                          ref={menuOpenJobId === job.id ? menuRef : null}
                        >
                          <button
                            aria-expanded={menuOpenJobId === job.id}
                            aria-haspopup="menu"
                            aria-label="More actions"
                            className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
                            type="button"
                            onClick={() => onMenuToggle(job.id)}
                          >
                            <MoreHorizontal
                              aria-hidden
                              className="h-4 w-4 text-foreground"
                            />
                          </button>
                          {menuOpenJobId === job.id && (
                            <div
                              className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[11rem] rounded-card border py-1 shadow-lg"
                              role="menu"
                            >
                              <button
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={
                                  job.status !== "pending" &&
                                  job.status !== "running"
                                }
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  onMenuToggle(job.id);
                                  if (
                                    job.status === "pending" ||
                                    job.status === "running"
                                  ) {
                                    onCancel(job.id);
                                  }
                                }}
                              >
                                <Ban aria-hidden className="h-4 w-4" />
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
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
        <p className="text-muted text-sm">No recent jobs.</p>
      )}
    </Card>
  );
}
