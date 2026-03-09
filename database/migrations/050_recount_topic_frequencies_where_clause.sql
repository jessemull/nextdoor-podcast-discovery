-- Migration: Fix recount_topic_frequencies() "UPDATE requires a WHERE clause"
-- Supabase/PostgREST reject UPDATE with no WHERE. Add WHERE TRUE to the reset
-- so the intent (update all rows) is explicit and the safety check is satisfied.

CREATE OR REPLACE FUNCTION recount_topic_frequencies()
RETURNS VOID AS $$
BEGIN
    -- Reset all counts (WHERE TRUE satisfies "UPDATE must have WHERE" rule)
    UPDATE topic_frequencies SET count_30d = 0, last_updated = NOW() WHERE TRUE;

    -- Recount from llm_scores within last 30 days
    WITH recent_counts AS (
        SELECT unnest(categories) AS cat, COUNT(*) AS cnt
        FROM llm_scores
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY cat
    )
    UPDATE topic_frequencies tf
    SET count_30d = rc.cnt::INT,
        last_updated = NOW()
    FROM recent_counts rc
    WHERE tf.category = rc.cat;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION recount_topic_frequencies() SET search_path = public;
