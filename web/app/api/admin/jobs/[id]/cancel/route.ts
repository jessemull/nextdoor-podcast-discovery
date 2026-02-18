import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { UUID_REGEX } from "@/lib/validators";

/**
 * PUT /api/admin/jobs/:id/cancel
 *
 * Cancels a pending or running background job.
 * Requires authentication.
 *
 * Only pending and running jobs can be cancelled.
 * Completed and error jobs cannot be cancelled.
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(jobId)) {
      return NextResponse.json(
        {
          details: "Invalid job ID format. Expected UUID.",
          error: "Invalid job ID",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get current job status
    const { data: job, error: jobError } = await supabase
      .from("background_jobs")
      .select("id, status, type")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        {
          details: jobError?.message || "Job not found",
          error: "Not found",
        },
        { status: 404 }
      );
    }

    // Only pending and running jobs can be cancelled
    if (job.status !== "pending" && job.status !== "running") {
      return NextResponse.json(
        {
          details: `Cannot cancel job with status "${job.status}". Only pending or running jobs can be cancelled.`,
          error: "Invalid job status",
        },
        { status: 400 }
      );
    }

    // Update job to cancelled
    // Note: cancelled_at and cancelled_by columns are added by migration 008_job_cancellation.sql
    const { error: updateError } = await supabase
      .from("background_jobs")
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_by: session.user?.email || "unknown",
        status: "cancelled",
      })
      .eq("id", jobId);

    if (updateError) {
      logError("[admin/jobs/cancel] Error cancelling job", updateError);
      
      // Check if error is due to missing columns (migration not run)
      if (updateError.message.includes("column") && updateError.message.includes("does not exist")) {
        return NextResponse.json(
          {
            details: "Database migration not applied. Please run migration 008_job_cancellation.sql first.",
            error: "Migration required",
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        {
          details: updateError.message,
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        job_id: jobId,
        status: "cancelled",
        success: true,
      },
    });
  } catch (error) {
    logError("[admin/jobs/cancel]", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
