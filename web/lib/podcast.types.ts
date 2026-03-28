/**
 * Types for podcast episodes and categories (public site).
 */

export interface PodcastEpisodeImage {
  description: string | null;
  id: string;
  image_url: string | null;
  sort_order: number;
}

export interface PodcastEpisode {
  about_episode: string | null;
  audio_storage_path: string | null;
  audio_url: string | null;
  created_at: string;
  description: string | null;
  duration_seconds: number | null;
  episode_images: PodcastEpisodeImage[];
  id: string;
  image_description: string | null;
  image_storage_path: string | null;
  image_url: string | null;
  published_at: string | null;
  show_notes: string | null;
  slug: string;
  title: string;
  transcript: string | null;
  updated_at?: string;
}

export interface PodcastEpisodeSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  audio_url: string | null;
  created_at: string;
}

export interface PodcastEpisodeWithSimilarity extends PodcastEpisodeSummary {
  similarity: number;
}

export interface PodcastCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}
