import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/supabase-server-auth";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const BUCKET_AUDIO_PRIVATE = "episode-audio-private";
const BUCKET_IMAGES_PRIVATE = "episode-images-private";
const MAX_SIZE_MB = 100;
const SIGNED_URL_EXPIRES_SEC = 3600;

/**
 * POST /api/admin/podcast/upload
 * FormData: file (File), type: 'audio' | 'image'
 * Uploads to private buckets. Returns { data: { path, previewUrl? } }.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const type = formData.get("type");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing or invalid file" },
      { status: 400 }
    );
  }

  if (type !== "audio" && type !== "image") {
    return NextResponse.json(
      { error: "type must be 'audio' or 'image'" },
      { status: 400 }
    );
  }

  const bucket =
    type === "audio" ? BUCKET_AUDIO_PRIVATE : BUCKET_IMAGES_PRIVATE;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `File size must be under ${MAX_SIZE_MB}MB` },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(safeName, await file.arrayBuffer(), {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message ?? "Upload failed" },
      { status: 500 }
    );
  }

  const path = uploadData.path;
  let previewUrl: string | undefined;
  const { data: signedData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SEC);
  if (signedData?.signedUrl) {
    previewUrl = signedData.signedUrl;
  }

  return NextResponse.json({
    data: { path, ...(previewUrl !== undefined && { previewUrl }) },
  });
}
