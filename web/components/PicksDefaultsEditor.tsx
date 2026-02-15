"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface PicksDefaults {
  picks_limit: number;
  picks_min: number;
  picks_min_podcast?: number;
}

interface PicksDefaultsEditorProps {
  onSave: () => void;
  picksDefaults: PicksDefaults;
  setPicksDefaults: (defaults: PicksDefaults) => void;
}

const DEFAULT_PICKS: PicksDefaults = {
  picks_limit: 5,
  picks_min: 7,
  picks_min_podcast: undefined,
};

/**
 * PicksDefaultsEditor Component
 *
 * Configures default values for the Top Picks filter on the feed (minimum score,
 * limit, and optional podcast score). These defaults are used when the feed
 * "Top Picks" checkbox is enabled.
 */
export function PicksDefaultsEditor({
  onSave,
  picksDefaults,
  setPicksDefaults,
}: PicksDefaultsEditorProps) {
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const handleConfirmSave = () => {
    setSaveConfirmOpen(false);
    onSave();
  };

  return (
    <Card className="mb-8 p-6">
      <h2 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
        Podcast Picks Defaults
      </h2>
      <p
        className="text-foreground mb-6 text-sm"
        style={{ opacity: 0.85 }}
      >
        These values are used when "Top Picks" is enabled on the feed: only
        posts that meet the minimum score (and optional podcast score) are
        shown, up to the configured limit. URL parameters can override these when
        present.
      </p>

      <h3 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
        Adjust Defaults
      </h3>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            className="text-foreground mb-2 block text-sm font-medium"
            htmlFor="picks-min"
            style={{ opacity: 0.85 }}
          >
            <span className="inline-flex items-center gap-1.5">
              Minimum Score
              <InfoTooltip description="Only posts with final score at or above this value are shown when top picks is enabled." />
            </span>
          </label>
          <input
            className="w-full rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
            id="picks-min"
            max={10}
            min={0}
            step={0.5}
            type="number"
            value={picksDefaults.picks_min}
            onChange={(e) =>
              setPicksDefaults({
                ...picksDefaults,
                picks_min: parseFloat(e.target.value) || 7,
              })
            }
          />
        </div>
        <div>
          <label
            className="text-foreground mb-2 block text-sm font-medium"
            htmlFor="picks-limit"
            style={{ opacity: 0.85 }}
          >
            <span className="inline-flex items-center gap-1.5">
              Number of Picks
              <InfoTooltip description="Maximum number of posts to show in the top picks list." />
            </span>
          </label>
          <input
            className="w-full rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
            id="picks-limit"
            max={20}
            min={1}
            type="number"
            value={picksDefaults.picks_limit}
            onChange={(e) =>
              setPicksDefaults({
                ...picksDefaults,
                picks_limit: parseInt(e.target.value, 10) || 5,
              })
            }
          />
        </div>
        <div>
          <label
            className="text-foreground mb-2 block text-sm font-medium"
            htmlFor="picks-min-podcast"
            style={{ opacity: 0.85 }}
          >
            <span className="inline-flex items-center gap-1.5">
              Min Podcast (Optional)
              <InfoTooltip description="When set, only posts with podcast_worthy score at or above this value are shown; leave empty to use minimum score only." />
            </span>
          </label>
          <input
            className="w-full rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
            id="picks-min-podcast"
            max={10}
            min={0}
            placeholder="—"
            step={0.5}
            type="number"
            value={picksDefaults.picks_min_podcast ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const num = raw === "" ? undefined : parseFloat(raw);
              setPicksDefaults({
                ...picksDefaults,
                picks_min_podcast:
                  num === undefined || Number.isNaN(num)
                    ? undefined
                    : Math.min(10, Math.max(0, num)),
              });
            }}
          />
        </div>
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
        onCancel={() => setSaveConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        open={saveConfirmOpen}
        title="Update Picks Defaults"
      >
        <p className="text-foreground text-sm" style={{ opacity: 0.85 }}>
          Save the default values for the top picks filter on the feed.
        </p>
      </ConfirmModal>
    </Card>
  );
}
