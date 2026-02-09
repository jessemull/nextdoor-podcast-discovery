import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

/**
 * GET /api/episodes
 *
 * Returns distinct episode dates. Episode date column was removed;
 * this endpoint now returns an empty list for backward compatibility.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: [] });
}
