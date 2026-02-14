import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getPostIdsByQuery } from "@/lib/posts.bulk.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { postsBulkCountBodySchema } from "@/lib/validators";

/**
 * POST /api/posts/bulk/count
 *
 * Returns the number of posts matching the given query (same shape as bulk apply_to_query).
 * Used to show confirmation modal count when "select all" is checked.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = postsBulkCountBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const message = first?.message ?? "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { query } = parsed.data;
  const supabase = getSupabaseAdmin();
  const result = await getPostIdsByQuery(supabase, query);
  if (result.error) return result.error;

  return NextResponse.json({ data: { count: result.postIds.length } });
}
