-- Migration: Add neighborhood filter to get_posts_with_scores RPC
-- Run this in Supabase SQL Editor after 009_job_retry.sql
--
-- Adds p_neighborhood_id parameter to filter posts by neighborhood.

-- ============================================================================
-- RPC Function: get_posts_with_scores (with neighborhood filter)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_scores(
    p_weight_config_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL
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
    ORDER BY ps.final_score DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RPC Function: get_posts_with_scores_count (with neighborhood filter)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_scores_count(
    p_weight_config_id UUID,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL
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
        AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;
