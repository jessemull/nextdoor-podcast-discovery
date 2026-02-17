/**
 * Shared Redis client (Upstash) for serverless caching.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, returns
 * a Redis instance. Otherwise returns null so callers fall back to in-memory
 * behavior (local dev, tests).
 *
 * Redis keys and TTLs (used by embedding and active-config caches):
 *
 * | Key pattern              | Value           | TTL    | Commands (approx)        |
 * | ------------------------ | --------------- | ------ | ------------------------ |
 * | emb:<sha256(query:thr)>  | JSON float[]    | 300 s  | 1 GET hit, 1 SET+GET miss |
 * | active_config_id         | UUID string     | 45 s   | 1 GET hit, 1 SET on miss; 1 DEL on invalidate |
 *
 * Upstash free tier: 500K commands/month. Typical usage: ~2 per semantic search,
 * 1–2 per feed/settings request; well within limit for small team.
 */

import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
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
 * Returns the Redis client when Upstash env vars are configured; otherwise null.
 * Use for embedding cache, active config cache, and optional response caches.
 */
export function getRedis(): Redis | null {
  return getRedisClient();
}
