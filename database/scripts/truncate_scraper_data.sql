-- Wipe all post-related data for a clean scrape (no ads, no duplicates).
-- Run in Supabase SQL Editor when you want to re-scrape from scratch.
--
-- Truncates: post_scores, llm_scores, post_embeddings, posts (in one go;
-- CASCADE clears any other tables that reference posts). Resets
-- topic_frequencies counts so novelty is fresh. Sessions and neighborhoods
-- are kept so you stay logged in and neighborhood lookups still work.

TRUNCATE post_scores, llm_scores, post_embeddings, posts
  RESTART IDENTITY
  CASCADE;

-- Reset 30-day topic counts so novelty adjustment starts fresh
UPDATE topic_frequencies
SET count_30d = 0,
    last_updated = NOW();
