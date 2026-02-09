import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { postsUsedBodySchema, UUID_REGEX } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/posts/[id]/used
 *
 * Mark a post as used in an episode. Requires authentication.
 *
 * Body:
 * - used: boolean
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Require authentication

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Validate UUID format

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid post ID format" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = postsUsedBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { used } = parsed.data;

    const supabase = getSupabaseAdmin();

    const updateData: Record<string, boolean> = {
      used_on_episode: used,
    };

    // Cast needed because Supabase types may be out of sync with DB schema
    const { data, error } = await (supabase.from("posts") as ReturnType<
      typeof supabase.from
    >)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[posts/used] Error updating post:", {
        code: error.code,
        error: error.message,
        hint: error.hint,
        postId: id,
      });
      return NextResponse.json(
        {
          details: error.message || "Failed to update post",
          error: "Database error",
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          details: `Post with ID ${id} not found`,
          error: "Not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = process.env.NODE_ENV === "development" ? errorMessage : undefined;
    console.error("[posts/used] Unexpected error:", {
      error: errorMessage,
      postId: id,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        details: errorDetails,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
