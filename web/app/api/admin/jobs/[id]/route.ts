import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { UUID_REGEX } from "@/lib/validators";

/**
 * DELETE /api/admin/jobs/:id
 *
 * Deletes a pending or running job (removes the row).
 * Use for transient jobs (e.g. fetch_permalink) so the queue does not fill with cancelled rows.
 * Requires authentication.
 */
export async function DELETE(
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

    const { data: job, error: jobError } = await supabase
      .from("background_jobs")
      .select("id, status")
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

    if (job.status !== "pending" && job.status !== "running") {
      return NextResponse.json(
        {
          details: `Cannot delete job with status "${job.status}". Only pending or running jobs can be deleted.`,
          error: "Invalid job status",
        },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("background_jobs")
      .delete()
      .eq("id", jobId);

    if (deleteError) {
      logError("[admin/jobs/delete] Error deleting job", deleteError);
      return NextResponse.json(
        {
          details: deleteError.message,
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { deleted: true, job_id: jobId },
    });
  } catch (error) {
    logError("[admin/jobs/delete]", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
