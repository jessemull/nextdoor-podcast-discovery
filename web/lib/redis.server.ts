/**
 * Shared Redis client (Upstash) for serverless caching.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, returns
 * a Redis instance. Otherwise returns null so callers fall back to in-memory
 * behavior (local dev, tests).
 *
 * Keys are prefixed by environment (VERCEL_ENV or "development") so one Redis
 * instance can serve both Preview and Production without collision.
 *
 * Key patterns (after prefix): <prefix>:active_config_id, <prefix>:emb:<hash>,
 * <prefix>:sports_fact, <prefix>:sports_fact_rl:<userId>:<bucket>
 * TTLs: active_config 45s, embedding 300s, sports_fact 300s, rate-limit buckets 1h.
 */

import { Redis } from "@upstash/redis";

let redisClient: null | Redis = null;

function getRedisClient(): null | Redis {
  if (redisClient != null) {
    return redisClient;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redisClient = Redis.fromEnv();
    return redisClient;
  }
  return null;
}

/**
 * Environment prefix for Redis keys so Preview and Production share one Redis
 * without key collision. Vercel sets VERCEL_ENV to "production" or "preview".
 */
export function getRedisKeyPrefix(): string {
  return process.env.VERCEL_ENV ?? "development";
}

/**
 * Returns the Redis client when Upstash env vars are configured; otherwise null.
 * Use for embedding cache, active config cache, and optional response caches.
 */
export function getRedis(): null | Redis {
  return getRedisClient();
}
