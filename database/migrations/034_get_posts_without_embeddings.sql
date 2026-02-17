-- Migration: Add get_posts_without_embeddings RPC for chunked embedder
-- Run this in Supabase SQL Editor after 033_runtime_scores_rpc.sql
--
-- Returns posts that have text but no embedding (for chunked processing).
-- Limit parameter controls chunk size; ORDER BY id for stable pagination.

CREATE OR REPLACE FUNCTION get_posts_without_embeddings(lim INT DEFAULT 500)
RETURNS TABLE (id UUID, text TEXT) AS $$
  SELECT p.id, p.text
  FROM posts p
  LEFT JOIN post_embeddings pe ON p.id = pe.post_id
  WHERE pe.post_id IS NULL
    AND p.text IS NOT NULL
    AND trim(p.text) != ''
  ORDER BY p.id
  LIMIT lim;
$$ LANGUAGE sql STABLE;
