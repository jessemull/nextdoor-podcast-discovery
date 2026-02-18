import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { calculateSuccessRate } from "@/lib/utils";

/**
 * GET /api/admin/jobs/stats
 *
 * Returns statistics about background jobs.
 * Requires authentication.
 *
 * Returns:
 * - Total jobs by status
 * - Average job duration
 * - Success rate
 * - Jobs by type
 */
export async function GET(_request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get all jobs for statistics
    const { data: jobs, error } = await supabase
      .from("background_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logError("[admin/jobs/stats] Error fetching jobs", error);
      return NextResponse.json(
        {
          details: error.message,
          error: "Database error",
        },
        { status: 500 }
      );
    }

    const jobsList = jobs ?? [];
    if (jobsList.length === 0) {
      return NextResponse.json({
        data: {
          average_duration_seconds: 0,
          by_status: {},
          by_type: {},
          success_rate: 0,
          total_jobs: 0,
        },
      });
    }

    // Calculate statistics
    const totalJobs = jobsList.length;

    // Count by status
    const byStatus: Record<string, number> = {};
    for (const job of jobsList) {
      const status = typeof job.status === "string" ? job.status : String(job.status ?? "unknown");
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    // Count by type
    const byType: Record<string, number> = {};
    for (const job of jobsList) {
      const type = typeof job.type === "string" ? job.type : String(job.type ?? "unknown");
      byType[type] = (byType[type] || 0) + 1;
    }

    // Calculate average duration for completed jobs
    const completedJobs = jobsList.filter(
      (job) =>
        job.status === "completed" &&
        job.started_at &&
        job.completed_at
    );

    let averageDurationSeconds = 0;
    if (completedJobs.length > 0) {
      const totalDuration = completedJobs.reduce((sum, job) => {
        const started = new Date(job.started_at as string).getTime();
        const completed = new Date(job.completed_at as string).getTime();
        return sum + (completed - started);
      }, 0);
      averageDurationSeconds = Math.round(totalDuration / completedJobs.length / 1000);
    }

    // Calculate success rate (completed / (completed + error))
    const completedCount = byStatus.completed || 0;
    const errorCount = byStatus.error || 0;
    const successRate = calculateSuccessRate(completedCount, errorCount);

    return NextResponse.json({
      data: {
        average_duration_seconds: averageDurationSeconds,
        by_status: byStatus,
        by_type: byType,
        success_rate: successRate,
        total_jobs: totalJobs,
      },
    });
  } catch (error) {
    logError("[admin/jobs/stats]", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
