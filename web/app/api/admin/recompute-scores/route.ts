import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { recomputeScoresBodySchema } from "@/lib/validators";

/**
 * POST /api/admin/recompute-scores
 *
 * Creates a weight config and background job to recompute final scores for all posts.
 * Requires authentication.
 *
 * Body:
 * - ranking_weights: Record<string, number> (required)
 * - name?: string (optional name for the weight config)
 * - description?: string (optional description)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = recomputeScoresBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { description, name, ranking_weights } = parsed.data;

    const supabase = getSupabaseAdmin();

    const { data: weightConfigRow, error: configError } = await supabase
      .from("weight_configs")
      .insert({
        created_by: session.user?.email || "unknown",
        description: description ?? null,
        name: name ?? `Config ${new Date().toISOString()}`,
        weights: ranking_weights,
      })
      .select()
      .single();

    if (configError || !weightConfigRow) {
      console.error("[admin/recompute-scores] Failed to create weight config:", {
        error: configError?.message || "Unknown error",
      });
      return NextResponse.json(
        {
          details: configError?.message || "Failed to create weight config",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    // Create background job with weight_config_id
    const { data: jobRow, error: jobError } = await supabase
      .from("background_jobs")
      .insert({
        created_by: session.user?.email || "unknown",
        max_retries: 3, // Default: retry up to 3 times on transient failures
        params: { weight_config_id: weightConfigRow.id },
        retry_count: 0,
        status: "pending",
        type: "recompute_final_scores",
      })
      .select()
      .single();

    if (jobError || !jobRow) {
      console.error("[admin/recompute-scores] Failed to create job:", {
        error: jobError?.message || "Unknown error",
      });
      return NextResponse.json(
        {
          details: jobError?.message || "Failed to create background job",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        job_id: jobRow.id,
        status: jobRow.status,
        weight_config_id: weightConfigRow.id,
        weight_config_name: weightConfigRow.name,
      },
    });
  } catch (error) {
    console.error("[admin/recompute-scores] Error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
