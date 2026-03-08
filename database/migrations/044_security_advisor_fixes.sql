-- Migration: Fix Supabase Security Advisor — RLS and function search_path
-- Run in Supabase SQL Editor.
--
-- 1. Ensures RLS is enabled on post_scores_staging (fixes "RLS Disabled in Public" error).
-- 2. Sets search_path = public on all custom functions (fixes "Function Search Path Mutable" warnings).
--    Skips functions owned by extensions (e.g. vector).

-- ============================================================================
-- 1. RLS on post_scores_staging (idempotent)
-- ============================================================================

ALTER TABLE post_scores_staging ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Set search_path on all custom functions (exclude extension-owned)
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid
          AND d.classid = 'pg_proc'::regclass
          AND d.refclassid = 'pg_extension'::regclass
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', r.nspname, r.proname, r.args);
  END LOOP;
END $$;
