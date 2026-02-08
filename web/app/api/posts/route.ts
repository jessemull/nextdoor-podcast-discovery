import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
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
    limit: searchParams.get("limit") ?? undefined,
    min_score: searchParams.get("min_score") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
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
    limit,
    min_score: minScoreParam,
    offset,
    sort,
    unused_only: unusedOnly,
  } = parsed.data;
  const minScore =
    minScoreParam != null ? String(minScoreParam) : null;

  const supabase = getSupabaseAdmin();

  try {
    if (sort === "score") {
      // For score-based sorting, query scores first then join posts

      return await getPostsByScore(supabase, {
        category: category ?? null,
        limit,
        minScore,
        offset,
        unusedOnly,
      });
    } else {
      // For date-based sorting, query posts first then join scores

      return await getPostsByDate(supabase, {
        category: category ?? null,
        limit,
        minScore,
        offset,
        unusedOnly,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = process.env.NODE_ENV === "development" ? errorMessage : undefined;
    console.error("[posts] Unexpected error:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
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
  limit: number;
  minScore: null | string;
  offset: number;
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
  const { category, limit, minScore, offset, unusedOnly } = params;

  // Get active weight config ID
  const activeConfigResult = await supabase
    .from("settings")
    .select("value")
    .eq("key", "active_weight_config_id")
    .single();

  /**
   * Get active weight config ID with fallback strategy.
   *
   * Fallback logic:
   * 1. First, try to get active_weight_config_id from settings table
   * 2. If not found, query weight_configs for any config with is_active=true
   *    - If found, use it and update settings to maintain consistency
   * 3. If no active config exists, check if any configs exist at all
   *    - If configs exist but none are active: return 503 (user must activate one)
   *    - If no configs exist: return 503 (user must create one)
   *
   * This fallback handles edge cases where:
   * - Settings table is out of sync with weight_configs.is_active
   * - Migration created configs but didn't set active_weight_config_id
   * - User deleted the active config without setting a new one
   */
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
      p_limit: limit,
      p_min_score: validMinScore,
      p_offset: offset,
      p_unused_only: unusedOnly,
      p_weight_config_id: activeConfigId,
    }
  );

  if (scoresError) {
    console.error("[posts] Error calling get_posts_with_scores:", {
      code: scoresError.code,
      error: scoresError.message,
      hint: scoresError.hint,
    });
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
      p_min_score: validMinScore,
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
    console.error("[posts] Error fetching posts:", {
      code: postsError.code,
      error: postsError.message,
      postCount: postIds.length,
    });
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
 * Queries posts first, then fetches corresponding scores.
 */
async function getPostsByDate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: QueryParams
) {
  const { category, limit, minScore, offset, unusedOnly } = params;

  // Build posts query

  let postsQuery = supabase
    .from("posts")
    .select("*, neighborhood:neighborhoods(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (unusedOnly) {
    postsQuery = postsQuery.eq("used_on_episode", false);
  }

  const { count, data: posts, error: postsError } = await postsQuery
    .range(offset, offset + limit - 1);

  if (postsError) {
    console.error("[posts] Error fetching posts:", {
      code: postsError.code,
      error: postsError.message,
      limit,
      offset,
    });
    return NextResponse.json(
      {
        details: postsError.message || "Failed to fetch posts",
        error: "Database error",
      },
      { status: 500 }
    );
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  // Fetch scores for these posts
  type PostRow = {
    neighborhood: Database["public"]["Tables"]["neighborhoods"]["Row"] | null;
  } & Database["public"]["Tables"]["posts"]["Row"];

  const postIds = (posts as PostRow[]).map((p) => p.id);

  const { data: scores, error: scoresError } = await supabase
    .from("llm_scores")
    .select("*")
    .in("post_id", postIds);

  if (scoresError) {
    console.error("[posts] Error fetching scores:", {
      code: scoresError.code,
      error: scoresError.message,
      postCount: postIds.length,
    });
    // Continue without scores rather than failing entirely
  }

  // Create scores lookup map
  type LLMScoreRow = Database["public"]["Tables"]["llm_scores"]["Row"];

  const scoresMap = new Map<string, LLMScoreRow>(
    (scores || []).map((s) => [(s as LLMScoreRow).post_id, s as LLMScoreRow])
  );

  // Merge posts with scores (cast: DB Row has scores as Json, we use DimensionScores in types)
  let results = (posts as PostRow[]).map((post) => ({
    ...post,
    llm_scores: scoresMap.get(post.id) || null,
    neighborhood: post.neighborhood || null,
  })) as unknown as PostWithScores[]; // DB Row types; we use PostWithScores in API

  // Apply post-query filters

  if (category) {
    results = results.filter(
      (p) => p.llm_scores?.categories?.includes(category)
    );
  }

  if (minScore) {
    const min = parseFloat(minScore);
    if (!isNaN(min)) {
      results = results.filter(
        (p) => p.llm_scores?.final_score && p.llm_scores.final_score >= min
      );
    }
  }

  const response: PostsResponse = {
    data: results,
    total: count || 0,
  };

  return NextResponse.json(response);
}
