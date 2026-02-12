"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

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

function weightsEqual(a: RankingWeights, b: RankingWeights): boolean {
  const keys = Object.keys(a) as (keyof RankingWeights)[];
  return keys.every((k) => a[k] === b[k]);
}

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
  const activePresetName = useMemo(() => {
    const entry = Object.entries(PRESETS).find(([, w]) =>
      weightsEqual(w, rankingWeights)
    );
    return entry ? entry[0] : null;
  }, [rankingWeights]);

  return (
    <Card className="mb-8 p-6">
      <h2 className="mb-4 text-foreground text-lg font-semibold">
        Ranking Weights
      </h2>
      <p className="text-muted mb-4 text-sm">
        Adjust how important each scoring dimension is when calculating the
        final score.
      </p>

      <div className="mb-4">
        <label
          className="text-muted-foreground mb-1 block text-sm font-medium"
          htmlFor="config-name"
        >
          Config name (optional)
        </label>
        <input
          className="w-full max-w-md rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-border-focus focus:outline-none focus:ring-1"
          id="config-name"
          placeholder="e.g. Episode 5 Prep, Comedy Focus"
          type="text"
          value={configName}
          onChange={(e) => setConfigName(e.target.value)}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <span className="text-muted-foreground self-center text-xs">
          Presets:
        </span>
        {Object.entries(PRESETS).map(([name, weights]) => {
          const isActive = activePresetName === name;
          return (
            <button
              key={name}
              className={cn(
                "rounded border px-3 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus",
                isActive
                  ? "border-border bg-surface-hover text-foreground"
                  : "border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground"
              )}
              type="button"
              onClick={() => setRankingWeights(weights)}
            >
              {name}
            </button>
          );
        })}
      </div>

      {Object.entries(rankingWeights).map(([dimension, value]) => (
        <div key={dimension} className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-muted-foreground text-sm font-medium capitalize">
              {dimension.replace(/_/g, " ")}
            </label>
            <span className="text-muted text-sm">{value.toFixed(1)}</span>
          </div>
          <input
            className="h-2 w-full appearance-none rounded-full bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-muted"
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
          <Button variant="ghost" onClick={onReset}>
            Reset to Defaults
          </Button>
          <Button
            disabled={isSaving || isRecomputing || isJobRunning}
            variant="primary"
            onClick={onSave}
          >
            {isRecomputing
              ? "Starting..."
              : isJobRunning
                ? "Job Running..."
                : "Save & Recompute Scores"}
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          This will update the weights and recalculate final scores for all
          posts. The dashboard will reflect the new rankings once the job
          completes.
          {pendingJobsCount > 0 && (
            <span className="mt-1 block">
              {pendingJobsCount} job{pendingJobsCount > 1 ? "s" : ""} queued
            </span>
          )}
        </p>
      </div>
    </Card>
  );
}
