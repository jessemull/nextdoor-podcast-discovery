"use client";

import { useCallback, useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/lib/ToastContext";
import { SettingsAlerts } from "@/components/SettingsAlerts";
import { SettingsDefaultsSection } from "@/components/SettingsDefaultsSection";
import { SettingsWeightSection } from "@/components/SettingsWeightSection";
import { useSettingsPolling } from "@/lib/hooks/useSettingsPolling";

import type { Job, RankingWeights, WeightConfig } from "@/lib/types";

interface NoveltyConfig {
  frequency_thresholds?: { common: number; rare: number; very_common: number };
  max_multiplier?: number;
  min_multiplier?: number;
  window_days?: number;
}

interface SettingsResponse {
  data: {
    novelty_config?: NoveltyConfig;
    picks_defaults?: {
      picks_limit: number;
      picks_min: number;
      picks_min_podcast?: number;
    };
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

interface JobsResponse {
  data: Job[];
  total: number;
}

// Default weights (includes podcast_worthy for direct podcast suitability signal)
const DEFAULT_WEIGHTS: RankingWeights = {
  absurdity: 2.0,
  discussion_spark: 1.0,
  drama: 1.5,
  emotional_intensity: 1.2,
  news_value: 1.0,
  podcast_worthy: 2.0,
  readability: 1.2,
};

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
  const { toast } = useToast();
  const [error, setError] = useState<null | string>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rankingWeights, setRankingWeights] = useState<RankingWeights>(DEFAULT_WEIGHTS);
  const [noveltyConfig, setNoveltyConfig] = useState<NoveltyConfig>({
    frequency_thresholds: { common: 30, rare: 5, very_common: 100 },
    max_multiplier: 1.5,
    min_multiplier: 0.2,
    window_days: 30,
  });
  const [searchDefaults, setSearchDefaults] = useState({
    similarity_threshold: 0.2,
  });
  const [picksDefaults, setPicksDefaults] = useState({
    picks_limit: 5,
    picks_min: 7,
    picks_min_podcast: undefined as number | undefined,
  });
  const [successMessage, setSuccessMessage] = useState<null | string>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [deletingConfigId, setDeletingConfigId] = useState<null | string>(null);
  // Use polling hook for jobs and weight configs
  const {
    activeConfigId,
    jobs,
    refetchWeightConfigs,
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
          if (settingsData.data.novelty_config) {
            setNoveltyConfig(settingsData.data.novelty_config);
          }
          if (settingsData.data.search_defaults) {
            setSearchDefaults(settingsData.data.search_defaults);
          }
          if (settingsData.data.picks_defaults) {
            setPicksDefaults(settingsData.data.picks_defaults);
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
            setRankingWeights({ ...DEFAULT_WEIGHTS, ...activeConfig.weights });
          } else if (configsData.data.length > 0 && configsData.data[0].weights) {
            // Fallback to first config if no active
            setRankingWeights({ ...DEFAULT_WEIGHTS, ...configsData.data[0].weights });
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


  const handleSaveWeights = useCallback(
    async (name: string) => {
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await fetch("/api/admin/recompute-scores", {
          body: JSON.stringify({
            name: name.trim() || undefined,
            ranking_weights: rankingWeights,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || errorData.details || "Failed to trigger recompute"
          );
        }

        await response.json();
        // Refetch configs so the new config appears in the list below
        const configsResponse = await fetch("/api/admin/weight-configs");
        if (configsResponse.ok) {
          const configsData: WeightConfigsResponse = await configsResponse.json();
          setWeightConfigs(configsData.data || []);
        }
      } catch (err) {
        console.error("Error saving weights:", err);
        toast.error(err instanceof Error ? err.message : "Failed to save weights");
      }
    },
    [rankingWeights, setWeightConfigs, toast]
  );

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

  const handleSaveNoveltyConfig = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/settings", {
        body: JSON.stringify({ novelty_config: noveltyConfig }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to save novelty config");
      }

      setSuccessMessage("Novelty configuration saved. Changes apply to future recomputes.");
    } catch (err) {
      console.error("Error saving novelty config:", err);
      setError(err instanceof Error ? err.message : "Failed to save novelty config");
    } finally {
      setIsSaving(false);
    }
  }, [noveltyConfig]);

  const handleSavePicksDefaults = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/settings", {
        body: JSON.stringify({
          picks_defaults: picksDefaults,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to save picks defaults");
      }

      setSuccessMessage("Podcast Picks defaults saved successfully");
    } catch (err) {
      console.error("Error saving picks defaults:", err);
      setError(err instanceof Error ? err.message : "Failed to save picks defaults");
    } finally {
      setIsSaving(false);
    }
  }, [picksDefaults]);

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
          <h1 className="mb-4 text-3xl font-semibold text-foreground">
            Settings
          </h1>
          <p className="text-muted">Loading...</p>
        </div>
      </main>
    );
  }

  // Count pending jobs for queue position display
  const pendingJobs = jobs.filter((job) => job.status === "pending");
  const runningJob = jobs.find((job) => job.status === "running");

  return (
    <ErrorBoundary>
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-3xl font-semibold text-foreground">
            Settings
          </h1>
          <p
            className="text-foreground mb-8 text-sm"
            style={{ opacity: 0.85 }}
          >
            Configure ranking weights and search preferences.
          </p>

        <SettingsAlerts error={error} successMessage={successMessage} />

        <SettingsWeightSection
          activeConfigId={activeConfigId}
          configs={weightConfigs}
          deletingConfigId={deletingConfigId}
          isActivating={isActivating}
          jobs={jobs}
          rankingWeights={rankingWeights}
          setActiveConfigId={setActiveConfigId}
          setRankingWeights={setRankingWeights}
          onActivate={handleActivateConfig}
          onDelete={handleDeleteConfig}
          onRenameSuccess={refetchWeightConfigs}
          onReset={() => setRankingWeights(DEFAULT_WEIGHTS)}
          onSave={handleSaveWeights}
        />

        <SettingsDefaultsSection
          isSaving={isSaving}
          noveltyConfig={noveltyConfig}
          picksDefaults={picksDefaults}
          searchDefaults={searchDefaults}
          setNoveltyConfig={setNoveltyConfig}
          setPicksDefaults={setPicksDefaults}
          setSearchDefaults={setSearchDefaults}
          onSaveNovelty={handleSaveNoveltyConfig}
          onSavePicks={handleSavePicksDefaults}
          onSaveSearch={handleSaveSearchDefaults}
        />
        </div>
      </main>
    </ErrorBoundary>
  );
}
