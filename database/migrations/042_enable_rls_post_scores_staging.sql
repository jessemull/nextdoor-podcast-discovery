-- Migration: Enable RLS on post_scores_staging
-- Run after 041_runtime_scores_p_weights.sql
--
-- post_scores_staging is written only by the worker (service role) during
-- recompute jobs. Enabling RLS keeps defense-in-depth consistent with
-- other tables; no anon/authenticated policies (service role bypasses RLS).

-- ============================================================================
-- RLS: no policies for anon/authenticated (service role bypasses RLS)
-- ============================================================================

ALTER TABLE post_scores_staging ENABLE ROW LEVEL SECURITY;
