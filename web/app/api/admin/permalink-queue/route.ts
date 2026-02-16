import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { permalinkQueueBodySchema } from "@/lib/validators";

/**
 * POST /api/admin/permalink-queue
 *
 * Adds a permalink to the queue for scraping. Creates a background job of type
 * fetch_permalink. If post_id is provided, the job will update the existing
 * post; otherwise it will add a new post.
 *
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = permalinkQueueBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { post_id: postId, url } = parsed.data;

    const supabase = getSupabaseAdmin();

    // If post_id provided, verify post exists
    if (postId) {
      const { data: postRow, error: postError } = await supabase
        .from("posts")
        .select("id")
        .eq("id", postId)
        .single();

      if (postError || !postRow) {
        return NextResponse.json(
          {
            details: postError?.message ?? "Post does not exist",
            error: "Post not found",
          },
          { status: 404 }
        );
      }
    }

    const params: { post_id?: string; url: string } = { url };
    if (postId) {
      params.post_id = postId;
    }

    const { data: jobRow, error: jobError } = await supabase
      .from("background_jobs")
      .insert({
        created_by: session.user?.email ?? "unknown",
        max_retries: 3,
        params,
        retry_count: 0,
        status: "pending",
        type: "fetch_permalink",
      })
      .select()
      .single();

    if (jobError || !jobRow) {
      console.error("[admin/permalink-queue] Failed to create job:", {
        error: jobError?.message ?? "Unknown error",
      });
      return NextResponse.json(
        {
          details: jobError?.message ?? "Failed to create background job",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    const data = {
      job_id: jobRow.id,
      status: jobRow.status,
    };
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[admin/permalink-queue] Error:", {
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
