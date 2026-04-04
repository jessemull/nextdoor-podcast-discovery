import { NextRequest, NextResponse } from "next/server";

import { getActiveWeightConfigId } from "@/lib/active-config-cache.server";
import { logError } from "@/lib/log.server";
import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import {
  scoringFewShotConfigSchema,
  settingsPutBodySchema,
} from "@/lib/validators";

/**
 * GET /api/settings
 *
 * Returns current settings (ranking_weights from active weight config and search_defaults).
 * Requires authentication.
 *
 * Note: ranking_weights now comes from the active weight_config, not the legacy
 * settings.ranking_weights. This ensures consistency with the versioning system.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const activeConfigId = await getActiveWeightConfigId(supabase);

    // Fetch active weight config, search defaults, novelty config, picks defaults in parallel
    const [
      configResult,
      scoringFewShotResult,
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
      supabase.from("settings").select("value").eq("key", "scoring_few_shot").single(),
      supabase.from("settings").select("value").eq("key", "search_defaults").single(),
      supabase.from("settings").select("value").eq("key", "novelty_config").single(),
      supabase.from("settings").select("value").eq("key", "picks_defaults").single(),
    ]);

    // Get ranking weights from active config, or fallback to defaults
    const rankingWeights =
      configResult.data?.weights && typeof configResult.data.weights === "object"
        ? (configResult.data.weights as Record<string, number>)
        : {
            absurdity: 2.5,
            discussion_spark: 1.0,
            drama: 1.5,
            emotional_intensity: 1.2,
            news_value: 1.0,
            podcast_worthy: 2.5,
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
        : { picks_min: 7 };

    const rawFewShot = scoringFewShotResult.data?.value;
    const parsedFewShot = scoringFewShotConfigSchema.safeParse(rawFewShot);
    const scoringFewShot = parsedFewShot.success ? parsedFewShot.data : null;

    return NextResponse.json({
      data: {
        novelty_config: noveltyConfig,
        picks_defaults: picksDefaults,
        ranking_weights: rankingWeights,
        scoring_few_shot: scoringFewShot,
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
 * - novelty_config?: Record<string, unknown>
 * - picks_defaults?: { picks_min: number }
 * - scoring_few_shot?: { intro: string; examples: Array<{ post_id: string; ideal: ... }> }
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();
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
    const { novelty_config, picks_defaults, ranking_weights, scoring_few_shot, search_defaults } =
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

    if (scoring_few_shot) {
      updates.push(
        supabase
          .from("settings")
          .upsert({ key: "scoring_few_shot", value: scoring_few_shot }, { onConflict: "key" })
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
