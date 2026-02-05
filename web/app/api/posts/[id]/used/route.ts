import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

// UUID v4 format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * - episode_date?: string (ISO date, e.g. "2026-02-05")
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
    const { episode_date, used } = body;

    // Validate required field

    if (typeof used !== "boolean") {
      return NextResponse.json(
        { error: "Missing required field: used (boolean)" },
        { status: 400 }
      );
    }

    // Validate episode_date format if provided

    if (episode_date && !/^\d{4}-\d{2}-\d{2}$/.test(episode_date)) {
      return NextResponse.json(
        { error: "Invalid episode_date format (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const updateData: Record<string, boolean | string> = {
      used_on_episode: used,
    };

    if (episode_date) {
      updateData.episode_date = episode_date;
    } else if (used) {
      // Default to today if marking as used without a date
      updateData.episode_date = new Date().toISOString().split("T")[0];
    }

    // Cast needed because Supabase types may be out of sync with DB schema
    const { data, error } = await (supabase.from("posts") as ReturnType<
      typeof supabase.from
    >)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating post:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
