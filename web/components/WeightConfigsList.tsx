import type { JobParams, RankingWeights } from "@/lib/types";

interface WeightConfig {
  created_at: string;
  created_by: null | string;
  description: null | string;
  has_scores: boolean;
  id: string;
  is_active: boolean;
  name: null | string;
  weights: RankingWeights;
}

interface Job {
  params: JobParams | null;
  status: string;
}

interface WeightConfigsListProps {
  activeConfigId: null | string;
  configs: WeightConfig[];
  deletingConfigId: null | string;
  isActivating: boolean;
  jobs: Job[];
  onActivate: (configId: string) => void;
  onDelete: (configId: string) => void;
}

/**
 * WeightConfigsList Component
 *
 * Displays a list of weight configurations with options to activate or delete them.
 */
export function WeightConfigsList({
  activeConfigId,
  configs,
  deletingConfigId,
  isActivating,
  jobs,
  onActivate,
  onDelete,
}: WeightConfigsListProps) {
  if (configs.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 rounded-lg bg-gray-800 p-6">
      <h2 className="mb-4 text-xl font-semibold">Weight Configurations</h2>
      <p className="mb-6 text-sm text-gray-400">
        Switch between different weight configurations. Only configs with completed recompute jobs
        can be activated.
      </p>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {configs.map((config) => {
          const isActive = config.id === activeConfigId;
          const hasCompletedJob = jobs.some(
            (job) =>
              job.status === "completed" &&
              job.params?.weight_config_id === config.id
          );
          const hasRunningJob = jobs.some(
            (job) =>
              (job.status === "running" || job.status === "pending") &&
              job.params?.weight_config_id === config.id
          );
          const canActivate = (hasCompletedJob || config.has_scores) && !isActive;

          return (
            <div key={config.id} className="rounded border border-gray-700 bg-gray-900 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">
                    {config.name || `Config ${config.id.substring(0, 8)}`}
                  </span>
                  {isActive && (
                    <span className="rounded bg-green-900 px-2 py-0.5 text-xs text-green-200">
                      Active
                    </span>
                  )}
                  {hasRunningJob && !isActive && (
                    <span className="rounded bg-yellow-900 px-2 py-0.5 text-xs text-yellow-200">
                      Computing...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canActivate && (
                    <button
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isActivating}
                      onClick={() => onActivate(config.id)}
                    >
                      {isActivating ? "Activating..." : "Activate"}
                    </button>
                  )}
                  {!isActive && !hasRunningJob && (
                    <button
                      className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={deletingConfigId === config.id}
                      onClick={() => onDelete(config.id)}
                    >
                      {deletingConfigId === config.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
              {config.description && (
                <p className="mb-2 text-xs text-gray-400">{config.description}</p>
              )}
              <div className="mb-2 text-xs text-gray-500">
                <p>Created: {new Date(config.created_at).toLocaleString()}</p>
                {config.created_by && <p>By: {config.created_by}</p>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(config.weights).map(([dim, weight]) => (
                  <span key={dim} className="text-gray-400">
                    {dim.replace(/_/g, " ")}: {weight.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
