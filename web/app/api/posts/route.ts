import { NextRequest, NextResponse } from "next/server";

import { getActiveWeightConfigId } from "@/lib/active-config-cache.server";
import { auth0 } from "@/lib/auth0";
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

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;

  // Validate query params at API boundary (Zod)

  const neighborhoodIdsParam = searchParams.getAll("neighborhood_ids").filter(Boolean);
  const raw = {
    category: searchParams.get("category") ?? undefined,
    ignored_only: searchParams.get("ignored_only") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    max_podcast_worthy: searchParams.get("max_podcast_worthy") ?? undefined,
    max_reaction_count: searchParams.get("max_reaction_count") ?? undefined,
    max_score: searchParams.get("max_score") ?? undefined,
    min_podcast_worthy: searchParams.get("min_podcast_worthy") ?? undefined,
    min_reaction_count: searchParams.get("min_reaction_count") ?? undefined,
    min_score: searchParams.get("min_score") ?? undefined,
    neighborhood_ids:
      neighborhoodIdsParam.length > 0
        ? neighborhoodIdsParam
        : searchParams.get("neighborhood_id")
          ? [searchParams.get("neighborhood_id") as string]
          : undefined,
    offset: searchParams.get("offset") ?? undefined,
    order: searchParams.get("order") ?? undefined,
    preview: searchParams.get("preview") ?? undefined,
    saved_only: searchParams.get("saved_only") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    unused_only: searchParams.get("unused_only") ?? undefined,
    weight_config_id: searchParams.get("weight_config_id") ?? undefined,
    weights: searchParams.get("weights") ?? undefined,
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
    max_podcast_worthy: maxPodcastWorthyParam,
    max_reaction_count: maxReactionCountParam,
    max_score: maxScoreParam,
    min_podcast_worthy: minPodcastWorthyParam,
    min_reaction_count: minReactionCountParam,
    min_score: minScoreParam,
    neighborhood_ids: neighborhoodIds,
    offset,
    order,
    preview,
    saved_only: savedOnly,
    sort,
    unused_only: unusedOnly,
    weight_config_id: weightConfigIdParam,
    weights: weightsParam,
  } = parsed.data;
  const orderAsc = order === "asc";
  const maxPodcastWorthy =
    maxPodcastWorthyParam != null ? maxPodcastWorthyParam : null;
  const maxReactionCount =
    maxReactionCountParam != null ? maxReactionCountParam : null;
  const maxScore =
    maxScoreParam != null ? String(maxScoreParam) : null;
  const minPodcastWorthy =
    minPodcastWorthyParam != null ? minPodcastWorthyParam : null;
  const minReactionCount =
    minReactionCountParam != null ? minReactionCountParam : null;
  const minScore =
    minScoreParam != null ? String(minScoreParam) : null;

  const supabase = getSupabaseAdmin();

  const weightConfigId =
    weightConfigIdParam != null && weightConfigIdParam.trim()
      ? weightConfigIdParam
      : null;

  try {
    if (sort === "date") {
      // For date-based sorting, query posts first then join scores

      return await getPostsByDate(supabase, {
        category: category ?? null,
        ignoredOnly,
        limit,
        maxPodcastWorthy,
        maxReactionCount,
        maxScore,
        minPodcastWorthy,
        minReactionCount,
        minScore,
        neighborhoodIds: neighborhoodIds?.length ? neighborhoodIds : null,
        offset,
        orderAsc,
        preview: preview ?? false,
        savedOnly,
        unusedOnly,
        weightConfigId,
        weights: weightsParam ?? null,
      });
    } else {
      // For score or podcast_score sorting, use get_posts_with_scores
      const orderBy =
        sort === "podcast_score" ? "podcast_worthy" : "score";

      return await getPostsByScore(supabase, {
        category: category ?? null,
        ignoredOnly,
        limit,
        maxPodcastWorthy,
        maxReactionCount,
        maxScore,
        minPodcastWorthy,
        minReactionCount,
        minScore,
        neighborhoodIds: neighborhoodIds?.length ? neighborhoodIds : null,
        offset,
        orderAsc,
        orderBy,
        preview: preview ?? false,
        savedOnly,
        unusedOnly,
        weightConfigId,
        weights: weightsParam ?? null,
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
  maxPodcastWorthy: null | number;
  maxReactionCount: null | number;
  maxScore: null | string;
  minPodcastWorthy: null | number;
  minReactionCount: null | number;
  minScore: null | string;
  neighborhoodIds: null | string[];
  offset: number;
  orderAsc: boolean;
  orderBy?: "podcast_worthy" | "score";
  preview: boolean;
  savedOnly: boolean;
  unusedOnly: boolean;
  weightConfigId: null | string;
  weights: null | Record<string, number>;
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
    maxPodcastWorthy,
    maxReactionCount,
    maxScore,
    minPodcastWorthy,
    minReactionCount,
    minScore,
    neighborhoodIds,
    offset,
    orderAsc,
    orderBy = "score",
    preview,
    savedOnly,
    unusedOnly,
    weightConfigId: weightConfigIdParam,
    weights: weightsParam,
  } = params;

  const activeConfigId = await getActiveWeightConfigId(supabase);

  const hasInlineWeights =
    weightsParam != null &&
    Object.keys(weightsParam).length > 0 &&
    params.preview;

  const targetConfigId =
    hasInlineWeights ? null : (weightConfigIdParam && weightConfigIdParam.trim()
      ? weightConfigIdParam
      : activeConfigId);

  if (!hasInlineWeights && !targetConfigId) {
    const allConfigsResult = await supabase
      .from("weight_configs")
      .select("id, name")
      .limit(1);

    if (allConfigsResult.data && allConfigsResult.data.length > 0) {
      return NextResponse.json(
        {
          details:
            "No active weight configuration found. Please activate a weight configuration in the settings page.",
          error: "No active weight config",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        details:
          "No weight configurations found. Please create a weight configuration in the settings page.",
        error: "No weight configs found",
      },
      { status: 503 }
    );
  }

  if (
    !hasInlineWeights &&
    weightConfigIdParam &&
    weightConfigIdParam.trim()
  ) {
    const { data: configRow } = await supabase
      .from("weight_configs")
      .select("id")
      .eq("id", weightConfigIdParam)
      .single();

    if (!configRow) {
      return NextResponse.json(
        {
          details: "Weight config not found",
          error: "Invalid weight_config_id",
        },
        { status: 400 }
      );
    }
  }

  const parsedMaxScore = maxScore ? parseFloat(maxScore) : null;
  const parsedMinScore = minScore ? parseFloat(minScore) : null;
  const validMaxScore =
    parsedMaxScore != null && !isNaN(parsedMaxScore) ? parsedMaxScore : null;
  const validMinScore =
    parsedMinScore != null && !isNaN(parsedMinScore) ? parsedMinScore : null;

  const baseRpcParams = {
    p_category: category || null,
    p_ignored_only: ignoredOnly,
    p_max_podcast_worthy: maxPodcastWorthy,
    p_max_reaction_count: maxReactionCount,
    p_max_score: validMaxScore,
    p_min_podcast_worthy: minPodcastWorthy,
    p_min_reaction_count: minReactionCount,
    p_min_score: validMinScore,
    p_neighborhood_ids: neighborhoodIds,
    p_saved_only: savedOnly,
    p_unused_only: unusedOnly,
  };

  const rpcParams = preview
    ? {
        ...baseRpcParams,
        p_weight_config_id: hasInlineWeights ? null : targetConfigId,
        p_weights: hasInlineWeights ? weightsParam : null,
      }
    : {
        ...baseRpcParams,
        p_weight_config_id: targetConfigId,
      };

  const rpcName = preview
    ? "get_posts_with_runtime_scores"
    : "get_posts_with_scores";
  const countRpcName = preview
    ? "get_posts_with_runtime_scores_count"
    : "get_posts_with_scores_count";

  const scoresRpcParams =
    rpcName === "get_posts_with_runtime_scores"
      ? {
          ...rpcParams,
          p_limit: limit,
          p_offset: offset,
          p_order_asc: orderAsc,
          p_order_by: orderBy,
        }
      : {
          ...rpcParams,
          p_limit: limit,
          p_offset: offset,
          p_order_asc: orderAsc,
          p_order_by: orderBy,
        };

  const [scoresResult, countResult] = await Promise.all([
    supabase.rpc(rpcName, scoresRpcParams),
    supabase.rpc(countRpcName, rpcParams),
  ]);

  const { data: scoresData, error: scoresError } = scoresResult;
  const { data: countData, error: countError } = countResult;

  if (scoresError) {
    logError(`[posts] ${rpcName}`, scoresError);
    return NextResponse.json(
      {
        details: scoresError.message || "Database query failed",
        error: "Database error",
      },
      { status: 500 }
    );
  }

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
    maxPodcastWorthy,
    maxReactionCount,
    maxScore,
    minPodcastWorthy,
    minReactionCount,
    minScore,
    neighborhoodIds,
    offset,
    orderAsc,
    savedOnly,
    unusedOnly,
  } = params;

  const parsedMaxScore = maxScore ? parseFloat(maxScore) : null;
  const parsedMinScore = minScore ? parseFloat(minScore) : null;
  const validMaxScore =
    parsedMaxScore != null && !isNaN(parsedMaxScore) ? parsedMaxScore : null;
  const validMinScore =
    parsedMinScore != null && !isNaN(parsedMinScore) ? parsedMinScore : null;

  const rpcParams = {
    p_category: category || null,
    p_ignored_only: ignoredOnly,
    p_max_podcast_worthy: maxPodcastWorthy,
    p_max_reaction_count: maxReactionCount,
    p_max_score: validMaxScore,
    p_min_podcast_worthy: minPodcastWorthy,
    p_min_reaction_count: minReactionCount,
    p_min_score: validMinScore,
    p_neighborhood_ids: neighborhoodIds,
    p_saved_only: savedOnly,
    p_unused_only: unusedOnly,
  };

  const [scoresResult, countResult] = await Promise.all([
    supabase.rpc("get_posts_by_date", {
      ...rpcParams,
      p_limit: limit,
      p_offset: offset,
      p_order_asc: orderAsc,
    }),
    supabase.rpc("get_posts_by_date_count", rpcParams),
  ]);

  const { data: scoresData, error: scoresError } = scoresResult;
  const { data: countData, error: countError } = countResult;

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
