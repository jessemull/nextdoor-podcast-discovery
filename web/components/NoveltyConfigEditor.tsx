"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface NoveltyConfig {
  frequency_thresholds?: {
    common: number;
    rare: number;
    very_common: number;
  };
  max_multiplier?: number;
  min_multiplier?: number;
  window_days?: number;
}

interface NoveltyConfigEditorProps {
  noveltyConfig: NoveltyConfig;
  onSave: () => void;
  setNoveltyConfig: (config: NoveltyConfig) => void;
}

const DEFAULT_NOVELTY: NoveltyConfig = {
  frequency_thresholds: { common: 30, rare: 5, very_common: 100 },
  max_multiplier: 1.5,
  min_multiplier: 0.2,
  window_days: 30,
};

/**
 * NoveltyConfigEditor Component
 *
 * Allows users to configure how topic frequency affects ranking.
 * Rare topics get a boost, very common topics get penalized.
 */
export function NoveltyConfigEditor({
  noveltyConfig,
  onSave,
  setNoveltyConfig,
}: NoveltyConfigEditorProps) {
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const thresholds = noveltyConfig.frequency_thresholds ?? DEFAULT_NOVELTY.frequency_thresholds!;
  const minMult = noveltyConfig.min_multiplier ?? DEFAULT_NOVELTY.min_multiplier!;
  const maxMult = noveltyConfig.max_multiplier ?? DEFAULT_NOVELTY.max_multiplier!;

  const handleConfirmSave = () => {
    setSaveConfirmOpen(false);
    onSave();
  };

  return (
    <Card className="mb-8 p-6">
      <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
        Novelty Configuration
      </h2>
      <p
        className="text-foreground mb-3 text-sm"
        style={{ opacity: 0.85 }}
      >
        Post scores are adjusted by a novelty multiplier that boosts rare topics
        and buries overused ones. We track how often each topic appears in the
        past 30 days and apply multipliers based on three frequency thresholds:
        rare, common, and very common.
      </p>
      <ul
        className="text-foreground mb-3 mt-3 list-disc pl-5 text-sm"
        style={{ opacity: 0.85 }}
      >
        <li className="mb-1">
          If a topic’s count is at or below the rare threshold, it receives the
          maximum multiplier.
        </li>
        <li className="mb-1">
          If a topic’s count is above the very common threshold, it receives the
          minimum multiplier.
        </li>
        <li className="mb-1">
          Between the rare and common thresholds, the multiplier decreases
          linearly from the maximum value down to 1.0.
        </li>
        <li className="mb-1">
          Between the common and very common thresholds, the multiplier decreases
          linearly from 1.0 down to the minimum value.
        </li>
      </ul>
      <p
        className="text-foreground mb-6 text-sm"
        style={{ opacity: 0.85 }}
      >
        The three thresholds define the frequency boundaries within the 30-day
        window.
      </p>

      <h3 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
        Adjust Multipliers
      </h3>
      <div className="mb-6 space-y-4">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label
              className="text-foreground text-sm font-medium"
              htmlFor="min-multiplier"
              style={{ opacity: 0.85 }}
            >
              Min Multiplier (very common topics)
            </label>
            <span className="text-foreground text-sm" style={{ opacity: 0.85 }}>
              {minMult.toFixed(2)}
            </span>
          </div>
          <input
            className="h-2 w-full appearance-none rounded-full bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-muted"
            id="min-multiplier"
            max={1}
            min={0.1}
            step={0.1}
            type="range"
            value={minMult}
            onChange={(e) =>
              setNoveltyConfig({
                ...noveltyConfig,
                min_multiplier: parseFloat(e.target.value),
              })
            }
          />
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label
              className="text-foreground text-sm font-medium"
              htmlFor="max-multiplier"
              style={{ opacity: 0.85 }}
            >
              Max Multiplier (rare topics)
            </label>
            <span className="text-foreground text-sm" style={{ opacity: 0.85 }}>
              {maxMult.toFixed(2)}
            </span>
          </div>
          <input
            className="h-2 w-full appearance-none rounded-full bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-muted"
            id="max-multiplier"
            max={2}
            min={1}
            step={0.1}
            type="range"
            value={maxMult}
            onChange={(e) =>
              setNoveltyConfig({
                ...noveltyConfig,
                max_multiplier: parseFloat(e.target.value),
              })
            }
          />
        </div>

        <div className="pt-4">
          <h3 className="text-foreground mb-3 text-base font-semibold uppercase tracking-wide">
            Adjust Frequency
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                className="text-foreground mb-2 block text-sm font-medium"
                htmlFor="rare-threshold"
                style={{ opacity: 0.85 }}
              >
                Rare (≤)
              </label>
              <input
                className="w-full rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
                id="rare-threshold"
                max={100}
                min={0}
                type="number"
                value={thresholds.rare}
                onChange={(e) =>
                  setNoveltyConfig({
                    ...noveltyConfig,
                    frequency_thresholds: {
                      ...thresholds,
                      rare: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
              />
            </div>
            <div>
              <label
                className="text-foreground mb-2 block text-sm font-medium"
                htmlFor="common-threshold"
                style={{ opacity: 0.85 }}
              >
                Common (≤)
              </label>
              <input
                className="w-full rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
                id="common-threshold"
                max={500}
                min={1}
                type="number"
                value={thresholds.common}
                onChange={(e) =>
                  setNoveltyConfig({
                    ...noveltyConfig,
                    frequency_thresholds: {
                      ...thresholds,
                      common: parseInt(e.target.value, 10) || 30,
                    },
                  })
                }
              />
            </div>
            <div>
              <label
                className="text-foreground mb-2 block text-sm font-medium"
                htmlFor="very-common-threshold"
                style={{ opacity: 0.85 }}
              >
                Very Common (≤)
              </label>
              <input
                className="w-full rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
                id="very-common-threshold"
                max={1000}
                min={10}
                type="number"
                value={thresholds.very_common}
                onChange={(e) =>
                  setNoveltyConfig({
                    ...noveltyConfig,
                    frequency_thresholds: {
                      ...thresholds,
                      very_common: parseInt(e.target.value, 10) || 100,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Button
          className="border border-border"
          variant="ghost"
          onClick={() => setNoveltyConfig({ ...DEFAULT_NOVELTY })}
        >
          Defaults
        </Button>
        <Button variant="primary" onClick={() => setSaveConfirmOpen(true)}>
          Save
        </Button>
      </div>

      <ConfirmModal
        cancelLabel="Cancel"
        confirmLabel="Submit"
        onCancel={() => setSaveConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        open={saveConfirmOpen}
        title="Update Novelty Configuration"
      >
        <p className="text-foreground text-sm" style={{ opacity: 0.85 }}>
          Updating the novelty configuration will kick off a compute job to
          update the feed.
        </p>
      </ConfirmModal>
    </Card>
  );
}
