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

function statusBadgeClass(status: string): string {
  return status === "completed"
    ? "shrink-0 rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600"
    : "shrink-0 rounded border border-red-500/70 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600";
}

interface ScraperRunsSectionProps {
  emptyMessage?: string;
  onRetry?: (run: ScraperRun) => void | Promise<void>;
  runs: ScraperRun[];
  title?: string;
}

export function ScraperRunsSection({
  emptyMessage = "No scraper runs in the last seven days.",
  onRetry,
  runs,
  title = "Scraper runs",
}: ScraperRunsSectionProps) {
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
          Last seven days of scraper jobs.
        </p>
      </div>
      {runs.length > 0 ? (
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {runs.map((run) => {
            const badgeClass = statusBadgeClass(run.status);
            const statusLabel =
              run.status === "completed" ? "Completed" : "Failed";
            return (
              <div
                key={run.id}
                className="rounded border border-border bg-surface-hover/50 p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="text-foreground min-w-0 flex-1 truncate text-base font-semibold">
                    {run.id}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={badgeClass}>{statusLabel}</span>
                    {run.status === "error" && onRetry && (
                      <button
                        className="border-emerald-500/70 bg-emerald-500/10 text-emerald-600 hover:bg-surface-hover shrink-0 rounded border px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-border-focus"
                        type="button"
                        onClick={() => onRetry(run)}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
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
