import { NextRequest, NextResponse } from "next/server";

import { getSessionWithAuthLog } from "@/lib/auth0-api.server";

/**
 * GET /api/episodes
 *
 * Returns distinct episode dates. Episode date column was removed;
 * this endpoint now returns an empty list for backward compatibility.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionWithAuthLog(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: [] });
}
