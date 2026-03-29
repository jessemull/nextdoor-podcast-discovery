-- Migration: Include posts.comments in scoring RPCs for LLM context
-- Run after 060_podcast_episode_categories_rpc.sql (or latest prior migration).
--
-- Extends get_unscored_posts and get_posts_missing_dimension to return comments JSONB
-- so the scraper can pass thread context to Claude.

-- ============================================================================
-- get_unscored_posts: add comments column
-- ============================================================================

DROP FUNCTION IF EXISTS get_unscored_posts(int);

CREATE OR REPLACE FUNCTION get_unscored_posts(p_limit INT DEFAULT 100)
RETURNS TABLE(id UUID, text TEXT, comments JSONB) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.text, COALESCE(p.comments, '[]'::jsonb) AS comments
    FROM posts p
    LEFT JOIN llm_scores ls ON p.id = ls.post_id
    WHERE ls.id IS NULL
    ORDER BY p.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION get_unscored_posts(int) SET search_path = public;

-- ============================================================================
-- get_posts_missing_dimension: add comments column
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_missing_dimension(text, int);

CREATE OR REPLACE FUNCTION get_posts_missing_dimension(
    p_dimension TEXT,
    p_limit INT DEFAULT 100
)
RETURNS TABLE(id UUID, text TEXT, comments JSONB) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.text, COALESCE(p.comments, '[]'::jsonb) AS comments
    FROM posts p
    INNER JOIN llm_scores ls ON p.id = ls.post_id
    WHERE (ls.scores->>p_dimension) IS NULL
       OR NOT (ls.scores ? p_dimension)
    ORDER BY ls.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION get_posts_missing_dimension(text, int) SET search_path = public;
