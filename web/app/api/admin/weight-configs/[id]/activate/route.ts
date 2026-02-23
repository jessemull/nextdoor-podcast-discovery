import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { UUID_REGEX } from "@/lib/validators";

interface ActivateRouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/admin/weight-configs/:id/activate
 *
 * Enqueues a recompute job with activate_on_completion. The config becomes
 * active only after the job completes (compute-then-cutover). This ensures:
 * (1) No immediate swap — active does not change until scores are ready.
 * (2) No partial state — worker writes to staging, then applies in one transaction.
 * (3) Clean cutover — apply_post_scores_from_staging, then worker sets active.
 * (4) Visibility — job status (pending/running/completed/error) is shown on Settings and Jobs.
 * Requires authentication.
 */
export async function PUT(
  _request: NextRequest,
  { params }: ActivateRouteParams
) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: configId } = await params;

    if (!configId) {
      return NextResponse.json(
        { error: "Weight config ID is required" },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(configId)) {
      return NextResponse.json(
        { error: "Invalid weight config ID format" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify config exists
    const { data: config, error: configError } = await supabase
      .from("weight_configs")
      .select("id, name")
      .eq("id", configId)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        {
          details: configError?.message || "Weight config not found",
          error: "Not found",
        },
        { status: 404 }
      );
    }

    // Enqueue recompute; worker will cut over (set active) only after job completes
    const { data: jobRow, error: jobError } = await supabase
      .from("background_jobs")
      .insert({
        created_by: session.user?.email ?? "unknown",
        max_retries: 3,
        params: {
          activate_on_completion: true,
          weight_config_id: configId,
        },
        retry_count: 0,
        status: "pending",
        type: "recompute_final_scores",
      })
      .select()
      .single();

    if (jobError || !jobRow) {
      logError(
        "[admin/weight-configs/activate] Failed to enqueue recompute job",
        jobError ?? new Error("No job row")
      );
      return NextResponse.json(
        {
          details: jobError?.message ?? "Failed to enqueue job",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        config_name: config.name,
        job_id: jobRow.id,
        message:
          "Recompute queued. This config will become active when the job completes.",
        success: true,
      },
    });
  } catch (error) {
    logError("[admin/weight-configs/activate]", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
