import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/supabase-server-auth";

/**
 * GET /api/episodes
 *
 * Returns distinct episode dates. Episode date column was removed;
 * this endpoint now returns an empty list for backward compatibility.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: [] });
}
