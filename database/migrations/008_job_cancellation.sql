-- Migration: Job Cancellation Support
-- Run this in Supabase SQL Editor after 007_has_scores_optimization.sql
--
-- Adds support for cancelling pending and running background jobs.
-- Workers will check for cancellation status and stop processing gracefully.

-- ============================================================================
-- Step 1: Update background_jobs status constraint
-- ============================================================================

-- The status column already supports 'cancelled' as a valid value
-- (it's TEXT, not an enum). No schema change needed, but we'll add a check
-- constraint for clarity and data integrity.

-- Add check constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_background_jobs_status'
    ) THEN
        ALTER TABLE background_jobs
        ADD CONSTRAINT check_background_jobs_status
        CHECK (status IN ('pending', 'running', 'completed', 'error', 'cancelled'));
    END IF;
END $$;

-- ============================================================================
-- Step 2: Add cancelled_at timestamp
-- ============================================================================

ALTER TABLE background_jobs
ADD COLUMN cancelled_at TIMESTAMPTZ;

CREATE INDEX idx_background_jobs_cancelled ON background_jobs(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- ============================================================================
-- Step 3: Add cancelled_by field
-- ============================================================================

ALTER TABLE background_jobs
ADD COLUMN cancelled_by TEXT;

-- ============================================================================
-- Verification queries (run these to check the migration worked)
-- ============================================================================

-- Check constraint exists:
-- SELECT constraint_name FROM information_schema.table_constraints 
-- WHERE table_name = 'background_jobs' AND constraint_name = 'check_background_jobs_status';

-- Check columns exist:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'background_jobs' 
-- AND column_name IN ('cancelled_at', 'cancelled_by');
