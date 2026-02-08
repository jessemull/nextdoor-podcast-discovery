"use client";

interface SearchDefaults {
  similarity_threshold: number;
}

interface SearchDefaultsEditorProps {
  isSaving: boolean;
  onSave: () => void;
  searchDefaults: SearchDefaults;
  setSearchDefaults: (defaults: SearchDefaults) => void;
}

/**
 * SearchDefaultsEditor Component
 *
 * Allows users to configure default settings for semantic search.
 */
export function SearchDefaultsEditor({
  isSaving,
  onSave,
  searchDefaults,
  setSearchDefaults,
}: SearchDefaultsEditorProps) {
  return (
    <div className="mb-8 rounded-lg bg-gray-800 p-6">
      <h2 className="mb-4 text-xl font-semibold">Search Defaults</h2>
      <p className="mb-6 text-sm text-gray-400">
        Configure default settings for semantic search.
      </p>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300" htmlFor="similarity-threshold">
            Similarity Threshold
          </label>
          <span className="text-sm text-gray-400">
            {searchDefaults.similarity_threshold.toFixed(2)}
          </span>
        </div>
        <input
          className="w-full"
          id="similarity-threshold"
          max={1}
          min={0}
          step={0.05}
          type="range"
          value={searchDefaults.similarity_threshold}
          onChange={(e) =>
            setSearchDefaults({
              ...searchDefaults,
              similarity_threshold: parseFloat(e.target.value),
            })
          }
        />
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Broader (0.0)</span>
          <span>Precise (1.0)</span>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Lower values return more results, higher values are more precise.
        </p>
      </div>

      <button
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSaving}
        onClick={onSave}
      >
        {isSaving ? "Saving..." : "Save Search Defaults"}
      </button>
    </div>
  );
}
