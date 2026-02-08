"use client";

export interface BulkActionBarProps {
  bulkActionLoading: boolean;
  episodeDateForUse: string;
  onBulkMarkUsed: () => void;
  onBulkSave: () => void;
  onClear: () => void;
  selectedCount: number;
  setEpisodeDateForUse: (value: string) => void;
}

/**
 * Bar shown when one or more posts are selected. Offers bulk mark-as-used,
 * bulk save, and clear selection, with episode date for mark-used.
 */
export function BulkActionBar({
  bulkActionLoading,
  episodeDateForUse,
  onBulkMarkUsed,
  onBulkSave,
  onClear,
  selectedCount,
  setEpisodeDateForUse,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-600 bg-gray-800/80 px-4 py-2">
      <span className="text-sm text-gray-400">{selectedCount} selected</span>
      <label className="text-sm text-gray-400" htmlFor="bulk-episode-date">
        Episode date:
      </label>
      <input
        className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white"
        id="bulk-episode-date"
        type="date"
        value={episodeDateForUse}
        onChange={(e) => setEpisodeDateForUse(e.target.value)}
      />
      <button
        className="rounded bg-green-600 px-3 py-1 text-sm text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        disabled={bulkActionLoading}
        type="button"
        onClick={onBulkMarkUsed}
      >
        {bulkActionLoading ? "..." : "Mark as used"}
      </button>
      <button
        className="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        disabled={bulkActionLoading}
        type="button"
        onClick={onBulkSave}
      >
        {bulkActionLoading ? "..." : "Save selected"}
      </button>
      <button
        className="text-sm text-gray-400 transition-colors hover:text-white"
        type="button"
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}
