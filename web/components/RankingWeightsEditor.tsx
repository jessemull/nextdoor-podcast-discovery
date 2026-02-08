"use client";

import type { RankingWeights } from "@/lib/types";

interface RankingWeightsEditorProps {
  isJobRunning: boolean;
  isRecomputing: boolean;
  isSaving: boolean;
  onReset: () => void;
  onSave: () => void;
  pendingJobsCount: number;
  rankingWeights: RankingWeights;
  setRankingWeights: (weights: RankingWeights) => void;
}

const DEFAULT_WEIGHTS: RankingWeights = {
  absurdity: 2.0,
  discussion_spark: 1.0,
  drama: 1.5,
  emotional_intensity: 1.2,
  news_value: 1.0,
};

/**
 * RankingWeightsEditor Component
 *
 * Allows users to adjust ranking weights using sliders and save/recompute scores.
 */
export function RankingWeightsEditor({
  isJobRunning,
  isRecomputing,
  isSaving,
  onReset,
  onSave,
  pendingJobsCount,
  rankingWeights,
  setRankingWeights,
}: RankingWeightsEditorProps) {
  return (
    <div className="mb-8 rounded-lg bg-gray-800 p-6">
      <h2 className="mb-4 text-xl font-semibold">Ranking Weights</h2>
      <p className="mb-6 text-sm text-gray-400">
        Adjust how important each scoring dimension is when calculating the final score.
      </p>

      {Object.entries(rankingWeights).map(([dimension, value]) => (
        <div key={dimension} className="mb-4">
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
            type="button"
            onClick={onReset}
          >
            Reset to Defaults
          </button>
          <button
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving || isRecomputing || isJobRunning}
            onClick={onSave}
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
          {pendingJobsCount > 0 && (
            <span className="block mt-1">
              {pendingJobsCount} job{pendingJobsCount > 1 ? "s" : ""} queued
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
