-- Align get_score_distribution final_score stats with feed (post_scores for active config)

CREATE OR REPLACE FUNCTION get_score_distribution()
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    dim TEXT;
    dims TEXT[] := ARRAY[
        'absurdity', 'discussion_spark', 'drama', 'emotional_intensity',
        'news_value', 'podcast_worthy', 'readability'
    ];
    dim_stats JSONB;
    dims_obj JSONB := '{}'::jsonb;
    final_stats JSONB;
    active_config_id UUID;
BEGIN
    -- Per-dimension stats from scores JSONB
    FOREACH dim IN ARRAY dims
    LOOP
        dim_stats := NULL;
        SELECT jsonb_build_object(
            'max', ROUND(MAX((scores->>dim)::float)::numeric, 2),
            'mean', ROUND(AVG((scores->>dim)::float)::numeric, 2),
            'min', ROUND(MIN((scores->>dim)::float)::numeric, 2),
            'p50', ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY (scores->>dim)::float))::numeric, 2),
            'p90', ROUND((percentile_cont(0.9) WITHIN GROUP (ORDER BY (scores->>dim)::float))::numeric, 2)
        ) INTO dim_stats
        FROM llm_scores
        WHERE scores->>dim IS NOT NULL
          AND (scores->>dim) ~ '^[0-9]+\.?[0-9]*$';

        IF dim_stats IS NOT NULL THEN
            dims_obj := dims_obj || jsonb_build_object(dim, dim_stats);
        END IF;
    END LOOP;

    active_config_id := COALESCE(
        (SELECT (value #>> '{}')::uuid FROM settings WHERE key = 'active_weight_config_id' LIMIT 1),
        (SELECT id FROM weight_configs WHERE is_active = true LIMIT 1)
    );

    -- final_score stats from post_scores (same source as feed for active config)
    IF active_config_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'max', ROUND(MAX(ps.final_score)::numeric, 2),
            'mean', ROUND(AVG(ps.final_score)::numeric, 2),
            'min', ROUND(MIN(ps.final_score)::numeric, 2),
            'p50', ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ps.final_score))::numeric, 2),
            'p90', ROUND((percentile_cont(0.9) WITHIN GROUP (ORDER BY ps.final_score))::numeric, 2)
        ) INTO final_stats
        FROM post_scores ps
        WHERE ps.weight_config_id = active_config_id
          AND ps.final_score IS NOT NULL;
    END IF;

    RETURN jsonb_build_object(
        'dimensions', dims_obj,
        'final_score', COALESCE(final_stats, '{}'::jsonb)
    );
END;
$$;

COMMENT ON FUNCTION get_score_distribution() IS
    'Returns min, max, mean, p50, p90 per dimension (llm_scores) and final_score (post_scores for active config)';
