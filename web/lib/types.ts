// Database types for UI layer
// NOTE: These types are used in the UI and may differ slightly from database.types.ts

export interface ErrorResponse {
  error: string;
}

// Individual dimension scores from Claude
export interface DimensionScores {
  absurdity: number;
  discussion_spark: number;
  drama: number;
  emotional_intensity: number;
  news_value: number;
  podcast_worthy?: number;
  readability?: number;
}

// LLM scoring result
export interface LLMScore {
  categories: string[];
  created_at: string;
  final_score: null | number;
  id: string;
  model_version: string;
  post_id: string;
  scores: DimensionScores;
  summary: null | string;
  why_podcast_worthy: null | string;
}

export interface Neighborhood {
  created_at: string;
  id: string;
  name: string;
  slug: string;
}

export interface Post {
  created_at: string;
  episode_date: null | string;
  hash: string;
  id: string;
  image_urls: string[];
  neighborhood_id: string;
  post_id_ext: string;
  reaction_count?: number;
  saved?: boolean;
  text: string;
  url: null | string;
  used_on_episode: boolean;
  user_id_hash: null | string;
}

// Combined type for API responses
export interface PostWithScores extends Post {
  llm_scores: LLMScore | null;
  neighborhood: Neighborhood | null;
}

// Search results include similarity score from vector search
export interface PostWithScoresAndSimilarity extends PostWithScores {
  similarity?: number;
}

// Topic frequency for novelty tracking
export interface TopicFrequency {
  category: string;
  count_30d: number;
  last_updated: string;
}

export interface RankingWeights {
  absurdity: number;
  discussion_spark: number;
  drama: number;
  emotional_intensity: number;
  news_value: number;
  readability?: number;
}

export interface Settings {
  id: string;
  key: string;
  updated_at: string;
  value: Record<string, unknown>;
}

/**
 * Job parameters for background jobs.
 * Each job type may have different params structure.
 */
export interface JobParams {
  [key: string]: unknown;
  weight_config_id?: string;
}

// API response types

export interface SportsFactResponse {
  fact: string;
  source?: "api" | "fallback";
}

export interface PostsResponse {
  data: PostWithScores[];
  total: number;
}

export interface StatsResponse {
  embedding_backlog: number;
  last_scrape_at: null | string;
  posts_last_24h: number;
  posts_scored: number;
  posts_total: number;
  posts_unscored: number;
  posts_used: number;
  top_categories: TopicFrequency[];
}
