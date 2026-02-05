/**
 * Database types for Supabase.
 *
 * NOTE: These types can be auto-generated using the Supabase CLI:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts
 *
 * Manually updated to match the schema after 002_llm_scoring_schema.sql migration.
 */

export type Json =
  | { [key: string]: Json | undefined }
  | boolean
  | Json[]
  | null
  | number
  | string;

export interface Database {
  public: {
    Tables: {
      llm_scores: {
        Insert: {
          categories?: string[];
          created_at?: string;
          final_score?: null | number;
          id?: string;
          model_version?: string;
          post_id: string;
          scores: Json;
          summary?: null | string;
        };
        Row: {
          categories: string[];
          created_at: string;
          final_score: null | number;
          id: string;
          model_version: string;
          post_id: string;
          scores: Json;
          summary: null | string;
        };
        Update: {
          categories?: string[];
          final_score?: null | number;
          model_version?: string;
          scores?: Json;
          summary?: null | string;
        };
      };
      neighborhoods: {
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        Update: {
          name?: string;
          slug?: string;
        };
      };
      posts: {
        Insert: {
          created_at?: string;
          episode_date?: null | string;
          hash: string;
          id?: string;
          image_urls?: Json;
          neighborhood_id: string;
          post_id_ext: string;
          text: string;
          url?: null | string;
          used_on_episode?: boolean;
          user_id_hash?: null | string;
        };
        Row: {
          created_at: string;
          episode_date: null | string;
          hash: string;
          id: string;
          image_urls: Json;
          neighborhood_id: string;
          post_id_ext: string;
          text: string;
          url: null | string;
          used_on_episode: boolean;
          user_id_hash: null | string;
        };
        Update: {
          episode_date?: null | string;
          hash?: string;
          image_urls?: Json;
          neighborhood_id?: string;
          post_id_ext?: string;
          text?: string;
          url?: null | string;
          used_on_episode?: boolean;
          user_id_hash?: null | string;
        };
      };
      sessions: {
        Insert: {
          cookies_encrypted: string;
          expires_at?: null | string;
          id?: string;
          neighborhood_id?: null | string;
          updated_at?: string;
        };
        Row: {
          cookies_encrypted: string;
          expires_at: null | string;
          id: string;
          neighborhood_id: null | string;
          updated_at: string;
        };
        Update: {
          cookies_encrypted?: string;
          expires_at?: null | string;
          neighborhood_id?: null | string;
          updated_at?: string;
        };
      };
      settings: {
        Insert: {
          id?: string;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Row: {
          id: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
      };
      topic_frequencies: {
        Insert: {
          category: string;
          count_30d?: number;
          id?: string;
          last_updated?: string;
        };
        Row: {
          category: string;
          count_30d: number;
          id: string;
          last_updated: string;
        };
        Update: {
          category?: string;
          count_30d?: number;
          last_updated?: string;
        };
      };
    };
  };
}
