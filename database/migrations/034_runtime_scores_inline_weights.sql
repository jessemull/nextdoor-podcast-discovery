-- Migration: Runtime scores with inline weights
-- Run after 033_runtime_scores_rpc.sql
--
-- Adds optional p_weights JSONB to get_posts_with_runtime_scores and
-- get_posts_with_runtime_scores_count. When p_weights is provided,
-- use it directly; otherwise load from p_weight_config_id (unchanged behavior).

-- ============================================================================
-- get_posts_with_runtime_scores: accept optional p_weights
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_runtime_scores(
    p_weight_config_id UUID DEFAULT NULL,
    p_weights JSONB DEFAULT NULL,
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
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_weights JSONB;
    v_novelty_config JSONB;
    v_frequencies JSONB;
    v_total_scored INT;
BEGIN
    -- Use inline p_weights when provided; else load from weight_configs
    IF p_weights IS NOT NULL AND p_weights != '{}'::jsonb THEN
        v_weights := p_weights;
    ELSIF p_weight_config_id IS NOT NULL THEN
        SELECT wc.weights INTO v_weights
        FROM weight_configs wc
        WHERE wc.id = p_weight_config_id;
    ELSE
        RETURN;
    END IF;

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
                    AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
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
                    AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
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
                    AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
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
                    AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
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
            ORDER BY s.fs DESC
            LIMIT p_limit OFFSET p_offset;
        END IF;
    END IF;
END;
$$;

-- ============================================================================
-- get_posts_with_runtime_scores_count: accept optional p_weights
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_runtime_scores_count(
    p_weight_config_id UUID DEFAULT NULL,
    p_weights JSONB DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL,
    p_ignored_only BOOLEAN DEFAULT false
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
    -- Use inline p_weights when provided; else load from weight_configs
    IF p_weights IS NOT NULL AND p_weights != '{}'::jsonb THEN
        v_weights := p_weights;
    ELSIF p_weight_config_id IS NOT NULL THEN
        SELECT wc.weights INTO v_weights
        FROM weight_configs wc
        WHERE wc.id = p_weight_config_id;
    ELSE
        RETURN 0;
    END IF;

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
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
    ) sub
    WHERE (p_min_score IS NULL OR sub.fs >= p_min_score);

    RETURN v_count;
END;
$$;
