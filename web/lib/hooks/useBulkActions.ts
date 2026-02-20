"use client";

import { useCallback, useState } from "react";

import { useToast } from "@/lib/ToastContext";

export type BulkActionType =
  | "ignore"
  | "mark_used"
  | "reprocess"
  | "save"
  | "unignore";

export interface BulkQuery {
  category?: string;
  ignored_only?: boolean;
  min_podcast_worthy?: number;
  min_reaction_count?: number;
  min_score?: number;
  neighborhood_id?: string;
  order?: "asc" | "desc";
  saved_only?: boolean;
  sort?: "date" | "podcast_score" | "score";
  unused_only?: boolean;
}

export interface UseBulkActionsParams {
  fetchPosts: (currentOffset?: number, append?: boolean) => Promise<void>;
  getCurrentQuery: () => BulkQuery;
  offset: number;
  setError: (value: null | string) => void;
}

export interface BulkActionOptions {
  applyToQuery: boolean;
  onError?: (message: string) => void;
  onSuccess?: (data?: {
    data?: { jobs_queued?: number; skipped?: number; updated?: number };
  }) => void;
}

export interface UseBulkActionsResult {
  bulkActionLoading: boolean;
  handleBulkAction: (
    action: BulkActionType,
    options: BulkActionOptions
  ) => Promise<void>;
  handleBulkIgnore: () => Promise<void>;
  handleBulkMarkUsed: () => Promise<void>;
  handleBulkSave: () => Promise<void>;
  handleBulkUnignore: () => Promise<void>;
  handleMarkIgnored: (postId: string, ignored: boolean) => Promise<void>;
  handleMarkSaved: (postId: string, saved: boolean) => Promise<void>;
  handleMarkUsed: (postId: string) => Promise<void>;
  markingIgnored: Set<string>;
  markingSaved: Set<string>;
  markingUsed: Set<string>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelect: (postId: string, selected: boolean) => void;
}

export function useBulkActions({
  fetchPosts,
  getCurrentQuery,
  offset,
  setError,
}: UseBulkActionsParams): UseBulkActionsResult {
  const { toast } = useToast();
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [markingIgnored, setMarkingIgnored] = useState<Set<string>>(new Set());
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleBulkAction = useCallback(
    async (
      action: BulkActionType,
      options: BulkActionOptions
    ): Promise<void> => {
      const { applyToQuery, onError, onSuccess } = options;
      if (!applyToQuery && selectedIds.size === 0) return;
      if (bulkActionLoading) return;

      setBulkActionLoading(true);
      try {
        const body = applyToQuery
          ? {
              action,
              apply_to_query: true,
              query: getCurrentQuery(),
            }
          : { action, post_ids: Array.from(selectedIds) };

        const response = await fetch("/api/posts/bulk", {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Bulk action failed");
        }

        const data = await response.json();
        setSelectedIds(new Set());
        await fetchPosts(offset);
        onSuccess?.(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Bulk action failed";
        if (onError != null) {
          onError(errorMessage);
        } else {
          setError(errorMessage);
        }
      } finally {
        setBulkActionLoading(false);
      }
    },
    [
      bulkActionLoading,
      fetchPosts,
      getCurrentQuery,
      offset,
      selectedIds,
      setError,
    ]
  );

  const toggleSelect = useCallback((postId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(postId);
      else next.delete(postId);
      return next;
    });
  }, []);

  const handleMarkSaved = useCallback(
    async (postId: string, saved: boolean) => {
      if (markingSaved.has(postId)) return;
      setMarkingSaved((prev) => new Set(prev).add(postId));
      try {
        const response = await fetch(`/api/posts/${postId}/saved`, {
          body: JSON.stringify({ saved }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to save post");
        }
        toast.success(saved ? "Saved." : "Unsaved.");
        await fetchPosts(0);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update post";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setMarkingSaved((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [fetchPosts, markingSaved, setError, toast]
  );

  const handleMarkIgnored = useCallback(
    async (postId: string, ignored: boolean) => {
      if (markingIgnored.has(postId)) return;
      setMarkingIgnored((prev) => new Set(prev).add(postId));
      try {
        const response = await fetch(`/api/posts/${postId}/ignored`, {
          body: JSON.stringify({ ignored }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update post");
        }
        toast.success(ignored ? "Ignored." : "Unignored.");
        await fetchPosts(0);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update post";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setMarkingIgnored((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [fetchPosts, markingIgnored, setError, toast]
  );

  const handleMarkUsed = useCallback(
    async (postId: string) => {
      if (markingUsed.has(postId)) return;
      setMarkingUsed((prev) => new Set(prev).add(postId));
      try {
        const response = await fetch(`/api/posts/${postId}/used`, {
          body: JSON.stringify({ used: true }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to mark post as used");
        }
        toast.success("Marked as used.");
        await fetchPosts(0);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update post";
        console.error("Failed to mark post as used:", err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setMarkingUsed((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [fetchPosts, markingUsed, setError, toast]
  );

  const handleBulkMarkUsed = useCallback(async () => {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/posts/${id}/used`, {
            body: JSON.stringify({ used: true }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          })
        )
      );
      setSelectedIds(new Set());
      await fetchPosts(offset);
    } catch (err) {
      console.error("Bulk mark used failed:", err);
      setError("Failed to mark some posts as used");
    } finally {
      setBulkActionLoading(false);
    }
  }, [
    bulkActionLoading,
    fetchPosts,
    offset,
    selectedIds,
    setError,
  ]);

  const handleBulkSave = useCallback(async () => {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/posts/${id}/saved`, {
            body: JSON.stringify({ saved: true }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          })
        )
      );
      setSelectedIds(new Set());
      await fetchPosts(offset);
    } catch (err) {
      console.error("Bulk save failed:", err);
      setError("Failed to save some posts");
    } finally {
      setBulkActionLoading(false);
    }
  }, [bulkActionLoading, fetchPosts, offset, selectedIds, setError]);

  const handleBulkIgnore = useCallback(async () => {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/posts/${id}/ignored`, {
            body: JSON.stringify({ ignored: true }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          })
        )
      );
      setSelectedIds(new Set());
      await fetchPosts(offset);
    } catch (err) {
      console.error("Bulk ignore failed:", err);
      setError("Failed to ignore some posts");
    } finally {
      setBulkActionLoading(false);
    }
  }, [bulkActionLoading, fetchPosts, offset, selectedIds, setError]);

  const handleBulkUnignore = useCallback(async () => {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/posts/${id}/ignored`, {
            body: JSON.stringify({ ignored: false }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          })
        )
      );
      setSelectedIds(new Set());
      await fetchPosts(offset);
    } catch (err) {
      console.error("Bulk unignore failed:", err);
      setError("Failed to unignore some posts");
    } finally {
      setBulkActionLoading(false);
    }
  }, [bulkActionLoading, fetchPosts, offset, selectedIds, setError]);

  return {
    bulkActionLoading,
    handleBulkAction,
    handleBulkIgnore,
    handleBulkMarkUsed,
    handleBulkSave,
    handleBulkUnignore,
    handleMarkIgnored,
    handleMarkSaved,
    handleMarkUsed,
    markingIgnored,
    markingSaved,
    markingUsed,
    selectedIds,
    setSelectedIds,
    toggleSelect,
  };
}
