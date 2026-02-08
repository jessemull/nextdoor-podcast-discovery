"use client";

import { useCallback, useState } from "react";

export interface UseBulkActionsParams {
  fetchPosts: (currentOffset?: number, append?: boolean) => Promise<void>;
  offset: number;
  setError: (value: null | string) => void;
}

export interface UseBulkActionsResult {
  bulkActionLoading: boolean;
  episodeDateForUse: string;
  handleBulkMarkUsed: () => Promise<void>;
  handleBulkSave: () => Promise<void>;
  handleMarkSaved: (postId: string, saved: boolean) => Promise<void>;
  handleMarkUsed: (postId: string) => Promise<void>;
  markingSaved: Set<string>;
  markingUsed: Set<string>;
  selectedIds: Set<string>;
  setEpisodeDateForUse: (value: string) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelect: (postId: string, selected: boolean) => void;
}

export function useBulkActions({
  fetchPosts,
  offset,
  setError,
}: UseBulkActionsParams): UseBulkActionsResult {
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [episodeDateForUse, setEpisodeDateForUse] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [markingSaved, setMarkingSaved] = useState<Set<string>>(new Set());
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        await fetchPosts(offset);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update post";
        setError(errorMessage);
      } finally {
        setMarkingSaved((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [fetchPosts, markingSaved, offset, setError]
  );

  const handleMarkUsed = useCallback(
    async (postId: string) => {
      if (markingUsed.has(postId)) return;
      setMarkingUsed((prev) => new Set(prev).add(postId));
      try {
        const response = await fetch(`/api/posts/${postId}/used`, {
          body: JSON.stringify({
            episode_date: episodeDateForUse,
            used: true,
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to mark post as used");
        }
        await fetchPosts(offset);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update post";
        console.error("Failed to mark post as used:", err);
        setError(errorMessage);
      } finally {
        setMarkingUsed((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [episodeDateForUse, fetchPosts, markingUsed, offset, setError]
  );

  const handleBulkMarkUsed = useCallback(async () => {
    if (selectedIds.size === 0 || bulkActionLoading) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/posts/${id}/used`, {
            body: JSON.stringify({
              episode_date: episodeDateForUse,
              used: true,
            }),
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
    episodeDateForUse,
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

  return {
    bulkActionLoading,
    episodeDateForUse,
    handleBulkMarkUsed,
    handleBulkSave,
    handleMarkSaved,
    handleMarkUsed,
    markingSaved,
    markingUsed,
    selectedIds,
    setEpisodeDateForUse,
    setSelectedIds,
    toggleSelect,
  };
}
