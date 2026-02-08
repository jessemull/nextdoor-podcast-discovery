-- Migration: Add get_posts_by_date RPC for date-sorted feed with filters in DB
-- Run this in Supabase SQL Editor after 016_why_podcast_worthy.sql
--
-- Enables category and min_score filtering in the database when sort=date,
-- so pagination and count are correct.

CREATE OR REPLACE FUNCTION get_posts_by_date(
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_episode_date DATE DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false
)
RETURNS TABLE(
    categories TEXT[],
    llm_created_at TIMESTAMPTZ,
    llm_score_id UUID,
    model_version TEXT,
    post_id UUID,
    final_score FLOAT,
    scores JSONB,
    summary TEXT,
    why_podcast_worthy TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ls.categories,
        ls.created_at AS llm_created_at,
        ls.id AS llm_score_id,
        ls.model_version,
        p.id AS post_id,
        ls.final_score,
        ls.scores,
        ls.summary,
        ls.why_podcast_worthy
    FROM posts p
    INNER JOIN llm_scores ls ON p.id = ls.post_id
    WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (p_episode_date IS NULL OR (p.episode_date = p_episode_date AND p.used_on_episode = true))
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (p_min_score IS NULL OR ls.final_score >= p_min_score)
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_posts_by_date_count(
    p_category TEXT DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_episode_date DATE DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false
)
RETURNS INT AS $$
DECLARE
    result_count INT;
BEGIN
    SELECT COUNT(*) INTO result_count
    FROM posts p
    INNER JOIN llm_scores ls ON p.id = ls.post_id
    WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (p_episode_date IS NULL OR (p.episode_date = p_episode_date AND p.used_on_episode = true))
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (p_min_score IS NULL OR ls.final_score >= p_min_score);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;
