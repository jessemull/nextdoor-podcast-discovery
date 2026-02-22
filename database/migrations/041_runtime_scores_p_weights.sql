-- Add p_weights JSONB parameter so preview mode (inline weight sliders) can call
-- get_posts_with_runtime_scores and get_posts_with_runtime_scores_count without
-- requiring a saved weight config. When p_weights is provided, use it; otherwise
-- load weights from weight_configs by p_weight_config_id.

-- ============================================================================
-- Step 1: get_posts_with_runtime_scores (add p_weights JSONB DEFAULT NULL)
-- ============================================================================

-- Drop existing (039 uses text in DROP but CREATE has text[]; drop both to be safe)
DROP FUNCTION IF EXISTS get_posts_with_runtime_scores(uuid, integer, integer, double precision, text, boolean, uuid[], boolean, double precision, text, integer, boolean, boolean, double precision, double precision, integer);
DROP FUNCTION IF EXISTS get_posts_with_runtime_scores(uuid, integer, integer, double precision, text[], boolean, uuid[], boolean, double precision, text, integer, boolean, boolean, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION get_posts_with_runtime_scores(
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
    p_max_reaction_count INT DEFAULT NULL,
    p_weights JSONB DEFAULT NULL
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
    IF p_weights IS NOT NULL AND jsonb_typeof(p_weights) = 'object' THEN
        v_weights := p_weights;
    ELSIF p_weight_config_id IS NOT NULL THEN
        SELECT wc.weights INTO v_weights
        FROM weight_configs wc
        WHERE wc.id = p_weight_config_id;
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
                WHERE (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
                    AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                    AND (NOT p_unused_only OR p.used_on_episode = false)
                    AND (p_ignored_only = COALESCE(p.ignored, false))
                    AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
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
                WHERE (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
                    AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                    AND (NOT p_unused_only OR p.used_on_episode = false)
                    AND (p_ignored_only = COALESCE(p.ignored, false))
                    AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
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
                WHERE (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
                    AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                    AND (NOT p_unused_only OR p.used_on_episode = false)
                    AND (p_ignored_only = COALESCE(p.ignored, false))
                    AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
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
                WHERE (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
                    AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
                    AND (NOT p_unused_only OR p.used_on_episode = false)
                    AND (p_ignored_only = COALESCE(p.ignored, false))
                    AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
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
-- Step 2: get_posts_with_runtime_scores_count (add p_weights JSONB DEFAULT NULL)
-- ============================================================================

-- Drop existing (both text and text[] for p_categories)
DROP FUNCTION IF EXISTS get_posts_with_runtime_scores_count(uuid, double precision, text, boolean, uuid[], boolean, double precision, integer, boolean, double precision, double precision, integer);
DROP FUNCTION IF EXISTS get_posts_with_runtime_scores_count(uuid, double precision, text[], boolean, uuid[], boolean, double precision, integer, boolean, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION get_posts_with_runtime_scores_count(
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
    p_max_reaction_count INT DEFAULT NULL,
    p_weights JSONB DEFAULT NULL
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
    IF p_weights IS NOT NULL AND jsonb_typeof(p_weights) = 'object' THEN
        v_weights := p_weights;
    ELSIF p_weight_config_id IS NOT NULL THEN
        SELECT wc.weights INTO v_weights
        FROM weight_configs wc
        WHERE wc.id = p_weight_config_id;
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
        WHERE (p_neighborhood_ids IS NULL OR cardinality(p_neighborhood_ids) = 0 OR p.neighborhood_id = ANY(p_neighborhood_ids))
            AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
            AND (NOT p_unused_only OR p.used_on_episode = false)
            AND (p_ignored_only = COALESCE(p.ignored, false))
            AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR ls.categories && p_categories)
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
