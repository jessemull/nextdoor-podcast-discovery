/**
 * Server-side data access for the public podcast site.
 * Use in Server Components only. Do not import in client code.
 */

import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase.server";

import type {
  PodcastCategory,
  PodcastEpisode,
  PodcastEpisodeCategoryRef,
  PodcastEpisodeImage,
  PodcastEpisodeSummary,
  PodcastEpisodeWithSimilarity,
} from "@/lib/podcast.types";

const supabase = () => getSupabaseAdmin();

function normalizeEpisodeCategories(raw: unknown): PodcastEpisodeCategoryRef[] {
  if (!Array.isArray(raw)) return [];
  const out: PodcastEpisodeCategoryRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name : "";
    const slug = typeof o.slug === "string" ? o.slug : "";
    if (!slug || !name) continue;
    out.push({ name, slug });
  }
  return out;
}

function normalizeEpisodeImages(raw: unknown): PodcastEpisodeImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    return {
      description: typeof o.description === "string" ? o.description : null,
      id,
      image_url: typeof o.image_url === "string" ? o.image_url : null,
      sort_order:
        typeof o.sort_order === "number" ? o.sort_order : index,
    };
  });
}

export async function getEpisodesPublished(
  limit = 20,
  offset = 0
): Promise<PodcastEpisodeSummary[]> {
  const { data, error } = await supabase().rpc("get_episodes_published", {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return ((data ?? []) as (PodcastEpisodeSummary & { categories?: unknown })[]).map(
    (row) => ({
      ...row,
      categories: normalizeEpisodeCategories(row.categories),
    })
  );
}

export async function getEpisodeBySlug(
  slug: string
): Promise<PodcastEpisode | null> {
  const { data, error } = await supabase().rpc("get_episode_by_slug", {
    p_slug: slug,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const episode = row as PodcastEpisode & {
    categories?: unknown;
    episode_images?: unknown;
  };
  return {
    ...episode,
    categories: normalizeEpisodeCategories(episode.categories),
    episode_images: normalizeEpisodeImages(episode.episode_images),
  };
}

export async function getEpisodesByCategory(
  categorySlug: string,
  limit = 20,
  offset = 0
): Promise<PodcastEpisodeSummary[]> {
  const { data, error } = await supabase().rpc("get_episodes_by_category", {
    p_category_slug: categorySlug,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return ((data ?? []) as (PodcastEpisodeSummary & { categories?: unknown })[]).map(
    (row) => ({
      ...row,
      categories: normalizeEpisodeCategories(row.categories),
    })
  );
}

export async function searchEpisodesPublished(
  query: string,
  limit = 20,
  offset = 0
): Promise<PodcastEpisodeSummary[]> {
  const { data, error } = await supabase().rpc("search_episodes_published", {
    p_query: query,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return ((data ?? []) as (PodcastEpisodeSummary & { categories?: unknown })[]).map(
    (row) => ({
      ...row,
      categories: normalizeEpisodeCategories(row.categories),
    })
  );
}

export async function getSimilarEpisodes(
  episodeId: string,
  limit = 6
): Promise<PodcastEpisodeWithSimilarity[]> {
  const { data, error } = await supabase().rpc("get_similar_episodes", {
    p_episode_id: episodeId,
    p_limit: limit,
  });
  if (error) throw error;
  return (
    (data ?? []) as (PodcastEpisodeWithSimilarity & { categories?: unknown })[]
  ).map((row) => ({
    ...row,
    categories: normalizeEpisodeCategories(row.categories),
  }));
}

export async function getPodcastCategories(): Promise<PodcastCategory[]> {
  const { data, error } = await supabase().rpc("get_podcast_categories");
  if (error) throw error;
  return (data ?? []) as PodcastCategory[];
}

/**
 * Safe wrappers that return empty data when podcast RPCs are not yet available
 * (e.g. migrations not run). Use in pages to avoid 500 before DB is ready.
 */
export async function getEpisodesPublishedSafe(
  limit = 20,
  offset = 0
): Promise<PodcastEpisodeSummary[]> {
  try {
    return await getEpisodesPublished(limit, offset);
  } catch {
    return [];
  }
}

export async function getEpisodeBySlugSafe(
  slug: string
): Promise<PodcastEpisode | null> {
  try {
    return await getEpisodeBySlug(slug);
  } catch {
    return null;
  }
}

export async function getEpisodesByCategorySafe(
  categorySlug: string,
  limit = 20,
  offset = 0
): Promise<PodcastEpisodeSummary[]> {
  try {
    return await getEpisodesByCategory(categorySlug, limit, offset);
  } catch {
    return [];
  }
}

export async function searchEpisodesPublishedSafe(
  query: string,
  limit = 20,
  offset = 0
): Promise<PodcastEpisodeSummary[]> {
  try {
    return await searchEpisodesPublished(query, limit, offset);
  } catch {
    return [];
  }
}

export async function getSimilarEpisodesSafe(
  episodeId: string,
  limit = 6
): Promise<PodcastEpisodeWithSimilarity[]> {
  try {
    return await getSimilarEpisodes(episodeId, limit);
  } catch {
    return [];
  }
}

export async function getPodcastCategoriesSafe(): Promise<PodcastCategory[]> {
  try {
    return await getPodcastCategories();
  } catch {
    return [];
  }
}
