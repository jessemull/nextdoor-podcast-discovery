-- One-off repair: recreate get_posts_with_scores and get_posts_with_scores_count in public.
-- Use when production API reports "Could not find the function ... in the schema cache"
-- (e.g. after drop_all_tables without full bootstrap, or schema cache issues).
-- Run in Supabase SQL Editor, then retry the app.

-- Drop existing overloads so we recreate with the exact signature the app expects
DROP FUNCTION IF EXISTS get_posts_with_scores(uuid, integer, integer, double precision, text[], boolean, uuid[], boolean, double precision, text, integer, boolean, boolean, double precision, double precision, integer);
DROP FUNCTION IF EXISTS get_posts_with_scores_count(uuid, double precision, text[], boolean, uuid[], boolean, double precision, integer, boolean, double precision, double precision, integer);

-- ============================================================================
-- get_posts_with_scores
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_scores(
    p_weight_config_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_min_score FLOAT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_ids UUID[] DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'score',
    p_min_reaction_count INT DEFAULT NULL,
    p_ignored_only BOOLEAN DEFAULT false,
    p_order_asc BOOLEAN DEFAULT false,
    p_max_score FLOAT DEFAULT NULL,
    p_max_podcast_worthy FLOAT DEFAULT NULL,
    p_max_reaction_count INT DEFAULT NULL
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
    SET search_path = public;
    IF p_order_by = 'podcast_worthy' THEN
        IF p_order_asc THEN
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
                AND (p_max_score IS NULL OR ps.final_score <= p_max_score)
                AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
                AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                AND (p_ignored_only = COALESCE(p.ignored, false))
                AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
                AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
                AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
            ORDER BY (ls.scores->>'podcast_worthy')::float ASC NULLS LAST, ps.final_score ASC
            LIMIT p_limit
            OFFSET p_offset;
        ELSE
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
                AND (p_max_score IS NULL OR ps.final_score <= p_max_score)
                AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
                AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                AND (p_ignored_only = COALESCE(p.ignored, false))
                AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
                AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
                AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
            ORDER BY (ls.scores->>'podcast_worthy')::float DESC NULLS LAST, ps.final_score DESC
            LIMIT p_limit
            OFFSET p_offset;
        END IF;
    ELSE
        IF p_order_asc THEN
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
                AND (p_max_score IS NULL OR ps.final_score <= p_max_score)
                AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
                AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                AND (p_ignored_only = COALESCE(p.ignored, false))
                AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
                AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
                AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
            ORDER BY ps.final_score ASC
            LIMIT p_limit
            OFFSET p_offset;
        ELSE
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
                AND (p_max_score IS NULL OR ps.final_score <= p_max_score)
                AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
                AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                AND (p_ignored_only = COALESCE(p.ignored, false))
                AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
                AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
                AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
            ORDER BY ps.final_score DESC
            LIMIT p_limit
            OFFSET p_offset;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- get_posts_with_scores_count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_scores_count(
    p_weight_config_id UUID,
    p_min_score FLOAT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_ids UUID[] DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL,
    p_ignored_only BOOLEAN DEFAULT false,
    p_max_score FLOAT DEFAULT NULL,
    p_max_podcast_worthy FLOAT DEFAULT NULL,
    p_max_reaction_count INT DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
    result_count INT;
BEGIN
    SET search_path = public;
    SELECT COUNT(*) INTO result_count
    FROM post_scores ps
    INNER JOIN llm_scores ls ON ps.post_id = ls.post_id
    INNER JOIN posts p ON ps.post_id = p.id
    WHERE ps.weight_config_id = p_weight_config_id
        AND (p_min_score IS NULL OR ps.final_score >= p_min_score)
        AND (p_max_score IS NULL OR ps.final_score <= p_max_score)
        AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (p_ignored_only = COALESCE(p.ignored, false))
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;

-- Fix search_path for PostgREST and Security Advisor
ALTER FUNCTION get_posts_with_scores(uuid, integer, integer, double precision, text[], boolean, uuid[], boolean, double precision, text, integer, boolean, boolean, double precision, double precision, integer) SET search_path = public;
ALTER FUNCTION get_posts_with_scores_count(uuid, double precision, text[], boolean, uuid[], boolean, double precision, integer, boolean, double precision, double precision, integer) SET search_path = public;

-- Tell PostgREST to reload schema so the RPCs appear in the API
NOTIFY pgrst, 'reload schema';
