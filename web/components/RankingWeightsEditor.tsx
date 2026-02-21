"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { cn } from "@/lib/utils";

import type { RankingWeights } from "@/lib/types";

const MIN_CONFIG_NAME_LENGTH = 3;

const WEIGHT_TOOLTIPS: Record<keyof RankingWeights, string> = {
  absurdity:
    "Weight for how absurd or comedic the content is.",
  discussion_spark:
    "Weight for how likely the post is to spark discussion.",
  drama:
    "Weight for dramatic or emotionally charged content.",
  emotional_intensity:
    "Weight for emotional intensity of the content.",
  news_value:
    "Weight for newsworthy or timely content.",
  podcast_worthy:
    "Weight for how suitable the content is for podcast discussion.",
  readability:
    "Weight for clarity and readability of the content.",
};

interface RankingWeightsEditorProps {
  onReset: () => void;
  onSave: (name: string, description?: string) => void;
  rankingWeights: RankingWeights;
  setRankingWeights: (weights: RankingWeights) => void;
}

const DEFAULT_WEIGHTS: RankingWeights = {
  absurdity: 2.5,
  discussion_spark: 1.0,
  drama: 1.5,
  emotional_intensity: 1.2,
  news_value: 1.0,
  podcast_worthy: 2.5,
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
  onReset,
  onSave,
  rankingWeights,
  setRankingWeights,
}: RankingWeightsEditorProps) {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalDescription, setSaveModalDescription] = useState("");
  const [saveModalName, setSaveModalName] = useState("");

  const activePresetName = useMemo(() => {
    const entry = Object.entries(PRESETS).find(([, w]) =>
      weightsEqual(w, rankingWeights)
    );
    return entry ? entry[0] : null;
  }, [rankingWeights]);

  const handleOpenSaveModal = () => {
    setSaveModalDescription("");
    setSaveModalName("");
    setSaveModalOpen(true);
  };

  const handleConfirmSave = () => {
    if (saveModalName.trim().length < MIN_CONFIG_NAME_LENGTH) return;
    setSaveModalOpen(false);
    onSave(
      saveModalName.trim(),
      saveModalDescription.trim() || undefined
    );
  };

  const description =
    "Adjust the weight of each scoring dimension when calculating the final score. Saving will queue a job to update the weights and recalculate the final scores for all posts.";

  return (
    <Card className="mb-8 p-6">
      <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
        Add Weight Configuration
      </h2>
      <p
        className="text-foreground mb-6 text-sm"
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
              className="text-foreground flex items-center gap-1.5 text-sm font-medium capitalize"
              style={{ opacity: 0.85 }}
            >
              {dimension.replace(/_/g, " ")}
              <InfoTooltip
                description={
                  WEIGHT_TOOLTIPS[dimension as keyof RankingWeights] ?? ""
                }
              />
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

      <div className="mt-6 flex justify-end gap-4">
        <Button
          className="border border-border"
          variant="ghost"
          onClick={onReset}
        >
          Defaults
        </Button>
        <Button variant="primary" onClick={handleOpenSaveModal}>
          Save
        </Button>
      </div>

      <ConfirmModal
        cancelLabel="Cancel"
        confirmDisabled={saveModalName.trim().length < MIN_CONFIG_NAME_LENGTH}
        confirmLabel="Submit"
        open={saveModalOpen}
        title="Adding Weight Configuration"
        onCancel={() => setSaveModalOpen(false)}
        onConfirm={handleConfirmSave}
      >
        <div className="space-y-3 py-1">
          <label className="block">
            <span
              className="text-foreground mb-2 flex items-center gap-1.5 text-sm"
              style={{ opacity: 0.85 }}
            >
              Weight Configuration Name
              <InfoTooltip description="Name for this weight configuration so you can identify it later." />
            </span>
            <input
              autoFocus // eslint-disable-line jsx-a11y/no-autofocus
              className="border-border bg-surface-hover text-foreground placeholder-muted-foreground focus:border-border-focus w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
              placeholder="Enter a name..."
              type="text"
              value={saveModalName}
              onChange={(e) => setSaveModalName(e.target.value)}
            />
          </label>
          <label className="block">
            <span
              className="text-foreground mb-2 flex items-center gap-1.5 text-sm"
              style={{ opacity: 0.85 }}
            >
              Description (Optional)
              <InfoTooltip description="Optional note describing when or why to use this configuration." />
            </span>
            <textarea
              className="border-border bg-surface-hover text-foreground placeholder-muted-foreground focus:border-border-focus w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
              placeholder="Optional note"
              rows={2}
              value={saveModalDescription}
              onChange={(e) => setSaveModalDescription(e.target.value)}
            />
          </label>
        </div>
      </ConfirmModal>
    </Card>
  );
}
