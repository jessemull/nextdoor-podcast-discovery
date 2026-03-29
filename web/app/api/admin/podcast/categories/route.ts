import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function escapeIlikeTerm(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, " ");
}

/**
 * GET /api/admin/podcast/categories
 * With no query params: returns all categories (for episode checklists, etc.).
 * With search|q and/or limit|offset: paginated list for the admin table.
 * Paginated responses include { data, total }.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const searchRaw =
    (searchParams.get("search") ?? searchParams.get("q") ?? "").trim();
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  const limitExplicit = limitParam != null && limitParam !== "";
  const offsetExplicit = offsetParam != null && offsetParam !== "";
  const paginate =
    limitExplicit || offsetExplicit || searchRaw.length > 0;

  const supabase = getSupabaseAdmin();

  if (!paginate) {
    const { data, error } = await supabase
      .from("podcast_categories")
      .select("*")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const list = data ?? [];
    return NextResponse.json({ data: list, total: list.length });
  }

  const limit = Math.min(
    Math.max(1, parseInt(limitParam ?? "", 10) || DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const offset = Math.max(0, parseInt(offsetParam ?? "", 10) || 0);

  let query = supabase
    .from("podcast_categories")
    .select("*", { count: "exact" })
    .order("name");

  if (searchRaw) {
    const escaped = escapeIlikeTerm(searchRaw);
    const pattern = `%${escaped}%`;
    query = query.or(
      `name.ilike.${pattern},slug.ilike.${pattern},description.ilike.${pattern}`
    );
  }

  const { data, error, count } = await query.range(
    offset,
    offset + limit - 1
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    data: data ?? [],
    total: count ?? (data?.length ?? 0),
  });
}

/**
 * POST /api/admin/podcast/categories
 * Body: name, slug?, description?
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug =
    typeof body.slug === "string"
      ? body.slug.trim().toLowerCase().replace(/\s+/g, "-")
      : name.toLowerCase().replace(/\s+/g, "-");

  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const insert = {
    description: typeof body.description === "string" ? body.description : null,
    name,
    slug,
  };

  const { data, error } = await supabase
    .from("podcast_categories")
    .insert(insert)
    .select("id, slug, name, description, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A category with this slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
