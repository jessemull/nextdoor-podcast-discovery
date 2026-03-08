-- Drop all application tables and functions so you can re-run database/bootstrap.sql on an existing project.
-- Use only when you want a full schema reset (e.g. fresh prod). Run in Supabase SQL Editor.
-- Order: drop tables first, then all custom functions (return-type changes require DROP before CREATE OR REPLACE).

DROP TABLE IF EXISTS post_scores_staging CASCADE;
DROP TABLE IF EXISTS post_scores CASCADE;
DROP TABLE IF EXISTS llm_scores CASCADE;
DROP TABLE IF EXISTS post_embeddings CASCADE;
DROP TABLE IF EXISTS rankings CASCADE;
DROP TABLE IF EXISTS background_jobs CASCADE;
DROP TABLE IF EXISTS scraper_runs CASCADE;
DROP TABLE IF EXISTS weight_configs CASCADE;
DROP TABLE IF EXISTS topic_frequencies CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS neighborhoods CASCADE;

-- Drop all custom functions in public schema (skip functions owned by extensions, e.g. vector).
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
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
  END LOOP;
END $$;
