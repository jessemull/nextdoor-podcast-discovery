import { NextRequest, NextResponse } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { auth0 } from "@/lib/auth0";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const DEFAULT_DAYS = 7;

/** Run IDs that have a pending/running run_scraper job (params.scraper_run_id). */
async function getQueuedRetryRunIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data: jobs } = await supabase
    .from("background_jobs")
    .select("params")
    .eq("type", "run_scraper")
    .in("status", ["pending", "running"]);
  const ids: string[] = [];
  for (const row of jobs ?? []) {
    const params = row?.params as { scraper_run_id?: string } | null;
    if (params?.scraper_run_id?.trim()) ids.push(params.scraper_run_id.trim());
  }
  return ids;
}
const MAX_DAYS = 90;
const MAX_LIMIT = 100;

/**
 * GET /api/admin/scraper-runs
 *
 * Returns recent scraper runs (self-reported by the scraper).
 * Query params: days (default 7, max 90) or limit (max 100).
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const limitParam = searchParams.get("limit");

    const supabase = getSupabaseAdmin();

    if (limitParam != null) {
      const limit = Math.min(
        Math.max(1, parseInt(limitParam, 10) || DEFAULT_DAYS),
        MAX_LIMIT
      );
      const { data, error } = await supabase
        .from("scraper_runs")
        .select("id, run_at, status, feed_type, error_message")
        .order("run_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[admin/scraper-runs] Error:", error.message);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
      const queuedRetryRunIds = await getQueuedRetryRunIds(supabase);
      return NextResponse.json({
        data: data ?? [],
        queued_retry_run_ids: queuedRetryRunIds,
      });
    }

    const days = Math.min(
      Math.max(1, parseInt(daysParam ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS),
      MAX_DAYS
    );
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    const { data, error } = await supabase
      .from("scraper_runs")
      .select("id, run_at, status, feed_type, error_message")
      .gte("run_at", sinceIso)
      .order("run_at", { ascending: false });

    if (error) {
      console.error("[admin/scraper-runs] Error:", error.message);
      return NextResponse.json(
        { error: "Database error", details: error.message },
        { status: 500 }
      );
    }
    const queuedRetryRunIds = await getQueuedRetryRunIds(supabase);
    return NextResponse.json({
      data: data ?? [],
      queued_retry_run_ids: queuedRetryRunIds,
    });
  } catch (err) {
    console.error("[admin/scraper-runs] Error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
