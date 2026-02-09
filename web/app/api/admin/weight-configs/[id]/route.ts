import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import {
  UUID_REGEX,
  weightConfigPatchBodySchema,
} from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/weight-configs/:id
 *
 * Update weight config name and/or description. Requires authentication.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: configId } = await params;

  if (!configId || !UUID_REGEX.test(configId)) {
    return NextResponse.json(
      { error: "Invalid weight config ID format" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = weightConfigPatchBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const updates: { description?: string; name?: string } = {};
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description;
    }
    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "At least one of name or description is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("weight_configs")
      .update(updates)
      .eq("id", configId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { details: "Weight config not found", error: "Not found" },
          { status: 404 }
        );
      }
      console.error("[admin/weight-configs/patch] Error updating config:", {
        error: error.message,
        configId,
      });
      return NextResponse.json(
        {
          details: error.message || "Failed to update config",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/weight-configs/patch] Unexpected error:", {
      error: errorMessage,
      configId,
    });
    return NextResponse.json(
      { details: errorMessage, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/weight-configs/:id
 *
 * Deletes a weight configuration and all associated post_scores.
 * Cannot delete the active config (must deactivate first).
 * Requires authentication.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
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

    // Prevent deletion of active config
    if (configId === activeConfigId) {
      return NextResponse.json(
        {
          details: "Cannot delete the active weight configuration. Deactivate it first.",
          error: "Cannot delete active config",
        },
        { status: 400 }
      );
    }

    // Check for pending or running jobs that reference this config
    const { data: jobs, error: jobsError } = await supabase
      .from("background_jobs")
      .select("id, params, status, type")
      .eq("type", "recompute_final_scores")
      .in("status", ["pending", "running"]);

    if (jobsError) {
      console.error("[admin/weight-configs/delete] Error checking jobs:", {
        error: jobsError.message,
      });
      return NextResponse.json(
        {
          details: jobsError.message,
          error: "Database error",
        },
        { status: 500 }
      );
    }

    // Check if any job references this config
    const jobsReferencingConfig = (jobs || []).filter((job: { params: unknown; status: string }) => {
      const params = job.params as null | Record<string, unknown>;
      return params?.weight_config_id === configId;
    });

    if (jobsReferencingConfig.length > 0) {
      const statusSet = new Set(jobsReferencingConfig.map((j) => j.status));
      const statusList = Array.from(statusSet).join(", ");
      return NextResponse.json(
        {
          details: `Cannot delete weight configuration. There are ${jobsReferencingConfig.length} job(s) (status: ${statusList}) that reference this config. Cancel or wait for the job(s) to complete first.`,
          error: "Cannot delete config with active jobs",
        },
        { status: 400 }
      );
    }

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

    // Delete the config (CASCADE will delete post_scores automatically)
    const { error: deleteError } = await supabase
      .from("weight_configs")
      .delete()
      .eq("id", configId);

    if (deleteError) {
      console.error("[admin/weight-configs/delete] Error deleting config:", {
        error: deleteError.message,
      });
      return NextResponse.json(
        {
          details: deleteError.message,
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        config_name: config.name,
        deleted_config_id: configId,
        success: true,
      },
    });
  } catch (error) {
    console.error("[admin/weight-configs/delete] Error:", {
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
