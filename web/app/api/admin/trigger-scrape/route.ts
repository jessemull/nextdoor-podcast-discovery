import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const FEED_TYPES = ["recent", "trending"] as const;

/**
 * POST /api/admin/trigger-scrape
 *
 * Creates a run_scraper background job so the worker runs the scraper.
 * Body: { feed_type: "recent" | "trending" }.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const feedType =
      typeof body.feed_type === "string" ? body.feed_type : "recent";
    if (!FEED_TYPES.includes(feedType as (typeof FEED_TYPES)[number])) {
      return NextResponse.json(
        { error: "Invalid feed_type", details: "Must be recent or trending" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: jobRow, error } = await supabase
      .from("background_jobs")
      .insert({
        created_by: session.user?.email || "unknown",
        params: { feed_type: feedType },
        status: "pending",
        type: "run_scraper",
      })
      .select()
      .single();

    if (error || !jobRow) {
      console.error("[admin/trigger-scrape] Failed to create job:", error?.message);
      return NextResponse.json(
        {
          error: "Database error",
          details: error?.message ?? "Failed to create job",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { job_id: jobRow.id, feed_type: feedType, status: jobRow.status },
    });
  } catch (err) {
    console.error("[admin/trigger-scrape] Error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
