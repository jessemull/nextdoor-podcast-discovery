-- Migration: Job Retry Support
-- Run this in Supabase SQL Editor after 008_job_cancellation.sql
--
-- Adds support for automatic retry of failed jobs with configurable max retries.
-- Workers will automatically retry transient failures up to max_retries times.

-- ============================================================================
-- Step 1: Add retry_count column
-- ============================================================================

ALTER TABLE background_jobs
ADD COLUMN retry_count INTEGER DEFAULT 0;

CREATE INDEX idx_background_jobs_retry ON background_jobs(retry_count) WHERE retry_count > 0;

-- ============================================================================
-- Step 2: Add max_retries column (optional, can be set per job type)
-- ============================================================================

ALTER TABLE background_jobs
ADD COLUMN max_retries INTEGER DEFAULT 3;

-- ============================================================================
-- Step 3: Add last_retry_at timestamp
-- ============================================================================

ALTER TABLE background_jobs
ADD COLUMN last_retry_at TIMESTAMPTZ;

-- ============================================================================
-- Verification queries (run these to check the migration worked)
-- ============================================================================

-- Check columns exist:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'background_jobs' 
-- AND column_name IN ('retry_count', 'max_retries', 'last_retry_at');
