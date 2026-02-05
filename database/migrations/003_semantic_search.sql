-- Migration: Add semantic search RPC function
-- Run this in Supabase SQL Editor after 002_llm_scoring_schema.sql
--
-- Adds RPC function for vector similarity search using pgvector

-- ============================================================================
-- Semantic Search Function
-- ============================================================================

-- RPC function to search posts by semantic similarity
-- Takes a query embedding vector and returns similar posts
CREATE OR REPLACE FUNCTION search_posts_by_embedding(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.5,
    result_limit INT DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    text TEXT,
    similarity DOUBLE PRECISION,
    created_at TIMESTAMPTZ,
    neighborhood_id UUID,
    post_id_ext TEXT,
    url TEXT,
    user_id_hash TEXT,
    image_urls JSONB,
    hash TEXT,
    used_on_episode BOOLEAN,
    episode_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.text,
        (1 - (pe.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
        p.created_at,
        p.neighborhood_id,
        p.post_id_ext::TEXT,
        p.url::TEXT,
        p.user_id_hash::TEXT,
        p.image_urls,
        p.hash::TEXT,
        COALESCE(p.used_on_episode, false),
        p.episode_date
    FROM posts p
    INNER JOIN post_embeddings pe ON p.id = pe.post_id
    WHERE 1 - (pe.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY pe.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification query (run this to check the function works)
-- ============================================================================

-- Test the function (replace with actual embedding vector):
-- SELECT * FROM search_posts_by_embedding(
--     (SELECT embedding FROM post_embeddings LIMIT 1),
--     0.5,
--     10
-- );
