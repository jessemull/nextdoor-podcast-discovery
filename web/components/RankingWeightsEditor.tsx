"use client";

import type { RankingWeights } from "@/lib/types";

interface RankingWeightsEditorProps {
  configName: string;
  isJobRunning: boolean;
  isRecomputing: boolean;
  isSaving: boolean;
  onReset: () => void;
  onSave: () => void;
  pendingJobsCount: number;
  rankingWeights: RankingWeights;
  setConfigName: (name: string) => void;
  setRankingWeights: (weights: RankingWeights) => void;
}

const DEFAULT_WEIGHTS: RankingWeights = {
  absurdity: 2.0,
  discussion_spark: 1.0,
  drama: 1.5,
  emotional_intensity: 1.2,
  news_value: 1.0,
  podcast_worthy: 2.0,
  readability: 1.2,
};

const PRESETS: Record<string, RankingWeights> = {
  Balanced: {
    absurdity: 1.5,
    discussion_spark: 1.0,
    drama: 1.0,
    emotional_intensity: 1.0,
    news_value: 1.0,
    podcast_worthy: 2.0,
    readability: 1.2,
  },
  Comedy: {
    absurdity: 3.0,
    discussion_spark: 1.0,
    drama: 1.5,
    emotional_intensity: 1.5,
    news_value: 0.5,
    podcast_worthy: 2.0,
    readability: 1.2,
  },
  Drama: {
    absurdity: 1.0,
    discussion_spark: 2.0,
    drama: 3.0,
    emotional_intensity: 2.0,
    news_value: 1.0,
    podcast_worthy: 1.5,
    readability: 1.2,
  },
  "Max Absurdity": {
    absurdity: 4.0,
    discussion_spark: 0.5,
    drama: 1.0,
    emotional_intensity: 1.5,
    news_value: 0.5,
    podcast_worthy: 2.0,
    readability: 1.0,
  },
  News: {
    absurdity: 0.5,
    discussion_spark: 1.5,
    drama: 1.0,
    emotional_intensity: 1.0,
    news_value: 3.0,
    podcast_worthy: 1.5,
    readability: 1.2,
  },
};

/**
 * RankingWeightsEditor Component
 *
 * Allows users to adjust ranking weights using sliders and save/recompute scores.
 */
export function RankingWeightsEditor({
  configName,
  isJobRunning,
  isRecomputing,
  isSaving,
  onReset,
  onSave,
  pendingJobsCount,
  rankingWeights,
  setConfigName,
  setRankingWeights,
}: RankingWeightsEditorProps) {
  return (
    <div className="mb-8 rounded-lg bg-gray-800 p-6">
      <h2 className="mb-4 text-xl font-semibold">Ranking Weights</h2>
      <p className="mb-4 text-sm text-gray-400">
        Adjust how important each scoring dimension is when calculating the final score.
      </p>

      <div className="mb-4">
        <label
          className="mb-1 block text-sm font-medium text-gray-300"
          htmlFor="config-name"
        >
          Config name (optional)
        </label>
        <input
          className="w-full max-w-md rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500"
          id="config-name"
          placeholder="e.g. Episode 5 Prep, Comedy Focus"
          type="text"
          value={configName}
          onChange={(e) => setConfigName(e.target.value)}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <span className="text-xs text-gray-500">Presets:</span>
        {Object.entries(PRESETS).map(([name, weights]) => (
          <button
            key={name}
            className="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
            type="button"
            onClick={() => setRankingWeights(weights)}
          >
            {name}
          </button>
        ))}
      </div>

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
