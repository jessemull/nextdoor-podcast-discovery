import { NextRequest, NextResponse } from "next/server";

import { invalidateActiveConfigCache } from "@/lib/active-config-cache.server";
import { auth0 } from "@/lib/auth0";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { UUID_REGEX } from "@/lib/validators";

/**
 * PUT /api/admin/weight-configs/:id/activate
 *
 * Atomically switches the active weight configuration.
 * Requires authentication.
 *
 * This is an instant operation - no recompute needed.
 * The new config's scores must already be computed (via background job).
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const configId = params.id;

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

    // Atomically switch active config
    const { error: updateError } = await supabase
      .from("settings")
      .upsert(
        { key: "active_weight_config_id", value: configId },
        { onConflict: "key" }
      );

    if (updateError) {
      console.error("[admin/weight-configs/activate] Error updating settings:", {
        error: updateError.message,
      });
      return NextResponse.json(
        {
          details: updateError.message,
          error: "Database error",
        },
        { status: 500 }
      );
    }

    // Update is_active flags (optional, for convenience)
    // Set all to false, then set this one to true
    await supabase
      .from("weight_configs")
      .update({ is_active: false })
      .neq("id", configId);

    await supabase
      .from("weight_configs")
      .update({ is_active: true })
      .eq("id", configId);

    invalidateActiveConfigCache();

    return NextResponse.json({
      data: {
        active_config_id: configId,
        config_name: config.name,
        success: true,
      },
    });
  } catch (error) {
    console.error("[admin/weight-configs/activate] Error:", {
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
