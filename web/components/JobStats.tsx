import { calculateSuccessRate } from "@/lib/utils";

import type { Job } from "@/lib/types";

interface JobStatsProps {
  jobs: Job[];
}

/**
 * JobStats Component
 *
 * Displays statistics about background jobs:
 * - Total jobs count
 * - Success rate (completed / (completed + error))
 * - Average duration of completed jobs
 * - Number of completed jobs
 */
export function JobStats({ jobs }: JobStatsProps) {
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const errorJobs = jobs.filter((j) => j.status === "error");
  const successRate = calculateSuccessRate(completedJobs.length, errorJobs.length);

  // Calculate average duration for completed jobs
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
    avgDurationSeconds = Math.round(totalDuration / completedWithDuration.length / 1000);
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="rounded bg-surface-hover/50 p-4">
        <p className="text-muted-foreground text-xs">Total Jobs</p>
        <p className="text-2xl font-bold text-foreground">{totalJobs}</p>
      </div>
      <div className="rounded bg-surface-hover/50 p-4">
        <p className="text-muted-foreground text-xs">Success Rate</p>
        <p className="text-2xl font-bold text-foreground">{successRate}%</p>
      </div>
      <div className="rounded bg-surface-hover/50 p-4">
        <p className="text-muted-foreground text-xs">Avg Duration</p>
        <p className="text-2xl font-bold text-foreground">
          {avgDurationSeconds > 60
            ? `${Math.round(avgDurationSeconds / 60)}m`
            : `${avgDurationSeconds}s`}
        </p>
      </div>
      <div className="rounded bg-surface-hover/50 p-4">
        <p className="text-muted-foreground text-xs">Completed</p>
        <p className="text-2xl font-bold text-foreground">
          {completedJobs.length}
        </p>
      </div>
    </div>
  );
}
