import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { postsIgnoredBodySchema, UUID_REGEX } from "@/lib/validators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/posts/[id]/ignored
 *
 * Set or clear ignored (soft delete) state for a post. Requires authentication.
 *
 * Body:
 * - ignored: boolean
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "Invalid post ID format" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = postsIgnoredBodySchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const message = first?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { ignored } = parsed.data;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("posts")
      .update({ ignored })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logError("[posts/ignored] Error updating post", error);
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
        { details: "Post not found", error: "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logError("[posts/ignored] Unexpected error", error);
    return NextResponse.json(
      { details: errorMessage, error: "Internal server error" },
      { status: 500 }
    );
  }
}
