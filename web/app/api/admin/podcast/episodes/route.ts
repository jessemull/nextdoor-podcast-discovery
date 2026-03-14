import { NextRequest, NextResponse } from "next/server";

import { computeAndUpsertEpisodeEmbedding } from "@/lib/episode-embedding.server";
import { copyPrivateToPublic } from "@/lib/podcast-storage.server";
import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

/**
 * GET /api/admin/podcast/episodes
 * List all episodes (any status). Auth required.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("podcast_episodes")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

/**
 * POST /api/admin/podcast/episodes
 * Create episode. Body: title, slug, description?, show_notes?, transcript?, published_at?, status?, audio_url?, image_url?, duration_seconds?, order_index?
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const slug =
    typeof body.slug === "string"
      ? body.slug.trim().toLowerCase().replace(/\s+/g, "-")
      : "";

  if (!title || !slug) {
    return NextResponse.json(
      { error: "title and slug are required" },
      { status: 400 }
    );
  }

  const status = body.status === "published" ? "published" : "draft";
  const audioStoragePath =
    typeof body.audio_storage_path === "string"
      ? body.audio_storage_path.trim() || null
      : null;
  const imageStoragePath =
    typeof body.image_storage_path === "string"
      ? body.image_storage_path.trim() || null
      : null;

  let audioUrl: string | null = null;
  let imageUrl: string | null = null;
  if (status === "published") {
    if (audioStoragePath) {
      try {
        audioUrl = await copyPrivateToPublic("audio", audioStoragePath);
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Failed to copy audio to public",
          },
          { status: 500 }
        );
      }
    }
    if (imageStoragePath) {
      try {
        imageUrl = await copyPrivateToPublic("image", imageStoragePath);
      } catch (err) {
        return NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Failed to copy image to public",
          },
          { status: 500 }
        );
      }
    }
  }

  const publishedAtValue =
    typeof body.published_at === "string" && body.published_at
      ? body.published_at
      : null;
  const publishedAt =
    status === "published"
      ? publishedAtValue ?? new Date().toISOString()
      : publishedAtValue;

  const supabase = getSupabaseAdmin();
  const insert: Record<string, unknown> = {
    audio_storage_path: audioStoragePath,
    audio_url: audioUrl,
    description: typeof body.description === "string" ? body.description : null,
    duration_seconds:
      typeof body.duration_seconds === "number" ? body.duration_seconds : null,
    image_storage_path: imageStoragePath,
    image_url: imageUrl,
    order_index: typeof body.order_index === "number" ? body.order_index : 0,
    published_at: publishedAt,
    show_notes: typeof body.show_notes === "string" ? body.show_notes : null,
    slug,
    status,
    title,
    transcript: typeof body.transcript === "string" ? body.transcript : null,
  };

  const { data, error } = await supabase
    .from("podcast_episodes")
    .insert(insert)
    .select("id, slug, title, status, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "An episode with this slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await computeAndUpsertEpisodeEmbedding(data.id);
  } catch (embedErr) {
    const msg =
      embedErr instanceof Error ? embedErr.message : "Failed to update related episodes";
    return NextResponse.json(
      { error: `Episode created but ${msg.toLowerCase()}. Please try again.` },
      { status: 500 }
    );
  }
  return NextResponse.json({ data });
}
