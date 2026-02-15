"use client";

import {
  Ban,
  CheckCircle,
  Clock,
  ListTodo,
  Loader2,
  Percent,
  Play,
  XCircle,
} from "lucide-react";

import { calculateSuccessRate } from "@/lib/utils";

import type { Job } from "@/lib/types";
import type { ReactNode } from "react";

const STATS_GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4";

function JobStatCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 rounded-lg border border-white/20 bg-surface-hover/50 p-3">
      <div className="flex shrink-0 items-center justify-center text-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="text-foreground truncate text-xl font-bold leading-tight">
          {value}
        </div>
        <div className="text-muted-foreground truncate text-sm">{label}</div>
      </div>
    </div>
  );
}

interface JobStatsProps {
  jobs: Job[];
}

/**
 * JobStats component
 *
 * Displays statistics about background jobs using the same card pattern as the
 * homepage StatsPanel: Total Jobs, Success Rate, Avg Duration, Completed,
 * Pending, Running, Error, Cancelled.
 */
export function JobStats({ jobs }: JobStatsProps) {
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const errorJobs = jobs.filter((j) => j.status === "error");
  const pendingJobs = jobs.filter((j) => j.status === "pending");
  const runningJobs = jobs.filter((j) => j.status === "running");
  const cancelledJobs = jobs.filter((j) => j.status === "cancelled");
  const successRate = calculateSuccessRate(
    completedJobs.length,
    errorJobs.length
  );

  const completedWithDuration = completedJobs.filter(
    (j) => j.started_at && j.completed_at
  );
  let avgDurationSeconds = 0;
  if (completedWithDuration.length > 0) {
    const totalDuration = completedWithDuration.reduce((sum, job) => {
      const started = new Date(job.started_at!).getTime();
      const completed = new Date(job.completed_at!).getTime();
      return sum + (completed - started);
    }, 0);
    avgDurationSeconds = Math.round(
      totalDuration / completedWithDuration.length / 1000
    );
  }
  const avgDurationStr =
    avgDurationSeconds >= 60
      ? `${Math.round(avgDurationSeconds / 60)}m`
      : `${avgDurationSeconds}s`;

  return (
    <div className={STATS_GRID_CLASS}>
      <JobStatCell
        icon={<ListTodo aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
        label="Total Jobs"
        value={String(totalJobs)}
      />
      <JobStatCell
        icon={<Percent aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
        label="Success Rate"
        value={`${successRate}%`}
      />
      <JobStatCell
        icon={<Clock aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
        label="Avg Duration"
        value={avgDurationStr}
      />
      <JobStatCell
        icon={
          <CheckCircle aria-hidden className="h-9 w-9" strokeWidth={1.5} />
        }
        label="Completed"
        value={String(completedJobs.length)}
      />
      <JobStatCell
        icon={<Loader2 aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
        label="Pending"
        value={String(pendingJobs.length)}
      />
      <JobStatCell
        icon={<Play aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
        label="Running"
        value={String(runningJobs.length)}
      />
      <JobStatCell
        icon={<XCircle aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
        label="Error"
        value={String(errorJobs.length)}
      />
      <JobStatCell
        icon={<Ban aria-hidden className="h-9 w-9" strokeWidth={1.5} />}
        label="Cancelled"
        value={String(cancelledJobs.length)}
      />
    </div>
  );
}
