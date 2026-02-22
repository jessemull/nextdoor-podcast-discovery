import { NextRequest, NextResponse } from "next/server";

import { invalidateActiveConfigCache } from "@/lib/active-config-cache.server";

/**
 * POST /api/admin/invalidate-active-config
 *
 * Invalidates the active weight config cache (L1 + Redis). Used by the
 * scraper worker after it performs a cutover so the app sees the new active
 * config immediately. Requires INTERNAL_API_SECRET header.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-secret");
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await invalidateActiveConfigCache();
  return NextResponse.json({ ok: true });
}
