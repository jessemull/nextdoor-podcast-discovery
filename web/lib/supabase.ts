/**
 * Supabase client initialization with lazy loading.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy-initialized client instances
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Get the public Supabase client (uses anon key).
 * Use this for client-side queries with Row Level Security.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    _supabase = createClient(url, anonKey);
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
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !serviceKey) {
      throw new Error("Missing Supabase admin environment variables");
    }

    _supabaseAdmin = createClient(url, serviceKey);
  }
  return _supabaseAdmin;
}
