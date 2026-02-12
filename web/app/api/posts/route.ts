import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { postsQuerySchema } from "@/lib/validators";

import type { Database } from "@/lib/database.types";
import type { PostsResponse, PostWithScores } from "@/lib/types";

/**
 * GET /api/posts
 *
 * Fetch posts with their LLM scores. Requires authentication.
 *
 * Query params:
 * - limit: number (default 20, max 100)
 * - offset: number (default 0)
 * - category: string (filter by category)
 * - min_score: number (minimum final_score)
 * - unused_only: boolean (only show posts not used in episodes)
 * - sort: "score" | "date" (default "score")
 */
export async function GET(request: NextRequest) {
  // Require authentication

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;

  // Validate query params at API boundary (Zod)

  const raw = {
    category: searchParams.get("category") ?? undefined,
    ignored_only: searchParams.get("ignored_only") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    min_podcast_worthy: searchParams.get("min_podcast_worthy") ?? undefined,
    min_reaction_count: searchParams.get("min_reaction_count") ?? undefined,
    min_score: searchParams.get("min_score") ?? undefined,
    neighborhood_id: searchParams.get("neighborhood_id") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
    saved_only: searchParams.get("saved_only") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    unused_only: searchParams.get("unused_only") ?? undefined,
  };
  const parsed = postsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const message = first?.message ?? "Invalid query parameters";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const {
    category,
    ignored_only: ignoredOnly,
    limit,
    min_podcast_worthy: minPodcastWorthyParam,
    min_reaction_count: minReactionCountParam,
    min_score: minScoreParam,
    neighborhood_id: neighborhoodId,
    offset,
    saved_only: savedOnly,
    sort,
    unused_only: unusedOnly,
  } = parsed.data;
  const minScore =
    minScoreParam != null ? String(minScoreParam) : null;
  const minPodcastWorthy =
    minPodcastWorthyParam != null ? minPodcastWorthyParam : null;
  const minReactionCount =
    minReactionCountParam != null ? minReactionCountParam : null;

  const supabase = getSupabaseAdmin();

  try {
    if (sort === "date") {
      // For date-based sorting, query posts first then join scores

      return await getPostsByDate(supabase, {
        category: category ?? null,
        ignoredOnly,
        limit,
        minPodcastWorthy,
        minReactionCount,
        minScore,
        neighborhoodId: neighborhoodId ?? null,
        offset,
        savedOnly,
        unusedOnly,
      });
    } else {
      // For score or podcast_score sorting, use get_posts_with_scores
      const orderBy =
        sort === "podcast_score" ? "podcast_worthy" : "score";

      return await getPostsByScore(supabase, {
        category: category ?? null,
        ignoredOnly,
        limit,
        minPodcastWorthy,
        minReactionCount,
        minScore,
        neighborhoodId: neighborhoodId ?? null,
        offset,
        orderBy,
        savedOnly,
        unusedOnly,
      });
    }
  } catch (error) {
    logError("[posts]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = process.env.NODE_ENV === "development" ? errorMessage : undefined;
    return NextResponse.json(
      {
        details: errorDetails,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

interface QueryParams {
  category: null | string;
  ignoredOnly: boolean;
  limit: number;
  minPodcastWorthy: null | number;
  minReactionCount: null | number;
  minScore: null | string;
  neighborhoodId: null | string;
  offset: number;
  orderBy?: "podcast_worthy" | "score";
  savedOnly: boolean;
  unusedOnly: boolean;
}

/**
 * Type for RPC result from get_posts_with_scores function.
 * This matches the return shape of the database RPC function.
 */
interface PostScoreRow {
  categories: string[];
  final_score: number;
  llm_created_at: string;
  llm_score_id: string;
  model_version: string;
  post_id: string;
  scores: Record<string, number>;
  summary: null | string;
  why_podcast_worthy: null | string;
}

/**
 * Get posts sorted by score (highest first).
 *
 * Uses RPC function to efficiently join post_scores and llm_scores.
 * This function handles the active weight configuration lookup with fallback logic:
 * 1. First tries to get active_weight_config_id from settings table
 * 2. If not found, queries weight_configs for any config with is_active=true
 *    - If found, uses it and updates settings to maintain consistency
 * 3. If no active config exists, checks if any configs exist at all
 *    - If configs exist but none are active: returns 503 (user must activate one)
 *    - If no configs exist: returns 503 (user must create one)
 *
 * @param supabase - Supabase admin client
 * @param params - Query parameters (category, limit, minScore, offset, unusedOnly)
 * @returns NextResponse with posts data or error
 */
async function getPostsByScore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: QueryParams
) {
  const {
    category,
    ignoredOnly,
    limit,
    minPodcastWorthy,
    minReactionCount,
    minScore,
    neighborhoodId,
    offset,
    orderBy = "score",
    savedOnly,
    unusedOnly,
  } = params;

  const activeConfigResult = await supabase
    .from("settings")
    .select("value")
    .eq("key", "active_weight_config_id")
    .single();

  let activeConfigId: null | string =
    activeConfigResult.data?.value &&
    typeof activeConfigResult.data.value === "string"
      ? activeConfigResult.data.value
      : null;

  if (!activeConfigId) {
    // Fallback: try to get the first active config
    const configResult = await supabase
      .from("weight_configs")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (configResult.data) {
      // Use this config and update settings
      activeConfigId = configResult.data.id as string;
      await supabase
        .from("settings")
        .upsert(
          { key: "active_weight_config_id", value: activeConfigId },
          { onConflict: "key" }
        );
    } else {
      // Check if any configs exist at all
      const allConfigsResult = await supabase
        .from("weight_configs")
        .select("id, name")
        .limit(1);

      if (allConfigsResult.data && allConfigsResult.data.length > 0) {
        return NextResponse.json(
          {
            details: "No active weight configuration found. Please activate a weight configuration in the settings page.",
            error: "No active weight config",
          },
          { status: 503 }
        );
      } else {
        return NextResponse.json(
          {
            details: "No weight configurations found. Please create a weight configuration in the settings page.",
            error: "No weight configs found",
          },
          { status: 503 }
        );
      }
    }
  }

  // Parse minScore
  const parsedMinScore = minScore ? parseFloat(minScore) : null;
  const validMinScore = parsedMinScore && !isNaN(parsedMinScore) ? parsedMinScore : null;

  // Call RPC function to get posts with scores
  const { data: scoresData, error: scoresError } = await supabase.rpc(
    "get_posts_with_scores",
    {
      p_category: category || null,
      p_ignored_only: ignoredOnly,
      p_limit: limit,
      p_min_podcast_worthy: minPodcastWorthy,
      p_min_reaction_count: minReactionCount,
      p_min_score: validMinScore,
      p_neighborhood_id: neighborhoodId,
      p_offset: offset,
      p_order_by: orderBy,
      p_saved_only: savedOnly,
      p_unused_only: unusedOnly,
      p_weight_config_id: activeConfigId,
    }
  );

  if (scoresError) {
    logError("[posts] get_posts_with_scores", scoresError);
    return NextResponse.json(
      {
        details: scoresError.message || "Database query failed",
        error: "Database error",
      },
      { status: 500 }
    );
  }

  // Get total count for pagination (call once, used for both empty and non-empty results)
  const { data: countData, error: countError } = await supabase.rpc(
    "get_posts_with_scores_count",
    {
      p_category: category || null,
      p_ignored_only: ignoredOnly,
      p_min_podcast_worthy: minPodcastWorthy,
      p_min_reaction_count: minReactionCount,
      p_min_score: validMinScore,
      p_neighborhood_id: neighborhoodId,
      p_saved_only: savedOnly,
      p_unused_only: unusedOnly,
      p_weight_config_id: activeConfigId,
    }
  );

  const total = countError ? 0 : (countData as number) || 0;

  if (!scoresData || scoresData.length === 0) {
    return NextResponse.json({ data: [], total });
  }

  // Get post IDs to fetch posts and neighborhoods
  const postIds = (scoresData as PostScoreRow[]).map((s) => s.post_id);

  // Fetch posts with neighborhoods
  const postsQuery = supabase
    .from("posts")
    .select("*, neighborhood:neighborhoods(*)")
    .in("id", postIds);

  const { data: posts, error: postsError } = await postsQuery;

  if (postsError) {
    logError("[posts] fetch posts", postsError);
    return NextResponse.json(
      {
        details: postsError.message || "Failed to fetch posts",
        error: "Database error",
      },
      { status: 500 }
    );
  }

  // Create posts lookup map with proper typing
  type PostRow = {
    neighborhood: Database["public"]["Tables"]["neighborhoods"]["Row"] | null;
  } & Database["public"]["Tables"]["posts"]["Row"];

  const postsMap = new Map<string, PostRow>(
    (posts || []).map((p) => [p.id, p as PostRow])
  );

  // Merge scores with posts, maintaining score order
  const results = (scoresData as PostScoreRow[])
    .map((scoreRow) => {
      const post = postsMap.get(scoreRow.post_id);
      if (!post) {
        console.warn("[posts] Post not found for score:", scoreRow.post_id);
        return null;
      }

      // Build llm_scores object from RPC result
      const llmScores = {
        categories: scoreRow.categories,
        created_at: scoreRow.llm_created_at || new Date().toISOString(),
        final_score: scoreRow.final_score,
        id: scoreRow.llm_score_id,
        model_version: scoreRow.model_version || "claude-3-haiku-20240307",
        post_id: scoreRow.post_id,
        scores: scoreRow.scores,
        summary: scoreRow.summary,
        why_podcast_worthy: scoreRow.why_podcast_worthy ?? null,
      };

      return {
        ...post,
        llm_scores: llmScores,
        neighborhood: post.neighborhood || null,
      };
    })
    .filter((r) => r !== null) as unknown as PostWithScores[]; // RPC/DB row shape matches PostWithScores

  return NextResponse.json({
    data: results,
    total,
  });
}

/**
 * Get posts sorted by date (newest first).
 * Uses get_posts_by_date RPC so category and min_score are filtered in the DB.
 */
async function getPostsByDate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: QueryParams
) {
  const {
    category,
    ignoredOnly,
    limit,
    minPodcastWorthy,
    minReactionCount,
    minScore,
    neighborhoodId,
    offset,
    savedOnly,
    unusedOnly,
  } = params;

  const parsedMinScore = minScore ? parseFloat(minScore) : null;
  const validMinScore = parsedMinScore != null && !isNaN(parsedMinScore) ? parsedMinScore : null;

  const { data: scoresData, error: scoresError } = await supabase.rpc(
    "get_posts_by_date",
    {
      p_category: category || null,
      p_ignored_only: ignoredOnly,
      p_limit: limit,
      p_min_podcast_worthy: minPodcastWorthy,
      p_min_reaction_count: minReactionCount,
      p_min_score: validMinScore,
      p_neighborhood_id: neighborhoodId,
      p_offset: offset,
      p_saved_only: savedOnly,
      p_unused_only: unusedOnly,
    }
  );

  if (scoresError) {
    logError("[posts] get_posts_by_date", scoresError);
    return NextResponse.json(
      {
        details: scoresError.message || "Database query failed",
        error: "Database error",
      },
      { status: 500 }
    );
  }

  const { data: countData, error: countError } = await supabase.rpc(
    "get_posts_by_date_count",
    {
      p_category: category || null,
      p_ignored_only: ignoredOnly,
      p_min_podcast_worthy: minPodcastWorthy,
      p_min_reaction_count: minReactionCount,
      p_min_score: validMinScore,
      p_neighborhood_id: neighborhoodId,
      p_saved_only: savedOnly,
      p_unused_only: unusedOnly,
    }
  );

  const total = countError ? 0 : (countData as number) || 0;

  if (!scoresData || scoresData.length === 0) {
    return NextResponse.json({ data: [], total });
  }

  const postIds = (scoresData as PostScoreRow[]).map((s) => s.post_id);

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("*, neighborhood:neighborhoods(*)")
    .in("id", postIds);

  if (postsError) {
    logError("[posts] fetch posts for date sort", postsError);
    return NextResponse.json(
      {
        details: postsError.message || "Failed to fetch posts",
        error: "Database error",
      },
      { status: 500 }
    );
  }

  type PostRow = {
    neighborhood: Database["public"]["Tables"]["neighborhoods"]["Row"] | null;
  } & Database["public"]["Tables"]["posts"]["Row"];

  const postsMap = new Map<string, PostRow>(
    (posts || []).map((p) => [p.id, p as PostRow])
  );

  const results = (scoresData as PostScoreRow[])
    .map((scoreRow) => {
      const post = postsMap.get(scoreRow.post_id);
      if (!post) return null;
      const llmScores = {
        categories: scoreRow.categories,
        created_at: scoreRow.llm_created_at || new Date().toISOString(),
        final_score: scoreRow.final_score,
        id: scoreRow.llm_score_id,
        model_version: scoreRow.model_version || "claude-3-haiku-20240307",
        post_id: scoreRow.post_id,
        scores: scoreRow.scores,
        summary: scoreRow.summary,
        why_podcast_worthy: scoreRow.why_podcast_worthy ?? null,
      };
      return {
        ...post,
        llm_scores: llmScores,
        neighborhood: post.neighborhood || null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null) as unknown as PostWithScores[];

  return NextResponse.json({
    data: results,
    total,
  });
}
