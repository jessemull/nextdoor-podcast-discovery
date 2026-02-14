"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/utils";

import type { RankingWeights } from "@/lib/types";

const MIN_CONFIG_NAME_LENGTH = 3;

interface RankingWeightsEditorProps {
  isJobRunning: boolean;
  isRecomputing: boolean;
  isSaving: boolean;
  onReset: () => void;
  onSave: (name: string) => void;
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
  isJobRunning,
  isRecomputing,
  isSaving,
  onReset,
  onSave,
  pendingJobsCount,
  rankingWeights,
  setRankingWeights,
}: RankingWeightsEditorProps) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalName, setSaveModalName] = useState("");

  const activePresetName = useMemo(() => {
    const entry = Object.entries(PRESETS).find(([, w]) =>
      weightsEqual(w, rankingWeights)
    );
    return entry ? entry[0] : null;
  }, [rankingWeights]);

  const handleOpenSaveModal = () => {
    setSaveModalName("");
    setSaveModalOpen(true);
  };

  const handleConfirmSave = () => {
    if (saveModalName.trim().length < MIN_CONFIG_NAME_LENGTH) return;
    onSave(saveModalName.trim());
    setSaveModalOpen(false);
  };

  const description =
    "Adjust how important each scoring dimension is when calculating the final score. Saving will update the weights and recalculate final scores for all posts; the dashboard will reflect the new rankings once the job completes." +
    (pendingJobsCount > 0
      ? ` ${pendingJobsCount} job${pendingJobsCount > 1 ? "s" : ""} queued.`
      : "");

  return (
    <Card className="mb-8 p-6">
      <h2 className="text-foreground mb-2 text-base font-semibold uppercase tracking-wide">
        Add Weight Configuration
      </h2>
      <p
        className="text-foreground mb-4 text-sm"
        style={{ opacity: 0.85 }}
      >
        {description}
      </p>

      <h3 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
        Presets
      </h3>
      <div className="mb-6 flex flex-wrap gap-2">
        {Object.entries(PRESETS).map(([name, weights]) => {
          const isActive = activePresetName === name;
          return (
            <button
              key={name}
              className={cn(
                "rounded border px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus",
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

      <h3 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
        Adjust Weights
      </h3>
      {Object.entries(rankingWeights).map(([dimension, value]) => (
        <div key={dimension} className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label
              className="text-foreground text-sm font-medium capitalize"
              style={{ opacity: 0.85 }}
            >
              {dimension.replace(/_/g, " ")}
            </label>
            <span className="text-foreground text-sm" style={{ opacity: 0.85 }}>{value.toFixed(1)}</span>
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

      <div className="mt-6 flex gap-4">
        <Button
          className="border border-border"
          variant="ghost"
          onClick={onReset}
        >
          Defaults
        </Button>
        <Button
          disabled={isSaving || isRecomputing || isJobRunning}
          variant="primary"
          onClick={handleOpenSaveModal}
        >
          {isRecomputing
            ? "Starting..."
            : isJobRunning
              ? "Job Running..."
              : "Save"}
        </Button>
      </div>

      <ConfirmModal
        cancelLabel="Cancel"
        confirmDisabled={saveModalName.trim().length < MIN_CONFIG_NAME_LENGTH}
        confirmLabel="Submit"
        confirmLoading={isSaving}
        onCancel={() => setSaveModalOpen(false)}
        onConfirm={handleConfirmSave}
        open={saveModalOpen}
        title="Name this config"
      >
        <label className="block">
          <span className="text-foreground mb-1 block text-sm" style={{ opacity: 0.85 }}>
            Config name (required)
          </span>
          <input
            autoFocus
            className="border-border bg-surface-hover text-foreground placeholder-muted-foreground focus:border-border-focus w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            placeholder="e.g. Episode 5 Prep, Comedy Focus"
            type="text"
            value={saveModalName}
            onChange={(e) => setSaveModalName(e.target.value)}
          />
        </label>
      </ConfirmModal>
    </Card>
  );
}
