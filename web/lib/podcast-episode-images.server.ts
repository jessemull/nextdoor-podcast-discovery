/**
 * Admin persistence for podcast_episode_images and denormalized first-image columns.
 */

import "server-only";

import { copyPrivateToPublic } from "@/lib/podcast-storage.server";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface EpisodeImagePayload {
  description?: null | string;
  image_storage_path?: null | string;
  image_url?: null | string;
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Parses episode_images from JSON body; falls back to empty array.
 */
export function parseEpisodeImagesPayload(
  raw: unknown
): EpisodeImagePayload[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!item || typeof item !== "object") return {};
    const o = item as Record<string, unknown>;
    return {
      description: trimOrNull(o.description),
      image_storage_path: trimOrNull(o.image_storage_path),
      image_url: trimOrNull(o.image_url),
    };
  });
}

/**
 * Deletes all gallery rows for an episode, inserts the new set, and syncs
 * podcast_episodes.image_* from the first row (by sort_order).
 */
export async function replaceEpisodeImages(
  supabase: SupabaseClient,
  episodeId: string,
  images: EpisodeImagePayload[],
  publishing: boolean
): Promise<void> {
  const { error: delErr } = await supabase
    .from("podcast_episode_images")
    .delete()
    .eq("episode_id", episodeId);

  if (delErr) {
    throw new Error(delErr.message);
  }

  const rows: Array<{
    description: string | null;
    episode_id: string;
    image_storage_path: string | null;
    image_url: string | null;
    sort_order: number;
  }> = [];

  for (let i = 0; i < images.length; i += 1) {
    const img = images[i];
    const storagePath = img.image_storage_path ?? null;
    const existingPublic = img.image_url ?? null;
    let publicUrl: string | null;

    if (publishing && storagePath) {
      publicUrl = await copyPrivateToPublic("image", storagePath);
    } else if (publishing && existingPublic) {
      publicUrl = existingPublic;
    } else if (!publishing) {
      publicUrl = existingPublic;
    } else {
      publicUrl = null;
    }

    rows.push({
      description: img.description ?? null,
      episode_id: episodeId,
      image_storage_path: storagePath,
      image_url: publicUrl,
      sort_order: i,
    });
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("podcast_episode_images")
      .insert(rows);

    if (insErr) {
      throw new Error(insErr.message);
    }
  }

  const first = rows[0];
  const { error: epErr } = await supabase
    .from("podcast_episodes")
    .update({
      image_description: first?.description ?? null,
      image_storage_path: first?.image_storage_path ?? null,
      image_url: first?.image_url ?? null,
    })
    .eq("id", episodeId);

  if (epErr) {
    throw new Error(epErr.message);
  }
}
