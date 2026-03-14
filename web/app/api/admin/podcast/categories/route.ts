import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

/**
 * GET /api/admin/podcast/categories
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("podcast_categories")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
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
