import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { recomputeScoresBodySchema } from "@/lib/validators";

/**
 * POST /api/admin/recompute-scores
 *
 * Creates a background job to recompute final scores for all posts.
 * Requires authentication.
 *
 * Body (one of):
 * - ranking_weights: Record<string, number> — create a new weight config and job
 * - use_active_config: true — create a job using the current active weight config
 *   (e.g. after saving novelty config; no new config is created)
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
    const { description, name, ranking_weights, use_active_config } = parsed.data;

    const supabase = getSupabaseAdmin();

    let weightConfigId: string;
    let weightConfigName: string | null = null;

    if (use_active_config === true) {
      const { data: activeRow } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "active_weight_config_id")
        .single();

      const activeId =
        activeRow?.value != null && typeof activeRow.value === "string"
          ? activeRow.value
          : null;

      if (!activeId) {
        return NextResponse.json(
          {
            error:
              "No active weight config. Activate a config in Ranking Weights first.",
          },
          { status: 400 }
        );
      }

      const { data: configRow } = await supabase
        .from("weight_configs")
        .select("id, name")
        .eq("id", activeId)
        .single();

      if (!configRow?.id) {
        return NextResponse.json(
          {
            error: "Active weight config not found.",
          },
          { status: 400 }
        );
      }
      weightConfigId = configRow.id;
      weightConfigName = configRow.name ?? null;
    } else if (ranking_weights != null) {
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
      weightConfigId = weightConfigRow.id;
      weightConfigName = weightConfigRow.name;
    } else {
      return NextResponse.json(
        { error: "Provide ranking_weights or use_active_config: true" },
        { status: 400 }
      );
    }

    const { data: jobRow, error: jobError } = await supabase
      .from("background_jobs")
      .insert({
        created_by: session.user?.email || "unknown",
        max_retries: 3,
        params: { weight_config_id: weightConfigId },
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

    const data = {
      job_id: jobRow.id,
      status: jobRow.status,
      weight_config_id: weightConfigId,
      weight_config_name: weightConfigName,
    };
    return NextResponse.json({ data });
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
