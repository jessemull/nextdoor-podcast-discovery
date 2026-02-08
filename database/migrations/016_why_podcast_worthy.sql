-- Migration: Add why_podcast_worthy to llm_scores and RPC
-- Run this in Supabase SQL Editor after 015_fulltext_search.sql
--
-- Stores a one-sentence LLM explanation of why a post is good for the podcast.
-- podcast_worthy (1-10) is stored inside the existing scores JSONB.

ALTER TABLE llm_scores ADD COLUMN IF NOT EXISTS why_podcast_worthy TEXT;

-- Must drop first: PostgreSQL does not allow changing return type with CREATE OR REPLACE.
DROP FUNCTION IF EXISTS get_posts_with_scores(uuid, integer, integer, double precision, text, boolean, uuid, boolean, date);

CREATE OR REPLACE FUNCTION get_posts_with_scores(
    p_weight_config_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_episode_date DATE DEFAULT NULL
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
        ps.post_id,
        ps.final_score,
        ls.scores,
        ls.summary,
        ls.why_podcast_worthy
    FROM post_scores ps
    INNER JOIN llm_scores ls ON ps.post_id = ls.post_id
    INNER JOIN posts p ON ps.post_id = p.id
    WHERE ps.weight_config_id = p_weight_config_id
        AND (p_min_score IS NULL OR ps.final_score >= p_min_score)
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (p_episode_date IS NULL OR p.episode_date = p_episode_date)
    ORDER BY ps.final_score DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
