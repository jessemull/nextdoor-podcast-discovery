"use client";

import { useEffect, useState } from "react";

import { authFetch } from "@/lib/authFetch.client";

import type { WeightConfig } from "@/lib/types";

interface WeightConfigsResponse {
  active_config_id: null | string;
  data: WeightConfig[];
}

/**
 * Hook to fetch weight configs once on mount.
 * Used for feed preview mode config selector.
 */
export function useWeightConfigs(): {
  activeConfigId: null | string;
  weightConfigs: WeightConfig[];
} {
  const [activeConfigId, setActiveConfigId] = useState<null | string>(null);
  const [weightConfigs, setWeightConfigs] = useState<WeightConfig[]>([]);

  useEffect(() => {
    authFetch("/api/admin/weight-configs")
      .then((res) => (res.ok ? res.json() : { active_config_id: null, data: [] }))
      .then((data: WeightConfigsResponse) => {
        setActiveConfigId(data.active_config_id ?? null);
        setWeightConfigs(data.data ?? []);
      })
      .catch((err) => {
        console.error("Failed to load weight configs:", err);
      });
  }, []);

  return {
    activeConfigId,
    weightConfigs,
  };
}
