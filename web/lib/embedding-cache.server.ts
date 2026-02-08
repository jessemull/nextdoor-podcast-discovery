/**
 * In-memory cache for search query embeddings.
 * TTL 5 minutes. Used by POST /api/search for semantic search.
 *
 * Exports clearEmbeddingCacheForTest for test isolation; tests should
 * call it in beforeEach to avoid cross-test contamination.
 */

const EMBEDDING_CACHE_TTL_MS = 5 * 60 * 1000;
const embeddingCache = new Map<
  string,
  { embedding: number[]; expiresAt: number }
>();

export function getCachedEmbedding(
  query: string,
  similarityThreshold: number
): null | number[] {
  const key = `${query}:${similarityThreshold}`;
  const entry = embeddingCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) embeddingCache.delete(key);
    return null;
  }
  return entry.embedding;
}

export function setCachedEmbedding(
  query: string,
  similarityThreshold: number,
  embedding: number[]
): void {
  const key = `${query}:${similarityThreshold}`;
  embeddingCache.set(key, {
    embedding,
    expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
  });
  if (embeddingCache.size > 100) {
    const oldest = Array.from(embeddingCache.entries()).sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    )[0];
    if (oldest) embeddingCache.delete(oldest[0]);
  }
}

/** Clears the embedding cache. Used by tests for isolation. */
export function clearEmbeddingCacheForTest(): void {
  embeddingCache.clear();
}
