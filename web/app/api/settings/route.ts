import { NextRequest, NextResponse } from "next/server";

import { getActiveWeightConfigId } from "@/lib/active-config-cache.server";
import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { settingsPutBodySchema } from "@/lib/validators";

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
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const activeConfigId = await getActiveWeightConfigId(supabase);

    // Fetch active weight config, search defaults, novelty config, picks defaults in parallel
    const [
      configResult,
      searchDefaultsResult,
      noveltyConfigResult,
      picksDefaultsResult,
    ] = await Promise.all([
      activeConfigId
        ? supabase
            .from("weight_configs")
            .select("weights")
            .eq("id", activeConfigId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("settings").select("value").eq("key", "search_defaults").single(),
      supabase.from("settings").select("value").eq("key", "novelty_config").single(),
      supabase.from("settings").select("value").eq("key", "picks_defaults").single(),
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
            podcast_worthy: 2.0,
            readability: 1.2,
          };

    const searchDefaults =
      searchDefaultsResult.data?.value &&
      typeof searchDefaultsResult.data.value === "object"
        ? (searchDefaultsResult.data.value as Record<string, unknown>)
        : {
            similarity_threshold: 0.2,
          };

    const noveltyConfig =
      noveltyConfigResult.data?.value &&
      typeof noveltyConfigResult.data.value === "object"
        ? (noveltyConfigResult.data.value as Record<string, unknown>)
        : {
            frequency_thresholds: { common: 30, rare: 5, very_common: 100 },
            max_multiplier: 1.5,
            min_multiplier: 0.2,
            window_days: 30,
          };

    const picksDefaults =
      picksDefaultsResult.data?.value &&
      typeof picksDefaultsResult.data.value === "object"
        ? (picksDefaultsResult.data.value as Record<string, unknown>)
        : {
            picks_limit: 5,
            picks_min: 7,
            picks_min_podcast: undefined,
          };

    return NextResponse.json({
      data: {
        novelty_config: noveltyConfig,
        picks_defaults: picksDefaults,
        ranking_weights: rankingWeights,
        search_defaults: searchDefaults,
      },
    });
  } catch (error) {
    logError("[settings] Error fetching settings", error);
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
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = settingsPutBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { novelty_config, picks_defaults, ranking_weights, search_defaults } =
      parsed.data;

    const supabase = getSupabaseAdmin();
    const updates: unknown[] = [];

    if (ranking_weights) {
      updates.push(
        supabase
          .from("settings")
          .upsert({ key: "ranking_weights", value: ranking_weights }, { onConflict: "key" })
      );
    }

    if (novelty_config) {
      updates.push(
        supabase
          .from("settings")
          .upsert({ key: "novelty_config", value: novelty_config }, { onConflict: "key" })
      );
    }

    if (search_defaults) {
      updates.push(
        supabase
          .from("settings")
          .upsert({ key: "search_defaults", value: search_defaults }, { onConflict: "key" })
      );
    }

    if (picks_defaults) {
      updates.push(
        supabase
          .from("settings")
          .upsert({ key: "picks_defaults", value: picks_defaults }, { onConflict: "key" })
      );
    }

    await Promise.all(updates);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    logError("[settings] Error updating settings", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
