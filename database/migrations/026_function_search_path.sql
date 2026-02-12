-- Migration: Set search_path on all functions (fix "Function Search Path Mutable" warnings)
-- Run this in Supabase SQL Editor after 025_enable_rls.sql
--
-- Supabase security scanner flags functions without an explicit search_path.
-- Setting search_path = public prevents search_path injection and ensures
-- consistent behavior. All functions reference only public schema objects.

-- ============================================================================
-- Functions with no arguments
-- ============================================================================

ALTER FUNCTION update_updated_at_column() SET search_path = public;
ALTER FUNCTION recount_topic_frequencies() SET search_path = public;
ALTER FUNCTION update_weight_config_has_scores() SET search_path = public;
ALTER FUNCTION get_embedding_backlog_count() SET search_path = public;

-- ============================================================================
-- Functions with arguments (signatures must match exactly)
-- ============================================================================

ALTER FUNCTION increment_topic_frequency(text, int) SET search_path = public;
ALTER FUNCTION get_unscored_posts(int) SET search_path = public;

-- get_posts_with_scores(uuid, int, int, double precision, text, boolean, uuid, boolean, double precision, text, int, boolean)
ALTER FUNCTION get_posts_with_scores(uuid, int, int, double precision, text, boolean, uuid, boolean, double precision, text, int, boolean) SET search_path = public;

-- get_posts_with_scores_count(uuid, double precision, text, boolean, uuid, boolean, double precision, int, boolean)
ALTER FUNCTION get_posts_with_scores_count(uuid, double precision, text, boolean, uuid, boolean, double precision, int, boolean) SET search_path = public;

-- get_posts_by_date(int, int, text, double precision, uuid, boolean, boolean, double precision, int, boolean)
ALTER FUNCTION get_posts_by_date(int, int, text, double precision, uuid, boolean, boolean, double precision, int, boolean) SET search_path = public;

-- get_posts_by_date_count(text, double precision, uuid, boolean, boolean, double precision, int, boolean)
ALTER FUNCTION get_posts_by_date_count(text, double precision, uuid, boolean, boolean, double precision, int, boolean) SET search_path = public;

-- search_posts_by_embedding(vector, double precision, int)
ALTER FUNCTION search_posts_by_embedding(vector, double precision, int) SET search_path = public;
