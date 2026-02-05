import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

import type { StatsResponse } from "@/lib/types";

/**
 * GET /api/stats
 *
 * Get dashboard statistics. Requires authentication.
 */
export async function GET() {
  // Require authentication

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Get post counts in parallel

    const [postsResult, scoresResult, usedResult, frequenciesResult] =
      await Promise.all([
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
      ]);

    // Check for errors

    if (postsResult.error) {
      console.error("Error fetching posts count:", postsResult.error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    if (scoresResult.error) {
      console.error("Error fetching scores count:", scoresResult.error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    if (usedResult.error) {
      console.error("Error fetching used count:", usedResult.error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    if (frequenciesResult.error) {
      console.error("Error fetching frequencies:", frequenciesResult.error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    const postsTotal = postsResult.count || 0;
    const postsScored = scoresResult.count || 0;
    const postsUsed = usedResult.count || 0;

    const response: StatsResponse = {
      posts_scored: postsScored,
      posts_total: postsTotal,
      posts_unscored: postsTotal - postsScored,
      posts_used: postsUsed,
      top_categories: frequenciesResult.data || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
