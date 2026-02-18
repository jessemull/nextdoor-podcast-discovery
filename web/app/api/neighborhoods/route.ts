import { NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";

/**
 * GET /api/neighborhoods
 *
 * Fetch all active neighborhoods. Requires authentication.
 */
export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("neighborhoods")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    logError("[neighborhoods] Error fetching", error);
    return NextResponse.json(
      { details: error.message || "Failed to fetch neighborhoods", error: "Database error" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data: data || [] },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
