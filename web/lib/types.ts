// Database types for UI layer
// NOTE: These types are used in the UI and may differ slightly from database.types.ts
// The database types allow nulls, but these represent the expected shape after validation

export interface ErrorResponse {
  error: string;
}

export interface LLMScore {
  absurdity: null | number;
  drama: null | number;
  humor: null | number;
  id: string;
  podcast_score: null | number;
  post_id: string;
  processed_at: string;
  relatability: null | number;
  summary: null | string;
  tags: string[];
}

export interface Neighborhood {
  created_at: string;
  id: string;
  is_active: boolean;
  name: string;
  slug: string;
  updated_at: string;
  weight_modifier: number;
}

export interface Post {
  created_at: string;
  hash: string;
  id: string;
  image_urls: string[];
  neighborhood_id: string;
  post_id_ext: string;
  posted_at: null | string;
  text: string;
  url: null | string;
  user_id_hash: null | string;
}

/**
 * Post embedding record.
 * NOTE: The `embedding` field contains 1536 floats and should NOT be
 * fetched in normal queries. Use Supabase RPC for similarity search.
 */
export interface PostEmbedding {
  created_at: string;
  embedding: number[];
  id: string;
  model: string;
  post_id: string;
}

// Combined types for API responses

export interface PostWithScores extends Post {
  llm_scores: LLMScore | null;
  neighborhood: Neighborhood;
  rankings: null | Ranking;
}

export interface Ranking {
  episode_date: null | string;
  final_score: number;
  id: string;
  post_id: string;
  updated_at: string;
  used_on_episode: boolean;
}

export interface RankingWeights {
  absurdity: number;
  drama: number;
  humor: number;
  relatability: number;
}

export interface Settings {
  id: string;
  key: string;
  updated_at: string;
  value: Record<string, unknown>;
}

// API response types

export interface SportsFactResponse {
  fact: string;
  source?: "api" | "fallback";
}
