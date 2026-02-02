/**
 * Supabase client initialization with lazy loading.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { env, clientEnv } from "./env";

// Lazy-initialized client instances
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Get the public Supabase client (uses anon key).
 * Use this for client-side queries with Row Level Security.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(clientEnv.SUPABASE_URL, clientEnv.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

/**
 * Get the admin Supabase client (uses service key).
 * Use this for server-side operations that bypass RLS.
 * Never expose this client to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  }
  return _supabaseAdmin;
}
