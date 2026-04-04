"use client";

import {
  Bookmark,
  BookmarkX,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import type { BulkActionType } from "@/lib/hooks/useBulkActions";

export const BULK_ADD_AS_EXAMPLE_VALUE = "add_as_example";

export const BULK_ACTION_LABELS: Record<BulkActionType, string> = {
  ignore: "Ignore",
  mark_unused: "Mark As Unused",
  mark_used: "Mark As Used",
  reprocess: "Refresh Posts",
  save: "Save",
  unsave: "Unsave",
  unignore: "Unignore",
};

export const BULK_ACTION_SUCCESS: Record<BulkActionType, string> = {
  ignore: "Ignored",
  mark_unused: "Marked as unused",
  mark_used: "Marked as used",
  reprocess: "Queued for refresh",
  save: "Saved",
  unsave: "Unsaved",
  unignore: "Unignored",
};

export const BULK_ACTION_TITLES: Record<BulkActionType, string> = {
  ignore: "Ignore Posts",
  mark_unused: "Mark Posts As Unused",
  mark_used: "Mark Posts As Used",
  reprocess: "Refresh Posts",
  save: "Save Posts",
  unsave: "Unsave Posts",
  unignore: "Unignore Posts",
};

export const BULK_ACTION_OPTIONS = [
  { icon: <EyeOff aria-hidden className="h-4 w-4" />, label: "Ignore", value: "ignore" },
  {
    icon: <Eye aria-hidden className="h-4 w-4" />,
    label: "Unignore",
    value: "unignore",
  },
  {
    icon: <Check aria-hidden className="h-4 w-4" />,
    label: "Mark As Used",
    value: "mark_used",
  },
  {
    icon: <RotateCcw aria-hidden className="h-4 w-4" />,
    label: "Mark As Unused",
    value: "mark_unused",
  },
  { icon: <Bookmark aria-hidden className="h-4 w-4" />, label: "Save", value: "save" },
  {
    icon: <BookmarkX aria-hidden className="h-4 w-4" />,
    label: "Unsave",
    value: "unsave",
  },
  {
    icon: <RefreshCw aria-hidden className="h-4 w-4" />,
    label: "Refresh Posts",
    value: "reprocess",
  },
];

export const SKELETON_CARD_COUNT = 8;

export const SORT_OPTIONS = [
  { label: "Comments (Least First)", sort: "comment_count" as const, sortOrder: "asc" as const },
  { label: "Comments (Most First)", sort: "comment_count" as const, sortOrder: "desc" as const },
  { label: "Newest First", sort: "date" as const, sortOrder: "desc" as const },
  { label: "Oldest First", sort: "date" as const, sortOrder: "asc" as const },
  {
    label: "Podcast Score (High to Low)",
    sort: "podcast_score" as const,
    sortOrder: "desc" as const,
  },
  {
    label: "Podcast Score (Low to High)",
    sort: "podcast_score" as const,
    sortOrder: "asc" as const,
  },
  { label: "Score (High to Low)", sort: "score" as const, sortOrder: "desc" as const },
  { label: "Score (Low to High)", sort: "score" as const, sortOrder: "asc" as const },
];
