import { NextRequest, NextResponse } from "next/server";

import { copyPrivateToPublic } from "@/lib/podcast-storage.server";
import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/podcast/episodes/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("podcast_episodes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Not found" },
      { status: error?.code === "PGRST116" ? 404 : 500 }
    );
  }
  return NextResponse.json({ data });
}

/**
 * PUT /api/admin/podcast/episodes/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const newStatus =
    body.status === "published" ? "published" as const : "draft" as const;
  const audioStoragePath =
    typeof body.audio_storage_path === "string"
      ? body.audio_storage_path.trim() || null
      : undefined;
  const imageStoragePath =
    typeof body.image_storage_path === "string"
      ? body.image_storage_path.trim() || null
      : undefined;

  let copyAudioUrl: string | null | undefined;
  let copyImageUrl: string | null | undefined;
  let currentStatus: string | null = null;
  if (body.status === "published") {
    const { data: current } = await supabase
      .from("podcast_episodes")
      .select("status")
      .eq("id", id)
      .single();
    currentStatus = current?.status ?? null;
    if (audioStoragePath) {
      try {
        copyAudioUrl = await copyPrivateToPublic("audio", audioStoragePath);
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
        copyImageUrl = await copyPrivateToPublic("image", imageStoragePath);
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

  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const slug =
    typeof body.slug === "string"
      ? body.slug.trim().toLowerCase().replace(/\s+/g, "-")
      : undefined;

  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title;
  if (slug !== undefined) update.slug = slug;
  if (body.description !== undefined)
    update.description =
      typeof body.description === "string" ? body.description : null;
  if (body.show_notes !== undefined)
    update.show_notes =
      typeof body.show_notes === "string" ? body.show_notes : null;
  if (body.transcript !== undefined)
    update.transcript =
      typeof body.transcript === "string" ? body.transcript : null;
  if (body.status === "published") {
    const incomingPublishedAt =
      typeof body.published_at === "string" && body.published_at
        ? body.published_at
        : null;
    const isTransitioningToPublished = currentStatus !== "published";
    update.published_at =
      incomingPublishedAt ??
      (isTransitioningToPublished ? new Date().toISOString() : undefined);
    if (update.published_at === undefined) delete update.published_at;
  } else if (body.published_at !== undefined) {
    update.published_at =
      typeof body.published_at === "string" && body.published_at
        ? body.published_at
        : null;
  }
  if (body.status !== undefined) update.status = newStatus;
  if (body.audio_url !== undefined)
    update.audio_url = typeof body.audio_url === "string" ? body.audio_url : null;
  if (body.image_url !== undefined)
    update.image_url = typeof body.image_url === "string" ? body.image_url : null;
  if (copyAudioUrl !== undefined) update.audio_url = copyAudioUrl;
  if (copyImageUrl !== undefined) update.image_url = copyImageUrl;
  if (audioStoragePath !== undefined) update.audio_storage_path = audioStoragePath;
  if (imageStoragePath !== undefined) update.image_storage_path = imageStoragePath;
  if (body.duration_seconds !== undefined)
    update.duration_seconds =
      typeof body.duration_seconds === "number" ? body.duration_seconds : null;
  if (body.order_index !== undefined)
    update.order_index =
      typeof body.order_index === "number" ? body.order_index : 0;

  const { data, error } = await supabase
    .from("podcast_episodes")
    .update(update)
    .eq("id", id)
    .select()
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
  return NextResponse.json({ data });
}

/**
 * DELETE /api/admin/podcast/episodes/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("podcast_episodes")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { id } });
}
