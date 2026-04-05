/**
 * Shared TTL cache and per-user rate limit for /api/sports-fact (Claude cost control).
 *
 * Global cache: one fact per TTL window for all users (acceptable for a random sidebar fact).
 * Rate limit: applies only on cache miss, before calling Claude.
 */

import "server-only";

import { getRedis, getRedisKeyPrefix } from "@/lib/redis.server";

const CACHE_TTL_SEC = 300;

const L1_TTL_MS = CACHE_TTL_SEC * 1000;

const RATE_LIMIT_MAX_MISSES_PER_WINDOW = 12;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  fact: string;
}

let cacheL1: CacheEntry | null = null;

interface MemoryRateEntry {
  count: number;
  windowStart: number;
}

const rateLimitMemory = new Map<string, MemoryRateEntry>();

function redisCacheKey(): string {
  return `${getRedisKeyPrefix()}:sports_fact`;
}

function redisRateKey(userId: string, bucket: number): string {
  return `${getRedisKeyPrefix()}:sports_fact_rl:${userId}:${bucket}`;
}

/**
 * Clears in-memory cache and rate-limit map. For Vitest only.
 */
export function resetSportsFactServerStateForTests(): void {
  cacheL1 = null;
  rateLimitMemory.clear();
}

export async function getCachedSportsFact(): Promise<null | string> {
  const now = Date.now();

  if (cacheL1 != null && cacheL1.expiresAt > now) {
    return cacheL1.fact;
  }

  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(redisCacheKey());
      if (raw != null && typeof raw === "string" && raw.length > 0) {
        cacheL1 = {
          expiresAt: now + L1_TTL_MS,
          fact: raw,
        };

        return raw;
      }
    } catch {
      // Redis unavailable: fall through to miss
    }
  }

  return null;
}

export async function setCachedSportsFact(fact: string): Promise<void> {
  const now = Date.now();

  cacheL1 = {
    expiresAt: now + L1_TTL_MS,
    fact,
  };

  const redis = getRedis();
  if (redis && fact.length > 0) {
    try {
      await redis.set(redisCacheKey(), fact, { ex: CACHE_TTL_SEC });
    } catch {
      // Non-fatal
    }
  }
}

function checkRateLimitMemory(userId: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const entry = rateLimitMemory.get(userId);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMemory.set(userId, { count: 1, windowStart: now });

    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_MISSES_PER_WINDOW) {
    const retryAfterSec = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000
    );

    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  entry.count += 1;

  return { allowed: true };
}

/**
 * Records one cache-miss attempt for this user. Call only when about to invoke Claude.
 */
export async function consumeSportsFactRateLimit(
  userId: string
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const redis = getRedis();
  if (!redis) {
    return checkRateLimitMemory(userId);
  }

  const bucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const key = redisRateKey(userId, bucket);

  try {
    const n = await redis.incr(key);

    if (n === 1) {
      await redis.expire(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
    }

    if (n > RATE_LIMIT_MAX_MISSES_PER_WINDOW) {
      const windowEnd = (bucket + 1) * RATE_LIMIT_WINDOW_MS;
      const retryAfterSec = Math.ceil((windowEnd - Date.now()) / 1000);

      return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
    }

    return { allowed: true };
  } catch {
    return checkRateLimitMemory(userId);
  }
}
