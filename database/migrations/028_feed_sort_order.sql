-- Migration: Add sort order (asc/desc) to feed RPCs
-- Run after 027_posts_author_name.sql
--
-- Adds p_order_asc to get_posts_with_scores and get_posts_by_date so the API
-- can request ascending order (e.g. lowest score first, oldest first).

-- ============================================================================
-- Step 1: get_posts_with_scores (add p_order_asc)
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_with_scores(uuid, integer, integer, double precision, text, boolean, uuid, boolean, double precision, text, integer, boolean);

CREATE OR REPLACE FUNCTION get_posts_with_scores(
    p_weight_config_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'score',
    p_min_reaction_count INT DEFAULT NULL,
    p_ignored_only BOOLEAN DEFAULT false,
    p_order_asc BOOLEAN DEFAULT false
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
                AND (p_category IS NULL OR p_category = ANY(ls.categories))
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
                AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                AND (p_ignored_only = COALESCE(p.ignored, false))
                AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
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
                AND (p_category IS NULL OR p_category = ANY(ls.categories))
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
                AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                AND (p_ignored_only = COALESCE(p.ignored, false))
                AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
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
                AND (p_category IS NULL OR p_category = ANY(ls.categories))
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
                AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                AND (p_ignored_only = COALESCE(p.ignored, false))
                AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
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
                AND (p_category IS NULL OR p_category = ANY(ls.categories))
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
                AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                AND (p_ignored_only = COALESCE(p.ignored, false))
                AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
            ORDER BY ps.final_score DESC
            LIMIT p_limit
            OFFSET p_offset;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 2: get_posts_by_date (add p_order_asc)
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_by_date(integer, integer, text, double precision, uuid, boolean, boolean, double precision, integer);

CREATE OR REPLACE FUNCTION get_posts_by_date(
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_unused_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL,
    p_ignored_only BOOLEAN DEFAULT false,
    p_order_asc BOOLEAN DEFAULT false
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
    IF p_order_asc THEN
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
            AND (NOT p_unused_only OR p.used_on_episode = false)
            AND (p_ignored_only = COALESCE(p.ignored, false))
            AND (p_category IS NULL OR p_category = ANY(ls.categories))
            AND (p_min_score IS NULL OR ls.final_score >= p_min_score)
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        ORDER BY p.created_at ASC
        LIMIT p_limit
        OFFSET p_offset;
    ELSE
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
            AND (NOT p_unused_only OR p.used_on_episode = false)
            AND (p_ignored_only = COALESCE(p.ignored, false))
            AND (p_category IS NULL OR p_category = ANY(ls.categories))
            AND (p_min_score IS NULL OR ls.final_score >= p_min_score)
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        ORDER BY p.created_at DESC
        LIMIT p_limit
        OFFSET p_offset;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 3: Set search_path on new function signatures
-- ============================================================================

ALTER FUNCTION get_posts_with_scores(uuid, integer, integer, double precision, text, boolean, uuid, boolean, double precision, text, integer, boolean, boolean) SET search_path = public;
ALTER FUNCTION get_posts_by_date(integer, integer, text, double precision, uuid, boolean, boolean, double precision, integer, boolean) SET search_path = public;
