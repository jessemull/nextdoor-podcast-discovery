"use client";

import { JobsList } from "./JobsList";
import { RankingWeightsEditor } from "./RankingWeightsEditor";
import { WeightConfigsList } from "./WeightConfigsList";

import type { RankingWeights } from "@/lib/types";

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
      />
      <JobsList
        cancellingJobId={cancellingJobId}
        jobs={jobs}
        onCancel={onCancelJob}
      />
    </>
  );
}
