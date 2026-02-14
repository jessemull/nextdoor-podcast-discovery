import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { postsBulkBodySchema } from "@/lib/validators";

const BULK_QUERY_LIMIT = 10_000;

interface PostScoreRow {
  post_id: string;
}

/**
 * Resolve post IDs for bulk "apply to query". Uses same RPCs as GET /api/posts
 * with limit = BULK_QUERY_LIMIT. Returns array of post IDs.
 */
async function getPostIdsByQuery(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  query: {
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
): Promise<{ error: NextResponse; postIds?: never } | { error?: never; postIds: string[] }> {
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
          { error: "Database error", details: scoresError.message },
          { status: 500 }
        ),
      };
    }
    const postIds = (scoresData as PostScoreRow[]).map((s) => s.post_id);
    return { postIds };
  }

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
    const configResult = await supabase
      .from("weight_configs")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (configResult.data) {
      activeConfigId = configResult.data.id as string;
    } else {
      return {
        error: NextResponse.json(
          {
            error: "No active weight config",
            details:
              "Please activate a weight configuration in the settings page.",
          },
          { status: 503 }
        ),
      };
    }
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
        { error: "Database error", details: scoresError.message },
        { status: 500 }
      ),
    };
  }

  const postIds = (scoresData as PostScoreRow[]).map((s) => s.post_id);
  return { postIds };
}

/**
 * POST /api/posts/bulk
 *
 * Apply a single action (mark_used, save, ignore, unignore) to a set of posts.
 * Body: { action, post_ids?: string[] } or { action, apply_to_query: true, query }.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = postsBulkBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const message = first?.message ?? "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { action, apply_to_query, post_ids: bodyPostIds, query } = parsed.data;

  const supabase = getSupabaseAdmin();

  let postIds: string[];
  if (bodyPostIds != null && bodyPostIds.length > 0) {
    postIds = bodyPostIds;
  } else if (apply_to_query === true && query != null) {
    const result = await getPostIdsByQuery(supabase, query);
    if (result.error) return result.error;
    postIds = result.postIds;
  } else {
    return NextResponse.json(
      { error: "Provide either post_ids or apply_to_query with query" },
      { status: 400 }
    );
  }

  if (postIds.length === 0) {
    return NextResponse.json({ data: { updated: 0 } });
  }

  try {
    if (action === "mark_used") {
      const { error } = await supabase
        .from("posts")
        .update({ used_on_episode: true })
        .in("id", postIds);
      if (error) {
        logError("[posts/bulk] mark_used", error);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
    } else if (action === "save") {
      const { error } = await supabase
        .from("posts")
        .update({ saved: true })
        .in("id", postIds);
      if (error) {
        logError("[posts/bulk] save", error);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
    } else if (action === "ignore") {
      const { error } = await supabase
        .from("posts")
        .update({ ignored: true })
        .in("id", postIds);
      if (error) {
        logError("[posts/bulk] ignore", error);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
    } else if (action === "unignore") {
      const { error } = await supabase
        .from("posts")
        .update({ ignored: false })
        .in("id", postIds);
      if (error) {
        logError("[posts/bulk] unignore", error);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ data: { updated: postIds.length } });
  } catch (error) {
    logError("[posts/bulk]", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
