/**
 * Server-only helpers for podcast media: copy from private to public buckets.
 * Used when publishing an episode so public site and RSS use public URLs.
 */

import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase.server";

const BUCKET_AUDIO_PRIVATE = "episode-audio-private";
const BUCKET_AUDIO_PUBLIC = "episode-audio";
const BUCKET_IMAGES_PRIVATE = "episode-images-private";
const BUCKET_IMAGES_PUBLIC = "episode-images";

export type StorageMediaType = "audio" | "image";

/**
 * Copy a file from the private bucket to the public bucket at the same path.
 * Returns the public URL for the copied object.
 */
export async function copyPrivateToPublic(
  type: StorageMediaType,
  storagePath: string
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const privateBucket =
    type === "audio" ? BUCKET_AUDIO_PRIVATE : BUCKET_IMAGES_PRIVATE;
  const publicBucket =
    type === "audio" ? BUCKET_AUDIO_PUBLIC : BUCKET_IMAGES_PUBLIC;

  const { data: blob, error: downloadError } = await supabase.storage
    .from(privateBucket)
    .download(storagePath);

  if (downloadError || !blob) {
    throw new Error(
      `Failed to download from private bucket: ${downloadError?.message ?? "unknown"}`
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(publicBucket)
    .upload(storagePath, blob, {
      contentType: blob.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Failed to upload to public bucket: ${uploadError.message}`
    );
  }

  const { data: urlData } = supabase.storage
    .from(publicBucket)
    .getPublicUrl(storagePath);
  return urlData.publicUrl;
}
