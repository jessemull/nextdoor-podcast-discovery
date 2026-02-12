/**
 * Server-side Supabase client with admin privileges.
 * 
 * This module should ONLY be imported in:
 * - API routes (app/api/)
 * - Server components
 * - Server actions
 * 
 * NEVER import this in client components or "use client" files.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "server-only";

import { env } from "./env.server";

import type { Database } from "./database.types";

// Use 'any' for the client so incomplete Database types don't produce 'never'
// for tables/RPCs. The DB schema is correct at runtime; types are hand-maintained.
// Types can be tightened over time as database.types.ts is updated or generated.
let _supabaseAdmin: null | SupabaseClient<any> = null;

/**
 * Get the admin Supabase client (uses service key).
 * Use this for server-side operations that bypass RLS.
 * Never expose this client to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient<any> {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY
    ) as SupabaseClient<any>;
  }
  return _supabaseAdmin;
}
