import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

/**
 * GET /api/episodes
 *
 * Fetch distinct episode dates (posts marked as used). Requires authentication.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("posts")
    .select("episode_date")
    .eq("used_on_episode", true)
    .not("episode_date", "is", null);

  if (error) {
    console.error("[episodes] Error fetching:", {
      code: error.code,
      error: error.message,
    });
    return NextResponse.json(
      { details: error.message || "Failed to fetch episodes", error: "Database error" },
      { status: 500 }
    );
  }

  const dates = [
    ...new Set(
      (data || [])
        .map((row: { episode_date: string }) => row.episode_date)
        .filter(Boolean)
    ),
  ].sort((a, b) => b.localeCompare(a));

  return NextResponse.json({ data: dates });
}
