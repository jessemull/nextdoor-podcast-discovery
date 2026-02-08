"use client";

interface PicksDefaults {
  picks_limit: number;
  picks_min: number;
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
    <div className="mb-8 rounded-lg bg-gray-800 p-6">
      <h2 className="mb-4 text-xl font-semibold">Podcast Picks Defaults</h2>
      <p className="mb-6 text-sm text-gray-400">
        Configure default minimum score and limit for the Podcast Picks section.
        URL params (?picks_min=7&picks_limit=5) override these when present.
      </p>

      <div className="mb-6 space-y-4">
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-300"
            htmlFor="picks-min"
          >
            Minimum Score
          </label>
          <input
            className="w-24 rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
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
          <p className="mt-1 text-xs text-gray-500">
            Only show posts with final score ≥ this value (0–10).
          </p>
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-300"
            htmlFor="picks-limit"
          >
            Number of Picks
          </label>
          <input
            className="w-24 rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
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
          <p className="mt-1 text-xs text-gray-500">
            Max number of top picks to display (1–20).
          </p>
        </div>
      </div>

      <button
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSaving}
        onClick={onSave}
      >
        {isSaving ? "Saving..." : "Save Podcast Picks Defaults"}
      </button>
    </div>
  );
}
