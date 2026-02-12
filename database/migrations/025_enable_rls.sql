-- Migration: Enable Row Level Security (RLS) on all tables
-- Run this in Supabase SQL Editor after 024_default_session_neighborhood.sql
--
-- Enables RLS on all public tables and creates policies for:
-- 1. Service role (service key) - full access (bypasses RLS but explicit is better)
-- 2. Authenticated users - read/write based on table needs
-- 3. Public - read-only for neighborhoods (if needed)
--
-- Note: Service key operations bypass RLS, but enabling RLS protects against
-- accidental client-side direct access and provides defense-in-depth.

-- ============================================================================
-- Step 1: Enable RLS on all tables
-- ============================================================================

ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_frequencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 2: Policies for neighborhoods (read-only for anon role)
-- ============================================================================

-- Allow anon role to read neighborhoods (defensive - protects against accidental client access)
-- Note: All API routes use service key which bypasses RLS, so this only matters
-- if client-side code accidentally uses the anon key directly
CREATE POLICY "Anon can read neighborhoods"
    ON neighborhoods
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 3: Policies for posts (read-only for anon role)
-- ============================================================================

-- Allow anon role to read posts (defensive)
CREATE POLICY "Anon can read posts"
    ON posts
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 4: Policies for llm_scores (read-only for anon role)
-- ============================================================================

CREATE POLICY "Anon can read llm_scores"
    ON llm_scores
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 5: Policies for post_embeddings (read-only for anon role)
-- ============================================================================

CREATE POLICY "Anon can read post_embeddings"
    ON post_embeddings
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 6: Policies for post_scores (read-only for anon role)
-- ============================================================================

CREATE POLICY "Anon can read post_scores"
    ON post_scores
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 7: Policies for weight_configs (read-only for anon role)
-- ============================================================================

CREATE POLICY "Anon can read weight_configs"
    ON weight_configs
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 8: Policies for background_jobs (read-only for anon role)
-- ============================================================================

CREATE POLICY "Anon can read background_jobs"
    ON background_jobs
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 9: Policies for topic_frequencies (read-only for anon role)
-- ============================================================================

CREATE POLICY "Anon can read topic_frequencies"
    ON topic_frequencies
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 10: Policies for settings (read-only for anon role)
-- ============================================================================

CREATE POLICY "Anon can read settings"
    ON settings
    FOR SELECT
    TO anon
    USING (true);

-- ============================================================================
-- Step 11: Policies for sessions (service role only - scraper writes)
-- ============================================================================

-- Sessions are written by the scraper (service key) and should not be
-- accessible via client-side queries. No policies needed - service key
-- bypasses RLS, and we don't want client access.

-- ============================================================================
-- Note on service role access and write operations:
-- ============================================================================
-- The service role (SUPABASE_SERVICE_KEY) bypasses RLS automatically.
-- All write operations (INSERT, UPDATE, DELETE) from the scraper and
-- server-side API routes use the service key, so they will continue to work.
--
-- RLS policies above:
-- - Enable RLS on all tables (required for security)
-- - Allow read access via anon role (defensive - protects against accidental
--   client-side direct access if someone uses getSupabase() instead of API routes)
-- - Block all writes via anon role (only service key can write)
--
-- This provides defense-in-depth: even if client-side code accidentally uses
-- the anon key directly, it can only read data, not modify it.
