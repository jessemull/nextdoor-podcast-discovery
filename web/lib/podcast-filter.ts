import type { PodcastEpisodeSummary } from "@/lib/podcast.types";

/**
 * Matches client-side episode search in PodcastEpisodeList (title + description).
 */
export function filterPodcastEpisodesByQuery(
  episodes: PodcastEpisodeSummary[],
  query: string
): PodcastEpisodeSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return episodes;
  }
  return episodes.filter((ep) => {
    const desc = (ep.description ?? "").toLowerCase();
    const title = (ep.title ?? "").toLowerCase();
    return desc.includes(q) || title.includes(q);
  });
}
