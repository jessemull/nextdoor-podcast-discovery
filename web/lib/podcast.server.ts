/**
 * Server-side data access for the public podcast site.
 * Use in Server Components only. Do not import in client code.
 */

import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase.server";

import type {
  PodcastCategory,
  PodcastEpisode,
  PodcastEpisodeSummary,
  PodcastEpisodeWithSimilarity,
} from "@/lib/podcast.types";

const supabase = () => getSupabaseAdmin();

export async function getEpisodesPublished(
  limit = 20,
  offset = 0
): Promise<PodcastEpisodeSummary[]> {
  const { data, error } = await supabase().rpc("get_episodes_published", {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as PodcastEpisodeSummary[];
}

export async function getEpisodeBySlug(
  slug: string
): Promise<PodcastEpisode | null> {
  const { data, error } = await supabase().rpc("get_episode_by_slug", {
    p_slug: slug,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as PodcastEpisode | null;
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
  return (data ?? []) as PodcastEpisodeSummary[];
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
  return (data ?? []) as PodcastEpisodeSummary[];
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
  return (data ?? []) as PodcastEpisodeWithSimilarity[];
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
