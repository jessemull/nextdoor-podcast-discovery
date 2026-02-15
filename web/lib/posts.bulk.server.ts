import { NextResponse } from "next/server";

import { getActiveWeightConfigId } from "@/lib/active-config-cache.server";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";

export const BULK_QUERY_LIMIT = 10_000;

interface PostScoreRow {
  post_id: string;
}

export interface BulkQueryInput {
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

/**
 * Resolve post IDs for bulk "apply to query". Uses same RPCs as GET /api/posts
 * with limit = BULK_QUERY_LIMIT. Returns array of post IDs.
 */
export async function getPostIdsByQuery(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  query: BulkQueryInput
): Promise<
  | { error: NextResponse; postIds?: never }
  | { error?: never; postIds: string[] }
> {
  const orderAsc = query.order === "asc";
  const sort = query.sort ?? "score";
  const validMinScore =
    query.min_score != null && !isNaN(query.min_score) ? query.min_score : null;

  if (sort === "date") {
    const { data: scoresData, error: scoresError } = await supabase.rpc(
      "get_posts_by_date",
      {
        p_category: query.category || null,
        p_ignored_only: query.ignored_only ?? false,
        p_limit: BULK_QUERY_LIMIT,
        p_min_podcast_worthy: query.min_podcast_worthy ?? null,
        p_min_reaction_count: query.min_reaction_count ?? null,
        p_min_score: validMinScore,
        p_neighborhood_id: query.neighborhood_id ?? null,
        p_offset: 0,
        p_order_asc: orderAsc,
        p_saved_only: query.saved_only ?? false,
        p_unused_only: query.unused_only ?? false,
      }
    );
    if (scoresError) {
      logError("[posts/bulk] get_posts_by_date", scoresError);
      return {
        error: NextResponse.json(
          { details: scoresError.message, error: "Database error" },
          { status: 500 }
        ),
      };
    }
    const postIds = (scoresData as PostScoreRow[]).map((s) => s.post_id);
    return { postIds };
  }

  const activeConfigId = await getActiveWeightConfigId(supabase);

  if (!activeConfigId) {
    return {
      error: NextResponse.json(
        {
          details:
            "Please activate a weight configuration in the settings page.",
          error: "No active weight config",
        },
        { status: 503 }
      ),
    };
  }

  const orderBy = sort === "podcast_score" ? "podcast_worthy" : "score";
  const { data: scoresData, error: scoresError } = await supabase.rpc(
    "get_posts_with_scores",
    {
      p_category: query.category || null,
      p_ignored_only: query.ignored_only ?? false,
      p_limit: BULK_QUERY_LIMIT,
      p_min_podcast_worthy: query.min_podcast_worthy ?? null,
      p_min_reaction_count: query.min_reaction_count ?? null,
      p_min_score: validMinScore,
      p_neighborhood_id: query.neighborhood_id ?? null,
      p_offset: 0,
      p_order_asc: orderAsc,
      p_order_by: orderBy,
      p_saved_only: query.saved_only ?? false,
      p_unused_only: query.unused_only ?? false,
      p_weight_config_id: activeConfigId,
    }
  );

  if (scoresError) {
    logError("[posts/bulk] get_posts_with_scores", scoresError);
    return {
      error: NextResponse.json(
        { details: scoresError.message, error: "Database error" },
        { status: 500 }
      ),
    };
  }

  const postIds = (scoresData as PostScoreRow[]).map((s) => s.post_id);
  return { postIds };
}
