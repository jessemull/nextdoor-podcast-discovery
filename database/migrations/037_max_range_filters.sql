-- Migration: Add max range filters to feed RPCs
-- Run after 028_feed_sort_order.sql
--
-- Adds p_max_score, p_max_podcast_worthy, p_max_reaction_count to
-- get_posts_with_scores, get_posts_with_scores_count, get_posts_by_date,
-- get_posts_by_date_count so the filter menu min/max ranges work.

-- ============================================================================
-- Step 1: get_posts_with_scores (add p_max_*)
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_with_scores(uuid, integer, integer, double precision, text, boolean, uuid, boolean, double precision, text, integer, boolean, boolean);

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
                AND (p_category IS NULL OR p_category = ANY(ls.categories))
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
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
                AND (p_category IS NULL OR p_category = ANY(ls.categories))
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
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
                AND (p_category IS NULL OR p_category = ANY(ls.categories))
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
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
                AND (p_category IS NULL OR p_category = ANY(ls.categories))
                AND (NOT p_unused_only OR p.used_on_episode = false)
                AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
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
-- Step 2: get_posts_with_scores_count (add p_max_*)
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_with_scores_count(uuid, double precision, text, boolean, uuid, boolean, double precision, integer, boolean);

CREATE OR REPLACE FUNCTION get_posts_with_scores_count(
    p_weight_config_id UUID,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
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
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (p_ignored_only = COALESCE(p.ignored, false))
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 3: get_posts_by_date (add p_max_*)
-- ============================================================================

-- Drop the 11-param version from 028 (includes p_order_asc); 028 DROP targeted wrong 9-param version.
DROP FUNCTION IF EXISTS get_posts_by_date(integer, integer, text, double precision, uuid, boolean, boolean, double precision, integer, boolean, boolean);

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
            AND (p_max_score IS NULL OR ls.final_score <= p_max_score)
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
            AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
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
            AND (p_max_score IS NULL OR ls.final_score <= p_max_score)
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
            AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
        ORDER BY p.created_at DESC
        LIMIT p_limit
        OFFSET p_offset;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 4: get_posts_by_date_count (add p_max_*)
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_by_date_count(text, double precision, uuid, boolean, boolean, double precision, integer, boolean);

CREATE OR REPLACE FUNCTION get_posts_by_date_count(
    p_category TEXT DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_unused_only BOOLEAN DEFAULT false,
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
    FROM posts p
    INNER JOIN llm_scores ls ON p.id = ls.post_id
    WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_ignored_only = COALESCE(p.ignored, false))
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (p_min_score IS NULL OR ls.final_score >= p_min_score)
        AND (p_max_score IS NULL OR ls.final_score <= p_max_score)
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;

-- search_path is set inside each function body above (avoids ALTER failing when
-- the migration runner runs statements in separate batches).

-- ============================================================================
-- Step 5: get_posts_with_runtime_scores (add p_max_*) for preview mode
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_with_runtime_scores(uuid, integer, integer, double precision, text, boolean, uuid, boolean, double precision, text, integer, boolean, boolean);

CREATE OR REPLACE FUNCTION get_posts_with_runtime_scores(
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
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_weights JSONB;
    v_novelty_config JSONB;
    v_frequencies JSONB;
    v_total_scored INT;
BEGIN
    SELECT wc.weights INTO v_weights
    FROM weight_configs wc
    WHERE wc.id = p_weight_config_id;

    IF v_weights IS NULL THEN
        RETURN;
    END IF;

    SELECT COALESCE(s.value::jsonb, '{}'::jsonb) INTO v_novelty_config
    FROM settings s
    WHERE s.key = 'novelty_config'
    LIMIT 1;

    SELECT COALESCE(jsonb_object_agg(tf.category, tf.count_30d), '{}'::jsonb) INTO v_frequencies
    FROM topic_frequencies tf;

    SELECT COUNT(*)::int INTO v_total_scored
    FROM llm_scores;

    IF p_order_by = 'podcast_worthy' THEN
        IF p_order_asc THEN
            RETURN QUERY
            WITH scored AS (
                SELECT
                    ls.categories,
                    ls.created_at AS ls_created_at,
                    ls.id AS ls_id,
                    ls.model_version,
                    p.id AS p_id,
                    ls.scores AS ls_scores,
                    ls.summary AS ls_summary,
                    ls.why_podcast_worthy AS ls_why,
                    compute_final_score_runtime(
                        ls.scores, ls.categories, v_weights,
                        v_novelty_config, v_frequencies, v_total_scored
                    ) AS fs
                FROM posts p
                INNER JOIN llm_scores ls ON p.id = ls.post_id
                WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
                    AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                    AND (NOT p_unused_only OR p.used_on_episode = false)
                    AND (p_ignored_only = COALESCE(p.ignored, false))
                    AND (p_category IS NULL OR p_category = ANY(ls.categories))
                    AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                    AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
                    AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
                    AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
            )
            SELECT
                s.categories,
                s.ls_created_at AS llm_created_at,
                s.ls_id AS llm_score_id,
                s.model_version,
                s.p_id AS post_id,
                s.fs AS final_score,
                s.ls_scores AS scores,
                s.ls_summary AS summary,
                s.ls_why AS why_podcast_worthy
            FROM scored s
            WHERE (p_min_score IS NULL OR s.fs >= p_min_score)
                AND (p_max_score IS NULL OR s.fs <= p_max_score)
            ORDER BY (s.ls_scores->>'podcast_worthy')::float ASC NULLS LAST, s.fs ASC
            LIMIT p_limit OFFSET p_offset;
        ELSE
            RETURN QUERY
            WITH scored AS (
                SELECT
                    ls.categories,
                    ls.created_at AS ls_created_at,
                    ls.id AS ls_id,
                    ls.model_version,
                    p.id AS p_id,
                    ls.scores AS ls_scores,
                    ls.summary AS ls_summary,
                    ls.why_podcast_worthy AS ls_why,
                    compute_final_score_runtime(
                        ls.scores, ls.categories, v_weights,
                        v_novelty_config, v_frequencies, v_total_scored
                    ) AS fs
                FROM posts p
                INNER JOIN llm_scores ls ON p.id = ls.post_id
                WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
                    AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                    AND (NOT p_unused_only OR p.used_on_episode = false)
                    AND (p_ignored_only = COALESCE(p.ignored, false))
                    AND (p_category IS NULL OR p_category = ANY(ls.categories))
                    AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                    AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
                    AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
                    AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
            )
            SELECT
                s.categories,
                s.ls_created_at AS llm_created_at,
                s.ls_id AS llm_score_id,
                s.model_version,
                s.p_id AS post_id,
                s.fs AS final_score,
                s.ls_scores AS scores,
                s.ls_summary AS summary,
                s.ls_why AS why_podcast_worthy
            FROM scored s
            WHERE (p_min_score IS NULL OR s.fs >= p_min_score)
                AND (p_max_score IS NULL OR s.fs <= p_max_score)
            ORDER BY (s.ls_scores->>'podcast_worthy')::float DESC NULLS LAST, s.fs DESC
            LIMIT p_limit OFFSET p_offset;
        END IF;
    ELSE
        IF p_order_asc THEN
            RETURN QUERY
            WITH scored AS (
                SELECT
                    ls.categories,
                    ls.created_at AS ls_created_at,
                    ls.id AS ls_id,
                    ls.model_version,
                    p.id AS p_id,
                    ls.scores AS ls_scores,
                    ls.summary AS ls_summary,
                    ls.why_podcast_worthy AS ls_why,
                    compute_final_score_runtime(
                        ls.scores, ls.categories, v_weights,
                        v_novelty_config, v_frequencies, v_total_scored
                    ) AS fs
                FROM posts p
                INNER JOIN llm_scores ls ON p.id = ls.post_id
                WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
                    AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                    AND (NOT p_unused_only OR p.used_on_episode = false)
                    AND (p_ignored_only = COALESCE(p.ignored, false))
                    AND (p_category IS NULL OR p_category = ANY(ls.categories))
                    AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                    AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
                    AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
                    AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
            )
            SELECT
                s.categories,
                s.ls_created_at AS llm_created_at,
                s.ls_id AS llm_score_id,
                s.model_version,
                s.p_id AS post_id,
                s.fs AS final_score,
                s.ls_scores AS scores,
                s.ls_summary AS summary,
                s.ls_why AS why_podcast_worthy
            FROM scored s
            WHERE (p_min_score IS NULL OR s.fs >= p_min_score)
                AND (p_max_score IS NULL OR s.fs <= p_max_score)
            ORDER BY s.fs ASC
            LIMIT p_limit OFFSET p_offset;
        ELSE
            RETURN QUERY
            WITH scored AS (
                SELECT
                    ls.categories,
                    ls.created_at AS ls_created_at,
                    ls.id AS ls_id,
                    ls.model_version,
                    p.id AS p_id,
                    ls.scores AS ls_scores,
                    ls.summary AS ls_summary,
                    ls.why_podcast_worthy AS ls_why,
                    compute_final_score_runtime(
                        ls.scores, ls.categories, v_weights,
                        v_novelty_config, v_frequencies, v_total_scored
                    ) AS fs
                FROM posts p
                INNER JOIN llm_scores ls ON p.id = ls.post_id
                WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
                    AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                    AND (NOT p_unused_only OR p.used_on_episode = false)
                    AND (p_ignored_only = COALESCE(p.ignored, false))
                    AND (p_category IS NULL OR p_category = ANY(ls.categories))
                    AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
                    AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
                    AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
                    AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
            )
            SELECT
                s.categories,
                s.ls_created_at AS llm_created_at,
                s.ls_id AS llm_score_id,
                s.model_version,
                s.p_id AS post_id,
                s.fs AS final_score,
                s.ls_scores AS scores,
                s.ls_summary AS summary,
                s.ls_why AS why_podcast_worthy
            FROM scored s
            WHERE (p_min_score IS NULL OR s.fs >= p_min_score)
                AND (p_max_score IS NULL OR s.fs <= p_max_score)
            ORDER BY s.fs DESC
            LIMIT p_limit OFFSET p_offset;
        END IF;
    END IF;
END;
$$;

-- ============================================================================
-- Step 7: get_posts_with_runtime_scores_count (add p_max_*)
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_with_runtime_scores_count(uuid, double precision, text, boolean, uuid, boolean, double precision, integer, boolean);

CREATE OR REPLACE FUNCTION get_posts_with_runtime_scores_count(
    p_weight_config_id UUID,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL,
    p_ignored_only BOOLEAN DEFAULT false,
    p_max_score FLOAT DEFAULT NULL,
    p_max_podcast_worthy FLOAT DEFAULT NULL,
    p_max_reaction_count INT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_weights JSONB;
    v_novelty_config JSONB;
    v_frequencies JSONB;
    v_total_scored INT;
    v_count INT;
BEGIN
    SELECT wc.weights INTO v_weights
    FROM weight_configs wc
    WHERE wc.id = p_weight_config_id;

    IF v_weights IS NULL THEN
        RETURN 0;
    END IF;

    SELECT COALESCE(s.value::jsonb, '{}'::jsonb) INTO v_novelty_config
    FROM settings s
    WHERE s.key = 'novelty_config'
    LIMIT 1;

    SELECT COALESCE(jsonb_object_agg(tf.category, tf.count_30d), '{}'::jsonb) INTO v_frequencies
    FROM topic_frequencies tf;

    SELECT COUNT(*)::int INTO v_total_scored
    FROM llm_scores;

    SELECT COUNT(*)::int INTO v_count
    FROM (
        SELECT compute_final_score_runtime(
            ls.scores, ls.categories, v_weights,
            v_novelty_config, v_frequencies, v_total_scored
        ) AS fs
        FROM posts p
        INNER JOIN llm_scores ls ON p.id = ls.post_id
        WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
            AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
            AND (NOT p_unused_only OR p.used_on_episode = false)
            AND (p_ignored_only = COALESCE(p.ignored, false))
            AND (p_category IS NULL OR p_category = ANY(ls.categories))
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_max_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float <= p_max_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
            AND (p_max_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) <= p_max_reaction_count)
    ) sub
    WHERE (p_min_score IS NULL OR sub.fs >= p_min_score)
        AND (p_max_score IS NULL OR sub.fs <= p_max_score);

    RETURN v_count;
END;
$$;
