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
      background_jobs: {
        Insert: {
          cancelled_at?: null | string;
          cancelled_by?: null | string;
          completed_at?: null | string;
          created_at?: string;
          created_by?: null | string;
          error_message?: null | string;
          id?: string;
          params?: Json;
          progress?: null | number;
          started_at?: null | string;
          status: string;
          total?: null | number;
          type: string;
          updated_at?: string;
        };
        Row: {
          cancelled_at: null | string;
          cancelled_by: null | string;
          completed_at: null | string;
          created_at: string;
          created_by: null | string;
          error_message: null | string;
          id: string;
          params: Json;
          progress: null | number;
          started_at: null | string;
          status: string;
          total: null | number;
          type: string;
          updated_at: string;
        };
        Update: {
          cancelled_at?: null | string;
          cancelled_by?: null | string;
          completed_at?: null | string;
          created_at?: string;
          created_by?: null | string;
          error_message?: null | string;
          params?: Json;
          progress?: null | number;
          started_at?: null | string;
          status?: string;
          total?: null | number;
          updated_at?: string;
        };
      };
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
          why_podcast_worthy?: null | string;
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
          why_podcast_worthy: null | string;
        };
        Update: {
          categories?: string[];
          final_score?: null | number;
          model_version?: string;
          scores?: Json;
          summary?: null | string;
          why_podcast_worthy?: null | string;
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
          hash: string;
          id?: string;
          image_urls?: Json;
          neighborhood_id: string;
          post_id_ext: string;
          reaction_count?: number;
          text: string;
          url?: null | string;
          used_on_episode?: boolean;
          user_id_hash?: null | string;
        };
        Row: {
          created_at: string;
          hash: string;
          id: string;
          image_urls: Json;
          neighborhood_id: string;
          post_id_ext: string;
          reaction_count: number;
          text: string;
          url: null | string;
          used_on_episode: boolean;
          user_id_hash: null | string;
        };
        Update: {
          hash?: string;
          image_urls?: Json;
          neighborhood_id?: string;
          post_id_ext?: string;
          reaction_count?: number;
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
      weight_configs: {
        Insert: {
          created_at?: string;
          created_by?: null | string;
          description?: null | string;
          id?: string;
          is_active?: boolean;
          name?: null | string;
          weights: Json;
        };
        Row: {
          created_at: string;
          created_by: null | string;
          description: null | string;
          id: string;
          is_active: boolean;
          name: null | string;
          weights: Json;
        };
        Update: {
          created_at?: string;
          created_by?: null | string;
          description?: null | string;
          is_active?: boolean;
          name?: null | string;
          weights?: Json;
        };
      };
    };
  };
}
