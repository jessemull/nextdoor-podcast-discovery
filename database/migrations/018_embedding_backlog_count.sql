-- Migration: Add get_embedding_backlog_count RPC for stats
-- Run this in Supabase SQL Editor after 017_posts_by_date_rpc.sql
--
-- Returns count of posts that have LLM scores but no embedding (search backlog).

CREATE OR REPLACE FUNCTION get_embedding_backlog_count()
RETURNS INT AS $$
DECLARE
    result_count INT;
BEGIN
    SELECT COUNT(*) INTO result_count
    FROM llm_scores ls
    LEFT JOIN post_embeddings pe ON ls.post_id = pe.post_id
    WHERE pe.post_id IS NULL;

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;
