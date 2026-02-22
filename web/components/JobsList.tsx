"use client";

import { CircleSlash, MoreHorizontal, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  headerRightContent?: ReactNode;
  jobs: Job[];
  onCancel: (jobId: string) => void;
  onRetry?: (jobId: string) => Promise<void> | void;
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
          ? "shrink-0 rounded border border-orange-500/60 bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-400"
          : "shrink-0 rounded border border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground";
}

export function JobsList({
  description = DEFAULT_DESCRIPTION,
  emptyMessage = "No recent jobs.",
  headerRightContent,
  jobs,
  onCancel,
  onRetry,
  showManageLink = true,
  showStats = true,
  title = "Recent jobs",
  variant = "queue",
}: JobsListProps) {
  const [menuOpenJobId, setMenuOpenJobId] = useState<null | string>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [menuOpenJobId]);

  return (
    <Card className="mb-8 p-6">
      <div className="mb-4">
        <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:gap-4">
          <h2 className="text-foreground min-w-0 flex-1 text-xl font-semibold tracking-wide sm:text-2xl">
            {title}
          </h2>
          {showManageLink && (
            <Link
              className="text-muted shrink-0 text-sm hover:text-foreground"
              href="/jobs"
            >
              Manage jobs →
            </Link>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:gap-4">
          <p
            className="text-foreground min-w-0 flex-1 text-sm"
            style={{ opacity: 0.85 }}
          >
            {description}
          </p>
          {headerRightContent != null && (
            <div className="shrink-0">{headerRightContent}</div>
          )}
        </div>
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
                  {(variant === "queue" || variant === "finished") && (
                    <div className="-mt-1 mb-3 flex items-center justify-between gap-2 sm:hidden">
                      <span className="text-foreground text-base font-semibold">
                        Job
                      </span>
                      {(variant === "queue" ||
                        (variant === "finished" &&
                          onRetry &&
                          (job.status === "error" ||
                            job.status === "cancelled"))) && (
                        <div
                          className="relative z-10 shrink-0"
                          ref={menuOpenJobId === job.id ? menuRef : null}
                        >
                          <button
                            aria-expanded={menuOpenJobId === job.id}
                            aria-haspopup="menu"
                            aria-label="More actions"
                            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                            type="button"
                            onClick={() =>
                              setMenuOpenJobId((id) =>
                                id === job.id ? null : job.id
                              )
                            }
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
                              {variant === "queue" ? (
                                <button
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-surface-hover"
                                  role="menuitem"
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenJobId(null);
                                    onCancel(job.id);
                                  }}
                                >
                                  <CircleSlash aria-hidden className="h-4 w-4" />
                                  Cancel
                                </button>
                              ) : (
                                onRetry &&
                                (job.status === "error" ||
                                  job.status === "cancelled") && (
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                                    role="menuitem"
                                    type="button"
                                    onClick={() => {
                                      setMenuOpenJobId(null);
                                      void onRetry(job.id);
                                    }}
                                  >
                                    <RotateCcw aria-hidden className="h-4 w-4" />
                                    Retry
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mb-3 flex min-w-0 flex-row items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide sm:hidden">
                        Title
                      </h4>
                      <span
                        className="text-foreground block break-all sm:truncate"
                        title={`${formatJobType(job.type)} (#${job.id.substring(0, 8)})`}
                      >
                        <span
                          className="text-xs sm:hidden"
                          style={{ opacity: 0.85 }}
                        >
                          {formatJobType(job.type)} (#{job.id.substring(0, 8)})
                        </span>
                        <span className="hidden text-base font-semibold sm:inline">
                          {formatJobType(job.type)} (#{job.id.substring(0, 8)})
                        </span>
                      </span>
                    </div>
                    {variant === "queue" ? (
                      <button
                        className="border-destructive text-destructive hover:bg-surface-hover hidden shrink-0 rounded border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-border-focus sm:inline-block"
                        type="button"
                        onClick={() => onCancel(job.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      onRetry &&
                      (job.status === "error" ||
                        job.status === "cancelled") && (
                        <button
                          className="shrink-0 rounded-md border border-white/25 bg-surface-hover/80 px-2 py-0.5 text-foreground/90 text-xs font-medium hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => onRetry(job.id)}
                        >
                          Retry
                        </button>
                      )
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                      <DetailRow label="Status">
                        {statusBadge}
                      </DetailRow>
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
