import { NextRequest, NextResponse } from "next/server";

import { auth0 } from "@/lib/auth0";
import { getPostIdsByQuery } from "@/lib/posts.bulk.server";
import { logError } from "@/lib/log.server";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { postsBulkBodySchema } from "@/lib/validators";

/**
 * POST /api/posts/bulk
 *
 * Apply a single action (mark_used, save, ignore, unignore) to a set of posts.
 * Body: { action, post_ids?: string[] } or { action, apply_to_query: true, query }.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
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

  const parsed = postsBulkBodySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const message = first?.message ?? "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { action, apply_to_query, post_ids: bodyPostIds, query } = parsed.data;

  const supabase = getSupabaseAdmin();

  let postIds: string[];
  if (bodyPostIds != null && bodyPostIds.length > 0) {
    postIds = bodyPostIds;
  } else if (apply_to_query === true && query != null) {
    const result = await getPostIdsByQuery(supabase, query);
    if (result.error) return result.error;
    postIds = result.postIds;
  } else {
    return NextResponse.json(
      { error: "Provide either post_ids or apply_to_query with query" },
      { status: 400 }
    );
  }

  if (postIds.length === 0) {
    return NextResponse.json({ data: { updated: 0 } });
  }

  try {
    if (action === "mark_used") {
      const { error } = await supabase
        .from("posts")
        .update({ used_on_episode: true })
        .in("id", postIds);
      if (error) {
        logError("[posts/bulk] mark_used", error);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
    } else if (action === "save") {
      const { error } = await supabase
        .from("posts")
        .update({ saved: true })
        .in("id", postIds);
      if (error) {
        logError("[posts/bulk] save", error);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
    } else if (action === "ignore") {
      const { error } = await supabase
        .from("posts")
        .update({ ignored: true })
        .in("id", postIds);
      if (error) {
        logError("[posts/bulk] ignore", error);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
    } else if (action === "unignore") {
      const { error } = await supabase
        .from("posts")
        .update({ ignored: false })
        .in("id", postIds);
      if (error) {
        logError("[posts/bulk] unignore", error);
        return NextResponse.json(
          { error: "Database error", details: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ data: { updated: postIds.length } });
  } catch (error) {
    logError("[posts/bulk]", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
