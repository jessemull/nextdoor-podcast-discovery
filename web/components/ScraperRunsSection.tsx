"use client";

import { MoreHorizontal, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

function statusBadgeClass(status: string, isQueued: boolean): string {
  if (isQueued)
    return "shrink-0 rounded border border-sky-500/50 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600";
  return status === "completed"
    ? "shrink-0 rounded border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600"
    : "shrink-0 rounded border border-red-500/70 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600";
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
  const [menuOpenRunId, setMenuOpenRunId] = useState<null | string>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const queuedRetrySet = new Set(queuedRetryRunIds);

  useEffect(() => {
    if (menuOpenRunId == null) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpenRunId(null);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [menuOpenRunId]);

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
            const statusLabel = isQueued
              ? "Queued"
              : run.status === "completed"
                ? "Completed"
                : "Failed";
            const badgeClass = statusBadgeClass(run.status, isQueued);
            const showRetry =
              run.status === "error" && onRetry && !isQueued;
            return (
              <div
                key={run.id}
                className="rounded border border-border bg-surface-hover/50 p-4"
                ref={menuOpenRunId === run.id ? menuRef : null}
              >
                <div className="mb-3 flex flex-row items-start justify-between gap-2">
                  <span className="text-foreground text-base font-semibold">
                    Scraper Run
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {showRetry && (
                      <div className="relative z-10 sm:hidden">
                        <button
                          aria-expanded={menuOpenRunId === run.id}
                          aria-haspopup="menu"
                          aria-label="More actions"
                          className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() =>
                            setMenuOpenRunId((id) =>
                              id === run.id ? null : run.id
                            )
                          }
                        >
                          <MoreHorizontal
                            aria-hidden
                            className="h-4 w-4 text-foreground"
                          />
                        </button>
                        {menuOpenRunId === run.id && (
                          <div
                            className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[11rem] rounded-card border py-1 shadow-lg"
                            role="menu"
                          >
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                setMenuOpenRunId(null);
                                void onRetry?.(run);
                              }}
                            >
                              <RotateCcw aria-hidden className="h-4 w-4" />
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <span className={`${badgeClass} hidden sm:inline`}>
                      {statusLabel}
                    </span>
                    {showRetry && (
                      <button
                        className="hidden shrink-0 rounded border border-amber-500/70 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-border-focus sm:inline-block"
                        type="button"
                        onClick={() => onRetry?.(run)}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <DetailRow label="Run ID" value={run.id} />
                  <div className="sm:hidden">
                    <DetailRow label="Status">
                      <span className={badgeClass}>{statusLabel}</span>
                    </DetailRow>
                  </div>
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
