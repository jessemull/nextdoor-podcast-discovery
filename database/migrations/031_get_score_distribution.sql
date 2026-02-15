-- RPC to return score distribution stats for tuning

CREATE OR REPLACE FUNCTION get_score_distribution()
RETURNS JSONB AS $$
DECLARE
    dim TEXT;
    dims TEXT[] := ARRAY[
        'absurdity', 'discussion_spark', 'drama', 'emotional_intensity',
        'news_value', 'podcast_worthy', 'readability'
    ];
    dim_stats JSONB;
    dims_obj JSONB := '{}'::jsonb;
    final_stats JSONB;
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

    -- final_score stats
    SELECT jsonb_build_object(
        'max', ROUND(MAX(final_score)::numeric, 2),
        'mean', ROUND(AVG(final_score)::numeric, 2),
        'min', ROUND(MIN(final_score)::numeric, 2),
        'p50', ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY final_score))::numeric, 2),
        'p90', ROUND((percentile_cont(0.9) WITHIN GROUP (ORDER BY final_score))::numeric, 2)
    ) INTO final_stats
    FROM llm_scores
    WHERE final_score IS NOT NULL;

    RETURN jsonb_build_object(
        'dimensions', dims_obj,
        'final_score', COALESCE(final_stats, '{}'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_score_distribution() IS
    'Returns min, max, mean, p50, p90 per dimension and final_score for tuning';
