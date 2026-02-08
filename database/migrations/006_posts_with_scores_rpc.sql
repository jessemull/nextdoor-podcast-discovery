-- Migration: RPC Function for Posts with Scores
-- Run this in Supabase SQL Editor after 005_weight_config_versioning.sql
--
-- Creates an RPC function to efficiently join post_scores and llm_scores
-- for the posts API endpoint.

-- ============================================================================
-- RPC Function: get_posts_with_scores
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_scores(
    p_weight_config_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false
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
    ORDER BY ps.final_score DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RPC Function: get_posts_with_scores_count
-- ============================================================================

-- Separate function for getting total count (needed for pagination)
CREATE OR REPLACE FUNCTION get_posts_with_scores_count(
    p_weight_config_id UUID,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false
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
        AND (NOT p_unused_only OR p.used_on_episode = false);
    
    RETURN result_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification queries (run these to check the migration worked)
-- ============================================================================

-- Check functions exist:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name IN ('get_posts_with_scores', 'get_posts_with_scores_count');

-- Test the function (replace with actual weight_config_id):
-- SELECT * FROM get_posts_with_scores(
--     'your-weight-config-id-here'::UUID,
--     10,  -- limit
--     0,    -- offset
--     NULL, -- min_score
--     NULL, -- category
--     false -- unused_only
-- );
