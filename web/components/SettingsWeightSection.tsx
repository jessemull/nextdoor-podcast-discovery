"use client";

import { JobsList } from "./JobsList";
import { RankingWeightsEditor } from "./RankingWeightsEditor";
import { WeightConfigsList } from "./WeightConfigsList";

import type { Job, RankingWeights, WeightConfig } from "@/lib/types";

interface SettingsWeightSectionProps {
  activeConfigId: null | string;
  cancellingJobId: null | string;
  configName: string;
  configs: WeightConfig[];
  deletingConfigId: null | string;
  isActivating: boolean;
  isJobRunning: boolean;
  isRecomputing: boolean;
  isSaving: boolean;
  jobs: Job[];
  onActivate: (configId: string) => Promise<void>;
  onCancelJob: (jobId: string) => Promise<void>;
  onDelete: (configId: string) => Promise<void>;
  onRenameSuccess?: () => void;
  onReset: () => void;
  onSave: () => Promise<void>;
  pendingJobsCount: number;
  rankingWeights: RankingWeights;
  setActiveConfigId: (id: null | string) => void;
  setConfigName: (name: string) => void;
  setRankingWeights: (weights: RankingWeights) => void;
}

export function SettingsWeightSection({
  activeConfigId,
  cancellingJobId,
  configName,
  configs,
  deletingConfigId,
  isActivating,
  isJobRunning,
  isRecomputing,
  isSaving,
  jobs,
  onActivate,
  onCancelJob,
  onDelete,
  onRenameSuccess,
  onReset,
  onSave,
  pendingJobsCount,
  rankingWeights,
  setActiveConfigId,
  setConfigName,
  setRankingWeights,
}: SettingsWeightSectionProps) {
  return (
    <>
      <RankingWeightsEditor
        configName={configName}
        isJobRunning={isJobRunning}
        isRecomputing={isRecomputing}
        isSaving={isSaving}
        pendingJobsCount={pendingJobsCount}
        rankingWeights={rankingWeights}
        setConfigName={setConfigName}
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
