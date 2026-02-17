import { NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { getSupabaseAdmin } from "@/lib/supabase.server";

import type { StatsResponse } from "@/lib/types";

/**
 * GET /api/stats
 *
 * Get dashboard statistics. Requires authentication.
 */
export async function GET() {
  // Require authentication

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get post counts and extra stats in parallel
    const [
      postsResult,
      scoresResult,
      usedResult,
      frequenciesResult,
      postsLast24hResult,
      lastScrapeResult,
    ] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("llm_scores").select("id", { count: "exact", head: true }),
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("used_on_episode", true),
      supabase
        .from("topic_frequencies")
        .select("category, count_30d, last_updated")
        .order("count_30d", { ascending: false }),
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twentyFourHoursAgo),
      supabase.from("settings").select("value").eq("key", "last_scrape_at").single(),
    ]);

    let embeddingBacklog = 0;
    try {
      const { data: backlogData } = await supabase.rpc("get_embedding_backlog_count");
      if (typeof backlogData === "number") embeddingBacklog = backlogData;
    } catch (rpcError) {
      // RPC may not exist before migration 018; log but continue with 0
      console.warn("[stats] get_embedding_backlog_count RPC failed:", {
        error: rpcError instanceof Error ? rpcError.message : "Unknown error",
      });
    }

    let scoreDistribution: StatsResponse["score_distribution"] = null;
    try {
      const { data: distData } = await supabase.rpc("get_score_distribution");
      if (distData && typeof distData === "object" && distData !== null) {
        scoreDistribution = distData as StatsResponse["score_distribution"];
      }
    } catch (rpcError) {
      // RPC may not exist before migration 031
      console.warn("[stats] get_score_distribution RPC failed:", {
        error: rpcError instanceof Error ? rpcError.message : "Unknown error",
      });
    }

    // Check for errors

    if (postsResult.error) {
      console.error("[stats] Error fetching posts count:", {
        code: postsResult.error.code,
        error: postsResult.error.message,
      });
      return NextResponse.json(
        {
          details: postsResult.error.message || "Failed to fetch posts count",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    if (scoresResult.error) {
      console.error("[stats] Error fetching scores count:", {
        code: scoresResult.error.code,
        error: scoresResult.error.message,
      });
      return NextResponse.json(
        {
          details: scoresResult.error.message || "Failed to fetch scores count",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    if (usedResult.error) {
      console.error("[stats] Error fetching used count:", {
        code: usedResult.error.code,
        error: usedResult.error.message,
      });
      return NextResponse.json(
        {
          details: usedResult.error.message || "Failed to fetch used posts count",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    if (frequenciesResult.error) {
      console.error("[stats] Error fetching frequencies:", {
        code: frequenciesResult.error.code,
        error: frequenciesResult.error.message,
      });
      return NextResponse.json(
        {
          details: frequenciesResult.error.message || "Failed to fetch topic frequencies",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    const postsTotal = postsResult.count || 0;
    const postsScored = scoresResult.count || 0;
    const postsUsed = usedResult.count || 0;
    const postsLast24h = postsLast24hResult.count ?? 0;
    const lastScrapeAt =
      lastScrapeResult.data?.value && typeof lastScrapeResult.data.value === "string"
        ? lastScrapeResult.data.value
        : null;

    const response: StatsResponse = {
      embedding_backlog: embeddingBacklog,
      last_scrape_at: lastScrapeAt,
      posts_last_24h: postsLast24h,
      posts_scored: postsScored,
      posts_total: postsTotal,
      posts_unscored: postsTotal - postsScored,
      posts_used: postsUsed,
      score_distribution: scoreDistribution ?? undefined,
      top_categories: frequenciesResult.data || [],
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = process.env.NODE_ENV === "development" ? errorMessage : undefined;
    console.error("[stats] Unexpected error:", {
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
