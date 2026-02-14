import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { SEARCH_SUGGESTIONS } from "@/lib/constants";

/**
 * GET /api/search/suggestions?q=...&limit=10
 *
 * Returns search query suggestions for autocomplete.
 * Filters SEARCH_SUGGESTIONS by prefix (case-insensitive).
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    20,
    Math.max(1, limitParam ? parseInt(limitParam, 10) : 10)
  );
  if (Number.isNaN(limit)) {
    return NextResponse.json(
      { error: "Invalid limit" },
      { status: 400 }
    );
  }

  const suggestions = q
    ? SEARCH_SUGGESTIONS.filter((s) =>
        s.toLowerCase().startsWith(q)
      ).slice(0, limit)
    : [...SEARCH_SUGGESTIONS].slice(0, limit);

  return NextResponse.json({ data: suggestions });
}
