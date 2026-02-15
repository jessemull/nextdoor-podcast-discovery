import { NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";

/**
 * GET /api/episodes
 *
 * Returns distinct episode dates. Episode date column was removed;
 * this endpoint now returns an empty list for backward compatibility.
 */
export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: [] });
}
