-- Migration: Background Jobs Table
-- Run this in Supabase SQL Editor after 003_semantic_search.sql
--
-- Creates a generic background_jobs table for tracking long-running tasks
-- like recomputing final scores, recounting topic frequencies, etc.

-- ============================================================================
-- Step 1: Create background_jobs table
-- ============================================================================

CREATE TABLE background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,            -- e.g. 'recompute_final_scores'
    status TEXT NOT NULL,          -- 'pending' | 'running' | 'completed' | 'error' | 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by TEXT,               -- user email/id (from NextAuth)
    params JSONB,                  -- e.g. { "weights": { ... } }
    progress INTEGER,              -- 0–100 or records processed
    total INTEGER,                 -- total records to process (optional)
    error_message TEXT,            -- error details when status = 'error'
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient job queries
CREATE INDEX idx_background_jobs_type_status ON background_jobs(type, status);
CREATE INDEX idx_background_jobs_status ON background_jobs(status);
CREATE INDEX idx_background_jobs_created ON background_jobs(created_at DESC);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_background_jobs_updated_at
    BEFORE UPDATE ON background_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Step 2: Add search_defaults to settings (if not exists)
-- ============================================================================

INSERT INTO settings (key, value) VALUES 
    ('search_defaults', '{
        "similarity_threshold": 0.2
    }')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- Verification queries (run these to check the migration worked)
-- ============================================================================

-- Check table exists:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'background_jobs';

-- Check settings:
-- SELECT * FROM settings WHERE key IN ('ranking_weights', 'search_defaults');
