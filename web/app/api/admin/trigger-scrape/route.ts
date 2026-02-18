import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { triggerScrapeBodySchema } from "@/lib/validators";

/**
 * POST /api/admin/trigger-scrape
 *
 * Creates a run_scraper background job so the worker runs the scraper.
 * Body: { feed_type: "recent" | "trending", scraper_run_id?: string }.
 * scraper_run_id ties the retry to a specific failed run (for UI "Queued" state).
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = triggerScrapeBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ details: message, error: "Validation error" }, { status: 400 });
    }
    const { feed_type: feedType, scraper_run_id: scraperRunId } = parsed.data;

    const params: { feed_type: string; scraper_run_id?: string } = {
      feed_type: feedType,
    };
    if (scraperRunId) params.scraper_run_id = scraperRunId;

    const supabase = getSupabaseAdmin();
    const { data: jobRow, error } = await supabase
      .from("background_jobs")
      .insert({
        created_by: session.user?.email || "unknown",
        params,
        status: "pending",
        type: "run_scraper",
      })
      .select()
      .single();

    if (error || !jobRow) {
      logError("[admin/trigger-scrape] Failed to create job", error ?? new Error("No job row"));
      return NextResponse.json(
        {
          details: error?.message ?? "Failed to create job",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { feed_type: feedType, job_id: jobRow.id, status: jobRow.status },
    });
  } catch (err) {
    logError("[admin/trigger-scrape]", err);
    return NextResponse.json(
      {
        details: err instanceof Error ? err.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
