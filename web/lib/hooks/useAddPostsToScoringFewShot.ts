"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/lib/ToastContext";
import { SCORING_FEW_SHOT_MAX_EXAMPLES } from "@/lib/validators";

interface AddPostsResponseData {
  added: number;
  skipped_already_in_few_shot: number;
  skipped_invalid_or_missing_post: number;
  skipped_list_full: number;
}

/**
 * POST /api/settings/scoring-few-shot/add-posts from the admin feed or post detail.
 */
export function useAddPostsToScoringFewShot() {
  const { toast } = useToast();
  const [addingIds, setAddingIds] = useState<Set<string>>(() => new Set());
  const [exampleCount, setExampleCount] = useState<null | number>(null);

  const refreshExampleCount = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        return;
      }
      const json = (await res.json()) as {
        data?: { scoring_few_shot?: { examples?: unknown[] } | null };
      };
      const n = json.data?.scoring_few_shot?.examples?.length;
      setExampleCount(typeof n === "number" ? n : 0);
    } catch {
      setExampleCount(0);
    }
  }, []);

  useEffect(() => {
    void refreshExampleCount();
  }, [refreshExampleCount]);

  const examplesFull =
    exampleCount !== null && exampleCount >= SCORING_FEW_SHOT_MAX_EXAMPLES;

  const addPosts = useCallback(
    async (postIds: string[]): Promise<void> => {
      const ids = [...new Set(postIds)];
      if (ids.length === 0) {
        return;
      }
      if (
        exampleCount !== null &&
        exampleCount >= SCORING_FEW_SHOT_MAX_EXAMPLES
      ) {
        return;
      }
      setAddingIds((prev) => new Set([...prev, ...ids]));
      try {
        const res = await fetch("/api/settings/scoring-few-shot/add-posts", {
          body: JSON.stringify({ post_ids: ids }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const json = (await res.json()) as {
          data?: AddPostsResponseData;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? "Request failed");
        }
        const d = json.data;
        if (!d) {
          toast.success("Scoring few-shot updated.");
          void refreshExampleCount();
          return;
        }
        const {
          added,
          skipped_already_in_few_shot,
          skipped_invalid_or_missing_post,
          skipped_list_full,
        } = d;
        if (added > 0) {
          let msg = `Added ${added} to scoring few-shot (Settings).`;
          const parts: string[] = [];
          if (skipped_already_in_few_shot > 0) {
            parts.push(`${skipped_already_in_few_shot} already listed`);
          }
          if (skipped_invalid_or_missing_post > 0) {
            parts.push(`${skipped_invalid_or_missing_post} not found`);
          }
          if (skipped_list_full > 0) {
            parts.push(`${skipped_list_full} skipped (max 6)`);
          }
          if (parts.length > 0) {
            msg += ` ${parts.join("; ")}.`;
          }
          toast.success(msg);
          void refreshExampleCount();
        } else {
          const noOtherSkips =
            skipped_already_in_few_shot === 0 &&
            skipped_invalid_or_missing_post === 0;
          if (noOtherSkips && skipped_list_full > 0) {
            void refreshExampleCount();
            return;
          }
          const parts: string[] = [];
          if (skipped_already_in_few_shot > 0) {
            parts.push("Already in few-shot");
          }
          if (skipped_invalid_or_missing_post > 0) {
            parts.push("Post not found");
          }
          if (skipped_list_full > 0) {
            parts.push("Scoring few-shot is full (6)");
          }
          toast.error(parts.length > 0 ? parts.join(" · ") : "No posts added.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add posts");
      } finally {
        setAddingIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            next.delete(id);
          }
          return next;
        });
      }
    },
    [exampleCount, refreshExampleCount, toast]
  );

  return { addPosts, addingIds, examplesFull };
}
