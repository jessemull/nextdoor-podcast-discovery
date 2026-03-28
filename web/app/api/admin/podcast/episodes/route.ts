import { NextRequest, NextResponse } from "next/server";

import { computeAndUpsertEpisodeEmbedding } from "@/lib/episode-embedding.server";
import {
  parseCategoryIds,
  replaceEpisodeCategories,
} from "@/lib/podcast-episode-categories.server";
import {
  parseEpisodeImagesPayload,
  replaceEpisodeImages,
} from "@/lib/podcast-episode-images.server";
import { copyPrivateToPublic } from "@/lib/podcast-storage.server";
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
 * GET /api/admin/podcast/episodes
 * List episodes (any status). Auth required.
 * Query params: search|q (filter title/slug/description), limit (default 20, max 100), offset (default 0).
 * Returns { data, total } when pagination params are used.
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

  const limit = Math.min(
    Math.max(1, parseInt(limitParam ?? "", 10) || DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const offset = Math.max(0, parseInt(offsetParam ?? "", 10) || 0);

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("podcast_episodes")
    .select("*", { count: "exact" })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (searchRaw) {
    const escaped = escapeIlikeTerm(searchRaw);
    const pattern = `%${escaped}%`;
    query = query.or(
      `title.ilike.${pattern},slug.ilike.${pattern},description.ilike.${pattern}`
    );
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? (data?.length ?? 0),
  });
}

/**
 * POST /api/admin/podcast/episodes
 * Create episode. Body: title, slug, description?, show_notes?, transcript?, published_at?,
 * status?, audio_url?, image_url?, duration_seconds?, order_index?, category_ids?
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

  const categoryParse = parseCategoryIds(body);
  if (categoryParse.kind === "error") {
    return NextResponse.json({ error: categoryParse.message }, { status: 400 });
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
  const imageDescription =
    typeof body.image_description === "string"
      ? body.image_description.trim() || null
      : null;

  const galleryExplicit = Object.prototype.hasOwnProperty.call(
    body,
    "episode_images"
  );
  let galleryImages = galleryExplicit
    ? parseEpisodeImagesPayload(body.episode_images)
    : [];
  if (!galleryExplicit && imageStoragePath) {
    galleryImages = [
      {
        description: imageDescription,
        image_storage_path: imageStoragePath,
        image_url: null,
      },
    ];
  }
  const useGallery = galleryExplicit || galleryImages.length > 0;

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
    if (imageStoragePath && !useGallery) {
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
  const aboutEpisode =
    typeof body.about_episode === "string"
      ? body.about_episode.trim() || null
      : null;
  const insert: Record<string, unknown> = {
    about_episode: aboutEpisode,
    audio_storage_path: audioStoragePath,
    audio_url: audioUrl,
    description: typeof body.description === "string" ? body.description : null,
    duration_seconds:
      typeof body.duration_seconds === "number" ? body.duration_seconds : null,
    image_description: useGallery ? null : imageDescription,
    image_storage_path: useGallery ? null : imageStoragePath,
    image_url: useGallery ? null : imageUrl,
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

  if (categoryParse.kind === "ok") {
    try {
      await replaceEpisodeCategories(supabase, data.id, categoryParse.ids);
    } catch (catErr) {
      const msg =
        catErr instanceof Error
          ? catErr.message
          : "Failed to save episode categories";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (useGallery) {
    try {
      await replaceEpisodeImages(
        supabase,
        data.id,
        galleryImages,
        status === "published"
      );
    } catch (imgErr) {
      const msg =
        imgErr instanceof Error ? imgErr.message : "Failed to save episode images";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
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

  const { data: episodeImages } = await supabase
    .from("podcast_episode_images")
    .select("*")
    .eq("episode_id", data.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: categoryLinks } = await supabase
    .from("episode_categories")
    .select("category_id")
    .eq("episode_id", data.id);

  const category_ids = (categoryLinks ?? []).map(
    (r) => r.category_id as string
  );

  return NextResponse.json({
    data: { ...data, category_ids, episode_images: episodeImages ?? [] },
  });
}
