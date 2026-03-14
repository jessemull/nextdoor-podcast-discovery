import {
  getEpisodesPublishedSafe,
  getPodcastCategoriesSafe,
} from "@/lib/podcast.server";
import { siteBaseUrl } from "@/lib/site-url.server";

import type { MetadataRoute } from "next";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBaseUrl;

  const staticPages: MetadataRoute.Sitemap = [
    { changeFrequency: "daily", priority: 1, url: base },
    { changeFrequency: "daily", priority: 0.9, url: `${base}/episodes` },
    { changeFrequency: "weekly", priority: 0.8, url: `${base}/categories` },
    { changeFrequency: "monthly", priority: 0.5, url: `${base}/about` },
    { changeFrequency: "monthly", priority: 0.5, url: `${base}/subscribe` },
    { changeFrequency: "weekly", priority: 0.6, url: `${base}/search` },
  ];

  let episodes: Awaited<ReturnType<typeof getEpisodesPublishedSafe>> = [];
  let categories: Awaited<ReturnType<typeof getPodcastCategoriesSafe>> = [];
  try {
    [episodes, categories] = await Promise.all([
      getEpisodesPublishedSafe(1000, 0),
      getPodcastCategoriesSafe(),
    ]);
  } catch {
    // RPCs not available
  }

  const episodeUrls: MetadataRoute.Sitemap = episodes.map((ep) => ({
    changeFrequency: "monthly" as const,
    lastModified: ep.published_at ? new Date(ep.published_at) : undefined,
    priority: 0.7,
    url: `${base}/episodes/${ep.slug}`,
  }));

  const categoryUrls: MetadataRoute.Sitemap = categories.map((cat) => ({
    changeFrequency: "weekly" as const,
    priority: 0.6,
    url: `${base}/categories/${cat.slug}`,
  }));

  return [...staticPages, ...episodeUrls, ...categoryUrls];
}
