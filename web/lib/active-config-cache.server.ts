/**
 * Active weight config ID cache: L1 in-memory + optional Redis (Upstash).
 *
 * TTL 45 seconds. When Redis is configured, all serverless instances share
 * the same value. When Redis is not set (local dev, tests), in-memory only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRedis } from "@/lib/redis.server";

const TTL_MS = 45_000;
const TTL_SEC = 45;
const REDIS_KEY = "active_config_id";

interface CacheEntry {
  expiresAt: number;
  value: null | string;
}

let cacheL1: CacheEntry | null = null;

/**
 * Invalidate the cache. Call after activate or settings update.
 * Clears L1 and Redis (when configured).
 */
export async function invalidateActiveConfigCache(): Promise<void> {
  cacheL1 = null;
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(REDIS_KEY);
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Get active weight config ID with TTL cache.
 *
 * Checks L1 first, then Redis; on miss, fetches from DB and populates both.
 */
export async function getActiveWeightConfigId(
  supabase: SupabaseClient
): Promise<null | string> {
  const now = Date.now();
  if (cacheL1 != null && cacheL1.expiresAt > now) {
    return cacheL1.value;
  }

  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(REDIS_KEY);
      if (raw != null && typeof raw === "string") {
        cacheL1 = {
          expiresAt: now + TTL_MS,
          value: raw,
        };
        return raw;
      }
    } catch {
      // Redis unavailable: fall through to DB
    }
  }

  const value = await fetchActiveWeightConfigId(supabase);
  cacheL1 = {
    expiresAt: now + TTL_MS,
    value,
  };

  if (redis && value != null) {
    try {
      await redis.set(REDIS_KEY, value, { ex: TTL_SEC });
    } catch {
      // Non-fatal: L1 is already updated
    }
  }

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
