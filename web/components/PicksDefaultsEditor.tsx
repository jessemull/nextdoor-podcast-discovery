"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface PicksDefaults {
  picks_limit: number;
  picks_min: number;
  picks_min_podcast?: number;
}

interface PicksDefaultsEditorProps {
  isSaving: boolean;
  onSave: () => void;
  picksDefaults: PicksDefaults;
  setPicksDefaults: (defaults: PicksDefaults) => void;
}

/**
 * PicksDefaultsEditor Component
 *
 * Allows users to configure default settings for the Podcast Picks section on the home page.
 */
export function PicksDefaultsEditor({
  isSaving,
  onSave,
  picksDefaults,
  setPicksDefaults,
}: PicksDefaultsEditorProps) {
  return (
    <Card className="mb-8 p-6">
      <h2 className="mb-4 text-foreground text-lg font-semibold">
        Podcast Picks Defaults
      </h2>
      <p className="text-muted mb-6 text-sm">
        Configure default minimum score and limit for the Podcast Picks section.
        URL params (?picks_min=7&picks_limit=5&picks_min_podcast=7) override
        these when present.
      </p>

      <div className="mb-6 space-y-4">
        <div>
          <label
            className="text-muted-foreground mb-1 block text-sm font-medium"
            htmlFor="picks-min-podcast"
          >
            Min Podcast Score (optional)
          </label>
          <input
            className="w-24 rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
            id="picks-min-podcast"
            max={10}
            min={0}
            placeholder=""
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
          <p className="text-muted-foreground mt-1 text-xs">
            If set, Picks sort by podcast score and only show posts with
            podcast_worthy ≥ this (0–10). Leave empty to use Minimum Score
            instead.
          </p>
        </div>
        <div>
          <label
            className="text-muted-foreground mb-1 block text-sm font-medium"
            htmlFor="picks-min"
          >
            Minimum Score
          </label>
          <input
            className="w-24 rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
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
          <p className="text-muted-foreground mt-1 text-xs">
            Only show posts with final score ≥ this value (0–10).
          </p>
        </div>
        <div>
          <label
            className="text-muted-foreground mb-1 block text-sm font-medium"
            htmlFor="picks-limit"
          >
            Number of Picks
          </label>
          <input
            className="w-24 rounded border border-border bg-surface-hover px-3 py-2 text-sm text-foreground focus:border-border-focus focus:outline-none focus:ring-1"
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
          <p className="text-muted-foreground mt-1 text-xs">
            Max number of top picks to display (1–20).
          </p>
        </div>
      </div>

      <Button disabled={isSaving} variant="primary" onClick={onSave}>
        {isSaving ? "Saving..." : "Save Podcast Picks Defaults"}
      </Button>
    </Card>
  );
}
