-- Migration: Set search_path on feed RPCs (Supabase Security Advisor)
-- Run after 063_podcast_tables_enable_rls.sql (or latest prior migration).
--
-- Fixes "Function Search Path Mutable" for feed RPCs. Uses the catalog to ALTER
-- every overload of these names that exists (signatures differ across migration
-- history; hard-coded ALTER FUNCTION fails if 062 has not been applied yet).
--
-- Skips functions owned by extensions (same pattern as 044_security_advisor_fixes.sql).

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
      AND p.proname IN (
        'get_posts_by_date',
        'get_posts_by_date_count',
        'get_posts_with_runtime_scores',
        'get_posts_with_runtime_scores_count',
        'get_posts_with_scores',
        'get_posts_with_scores_count'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid
          AND d.classid = 'pg_proc'::regclass
          AND d.refclassid = 'pg_extension'::regclass
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public',
      r.nspname,
      r.proname,
      r.args
    );
  END LOOP;
END $$;
