"use client";

import { Card } from "@/components/ui/Card";

import type { ScraperRun } from "@/lib/types";
import type { ReactNode } from "react";

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

function feedLabel(feedType: string): string {
  if (feedType === "recent") return "Most Recent";
  if (feedType === "trending") return "Trending";
  return feedType;
}

function formatStatusLabel(status: string, isQueued: boolean): string {
  if (isQueued) return "Queued";
  switch (status) {
    case "completed":
      return "Completed";
    case "error":
      return "Failed";
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "cancelled":
      return "Cancelled";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}

function statusBadgeClass(status: string, isQueued: boolean): string {
  const base =
    "shrink-0 rounded border px-2 py-0.5 text-xs font-medium";
  if (isQueued)
    return `${base} border-sky-500/50 bg-sky-500/10 text-sky-600`;
  switch (status) {
    case "completed":
      return `${base} border-emerald-500/60 bg-emerald-500/10 text-emerald-600`;
    case "error":
      return `${base} border-red-500/70 bg-red-500/10 text-red-600`;
    case "pending":
      return `${base} border-amber-500/60 bg-amber-500/15 text-amber-400`;
    case "running":
      return `${base} border-blue-500/60 bg-blue-500/15 text-blue-400`;
    case "cancelled":
      return `${base} border-orange-500/60 bg-orange-500/15 text-orange-400`;
    default:
      return `${base} border-border bg-surface-hover text-muted-foreground`;
  }
}

interface ScraperRunsSectionProps {
  emptyMessage?: string;
  onRetry?: (run: ScraperRun) => Promise<void> | void;
  queuedRetryRunIds?: string[];
  runs: ScraperRun[];
  title?: string;
}

export function ScraperRunsSection({
  emptyMessage = "No scraper runs in the last seven days.",
  onRetry,
  queuedRetryRunIds = [],
  runs,
  title = "Scraper Runs",
}: ScraperRunsSectionProps) {
  const queuedRetrySet = new Set(queuedRetryRunIds);

  return (
    <Card className="mb-8 p-6">
      <div className="mb-4">
        <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
          {title}
        </h2>
        <p
          className="text-foreground text-sm"
          style={{ opacity: 0.85 }}
        >
          Last seven days of scraper runs.
        </p>
      </div>
      {runs.length > 0 ? (
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {runs.map((run) => {
            const isQueued = queuedRetrySet.has(run.id);
            const statusLabel = formatStatusLabel(run.status, isQueued);
            const badgeClass = statusBadgeClass(run.status, isQueued);
            const showRetry =
              run.status === "error" && onRetry && !isQueued;
            return (
              <div
                key={run.id}
                className="rounded border border-border bg-surface-hover/50 p-4"
              >
                <div className="mb-3 flex flex-row items-start justify-between gap-2">
                  <span className="text-foreground text-base font-semibold">
                    Scraper Run
                  </span>
                  {showRetry && (
                    <button
                      className="hidden shrink-0 rounded-md border border-white/25 bg-surface-hover/80 px-2 py-0.5 text-foreground/90 text-xs font-medium hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus sm:inline-block"
                      type="button"
                      onClick={() => onRetry?.(run)}
                    >
                      Retry
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <DetailRow label="Run ID" value={run.id} />
                  <DetailRow label="Status">
                    <span className={badgeClass}>{statusLabel}</span>
                  </DetailRow>
                  <DetailRow
                    label="Run at"
                    value={new Date(run.run_at).toLocaleString()}
                  />
                  <DetailRow label="Feed" value={feedLabel(run.feed_type)} />
                  {run.error_message != null && run.error_message !== "" && (
                    <DetailRow
                      label="Error"
                      value={run.error_message}
                      valueClass="text-destructive"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted text-sm">{emptyMessage}</p>
      )}
    </Card>
  );
}
