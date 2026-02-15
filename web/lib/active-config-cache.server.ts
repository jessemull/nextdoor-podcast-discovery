/**
 * In-memory cache for the active weight config ID.
 *
 * TTL 45 seconds to avoid repeated DB lookups during request bursts.
 * Serverless instances are ephemeral; cache is per-instance.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const TTL_MS = 45_000;

interface CacheEntry {
  expiresAt: number;
  value: null | string;
}

let cache: CacheEntry | null = null;

/**
 * Invalidate the cache. Call after activate or settings update.
 */
export function invalidateActiveConfigCache(): void {
  cache = null;
}

/**
 * Get active weight config ID with TTL cache.
 *
 * Checks cache first; on miss, fetches from DB (settings, then weight_configs fallback).
 */
export async function getActiveWeightConfigId(
  supabase: SupabaseClient
): Promise<null | string> {
  const now = Date.now();
  if (cache != null && cache.expiresAt > now) {
    return cache.value;
  }

  const value = await fetchActiveWeightConfigId(supabase);
  cache = {
    expiresAt: now + TTL_MS,
    value,
  };
  return value;
}

async function fetchActiveWeightConfigId(
  supabase: SupabaseClient
): Promise<null | string> {
  const activeConfigResult = await supabase
    .from("settings")
    .select("value")
    .eq("key", "active_weight_config_id")
    .single();

  let activeConfigId: null | string =
    activeConfigResult.data?.value &&
    typeof activeConfigResult.data.value === "string"
      ? activeConfigResult.data.value
      : null;

  if (!activeConfigId) {
    const configResult = await supabase
      .from("weight_configs")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (configResult.data) {
      activeConfigId = configResult.data.id as string;
      await supabase
        .from("settings")
        .upsert(
          { key: "active_weight_config_id", value: activeConfigId },
          { onConflict: "key" }
        );
    }
  }

  return activeConfigId;
}
