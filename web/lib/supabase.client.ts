/**
 * Client-side Supabase client with Row Level Security.
 * 
 * Safe to use in client components.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { clientEnv } from "./env.client";

import type { Database } from "./database.types";

let _supabase: null | SupabaseClient<Database> = null;

/**
 * Get the public Supabase client (uses anon key).
 * Use this for client-side queries with Row Level Security.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    _supabase = createClient<Database>(
      clientEnv.SUPABASE_URL,
      clientEnv.SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}
