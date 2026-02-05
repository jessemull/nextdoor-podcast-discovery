import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

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

  // Parse and validate query params

  const parsedLimit = parseInt(searchParams.get("limit") || "20");
  const limit = Math.min(isNaN(parsedLimit) ? 20 : parsedLimit, 100);

  const parsedOffset = parseInt(searchParams.get("offset") || "0");
  const offset = isNaN(parsedOffset) ? 0 : parsedOffset;

  const category = searchParams.get("category");
  const minScore = searchParams.get("min_score");
  const unusedOnly = searchParams.get("unused_only") === "true";
  const sort = searchParams.get("sort") || "score";

  const supabase = getSupabaseAdmin();

  try {
    if (sort === "score") {
      // For score-based sorting, query scores first then join posts

      return await getPostsByScore(supabase, {
        category,
        limit,
        minScore,
        offset,
        unusedOnly,
      });
    } else {
      // For date-based sorting, query posts first then join scores

      return await getPostsByDate(supabase, {
        category,
        limit,
        minScore,
        offset,
        unusedOnly,
      });
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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

// Generic record type for Supabase results before casting
type DbRecord = Record<string, unknown>;

/**
 * Get posts sorted by score (highest first).
 * Queries llm_scores first, then fetches corresponding posts.
 */
async function getPostsByScore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: QueryParams
) {
  const { category, limit, minScore, offset, unusedOnly } = params;

  // Build scores query

  let scoresQuery = supabase
    .from("llm_scores")
    .select("*", { count: "exact" })
    .order("final_score", { ascending: false, nullsFirst: false });

  if (minScore) {
    const parsed = parseFloat(minScore);
    if (!isNaN(parsed)) {
      scoresQuery = scoresQuery.gte("final_score", parsed);
    }
  }

  if (category) {
    scoresQuery = scoresQuery.contains("categories", [category]);
  }

  // Get paginated scores

  const { count, data: scores, error: scoresError } = await scoresQuery
    .range(offset, offset + limit - 1);

  if (scoresError) {
    console.error("Error fetching scores:", scoresError);
    return NextResponse.json({ error: scoresError.message }, { status: 500 });
  }

  if (!scores || scores.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  // Fetch corresponding posts

  const postIds = scores.map((s: DbRecord) => s.post_id as string);

  let postsQuery = supabase
    .from("posts")
    .select("*, neighborhood:neighborhoods(*)")
    .in("id", postIds);

  if (unusedOnly) {
    postsQuery = postsQuery.eq("used_on_episode", false);
  }

  const { data: posts, error: postsError } = await postsQuery;

  if (postsError) {
    console.error("Error fetching posts:", postsError);
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  // Create posts lookup map

  const postsMap = new Map(
    (posts || []).map((p: DbRecord) => [p.id as string, p])
  );

  // Merge scores with posts, maintaining score order

  const results = scores
    .map((score: DbRecord) => {
      const post = postsMap.get(score.post_id as string);
      if (!post) return null;
      if (unusedOnly && post.used_on_episode) return null;
      return {
        ...post,
        llm_scores: score,
        neighborhood: post.neighborhood || null,
      };
    })
    .filter(Boolean) as unknown as PostWithScores[];

  const response: PostsResponse = {
    data: results,
    total: count || 0,
  };

  return NextResponse.json(response);
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
    console.error("Error fetching posts:", postsError);
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  // Fetch scores for these posts

  const postIds = posts.map((p: DbRecord) => p.id as string);

  const { data: scores, error: scoresError } = await supabase
    .from("llm_scores")
    .select("*")
    .in("post_id", postIds);

  if (scoresError) {
    console.error("Error fetching scores:", scoresError);
    // Continue without scores rather than failing entirely
  }

  // Create scores lookup map

  const scoresMap = new Map(
    (scores || []).map((s: DbRecord) => [s.post_id as string, s])
  );

  // Merge posts with scores

  let results = posts.map((post: DbRecord) => ({
    ...post,
    llm_scores: scoresMap.get(post.id as string) || null,
    neighborhood: post.neighborhood || null,
  })) as unknown as PostWithScores[];

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
