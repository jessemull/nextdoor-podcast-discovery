"use client";

import { useCallback, useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { JobsList } from "@/components/JobsList";
import { WeightConfigsList } from "@/components/WeightConfigsList";
import type { JobParams, RankingWeights } from "@/lib/types";

interface SettingsResponse {
  data: {
    ranking_weights: RankingWeights;
    search_defaults: {
      similarity_threshold: number;
    };
  };
}

interface JobResponse {
  data: {
    job_id: string;
    status: string;
  };
}

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

interface JobsResponse {
  data: Job[];
  total: number;
}

// Original default weights (from PROJECT_PLAN.md and migration 002)
const DEFAULT_WEIGHTS: RankingWeights = {
  absurdity: 2.0,
  discussion_spark: 1.0,
  drama: 1.5,
  emotional_intensity: 1.2,
  news_value: 1.0,
};

// Polling configuration constants
const POLL_INTERVAL_MS = 5000; // Initial polling interval (5 seconds)
const MAX_POLL_INTERVAL_MS = 60000; // Maximum polling interval (60 seconds)
const POLL_BACKOFF_MULTIPLIER = 1.5; // Exponential backoff multiplier

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

interface WeightConfigsResponse {
  active_config_id: null | string;
  data: WeightConfig[];
}

/**
 * Settings Page - Configure ranking weights and search defaults
 *
 * Features:
 * - Display and edit ranking weights (sliders for each dimension)
 * - Display and edit search defaults (similarity threshold)
 * - Save settings without recomputing
 * - Save settings and trigger recompute job
 * - Display background job status and history
 */
export default function SettingsPage() {
  const [error, setError] = useState<null | string>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rankingWeights, setRankingWeights] = useState<RankingWeights>(DEFAULT_WEIGHTS);
  const [searchDefaults, setSearchDefaults] = useState({
    similarity_threshold: 0.2,
  });
  const [successMessage, setSuccessMessage] = useState<null | string>(null);
  const [weightConfigs, setWeightConfigs] = useState<WeightConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<null | string>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [deletingConfigId, setDeletingConfigId] = useState<null | string>(null);
  const [cancellingJobId, setCancellingJobId] = useState<null | string>(null);

  // Load settings and configs on mount (combined to avoid race conditions)
  useEffect(() => {
    const loadSettingsAndConfigs = async () => {
      try {
        // Load settings and configs in parallel
        const [settingsResponse, configsResponse] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/admin/weight-configs"),
        ]);

        if (settingsResponse.ok) {
          const settingsData: SettingsResponse = await settingsResponse.json();
          if (settingsData.data.search_defaults) {
            setSearchDefaults(settingsData.data.search_defaults);
          }
        }

        if (configsResponse.ok) {
          const configsData: WeightConfigsResponse = await configsResponse.json();
          setWeightConfigs(configsData.data || []);
          setActiveConfigId(configsData.active_config_id);
          
          // Load active weight config to show current weights
          const activeConfig = configsData.data.find(
            (config) => config.id === configsData.active_config_id
          );
          if (activeConfig?.weights) {
            setRankingWeights(activeConfig.weights);
          } else if (configsData.data.length > 0 && configsData.data[0].weights) {
            // Fallback to first config if no active
            setRankingWeights(configsData.data[0].weights);
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettingsAndConfigs();
  }, []);

  // Poll for job status and refresh configs with exponential backoff on errors
  // Pauses when tab is hidden (Page Visibility API)
  useEffect(() => {
    let pollInterval = POLL_INTERVAL_MS;
    let consecutiveErrors = 0;
    const maxInterval = MAX_POLL_INTERVAL_MS;
    const backoffMultiplier = POLL_BACKOFF_MULTIPLIER;
    let timeoutId: NodeJS.Timeout | null = null;
    let isPolling = true;

    const pollJobs = async () => {
      if (!isPolling) return;

      try {
        const [jobsResponse, configsResponse] = await Promise.all([
          fetch("/api/admin/jobs?type=recompute_final_scores&limit=20"),
          fetch("/api/admin/weight-configs"),
        ]);

        if (jobsResponse.ok && configsResponse.ok) {
          // Reset on success
          consecutiveErrors = 0;
          pollInterval = POLL_INTERVAL_MS;

          if (jobsResponse.ok) {
            const jobsData: JobsResponse = await jobsResponse.json();
            setJobs(jobsData.data || []);
          }

          if (configsResponse.ok) {
            const configsData: WeightConfigsResponse = await configsResponse.json();
            setWeightConfigs(configsData.data || []);
            setActiveConfigId(configsData.active_config_id);
          }
        } else {
          // Increment error count and apply backoff
          consecutiveErrors++;
          pollInterval = Math.min(
            Math.floor(POLL_INTERVAL_MS * Math.pow(backoffMultiplier, consecutiveErrors)),
            maxInterval
          );
          console.warn(`Polling error (${consecutiveErrors}), backing off to ${pollInterval}ms`);
        }
      } catch (err) {
        // Increment error count and apply backoff
        consecutiveErrors++;
        pollInterval = Math.min(
          Math.floor(POLL_INTERVAL_MS * Math.pow(backoffMultiplier, consecutiveErrors)),
          maxInterval
        );
        console.error("Error polling:", err);
        console.warn(`Polling error (${consecutiveErrors}), backing off to ${pollInterval}ms`);
      }

      // Schedule next poll if still active
      if (isPolling && !document.hidden) {
        timeoutId = setTimeout(pollJobs, pollInterval);
      }
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden: stop polling
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        isPolling = false;
      } else {
        // Tab visible: resume polling
        isPolling = true;
        consecutiveErrors = 0; // Reset errors on resume
        pollInterval = POLL_INTERVAL_MS;
        void pollJobs();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Start polling if tab is visible
    if (!document.hidden) {
      void pollJobs();
    }

    return () => {
      isPolling = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleSaveWeights = useCallback(async () => {
    setIsSaving(true);
    setIsRecomputing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Save weights and trigger recompute
      const response = await fetch("/api/admin/recompute-scores", {
        body: JSON.stringify({ ranking_weights: rankingWeights }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to trigger recompute");
      }

      const data: JobResponse = await response.json();
      setSuccessMessage(
        `Weights saved and recompute job started (Job #${data.data.job_id.substring(0, 8)}). This may take a few minutes. Once complete, you can activate this config.`
      );
      // Refresh configs to show the new one
      const configsResponse = await fetch("/api/admin/weight-configs");
      if (configsResponse.ok) {
        const configsData: WeightConfigsResponse = await configsResponse.json();
        setWeightConfigs(configsData.data || []);
      }
    } catch (err) {
      console.error("Error saving weights:", err);
      setError(err instanceof Error ? err.message : "Failed to save weights");
    } finally {
      setIsSaving(false);
      setIsRecomputing(false);
    }
  }, [rankingWeights]);

  const handleActivateConfig = useCallback(async (configId: string) => {
    setIsActivating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/weight-configs/${configId}/activate`, {
        method: "PUT",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to activate config");
      }

      setSuccessMessage("Weight config activated successfully. Rankings updated instantly.");
      
      // Refresh configs to update active status
      const configsResponse = await fetch("/api/admin/weight-configs");
      if (configsResponse.ok) {
        const configsData: WeightConfigsResponse = await configsResponse.json();
        setWeightConfigs(configsData.data || []);
        setActiveConfigId(configsData.active_config_id);
      }
    } catch (err) {
      console.error("Error activating config:", err);
      setError(err instanceof Error ? err.message : "Failed to activate config");
    } finally {
      setIsActivating(false);
    }
  }, []);

  const handleCancelJob = useCallback(async (jobId: string) => {
    if (!confirm("Are you sure you want to cancel this job? The worker will stop processing it.")) {
      return;
    }

    setCancellingJobId(jobId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/jobs/${jobId}/cancel`, {
        method: "PUT",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to cancel job");
      }

      setSuccessMessage("Job cancelled successfully.");
      
      // Refresh jobs
      const jobsResponse = await fetch("/api/admin/jobs?type=recompute_final_scores&limit=20");
      if (jobsResponse.ok) {
        const jobsData: JobsResponse = await jobsResponse.json();
        setJobs(jobsData.data || []);
      }
    } catch (err) {
      console.error("Error cancelling job:", err);
      setError(err instanceof Error ? err.message : "Failed to cancel job");
    } finally {
      setCancellingJobId(null);
    }
  }, []);

  const handleDeleteConfig = useCallback(async (configId: string) => {
    if (!confirm("Are you sure you want to delete this weight configuration? This will also delete all associated scores and cannot be undone.")) {
      return;
    }

    setDeletingConfigId(configId);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/weight-configs/${configId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to delete config");
      }

      setSuccessMessage("Weight configuration deleted successfully.");
      
      // Refresh configs
      const configsResponse = await fetch("/api/admin/weight-configs");
      if (configsResponse.ok) {
        const configsData: WeightConfigsResponse = await configsResponse.json();
        setWeightConfigs(configsData.data || []);
        setActiveConfigId(configsData.active_config_id);
      }
    } catch (err) {
      console.error("Error deleting config:", err);
      setError(err instanceof Error ? err.message : "Failed to delete config");
    } finally {
      setDeletingConfigId(null);
    }
  }, []);

  const handleSaveSearchDefaults = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/settings", {
        body: JSON.stringify({
          search_defaults: searchDefaults,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to save search defaults");
      }

      setSuccessMessage("Search defaults saved successfully");
    } catch (err) {
      console.error("Error saving search defaults:", err);
      setError(err instanceof Error ? err.message : "Failed to save search defaults");
    } finally {
      setIsSaving(false);
    }
  }, [searchDefaults]);

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-3xl font-bold">Settings</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  // Check if any job is currently running (only disable button when running, not when queued)
  const isJobRunning = jobs.some((job) => job.status === "running");

  // Count pending jobs for queue position display
  const pendingJobs = jobs.filter((job) => job.status === "pending");
  const runningJob = jobs.find((job) => job.status === "running");

  return (
    <ErrorBoundary>
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-3xl font-bold">Settings</h1>
          <p className="mb-8 text-gray-400">
            Configure ranking weights and search preferences.
          </p>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-800 bg-green-900/20 p-4">
            <p className="text-green-400">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-900/20 p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Ranking Weights Section */}
        <div className="mb-8 rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Ranking Weights</h2>
          <p className="mb-6 text-sm text-gray-400">
            Adjust how important each scoring dimension is when calculating the final score.
          </p>

          {Object.entries(rankingWeights).map(([dimension, value]) => (
            <div className="mb-4" key={dimension}>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium capitalize text-gray-300">
                  {dimension.replace(/_/g, " ")}
                </label>
                <span className="text-sm text-gray-400">{value.toFixed(1)}</span>
              </div>
              <input
                className="w-full"
                max={5}
                min={0}
                step={0.1}
                type="range"
                value={value}
                onChange={(e) =>
                  setRankingWeights({
                    ...rankingWeights,
                    [dimension]: parseFloat(e.target.value),
                  })
                }
              />
            </div>
          ))}

          <div className="mt-6">
            <div className="flex gap-4">
              <button
                className="rounded bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
                onClick={() => setRankingWeights(DEFAULT_WEIGHTS)}
                type="button"
              >
                Reset to Defaults
              </button>
              <button
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving || isRecomputing || isJobRunning}
                onClick={handleSaveWeights}
              >
                {isRecomputing
                  ? "Starting..."
                  : isJobRunning
                    ? "Job Running..."
                    : "Save & Recompute Scores"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              This will update the weights and recalculate final scores for all posts.
              The dashboard will reflect the new rankings once the job completes.
              {pendingJobs.length > 0 && (
                <span className="block mt-1">
                  {pendingJobs.length} job{pendingJobs.length > 1 ? "s" : ""} queued
                  {runningJob && " (1 running)"}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Search Defaults Section */}
        <div className="mb-8 rounded-lg bg-gray-800 p-6">
          <h2 className="mb-4 text-xl font-semibold">Search Defaults</h2>
          <p className="mb-6 text-sm text-gray-400">
            Configure default settings for semantic search.
          </p>

          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Similarity Threshold
              </label>
              <span className="text-sm text-gray-400">
                {searchDefaults.similarity_threshold.toFixed(2)}
              </span>
            </div>
            <input
              className="w-full"
              max={1}
              min={0}
              step={0.05}
              type="range"
              value={searchDefaults.similarity_threshold}
              onChange={(e) =>
                setSearchDefaults({
                  ...searchDefaults,
                  similarity_threshold: parseFloat(e.target.value),
                })
              }
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>Broader (0.0)</span>
              <span>Precise (1.0)</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Lower values return more results, higher values are more precise.
            </p>
          </div>

          <button
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            onClick={handleSaveSearchDefaults}
          >
            {isSaving ? "Saving..." : "Save Search Defaults"}
          </button>
        </div>

        {/* Weight Configs Section */}
        <WeightConfigsList
          activeConfigId={activeConfigId}
          configs={weightConfigs}
          deletingConfigId={deletingConfigId}
          isActivating={isActivating}
          jobs={jobs}
          onActivate={handleActivateConfig}
          onDelete={handleDeleteConfig}
        />

        {/* Background Jobs Section */}
        <JobsList cancellingJobId={cancellingJobId} jobs={jobs} onCancel={handleCancelJob} />
        </div>
      </main>
    </ErrorBoundary>
  );
}
