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
 * GET /api/admin/podcast/episodes/[id]/signed-url?type=audio|image
 * Returns a short-lived signed URL for draft episode media (private bucket).
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
  const { data: episode, error: fetchError } = await supabase
    .from("podcast_episodes")
    .select(
      type === "audio" ? "audio_storage_path" : "image_storage_path"
    )
    .eq("id", id)
    .single();

  if (fetchError || !episode) {
    return NextResponse.json(
      { error: fetchError?.message ?? "Not found" },
      { status: fetchError?.code === "PGRST116" ? 404 : 500 }
    );
  }

  const path =
    type === "audio"
      ? (episode as { audio_storage_path: string | null }).audio_storage_path
      : (episode as { image_storage_path: string | null }).image_storage_path;

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
