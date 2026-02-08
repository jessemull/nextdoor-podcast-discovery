import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

/**
 * GET /api/neighborhoods
 *
 * Fetch all active neighborhoods. Requires authentication.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("neighborhoods")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[neighborhoods] Error fetching:", {
      code: error.code,
      error: error.message,
    });
    return NextResponse.json(
      { details: error.message || "Failed to fetch neighborhoods", error: "Database error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data || [] });
}
