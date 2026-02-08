"use client";

import { useCallback, useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { JobsList } from "@/components/JobsList";
import { RankingWeightsEditor } from "@/components/RankingWeightsEditor";
import { SearchDefaultsEditor } from "@/components/SearchDefaultsEditor";
import { WeightConfigsList } from "@/components/WeightConfigsList";
import { useSettingsPolling } from "@/lib/hooks/useSettingsPolling";

import type { RankingWeights } from "@/lib/types";

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
  const [rankingWeights, setRankingWeights] = useState<RankingWeights>(DEFAULT_WEIGHTS);
  const [searchDefaults, setSearchDefaults] = useState({
    similarity_threshold: 0.2,
  });
  const [successMessage, setSuccessMessage] = useState<null | string>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [deletingConfigId, setDeletingConfigId] = useState<null | string>(null);
  const [cancellingJobId, setCancellingJobId] = useState<null | string>(null);

  // Use polling hook for jobs and weight configs
  const {
    activeConfigId,
    jobs,
    setActiveConfigId,
    setJobs,
    setWeightConfigs,
    weightConfigs,
  } = useSettingsPolling();

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
  }, [setActiveConfigId, setWeightConfigs]);


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
  }, [rankingWeights, setWeightConfigs]);

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
  }, [setActiveConfigId, setWeightConfigs]);

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
  }, [setJobs]);

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
  }, [setActiveConfigId, setWeightConfigs]);

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
        <RankingWeightsEditor
          isJobRunning={isJobRunning}
          isRecomputing={isRecomputing}
          isSaving={isSaving}
          pendingJobsCount={pendingJobs.length}
          rankingWeights={rankingWeights}
          setRankingWeights={setRankingWeights}
          onReset={() => setRankingWeights(DEFAULT_WEIGHTS)}
          onSave={handleSaveWeights}
        />

        {/* Search Defaults Section */}
        <SearchDefaultsEditor
          isSaving={isSaving}
          searchDefaults={searchDefaults}
          setSearchDefaults={setSearchDefaults}
          onSave={handleSaveSearchDefaults}
        />

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
