/**
 * Client-side Supabase client (cookies for auth, anon key for RLS).
 * Safe to use in client components.
 */

import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "./env.client";

import type { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient<Database> | null = null;

/**
 * Get the public Supabase client (uses anon key, cookie-based auth).
 * Use for client-side queries and auth (signIn, signOut, getUser).
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    _supabase = createBrowserClient<Database>(
      clientEnv.SUPABASE_URL,
      clientEnv.SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}
