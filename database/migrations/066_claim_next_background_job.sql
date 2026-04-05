-- Migration: Atomic claim for background_jobs (multi-worker safe)
-- Run in Supabase SQL Editor after 065 (or latest prior migration).
--
-- Replaces SELECT pending + UPDATE running (race between workers) with a single
-- transaction: lock one row with FOR UPDATE SKIP LOCKED, then set running.

CREATE OR REPLACE FUNCTION claim_next_background_job(p_job_types text[])
RETURNS SETOF background_jobs
LANGUAGE sql
SET search_path = public
AS $$
  WITH picked AS (
    SELECT id
    FROM background_jobs
    WHERE status = 'pending'
      AND type = ANY(p_job_types)
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE background_jobs AS b
  SET
    started_at = now(),
    status = 'running',
    updated_at = now()
  FROM picked
  WHERE b.id = picked.id
  RETURNING b.*;
$$;

REVOKE ALL ON FUNCTION claim_next_background_job(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_background_job(text[]) TO service_role;
