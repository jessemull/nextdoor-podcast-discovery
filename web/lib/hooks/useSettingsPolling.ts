"use client";

import { useCallback, useEffect, useState } from "react";

import type { Job, WeightConfig } from "@/lib/types";

interface JobsResponse {
  data: Job[];
  total: number;
}

interface WeightConfigsResponse {
  active_config_id: null | string;
  data: WeightConfig[];
}

// Polling configuration constants
const POLL_INTERVAL_MS = 5000; // Initial polling interval (5 seconds)
const MAX_POLL_INTERVAL_MS = 60000; // Maximum polling interval (60 seconds)
const POLL_BACKOFF_MULTIPLIER = 1.5; // Exponential backoff multiplier

/**
 * Custom hook for polling job status and weight configs.
 *
 * Features:
 * - Polls for job status and weight configs
 * - Exponential backoff on errors
 * - Pauses when tab is hidden (Page Visibility API)
 * - Resets errors when tab becomes visible
 */
export function useSettingsPolling() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [weightConfigs, setWeightConfigs] = useState<WeightConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<null | string>(null);

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

  const refetchWeightConfigs = useCallback(async () => {
    try {
      const configsResponse = await fetch("/api/admin/weight-configs");
      if (configsResponse.ok) {
        const configsData: WeightConfigsResponse =
          await configsResponse.json();
        setWeightConfigs(configsData.data || []);
        setActiveConfigId(configsData.active_config_id);
      }
    } catch (err) {
      console.error("Error refetching weight configs:", err);
    }
  }, []);

  return {
    activeConfigId,
    jobs,
    refetchWeightConfigs,
    setActiveConfigId,
    setJobs,
    setWeightConfigs,
    weightConfigs,
  };
}
