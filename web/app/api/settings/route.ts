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
 * GET /api/settings
 *
 * Returns current settings (ranking_weights from active weight config and search_defaults).
 * Requires authentication.
 *
 * Note: ranking_weights now comes from the active weight_config, not the legacy
 * settings.ranking_weights. This ensures consistency with the versioning system.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get active weight config ID
    const activeConfigResult = await supabase
      .from("settings")
      .select("value")
      .eq("key", "active_weight_config_id")
      .single();

    const activeConfigId =
      activeConfigResult.data?.value &&
      typeof activeConfigResult.data.value === "string"
        ? activeConfigResult.data.value
        : null;

    // Fetch active weight config and search defaults in parallel
    const [configResult, searchDefaultsResult] = await Promise.all([
      activeConfigId
        ? supabase
            .from("weight_configs")
            .select("weights")
            .eq("id", activeConfigId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("settings").select("value").eq("key", "search_defaults").single(),
    ]);

    // Get ranking weights from active config, or fallback to defaults
    const rankingWeights =
      configResult.data?.weights && typeof configResult.data.weights === "object"
        ? (configResult.data.weights as Record<string, number>)
        : {
            absurdity: 2.0,
            discussion_spark: 1.0,
            drama: 1.5,
            emotional_intensity: 1.2,
            news_value: 1.0,
          };

    const searchDefaults =
      searchDefaultsResult.data?.value && typeof searchDefaultsResult.data.value === "object"
        ? (searchDefaultsResult.data.value as Record<string, unknown>)
        : {
            similarity_threshold: 0.2,
          };

    return NextResponse.json({
      data: {
        ranking_weights: rankingWeights,
        search_defaults: searchDefaults,
      },
    });
  } catch (error) {
    console.error("[settings] Error fetching settings:", {
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

/**
 * PUT /api/settings
 *
 * Updates settings (ranking_weights and/or search_defaults).
 * Requires authentication.
 *
 * Body:
 * - ranking_weights?: Record<string, number>
 * - search_defaults?: Record<string, unknown>
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ranking_weights, search_defaults } = body;

    if (!ranking_weights && !search_defaults) {
      return NextResponse.json(
        { error: "At least one of ranking_weights or search_defaults must be provided" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const updates: Promise<unknown>[] = [];

    // Validate and update ranking_weights
    if (ranking_weights) {
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

      updates.push(
        supabase
          .from("settings")
          .upsert({ key: "ranking_weights", value: ranking_weights }, { onConflict: "key" })
      );
    }

    // Validate and update search_defaults
    if (search_defaults) {
      if (typeof search_defaults !== "object" || Array.isArray(search_defaults)) {
        return NextResponse.json(
          { error: "search_defaults must be an object" },
          { status: 400 }
        );
      }

      // Validate similarity_threshold if present
      if (
        "similarity_threshold" in search_defaults &&
        (typeof search_defaults.similarity_threshold !== "number" ||
          search_defaults.similarity_threshold < 0 ||
          search_defaults.similarity_threshold > 1)
      ) {
        return NextResponse.json(
          { error: "search_defaults.similarity_threshold must be a number between 0 and 1" },
          { status: 400 }
        );
      }

      updates.push(
        supabase
          .from("settings")
          .upsert({ key: "search_defaults", value: search_defaults }, { onConflict: "key" })
      );
    }

    await Promise.all(updates);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[settings] Error updating settings:", {
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
