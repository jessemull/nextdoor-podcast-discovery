import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

/**
 * GET /api/admin/weight-configs
 *
 * Returns all weight configurations.
 * Requires authentication.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get all weight configs
    const { data: configs, error } = await supabase
      .from("weight_configs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/weight-configs] Error fetching configs:", {
        error: error.message,
      });
      return NextResponse.json(
        {
          details: error.message,
          error: "Database error",
        },
        { status: 500 }
      );
    }

    // Get active config ID
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

    // Use has_scores column from weight_configs (optimized via migration 007)
    // Falls back to querying post_scores if column doesn't exist (backward compatibility)
    const configsWithActive = (configs || []).map((config) => {
      // Check if has_scores column exists (from migration 007)
      const hasScores = "has_scores" in config
        ? (config.has_scores as boolean)
        : false; // Fallback: assume false if column doesn't exist

      return {
        ...config,
        has_scores: hasScores,
        is_active: config.id === activeConfigId,
      };
    });

    return NextResponse.json({
      active_config_id: activeConfigId,
      data: configsWithActive,
    });
  } catch (error) {
    console.error("[admin/weight-configs] Error:", {
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
