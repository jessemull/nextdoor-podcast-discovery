"use client";

export interface BulkActionBarProps {
  bulkActionLoading: boolean;
  onBulkIgnore: () => void;
  onBulkMarkUsed: () => void;
  onBulkSave: () => void;
  onBulkUnignore: () => void;
  onClear: () => void;
  selectedCount: number;
}

/**
 * Bar shown when one or more posts are selected. Offers bulk mark-as-used,
 * bulk save, bulk ignore/unignore, and clear selection.
 */
export function BulkActionBar({
  bulkActionLoading,
  onBulkIgnore,
  onBulkMarkUsed,
  onBulkSave,
  onBulkUnignore,
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
        className="rounded bg-gray-600 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
        disabled={bulkActionLoading}
        type="button"
        onClick={onBulkIgnore}
      >
        {bulkActionLoading ? "..." : "Ignore selected"}
      </button>
      <button
        className="rounded border border-gray-500 bg-gray-700 px-3 py-1 text-sm text-gray-200 transition-colors hover:bg-gray-600 disabled:opacity-50"
        disabled={bulkActionLoading}
        type="button"
        onClick={onBulkUnignore}
      >
        {bulkActionLoading ? "..." : "Unignore selected"}
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
