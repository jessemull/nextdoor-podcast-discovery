// Database types

export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  weight_modifier: number;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  neighborhood_id: string;
  post_id_ext: string;
  user_id_hash: string | null;
  text: string;
  hash: string;
  url: string | null;
  image_urls: string[];
  posted_at: string | null;
  created_at: string;
}

export interface LLMScore {
  id: string;
  post_id: string;
  absurdity: number;
  humor: number;
  drama: number;
  relatability: number;
  podcast_score: number;
  tags: string[];
  summary: string;
  processed_at: string;
}

export interface PostEmbedding {
  id: string;
  post_id: string;
  embedding: number[];
  model: string;
  created_at: string;
}

export interface Ranking {
  id: string;
  post_id: string;
  final_score: number;
  used_on_episode: boolean;
  episode_date: string | null;
  updated_at: string;
}

export interface Settings {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

// Combined types for API responses

export interface PostWithScores extends Post {
  llm_scores: LLMScore | null;
  rankings: Ranking | null;
  neighborhood: Neighborhood;
}

export interface RankingWeights {
  absurdity: number;
  humor: number;
  drama: number;
  relatability: number;
}

// API response types

export interface SportsFactResponse {
  fact: string;
}

export interface ErrorResponse {
  error: string;
}
