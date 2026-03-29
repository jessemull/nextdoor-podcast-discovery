/**
 * Client-side Supabase client (cookies for auth, anon key for RLS).
 * Safe to use in client components.
 *
 * Only created in the browser so the PKCE code verifier is stored in
 * cookies (document.cookie). If created during SSR, @supabase/ssr uses
 * a no-op storage and the verifier is never persisted, so password reset
 * fails with "PKCE code verifier not found".
 */

import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "./env.client";

import type { Database } from "./database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient<Database> | null = null;

/**
 * Get the public Supabase client (uses anon key, cookie-based auth).
 * Use for client-side queries and auth (signIn, signOut, getUser).
 * Only creates the client in the browser so PKCE verifier is stored in cookies.
 */
export function getSupabase(): SupabaseClient<Database> {
  const inBrowser = typeof window !== "undefined";
  if (inBrowser && !_supabase) {
    _supabase = createBrowserClient<Database>(
      clientEnv.SUPABASE_URL,
      clientEnv.SUPABASE_ANON_KEY,
      {
        cookieOptions: {
          maxAge: 60 * 60 * 24 * 400, // ~400 days, match @supabase/ssr default
          path: "/",
          sameSite: "lax",
        },
      }
    );
  }
  if (_supabase) return _supabase;
  // SSR or pre-render: create a one-off client (not used for auth that needs storage)
  return createBrowserClient<Database>(
    clientEnv.SUPABASE_URL,
    clientEnv.SUPABASE_ANON_KEY
  );
}
