-- Migration: Default session neighborhood and sessions unique constraint
-- Run this in Supabase SQL Editor after 023_posts_ignored.sql
--
-- Sessions table uses neighborhood_id UUID REFERENCES neighborhoods(id). The scraper
-- stores one "default" session when no specific neighborhood is selected. This
-- migration:
-- 1. Inserts a reserved "Default" neighborhood with a fixed UUID so the scraper
--    can store the default session (see SessionManager.DEFAULT_SESSION_ID in code).
-- 2. Adds a unique index on sessions(neighborhood_id) so upsert on_conflict
--    works and we keep at most one session per neighborhood.

-- ============================================================================
-- Step 1: Default neighborhood for scraper session storage
-- ============================================================================

INSERT INTO neighborhoods (id, name, slug, is_active, weight_modifier)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default',
    'default',
    true,
    1.0
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Step 2: Unique index on sessions(neighborhood_id) for upsert
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_neighborhood_id
    ON sessions (neighborhood_id);
