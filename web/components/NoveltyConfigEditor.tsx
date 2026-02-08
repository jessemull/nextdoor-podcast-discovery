"use client";

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
  isSaving: boolean;
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
  isSaving,
  noveltyConfig,
  onSave,
  setNoveltyConfig,
}: NoveltyConfigEditorProps) {
  const thresholds = noveltyConfig.frequency_thresholds ?? DEFAULT_NOVELTY.frequency_thresholds!;
  const minMult = noveltyConfig.min_multiplier ?? DEFAULT_NOVELTY.min_multiplier!;
  const maxMult = noveltyConfig.max_multiplier ?? DEFAULT_NOVELTY.max_multiplier!;

  return (
    <div className="mb-8 rounded-lg bg-gray-800 p-6">
      <h2 className="mb-4 text-xl font-semibold">Novelty Configuration</h2>
      <p className="mb-2 text-sm text-gray-400">
        Control how topic frequency affects scores. Rare topics get a boost;
        overused topics get penalized.
      </p>
      <p className="mb-4 text-xs text-gray-500">
        Topics with ≤{thresholds.rare} posts in {noveltyConfig.window_days ?? 30} days get{" "}
        {maxMult.toFixed(1)}×; those with &gt;{thresholds.very_common} get {minMult.toFixed(1)}×.
      </p>
      <div className="mb-6 rounded border border-amber-800/50 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
        Recompute scores (via Ranking Weights &quot;Save & Recompute&quot;) for novelty
        changes to take effect on the feed.
      </div>

      <div className="mb-6 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300" htmlFor="min-multiplier">
              Min Multiplier (very common topics)
            </label>
            <span className="text-sm text-gray-400">{minMult.toFixed(2)}</span>
          </div>
          <input
            className="w-full"
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

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300" htmlFor="max-multiplier">
              Max Multiplier (rare topics)
            </label>
            <span className="text-sm text-gray-400">{maxMult.toFixed(2)}</span>
          </div>
          <input
            className="w-full"
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

        <div className="border-t border-gray-700 pt-4">
          <h3 className="mb-3 text-sm font-medium text-gray-300">
            Frequency Thresholds (30-day window)
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400" htmlFor="rare-threshold">
                Rare (≤)
              </label>
              <input
                className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
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
              <label className="mb-1 block text-xs text-gray-400" htmlFor="common-threshold">
                Common (≤)
              </label>
              <input
                className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
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
              <label className="mb-1 block text-xs text-gray-400" htmlFor="very-common-threshold">
                Very Common (≤)
              </label>
              <input
                className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
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

      <button
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSaving}
        onClick={onSave}
      >
        {isSaving ? "Saving..." : "Save Novelty Config"}
      </button>
    </div>
  );
}
