/**
 * Search query embedding cache: L1 in-memory + optional Redis (Upstash).
 *
 * TTL 5 minutes. Used by POST /api/search and GET /api/search/suggestions.
 * When Redis is configured, identical queries on any serverless instance hit
 * shared cache. When Redis is not set (local dev, tests), in-memory only.
 *
 * Exports clearEmbeddingCacheForTest for test isolation.
 */

import { createHash } from "crypto";

import { getRedis } from "@/lib/redis.server";

const EMBEDDING_CACHE_TTL_MS = 5 * 60 * 1000;
const EMBEDDING_CACHE_TTL_SEC = 300;
const L1_MAX_SIZE = 100;

const embeddingCacheL1 = new Map<
  string,
  { embedding: number[]; expiresAt: number }
>();

function cacheKey(query: string, similarityThreshold: number): string {
  return `${query}:${similarityThreshold}`;
}

function redisKey(query: string, similarityThreshold: number): string {
  const raw = cacheKey(query, similarityThreshold);
  const hash = createHash("sha256").update(raw).digest("hex");
  return `emb:${hash}`;
}

function pruneL1(): void {
  if (embeddingCacheL1.size <= L1_MAX_SIZE) return;
  const oldest = Array.from(embeddingCacheL1.entries()).sort(
    (a, b) => a[1].expiresAt - b[1].expiresAt
  )[0];
  if (oldest) embeddingCacheL1.delete(oldest[0]);
}

/**
 * Get cached embedding: L1 first, then Redis. Returns null on miss.
 */
export async function getCachedEmbedding(
  query: string,
  similarityThreshold: number
): Promise<null | number[]> {
  const key = cacheKey(query, similarityThreshold);
  const entry = embeddingCacheL1.get(key);
  if (entry && Date.now() <= entry.expiresAt) {
    return entry.embedding;
  }
  if (entry) embeddingCacheL1.delete(key);

  const redis = getRedis();
  if (redis) {
    try {
      const rkey = redisKey(query, similarityThreshold);
      const raw = await redis.get(rkey);
      if (raw != null) {
        const embedding = Array.isArray(raw)
          ? (raw as number[])
          : (JSON.parse(raw as string) as number[]);
        if (Array.isArray(embedding) && embedding.length === 1536) {
          embeddingCacheL1.set(key, {
            embedding,
            expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
          });
          pruneL1();
          return embedding;
        }
      }
    } catch {
      // Redis unavailable or parse error: fall through to miss
    }
  }

  return null;
}

/**
 * Store embedding in L1 and Redis (when configured).
 */
export async function setCachedEmbedding(
  query: string,
  similarityThreshold: number,
  embedding: number[]
): Promise<void> {
  const key = cacheKey(query, similarityThreshold);
  embeddingCacheL1.set(key, {
    embedding,
    expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
  });
  pruneL1();

  const redis = getRedis();
  if (redis) {
    try {
      const rkey = redisKey(query, similarityThreshold);
      await redis.set(rkey, embedding, { ex: EMBEDDING_CACHE_TTL_SEC });
    } catch {
      // Non-fatal: L1 is already updated
    }
  }
}

/** Clears the L1 embedding cache. Used by tests for isolation. */
export function clearEmbeddingCacheForTest(): void {
  embeddingCacheL1.clear();
}
