-- Migration: Post Scores Staging for Clean Cutover
-- Run after 031_get_score_distribution.sql
--
-- Enables recompute jobs to write to a staging table and apply all scores
-- in one transaction when complete. Avoids mixing old and new scores in
-- the feed during a long recompute.

-- ============================================================================
-- Step 1: Create post_scores_staging table
-- ============================================================================

CREATE TABLE post_scores_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES background_jobs(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    weight_config_id UUID NOT NULL REFERENCES weight_configs(id) ON DELETE CASCADE,
    final_score FLOAT NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, post_id)
);

CREATE INDEX idx_post_scores_staging_job ON post_scores_staging(job_id);
CREATE INDEX idx_post_scores_staging_config_post ON post_scores_staging(weight_config_id, post_id);

-- ============================================================================
-- Step 2: Create cutover RPC
-- ============================================================================

-- Apply post_scores from staging in one transaction.
-- Call only on job success. Deletes existing post_scores for the config,
-- inserts from staging, then clears staging for this job.
CREATE OR REPLACE FUNCTION apply_post_scores_from_staging(
    p_job_id UUID,
    p_weight_config_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- All in one transaction: delete old, insert from staging, clear staging
    DELETE FROM post_scores
    WHERE weight_config_id = p_weight_config_id;

    INSERT INTO post_scores (post_id, weight_config_id, final_score, computed_at)
    SELECT post_id, weight_config_id, final_score, computed_at
    FROM post_scores_staging
    WHERE job_id = p_job_id;

    DELETE FROM post_scores_staging
    WHERE job_id = p_job_id;
END;
$$;
