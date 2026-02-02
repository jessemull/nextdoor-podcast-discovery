/**
 * Database types for Supabase.
 *
 * NOTE: These types can be auto-generated using the Supabase CLI:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts
 *
 * For now, these are manually defined to match the schema in
 * database/migrations/001_initial_schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      neighborhoods: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          weight_modifier: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          weight_modifier?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          weight_modifier?: number;
          updated_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          neighborhood_id: string | null;
          cookies_encrypted: string;
          expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          neighborhood_id?: string | null;
          cookies_encrypted: string;
          expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          neighborhood_id?: string | null;
          cookies_encrypted?: string;
          expires_at?: string | null;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          neighborhood_id: string;
          post_id_ext: string;
          user_id_hash: string | null;
          text: string;
          hash: string;
          url: string | null;
          image_urls: Json;
          posted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          neighborhood_id: string;
          post_id_ext: string;
          user_id_hash?: string | null;
          text: string;
          hash: string;
          url?: string | null;
          image_urls?: Json;
          posted_at?: string | null;
          created_at?: string;
        };
        Update: {
          neighborhood_id?: string;
          post_id_ext?: string;
          user_id_hash?: string | null;
          text?: string;
          hash?: string;
          url?: string | null;
          image_urls?: Json;
          posted_at?: string | null;
        };
      };
      llm_scores: {
        Row: {
          id: string;
          post_id: string;
          absurdity: number | null;
          humor: number | null;
          drama: number | null;
          relatability: number | null;
          podcast_score: number | null;
          tags: Json;
          summary: string | null;
          processed_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          absurdity?: number | null;
          humor?: number | null;
          drama?: number | null;
          relatability?: number | null;
          podcast_score?: number | null;
          tags?: Json;
          summary?: string | null;
          processed_at?: string;
        };
        Update: {
          absurdity?: number | null;
          humor?: number | null;
          drama?: number | null;
          relatability?: number | null;
          podcast_score?: number | null;
          tags?: Json;
          summary?: string | null;
        };
      };
      post_embeddings: {
        Row: {
          id: string;
          post_id: string;
          embedding: number[] | null;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          embedding?: number[] | null;
          model?: string;
          created_at?: string;
        };
        Update: {
          embedding?: number[] | null;
          model?: string;
        };
      };
      rankings: {
        Row: {
          id: string;
          post_id: string;
          final_score: number;
          used_on_episode: boolean;
          episode_date: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          final_score?: number;
          used_on_episode?: boolean;
          episode_date?: string | null;
          updated_at?: string;
        };
        Update: {
          final_score?: number;
          used_on_episode?: boolean;
          episode_date?: string | null;
          updated_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
      };
    };
  };
}
