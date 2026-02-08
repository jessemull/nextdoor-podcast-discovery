-- Migration: Add episode_date filter to get_posts_with_scores RPC
-- Run this in Supabase SQL Editor after 013_rpc_saved_filter.sql
--
-- Adds p_episode_date parameter to filter posts used in a specific episode.

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
    post_id UUID,
    final_score FLOAT,
    llm_score_id UUID,
    scores JSONB,
    categories TEXT[],
    summary TEXT,
    model_version TEXT,
    llm_created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.post_id,
        ps.final_score,
        ls.id AS llm_score_id,
        ls.scores,
        ls.categories,
        ls.summary,
        ls.model_version,
        ls.created_at AS llm_created_at
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

CREATE OR REPLACE FUNCTION get_posts_with_scores_count(
    p_weight_config_id UUID,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_episode_date DATE DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
    result_count INT;
BEGIN
    SELECT COUNT(*) INTO result_count
    FROM post_scores ps
    INNER JOIN llm_scores ls ON ps.post_id = ls.post_id
    INNER JOIN posts p ON ps.post_id = p.id
    WHERE ps.weight_config_id = p_weight_config_id
        AND (p_min_score IS NULL OR ps.final_score >= p_min_score)
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (p_episode_date IS NULL OR p.episode_date = p_episode_date);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;
