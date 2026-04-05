"use client";

import type { Database } from "./database.types";
import type { GoTrueMFAApi } from "@supabase/auth-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * MFA helpers on Supabase Auth are not surfaced on the Database-generic client
 * type; this narrows to the runtime GoTrue MFA API without `as any` at call sites.
 */
export function getMfaApi(client: SupabaseClient<Database>): GoTrueMFAApi {
  return (client.auth as { mfa: GoTrueMFAApi }).mfa;
}
