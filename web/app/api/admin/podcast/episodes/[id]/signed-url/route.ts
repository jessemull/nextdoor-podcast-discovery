import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const BUCKET_AUDIO_PRIVATE = "episode-audio-private";
const BUCKET_IMAGES_PRIVATE = "episode-images-private";
const SIGNED_URL_EXPIRES_SEC = 3600;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/podcast/episodes/[id]/signed-url?type=audio|image&path=...
 * For images, optional `path` selects a row in podcast_episode_images; otherwise
 * falls back to podcast_episodes.image_storage_path.
 * Auth required.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const type = request.nextUrl.searchParams.get("type");
  if (type !== "audio" && type !== "image") {
    return NextResponse.json(
      { error: "type must be 'audio' or 'image'" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const pathParam = request.nextUrl.searchParams.get("path")?.trim() ?? "";

  let path: string | null = null;

  if (type === "audio") {
    const { data: episode, error: fetchError } = await supabase
      .from("podcast_episodes")
      .select("audio_storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !episode) {
      return NextResponse.json(
        { error: fetchError?.message ?? "Not found" },
        { status: fetchError?.code === "PGRST116" ? 404 : 500 }
      );
    }
    path = (episode as { audio_storage_path: string | null })
      .audio_storage_path;
  } else if (pathParam) {
    const { data: rows, error: imgErr } = await supabase
      .from("podcast_episode_images")
      .select("image_storage_path")
      .eq("episode_id", id)
      .eq("image_storage_path", pathParam)
      .limit(1);

    if (imgErr) {
      return NextResponse.json({ error: imgErr.message }, { status: 500 });
    }

    if (rows?.length) {
      path = pathParam;
    } else {
      const { data: episode, error: fetchError } = await supabase
        .from("podcast_episodes")
        .select("image_storage_path")
        .eq("id", id)
        .single();

      if (fetchError || !episode) {
        return NextResponse.json(
          { error: fetchError?.message ?? "Not found" },
          { status: fetchError?.code === "PGRST116" ? 404 : 500 }
        );
      }
      const legacy = (episode as { image_storage_path: string | null })
        .image_storage_path;
      if (legacy === pathParam) {
        path = pathParam;
      }
    }
  } else {
    const { data: episode, error: fetchError } = await supabase
      .from("podcast_episodes")
      .select("image_storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !episode) {
      return NextResponse.json(
        { error: fetchError?.message ?? "Not found" },
        { status: fetchError?.code === "PGRST116" ? 404 : 500 }
      );
    }
    path = (episode as { image_storage_path: string | null })
      .image_storage_path;
  }

  if (!path || typeof path !== "string") {
    return NextResponse.json(
      { error: "No storage path for this type" },
      { status: 404 }
    );
  }

  const bucket =
    type === "audio" ? BUCKET_AUDIO_PRIVATE : BUCKET_IMAGES_PRIVATE;
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SEC);

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: signedError?.message ?? "Failed to create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: signedData.signedUrl });
}
