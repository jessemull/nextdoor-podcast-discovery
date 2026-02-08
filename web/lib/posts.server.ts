/**
 * Server-side post data fetching.
 * Use in Server Components only.
 */

import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase.server";

import type { Database } from "@/lib/database.types";
import type { LLMScore, PostWithScores } from "@/lib/types";

/**
 * Fetch a single post with LLM scores and neighborhood.
 * Returns null if not found or on error.
 */
export async function getPostById(id: string): Promise<null | PostWithScores> {
  const supabase = getSupabaseAdmin();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("*, neighborhood:neighborhoods(*)")
    .eq("id", id)
    .single();

  if (postError || !post) {
    return null;
  }

  const { data: llmScore } = await supabase
    .from("llm_scores")
    .select("*")
    .eq("post_id", id)
    .single();

  const postRow = post as {
    neighborhood: Database["public"]["Tables"]["neighborhoods"]["Row"] | null;
  } & Database["public"]["Tables"]["posts"]["Row"];

  const result: PostWithScores = {
    ...postRow,
    image_urls: (postRow.image_urls as string[]) || [],
    llm_scores: llmScore
      ? ({
          categories: llmScore.categories || [],
          created_at: llmScore.created_at,
          final_score: llmScore.final_score,
          id: llmScore.id,
          model_version: llmScore.model_version || "claude-3-haiku-20240307",
          post_id: llmScore.post_id,
          scores: (llmScore.scores as LLMScore["scores"]) || {},
          summary: llmScore.summary,
          why_podcast_worthy: llmScore.why_podcast_worthy ?? null,
        } as LLMScore)
      : null,
    neighborhood: postRow.neighborhood,
  };

  return result;
}
