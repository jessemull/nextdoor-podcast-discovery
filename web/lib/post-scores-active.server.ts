/**
 * Resolve canonical final_score from post_scores for the active weight config
 * (same source as feed RPCs). Use wherever the UI shows a single ranking score.
 */

import "server-only";

import { getActiveWeightConfigId } from "@/lib/active-config-cache.server";

import type { Database } from "@/lib/database.types";
import type { LLMScore } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<Database>;

/**
 * Load final_score from post_scores for the given posts under the active weight config.
 */
export async function getFinalScoresForPostIds(
  supabase: AdminClient,
  postIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (postIds.length === 0) {
    return map;
  }

  const activeId = await getActiveWeightConfigId(supabase);
  if (!activeId) {
    return map;
  }

  const { data, error } = await supabase
    .from("post_scores")
    .select("post_id, final_score")
    .in("post_id", postIds)
    .eq("weight_config_id", activeId);

  if (error) {
    return map;
  }

  for (const row of data ?? []) {
    if (
      row.post_id != null &&
      row.final_score != null &&
      Number.isFinite(row.final_score)
    ) {
      map.set(row.post_id, row.final_score);
    }
  }

  return map;
}

/**
 * Override llm_scores.final_score when post_scores has a value for the active config.
 * Accepts any object with final_score so raw Supabase llm_scores rows work in search.
 */
export function applyActiveFinalScore<T extends { final_score: LLMScore["final_score"] }>(
  llmScores: null | T,
  finalFromPostScores: number | undefined
): null | T {
  if (!llmScores) {
    return null;
  }
  if (finalFromPostScores != null && Number.isFinite(finalFromPostScores)) {
    return { ...llmScores, final_score: finalFromPostScores };
  }
  return llmScores;
}
