import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { UUID_REGEX } from "@/lib/validators";

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
