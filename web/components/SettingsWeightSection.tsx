"use client";

import { JobsList } from "./JobsList";
import { RankingWeightsEditor } from "./RankingWeightsEditor";
import { WeightConfigsList } from "./WeightConfigsList";

import type { Job, RankingWeights, WeightConfig } from "@/lib/types";

interface SettingsWeightSectionProps {
  activeConfigId: null | string;
  cancellingJobId: null | string;
  configs: WeightConfig[];
  deletingConfigId: null | string;
  isActivating: boolean;
  jobs: Job[];
  onActivate: (configId: string) => Promise<void>;
  onCancelJob: (jobId: string) => Promise<void>;
  onDelete: (configId: string) => Promise<void>;
  onRenameSuccess?: () => void;
  onReset: () => void;
  onSave: (name: string) => Promise<void>;
  rankingWeights: RankingWeights;
  setActiveConfigId: (id: null | string) => void;
  setRankingWeights: (weights: RankingWeights) => void;
}

export function SettingsWeightSection({
  activeConfigId,
  cancellingJobId,
  configs,
  deletingConfigId,
  isActivating,
  jobs,
  onActivate,
  onCancelJob,
  onDelete,
  onRenameSuccess,
  onReset,
  onSave,
  rankingWeights,
  setActiveConfigId,
  setRankingWeights,
}: SettingsWeightSectionProps) {
  return (
    <>
      <RankingWeightsEditor
        rankingWeights={rankingWeights}
        setRankingWeights={setRankingWeights}
        onReset={onReset}
        onSave={onSave}
      />
      <WeightConfigsList
        activeConfigId={activeConfigId}
        configs={configs}
        deletingConfigId={deletingConfigId}
        isActivating={isActivating}
        jobs={jobs}
        onActivate={onActivate}
        onDelete={onDelete}
        onRenameSuccess={onRenameSuccess}
      />
      <JobsList
        cancellingJobId={cancellingJobId}
        jobs={jobs}
        onCancel={onCancelJob}
      />
    </>
  );
}
