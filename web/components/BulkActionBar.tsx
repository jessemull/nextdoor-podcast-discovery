"use client";

export interface BulkActionBarProps {
  bulkActionLoading: boolean;
  onBulkMarkUsed: () => void;
  onBulkSave: () => void;
  onClear: () => void;
  selectedCount: number;
}

/**
 * Bar shown when one or more posts are selected. Offers bulk mark-as-used,
 * bulk save, and clear selection.
 */
export function BulkActionBar({
  bulkActionLoading,
  onBulkMarkUsed,
  onBulkSave,
  onClear,
  selectedCount,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-600 bg-gray-800/80 px-4 py-2">
      <span className="text-sm text-gray-400">{selectedCount} selected</span>
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
