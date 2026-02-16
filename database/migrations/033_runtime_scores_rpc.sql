-- Migration: Runtime Score Calculation RPC
-- Run after 032_post_scores_staging.sql
--
-- Enables preview mode: compute final_score from llm_scores + weight config
-- (weights + novelty) without reading post_scores. Used when preview=true.

-- ============================================================================
-- Step 1: Helper function compute_final_score_runtime
-- ============================================================================

-- Port of Python novelty.py calculate_novelty + worker calculate_final_score.
-- Returns final_score (0-10) for a post given llm_scores and config.
CREATE OR REPLACE FUNCTION compute_final_score_runtime(
    p_scores JSONB,
    p_categories TEXT[],
    p_weights JSONB,
    p_novelty_config JSONB,
    p_frequencies JSONB,
    p_total_scored INT
)
RETURNS FLOAT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_novelty FLOAT := 1.0;
    v_min_mult FLOAT;
    v_max_mult FLOAT;
    v_rare INT;
    v_common INT;
    v_very_common INT;
    v_total_freq FLOAT := 0;
    v_avg_freq FLOAT;
    v_weighted_sum FLOAT := 0;
    v_max_possible FLOAT := 0;
    v_normalized FLOAT;
    v_raw_score FLOAT;
    v_dim TEXT;
    v_cat TEXT;
    v_count INT;
    v_thresholds JSONB;
BEGIN
    -- Cold start: categories empty, frequencies empty, or total scored < 30
    IF p_categories IS NULL OR array_length(p_categories, 1) IS NULL THEN
        v_novelty := 1.0;
    ELSIF p_frequencies IS NULL OR p_frequencies = '{}'::jsonb THEN
        v_novelty := 1.0;
    ELSIF p_total_scored IS NOT NULL AND p_total_scored < 30 THEN
        v_novelty := 1.0;
    ELSE
        -- Compute novelty from categories and frequencies
        v_min_mult := COALESCE((p_novelty_config->>'min_multiplier')::float, 0.2);
        v_max_mult := COALESCE((p_novelty_config->>'max_multiplier')::float, 1.5);
        v_thresholds := COALESCE(p_novelty_config->'frequency_thresholds', '{}'::jsonb);
        v_rare := COALESCE((v_thresholds->>'rare')::int, 5);
        v_common := COALESCE((v_thresholds->>'common')::int, 30);
        v_very_common := COALESCE((v_thresholds->>'very_common')::int, 100);

        FOR v_cat IN SELECT unnest(p_categories)
        LOOP
            v_count := COALESCE((p_frequencies->>v_cat)::int, 0);
            v_total_freq := v_total_freq + v_count;
        END LOOP;

        v_avg_freq := v_total_freq / NULLIF(array_length(p_categories, 1), 0);

        IF v_avg_freq <= v_rare THEN
            v_novelty := v_max_mult;
        ELSIF v_avg_freq <= v_common THEN
            v_novelty := v_max_mult - ((v_avg_freq - v_rare)::float / NULLIF(v_common - v_rare, 0)) * (v_max_mult - 1.0);
        ELSIF v_avg_freq <= v_very_common THEN
            v_novelty := 1.0 - ((v_avg_freq - v_common)::float / NULLIF(v_very_common - v_common, 0)) * (1.0 - v_min_mult);
        ELSE
            v_novelty := v_min_mult;
        END IF;
    END IF;

    -- Compute weighted sum and max_possible from weights
    FOR v_dim IN SELECT jsonb_object_keys(p_weights)
    LOOP
        v_weighted_sum := v_weighted_sum + COALESCE((p_scores->>v_dim)::float, 5.0) * (p_weights->>v_dim)::float;
        v_max_possible := v_max_possible + 10.0 * (p_weights->>v_dim)::float;
    END LOOP;

    IF v_max_possible <= 0 THEN
        RETURN 0.0;
    END IF;

    v_normalized := (v_weighted_sum / v_max_possible) * 10.0;
    v_raw_score := v_normalized * v_novelty;

    RETURN GREATEST(0.0, LEAST(10.0, v_raw_score));
END;
$$;

-- ============================================================================
-- Step 2: get_posts_with_runtime_scores RPC
-- ============================================================================

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
    -- Load config once
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
-- Step 3: get_posts_with_runtime_scores_count RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_runtime_scores_count(
    p_weight_config_id UUID,
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
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
    ) sub
    WHERE (p_min_score IS NULL OR sub.fs >= p_min_score);

    RETURN v_count;
END;
$$;
