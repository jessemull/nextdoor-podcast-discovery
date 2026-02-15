"use client";

import { RankingWeightsEditor } from "./RankingWeightsEditor";
import { WeightConfigsList } from "./WeightConfigsList";

import type { Job, RankingWeights, WeightConfig } from "@/lib/types";

interface SettingsWeightSectionProps {
  activeConfigId: null | string;
  configs: WeightConfig[];
  deletingConfigId: null | string;
  isActivating: boolean;
  jobs: Job[];
  onActivate: (configId: string) => Promise<void>;
  onDelete: (configId: string) => Promise<void>;
  onRenameSuccess?: () => void;
  onReset: () => void;
  onSave: (name: string, description?: string) => Promise<void>;
  rankingWeights: RankingWeights;
  setActiveConfigId: (id: null | string) => void;
  setRankingWeights: (weights: RankingWeights) => void;
}

export function SettingsWeightSection({
  activeConfigId,
  configs,
  deletingConfigId,
  isActivating,
  jobs,
  onActivate,
  onDelete,
  onRenameSuccess,
  onReset,
  onSave,
  rankingWeights,
  setActiveConfigId,
  setRankingWeights,
}: SettingsWeightSectionProps) {
  return (
    <WeightConfigsList
      activeConfigId={activeConfigId}
      configs={configs}
      deletingConfigId={deletingConfigId}
      isActivating={isActivating}
      jobs={jobs}
      middleSection={
        <RankingWeightsEditor
          rankingWeights={rankingWeights}
          setRankingWeights={setRankingWeights}
          onReset={onReset}
          onSave={onSave}
        />
      }
      onActivate={onActivate}
      onDelete={onDelete}
      onRenameSuccess={onRenameSuccess}
    />
  );
}
