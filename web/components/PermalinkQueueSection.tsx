"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
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
  onCancel?: (jobId: string) => void;
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
  onCancel,
  permalinkJobs,
  setPermalinkJobs,
}: PermalinkQueueSectionProps) {
  const { toast } = useToast();
  const [inputUrl, setInputUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [menuOpenJobId, setMenuOpenJobId] = useState<null | string>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sortedJobs = useMemo(() => sortJobs(permalinkJobs), [permalinkJobs]);

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
    <>
      <Card className="border-border bg-surface mb-8 p-6">
        <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
          Upsert Post
        </h2>
        <p
          className="text-foreground mb-6 text-sm"
          style={{ opacity: 0.85 }}
        >
          Add a permalink to update or add a post.
        </p>
        <div className="flex gap-2">
          <input
            aria-label="Nextdoor permalink URL"
            className="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-border-focus focus:outline-none focus:ring-[1px] focus:ring-border-focus"
            disabled={isAdding}
            placeholder="https://nextdoor.com/p/sW7395ZTbKKJ"
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
          />
          <Button
            className="shrink-0"
            disabled={isAdding || !inputUrl.trim()}
            variant="primary"
            onClick={handleAdd}
          >
            {isAdding ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </Card>
      <Card className="border-border bg-surface p-6">
        <div className="mb-4">
          <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
            Post Queue
          </h2>
          <p
            className="text-foreground text-sm"
            style={{ opacity: 0.85 }}
          >
            Permalink fetch jobs run one at a time. Remove from queue to cancel
            before they run.
          </p>
        </div>
        {sortedJobs.length > 0 ? (
          <div className="max-h-[48rem] space-y-3 overflow-y-auto">
            {sortedJobs.map((job) => {
              const params = job.params as { post_id?: string; url?: string };
              const url = params?.url ?? "unknown";
              const postId = params?.post_id;
              const canCancel =
                (job.status === "pending" || job.status === "running") &&
                !job.id.startsWith("opt-") &&
                onCancel;
              const menuOpen = menuOpenJobId === job.id;
              return (
                <div
                  key={job.id}
                  className="rounded border border-border bg-surface-hover/50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className="text-foreground min-w-0 flex-1 truncate text-base font-semibold"
                      title={url}
                    >
                      {truncateUrl(url, 56)}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {(job.status === "running" ||
                        job.status === "completed" ||
                        job.status === "error") && (
                        <span
                          className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${statusClass(job.status)}`}
                        >
                          {formatStatus(job.status)}
                        </span>
                      )}
                      {url && url.startsWith("http") && (
                        <a
                          aria-label="View Post on Nextdoor"
                          className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
                          href={url}
                          rel="noopener noreferrer"
                          target="_blank"
                          title="View Post on Nextdoor"
                        >
                          <Eye aria-hidden className="h-4 w-4 text-foreground" />
                        </a>
                      )}
                      {canCancel && (
                        <button
                          aria-label="Delete"
                          className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
                          title="Delete"
                          type="button"
                          onClick={() => onCancel?.(job.id)}
                        >
                          <Trash2
                            aria-hidden
                            className="h-4 w-4 text-destructive"
                          />
                        </button>
                      )}
                      <div
                        className="relative"
                        ref={menuOpen ? menuRef : null}
                      >
                        <button
                          aria-expanded={menuOpen}
                          aria-haspopup="menu"
                          aria-label="More actions"
                          className="cursor-pointer rounded p-1 focus:outline-none focus:ring-2 focus:ring-border-focus"
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
                        {menuOpen && (
                          <div
                            className="border-border bg-surface absolute right-0 top-full z-10 mt-1 min-w-[11rem] rounded-card border py-1 shadow-lg"
                            role="menu"
                          >
                            {url && url.startsWith("http") && (
                              <a
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                                href={url}
                                rel="noopener noreferrer"
                                role="menuitem"
                                target="_blank"
                                onClick={() => setMenuOpenJobId(null)}
                              >
                                <Eye aria-hidden className="h-4 w-4" />
                                View Post
                              </a>
                            )}
                            {canCancel && (
                              <button
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-surface-hover"
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  setMenuOpenJobId(null);
                                  onCancel?.(job.id);
                                }}
                              >
                                <Trash2 aria-hidden className="h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-foreground mb-1.5 text-xs font-semibold uppercase tracking-wide">
                      Submitted
                    </h4>
                    <p
                      className="text-foreground text-xs"
                      style={{ opacity: 0.85 }}
                    >
                      {formatRelativeTime(job.created_at)}
                    </p>
                  </div>
                  {job.status === "error" && job.error_message && (
                    <p
                      className="text-destructive mt-2 text-xs"
                      title={job.error_message}
                    >
                      {job.error_message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No permalink jobs yet. Add a URL above or use Refresh Post on a post
            card.
          </p>
        )}
      </Card>
    </>
  );
}
