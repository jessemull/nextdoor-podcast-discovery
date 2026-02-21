"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface PicksDefaults {
  picks_min: number;
}

interface PicksDefaultsEditorProps {
  onSave: (committed?: PicksDefaults) => void;
  picksDefaults: PicksDefaults;
  setPicksDefaults: (defaults: PicksDefaults) => void;
}

const DEFAULT_PICKS: PicksDefaults = { picks_min: 7 };

/**
 * PicksDefaultsEditor Component
 *
 * Configures the minimum score used when the "Top Picks" filter checkbox is
 * enabled on the feed. Only posts with final score at or above this value
 * are shown.
 */
export function PicksDefaultsEditor({
  onSave,
  picksDefaults,
  setPicksDefaults,
}: PicksDefaultsEditorProps) {
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [minScoreInput, setMinScoreInput] = useState(() =>
    String(picksDefaults.picks_min)
  );

  useEffect(() => {
    setMinScoreInput(String(picksDefaults.picks_min));
  }, [picksDefaults.picks_min]);

  const commitMinScore = () => {
    const v = parseFloat(minScoreInput);
    const clamped = Number.isNaN(v)
      ? 7
      : Math.min(10, Math.max(0, v));
    setPicksDefaults({ picks_min: clamped });
    setMinScoreInput(String(clamped));
  };

  const handleConfirmSave = () => {
    const vMin = parseFloat(minScoreInput);
    const minScore = Number.isNaN(vMin)
      ? 7
      : Math.min(10, Math.max(0, vMin));
    const committed: PicksDefaults = { picks_min: minScore };
    setPicksDefaults(committed);
    setMinScoreInput(String(minScore));
    setSaveConfirmOpen(false);
    onSave(committed);
  };

  return (
    <Card className="mb-8 p-6">
      <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
        Top Picks Threshold
      </h2>
      <p
        className="text-foreground mb-6 text-sm"
        style={{ opacity: 0.85 }}
      >
        When &quot;Top Picks&quot; is enabled in the feed filter sidebar, only posts
        with final score at or above this value are shown.
      </p>

      <h3 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
        Minimum Score
      </h3>
      <div className="mb-6 max-w-xs">
        <label
          className="text-foreground mb-2 block text-sm font-medium"
          htmlFor="picks-min"
          style={{ opacity: 0.85 }}
        >
          <span className="inline-flex items-center gap-1.5">
            Minimum Score
            <InfoTooltip description="Only posts with final score at or above this value are shown when Top Picks is enabled." />
          </span>
        </label>
        <input
          className="w-full rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
          id="picks-min"
          max={10}
          min={0}
          step={0.5}
          type="number"
          value={minScoreInput}
          onBlur={commitMinScore}
          onChange={(e) => setMinScoreInput(e.target.value)}
        />
      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Button
          className="border border-border"
          variant="ghost"
          onClick={() => setPicksDefaults({ ...DEFAULT_PICKS })}
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
        open={saveConfirmOpen}
        title="Update Top Picks Threshold"
        onCancel={() => setSaveConfirmOpen(false)}
        onConfirm={handleConfirmSave}
      >
        <p className="text-foreground text-sm" style={{ opacity: 0.85 }}>
          Save the minimum score used when Top Picks is enabled on the feed.
        </p>
      </ConfirmModal>
    </Card>
  );
}
