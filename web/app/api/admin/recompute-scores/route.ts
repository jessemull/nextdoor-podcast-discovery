import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

// Valid weight dimensions (must match scraper/src/worker.py)
const VALID_WEIGHT_DIMENSIONS = [
  "absurdity",
  "drama",
  "discussion_spark",
  "emotional_intensity",
  "news_value",
] as const;

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 10;

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
    const { description, name, ranking_weights } = body;

    if (!ranking_weights) {
      return NextResponse.json(
        { error: "ranking_weights is required" },
        { status: 400 }
      );
    }

    if (typeof ranking_weights !== "object" || Array.isArray(ranking_weights)) {
      return NextResponse.json(
        { error: "ranking_weights must be an object" },
        { status: 400 }
      );
    }

    // Validate all values are numbers within bounds
    for (const [key, value] of Object.entries(ranking_weights)) {
      if (typeof value !== "number") {
        return NextResponse.json(
          { error: `ranking_weights.${key} must be a number` },
          { status: 400 }
        );
      }
      if (value < MIN_WEIGHT || value > MAX_WEIGHT) {
        return NextResponse.json(
          { error: `ranking_weights.${key} must be between ${MIN_WEIGHT} and ${MAX_WEIGHT}` },
          { status: 400 }
        );
      }
    }

    // Validate only valid dimensions are present
    const invalidDimensions = Object.keys(ranking_weights).filter(
      (key) => !VALID_WEIGHT_DIMENSIONS.includes(key as typeof VALID_WEIGHT_DIMENSIONS[number])
    );
    if (invalidDimensions.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid weight dimensions: ${invalidDimensions.join(", ")}. Valid dimensions are: ${VALID_WEIGHT_DIMENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate all required dimensions are present
    const missingDimensions = VALID_WEIGHT_DIMENSIONS.filter(
      (dim) => !(dim in ranking_weights)
    );
    if (missingDimensions.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required weight dimensions: ${missingDimensions.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Create weight config
    const { data: weightConfig, error: configError } = await supabase
      .from("weight_configs")
      .insert({
        created_by: session.user?.email || "unknown",
        description: description || null,
        name: name || `Config ${new Date().toISOString()}`,
        weights: ranking_weights,
      })
      .select()
      .single();

    if (configError || !weightConfig) {
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
    const { data: job, error: jobError } = await supabase
      .from("background_jobs")
      .insert({
        created_by: session.user?.email || "unknown",
        max_retries: 3, // Default: retry up to 3 times on transient failures
        params: { weight_config_id: weightConfig.id },
        retry_count: 0,
        status: "pending",
        type: "recompute_final_scores",
      })
      .select()
      .single();

    if (jobError || !job) {
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
        job_id: job.id,
        status: job.status,
        weight_config_id: weightConfig.id,
        weight_config_name: weightConfig.name,
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
