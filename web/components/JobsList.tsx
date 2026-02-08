import type { JobParams } from "@/lib/types";

import { JobStats } from "./JobStats";

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
  params: null | JobParams;
  progress: null | number;
  retry_count: null | number;
  started_at: null | string;
  status: string;
  total: null | number;
  type: string;
}

interface JobsListProps {
  cancellingJobId: null | string;
  jobs: Job[];
  onCancel: (jobId: string) => void;
}

/**
 * JobsList Component
 *
 * Displays a list of background jobs with their status, progress, and actions.
 */
export function JobsList({ cancellingJobId, jobs, onCancel }: JobsListProps) {
  if (jobs.length === 0) {
    return null;
  }

  const pendingJobs = jobs.filter((job) => job.status === "pending");
  const runningJob = jobs.find((job) => job.status === "running");

  return (
    <div className="rounded-lg bg-gray-800 p-6">
      <h2 className="mb-4 text-xl font-semibold">Recompute Jobs</h2>
      <p className="mb-4 text-sm text-gray-400">
        All weight change jobs. Jobs process one at a time in order.
      </p>
      <div className="mb-6">
        <JobStats jobs={jobs} />
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {jobs.map((job) => {
          const queuePosition =
            job.status === "pending" ? pendingJobs.findIndex((j) => j.id === job.id) + 1 : null;

          return (
            <div className="rounded border border-gray-700 bg-gray-900 p-4" key={job.id}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">
                    Job #{job.id.substring(0, 8)}
                  </span>
                  {queuePosition !== null && queuePosition > 0 && (
                    <span className="text-xs text-gray-500">(Queue: #{queuePosition})</span>
                  )}
                  {job.created_by && (
                    <span className="text-xs text-gray-500">by {job.created_by}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      job.status === "completed"
                        ? "bg-green-900 text-green-200"
                        : job.status === "running"
                          ? "bg-yellow-900 text-yellow-200"
                          : job.status === "pending"
                            ? "bg-blue-900 text-blue-200"
                            : job.status === "error"
                              ? "bg-red-900 text-red-200"
                              : job.status === "cancelled"
                                ? "bg-gray-700 text-gray-300"
                                : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {job.status}
                  </span>
                  {(job.status === "pending" || job.status === "running") && (
                    <button
                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={cancellingJobId === job.id}
                      onClick={() => onCancel(job.id)}
                    >
                      {cancellingJobId === job.id ? "Cancelling..." : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-400">
                <p>Created: {new Date(job.created_at).toLocaleString()}</p>
                {job.started_at && <p>Started: {new Date(job.started_at).toLocaleString()}</p>}
                {job.completed_at && (
                  <p>Completed: {new Date(job.completed_at).toLocaleString()}</p>
                )}
                {job.progress !== null && job.total !== null && (
                  <p>
                    Progress: {job.progress.toLocaleString()} / {job.total.toLocaleString()} (
                    {Math.round((job.progress / job.total) * 100)}%)
                  </p>
                )}
                {job.error_message && (
                  <p className="mt-2 text-red-400">Error: {job.error_message}</p>
                )}
                {job.retry_count !== null && job.retry_count > 0 && (
                  <p className="mt-1 text-xs text-yellow-400">
                    Retries: {job.retry_count}
                    {job.max_retries !== null && ` / ${job.max_retries}`}
                    {job.last_retry_at &&
                      ` (Last: ${new Date(job.last_retry_at).toLocaleString()})`}
                  </p>
                )}
                {job.cancelled_at && (
                  <p className="mt-1 text-xs text-gray-400">
                    Cancelled: {new Date(job.cancelled_at).toLocaleString()}
                    {job.cancelled_by && ` by ${job.cancelled_by}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
