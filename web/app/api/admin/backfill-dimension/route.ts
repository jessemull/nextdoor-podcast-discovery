import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { backfillDimensionBodySchema } from "@/lib/validators";

/**
 * POST /api/admin/backfill-dimension
 *
 * Creates a background job to backfill a single scoring dimension for posts
 * that already have llm_scores but are missing that dimension key.
 * Requires authentication.
 *
 * Body: { dimension: "absurdity" | "discussion_spark" | "drama" | ... }
 */
export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = backfillDimensionBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { dimension } = parsed.data;

    const supabase = getSupabaseAdmin();
    const { data: jobRow, error } = await supabase
      .from("background_jobs")
      .insert({
        created_by: session.user?.email || "unknown",
        max_retries: 3,
        params: { dimension },
        retry_count: 0,
        status: "pending",
        type: "backfill_dimension",
      })
      .select()
      .single();

    if (error || !jobRow) {
      logError("[admin/backfill-dimension] Failed to create job", error ?? new Error("No job row"));
      return NextResponse.json(
        {
          details: error?.message ?? "Failed to create background job",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: jobRow });
  } catch (err) {
    logError("[admin/backfill-dimension]", err);
    return NextResponse.json(
      {
        details: err instanceof Error ? err.message : "Unknown error",
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
