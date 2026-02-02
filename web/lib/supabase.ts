/**
 * Supabase client initialization with lazy loading and type safety.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { env, clientEnv } from "./env";
import type { Database } from "./database.types";

// Lazy-initialized client instances
let _supabase: SupabaseClient<Database> | null = null;
let _supabaseAdmin: SupabaseClient<Database> | null = null;

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

/**
 * Get the admin Supabase client (uses service key).
 * Use this for server-side operations that bypass RLS.
 * Never expose this client to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY
    );
  }
  return _supabaseAdmin;
}
