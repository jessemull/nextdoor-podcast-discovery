import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { UUID_REGEX } from "@/lib/validators";

interface RetryRouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/jobs/:id/retry
 *
 * Creates a new job with the same type and params as the given job (audit trail).
 * Only jobs in error or cancelled state can be retried.
 * Requires authentication.
 */
export async function POST(
  _request: NextRequest,
  { params }: RetryRouteParams
) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: jobId } = await params;

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
      .select("id, params, status, type")
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

    if (job.status !== "error" && job.status !== "cancelled") {
      return NextResponse.json(
        {
          details: `Cannot retry job with status "${job.status}". Only error or cancelled jobs can be retried.`,
          error: "Invalid job status",
        },
        { status: 400 }
      );
    }

    const insertRow: Record<string, unknown> = {
      created_by: session.user?.email || "unknown",
      params: job.params ?? {},
      retry_count: 0,
      status: "pending",
      type: job.type,
    };
    if (
      job.type === "backfill_dimension" ||
      job.type === "recompute_final_scores"
    ) {
      insertRow.max_retries = 3;
    }

    const { data: newJob, error: insertError } = await supabase
      .from("background_jobs")
      .insert(insertRow)
      .select()
      .single();

    if (insertError || !newJob) {
      logError("[admin/jobs/retry] Error creating job", insertError ?? new Error("No job row"));
      return NextResponse.json(
        {
          details: insertError?.message || "Failed to create retry job",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: newJob });
  } catch (error) {
    logError("[admin/jobs/retry]", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
