-- Migration: Add min_reaction_count filter to post feed RPCs
-- Run this in Supabase SQL Editor after 019_podcast_worthy_filter.sql
--
-- Adds p_min_reaction_count to get_posts_with_scores, get_posts_with_scores_count,
-- get_posts_by_date, and get_posts_by_date_count. Filters by posts.reaction_count
-- (from migration 011) so "High engagement" chip can show only posts with at least
-- N reactions.

-- ============================================================================
-- get_posts_with_scores: add p_min_reaction_count
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_with_scores(uuid, integer, integer, double precision, text, boolean, uuid, boolean, date, double precision, text);

CREATE OR REPLACE FUNCTION get_posts_with_scores(
    p_weight_config_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_episode_date DATE DEFAULT NULL,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'score',
    p_min_reaction_count INT DEFAULT NULL
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
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        ORDER BY (ls.scores->>'podcast_worthy')::float DESC NULLS LAST, ps.final_score DESC
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
            AND (p_episode_date IS NULL OR p.episode_date = p_episode_date)
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        ORDER BY ps.final_score DESC
        LIMIT p_limit
        OFFSET p_offset;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- get_posts_with_scores_count: add p_min_reaction_count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_scores_count(
    p_weight_config_id UUID,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_episode_date DATE DEFAULT NULL,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL
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
        AND (p_episode_date IS NULL OR p.episode_date = p_episode_date)
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- get_posts_by_date: add p_min_reaction_count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_by_date(
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_episode_date DATE DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL
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
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- get_posts_by_date_count: add p_min_reaction_count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_by_date_count(
    p_category TEXT DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_episode_date DATE DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL
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
        AND (p_min_score IS NULL OR ls.final_score >= p_min_score)
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;
