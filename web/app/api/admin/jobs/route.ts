import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

/**
 * GET /api/admin/jobs
 *
 * Returns background job status. Can filter by type or get a specific job.
 * Requires authentication.
 *
 * Query params:
 * - type?: string (filter by job type)
 * - id?: string (get specific job by ID)
 * - limit?: number (default 10, max 50)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(
      limitParam ? parseInt(limitParam, 10) : 10,
      50
    );

    const supabase = getSupabaseAdmin();

    // Get specific job by ID
    if (id) {
      const { data: job, error } = await supabase
        .from("background_jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !job) {
        return NextResponse.json(
          {
            details: error?.message || "Job not found",
            error: "Not found",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ data: job });
    }

    // Get jobs with optional filters
    let query = supabase.from("background_jobs").select("*").order("created_at", { ascending: false }).limit(limit);

    if (type) {
      query = query.eq("type", type);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error("[admin/jobs] Error fetching jobs:", {
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

    return NextResponse.json({
      data: jobs || [],
      total: jobs?.length || 0,
    });
  } catch (error) {
    console.error("[admin/jobs] Error:", {
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
