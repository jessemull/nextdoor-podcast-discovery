/**
 * Database types for Supabase.
 *
 * NOTE: These types can be auto-generated using the Supabase CLI:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts
 *
 * For now, these are manually defined to match the schema in
 * database/migrations/001_initial_schema.sql
 *
 * IMPORTANT: These types reflect the raw database schema where fields can be null.
 * The UI types in `types.ts` also allow nulls but are kept separate for clarity.
 * When updating the database schema, update BOTH files:
 *   1. database/migrations/*.sql - the source of truth
 *   2. lib/database.types.ts - for Supabase client type safety
 *   3. lib/types.ts - for UI components (subset of fields, same null handling)
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
          absurdity?: null | number;
          drama?: null | number;
          humor?: null | number;
          id?: string;
          podcast_score?: null | number;
          post_id: string;
          processed_at?: string;
          relatability?: null | number;
          summary?: null | string;
          tags?: Json;
        };
        Row: {
          absurdity: null | number;
          drama: null | number;
          humor: null | number;
          id: string;
          podcast_score: null | number;
          post_id: string;
          processed_at: string;
          relatability: null | number;
          summary: null | string;
          tags: Json;
        };
        Update: {
          absurdity?: null | number;
          drama?: null | number;
          humor?: null | number;
          podcast_score?: null | number;
          relatability?: null | number;
          summary?: null | string;
          tags?: Json;
        };
      };
      neighborhoods: {
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
          weight_modifier?: number;
        };
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          updated_at: string;
          weight_modifier: number;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
          weight_modifier?: number;
        };
      };
      post_embeddings: {
        Insert: {
          created_at?: string;
          embedding?: null | number[];
          id?: string;
          model?: string;
          post_id: string;
        };
        Row: {
          created_at: string;
          embedding: null | number[];
          id: string;
          model: string;
          post_id: string;
        };
        Update: {
          embedding?: null | number[];
          model?: string;
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
          posted_at?: null | string;
          text: string;
          url?: null | string;
          user_id_hash?: null | string;
        };
        Row: {
          created_at: string;
          hash: string;
          id: string;
          image_urls: Json;
          neighborhood_id: string;
          post_id_ext: string;
          posted_at: null | string;
          text: string;
          url: null | string;
          user_id_hash: null | string;
        };
        Update: {
          hash?: string;
          image_urls?: Json;
          neighborhood_id?: string;
          post_id_ext?: string;
          posted_at?: null | string;
          text?: string;
          url?: null | string;
          user_id_hash?: null | string;
        };
      };
      rankings: {
        Insert: {
          episode_date?: null | string;
          final_score?: number;
          id?: string;
          post_id: string;
          updated_at?: string;
          used_on_episode?: boolean;
        };
        Row: {
          episode_date: null | string;
          final_score: number;
          id: string;
          post_id: string;
          updated_at: string;
          used_on_episode: boolean;
        };
        Update: {
          episode_date?: null | string;
          final_score?: number;
          updated_at?: string;
          used_on_episode?: boolean;
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
    };
  };
}
