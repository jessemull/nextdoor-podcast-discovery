import { calculateSuccessRate } from "@/lib/utils";

interface Job {
  cancelled_at: null | string;
  cancelled_by: null | string;
  completed_at: null | string;
  created_at: string;
  created_by: null | string;
  error_message: null | string;
  id: string;
  last_retry_at: null | string;
  max_retries: null | number;
  params: null | Record<string, unknown>;
  progress: null | number;
  retry_count: null | number;
  started_at: null | string;
  status: string;
  total: null | number;
  type: string;
}

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
      <div className="rounded bg-gray-900 p-4">
        <p className="text-xs text-gray-400">Total Jobs</p>
        <p className="text-2xl font-bold text-white">{totalJobs}</p>
      </div>
      <div className="rounded bg-gray-900 p-4">
        <p className="text-xs text-gray-400">Success Rate</p>
        <p className="text-2xl font-bold text-white">{successRate}%</p>
      </div>
      <div className="rounded bg-gray-900 p-4">
        <p className="text-xs text-gray-400">Avg Duration</p>
        <p className="text-2xl font-bold text-white">
          {avgDurationSeconds > 60
            ? `${Math.round(avgDurationSeconds / 60)}m`
            : `${avgDurationSeconds}s`}
        </p>
      </div>
      <div className="rounded bg-gray-900 p-4">
        <p className="text-xs text-gray-400">Completed</p>
        <p className="text-2xl font-bold text-green-400">{completedJobs.length}</p>
      </div>
    </div>
  );
}
