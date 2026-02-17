-- Migration: Scraper runs table for self-reported scrape outcomes
-- Run this in Supabase SQL Editor after 034_get_posts_without_embeddings.sql
--
-- The scraper inserts one row per run (success or failure) so the Jobs page
-- can show last N days of scrape runs without Healthchecks.io.

-- ============================================================================
-- Step 1: Create scraper_runs table
-- ============================================================================

CREATE TABLE scraper_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('completed', 'error')),
    feed_type TEXT NOT NULL CHECK (feed_type IN ('recent', 'trending')),
    error_message TEXT
);

CREATE INDEX idx_scraper_runs_run_at ON scraper_runs(run_at DESC);

COMMENT ON TABLE scraper_runs IS 'Self-reported scrape run outcomes from the scraper pipeline (one row per run).';

-- ============================================================================
-- RLS: no policies for anon/authenticated (service role bypasses RLS)
-- ============================================================================

ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;
