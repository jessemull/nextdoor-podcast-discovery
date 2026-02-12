"use client";

import { Bookmark, Check, Eye, EyeOff, X } from "lucide-react";

import { Button } from "@/components/ui/Button";

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
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-2">
      <span className="text-muted-foreground text-sm">
        {selectedCount} selected
      </span>
      <Button
        disabled={bulkActionLoading}
        variant="primary"
        onClick={onBulkMarkUsed}
      >
        <Check aria-hidden className="h-4 w-4" />
        {bulkActionLoading ? "..." : "Mark as used"}
      </Button>
      <Button
        disabled={bulkActionLoading}
        variant="primary"
        onClick={onBulkSave}
      >
        <Bookmark aria-hidden className="h-4 w-4" />
        {bulkActionLoading ? "..." : "Save selected"}
      </Button>
      <Button
        disabled={bulkActionLoading}
        variant="secondary"
        onClick={onBulkIgnore}
      >
        <EyeOff aria-hidden className="h-4 w-4" />
        {bulkActionLoading ? "..." : "Ignore selected"}
      </Button>
      <Button
        disabled={bulkActionLoading}
        variant="secondary"
        onClick={onBulkUnignore}
      >
        <Eye aria-hidden className="h-4 w-4" />
        {bulkActionLoading ? "..." : "Unignore selected"}
      </Button>
      <Button variant="ghost" onClick={onClear}>
        <X aria-hidden className="h-4 w-4" />
        Clear
      </Button>
    </div>
  );
}
