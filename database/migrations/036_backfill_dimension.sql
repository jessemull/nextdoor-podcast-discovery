-- Migration: Backfill dimension RPCs for scoring
-- Run this in Supabase SQL Editor after 035_scraper_runs.sql
--
-- When a new scoring dimension is added to SCORING_DIMENSIONS (scraper),
-- existing llm_scores rows lack that key. Create a backfill_dimension job via
-- POST /api/admin/backfill-dimension with body { dimension: "new_key" }; the
-- worker will score only that dimension and merge into scores (other keys unchanged).

-- ============================================================================
-- Step 1: get_posts_missing_dimension
-- ============================================================================
-- Returns (id, text) for posts that have llm_scores but scores->p_dimension
-- is null or missing. Used by the backfill_dimension worker to fetch batches.

CREATE OR REPLACE FUNCTION get_posts_missing_dimension(
    p_dimension TEXT,
    p_limit INT DEFAULT 100
)
RETURNS TABLE(id UUID, text TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.text
    FROM posts p
    INNER JOIN llm_scores ls ON p.id = ls.post_id
    WHERE (ls.scores->>p_dimension) IS NULL
       OR NOT (ls.scores ? p_dimension)
    ORDER BY ls.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 2: merge_dimension_into_llm_scores
-- ============================================================================
-- p_updates: JSONB array of {"post_id": "uuid", "value": number}.
-- Merges the single dimension into each row's scores (other keys unchanged).

CREATE OR REPLACE FUNCTION merge_dimension_into_llm_scores(
    p_dimension TEXT,
    p_updates JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE llm_scores ls
    SET scores = ls.scores || jsonb_build_object(
        p_dimension,
        (elem->>'value')::float
    )
    FROM jsonb_array_elements(p_updates) AS elem
    WHERE ls.post_id = (elem->>'post_id')::uuid;
END;
$$ LANGUAGE plpgsql;
