-- Migration: Drop broad anon SELECT policies (defense in depth)
-- Run in Supabase SQL Editor after 064 (or latest prior migration).
--
-- The web app and scraper use SUPABASE_SERVICE_KEY for all post/dashboard data
-- (PostgREST bypasses RLS for the service role). The browser Supabase client is
-- used only for Auth (sign-in, MFA, password reset), not for querying posts,
-- embeddings, scores, or jobs.
--
-- Removing these policies prevents unauthenticated callers who know
-- NEXT_PUBLIC_SUPABASE_ANON_KEY from reading sensitive tables via the REST API.
-- RLS remains enabled; service role and SECURITY DEFINER RPCs used with the
-- service role are unchanged.

DROP POLICY IF EXISTS "Anon can read background_jobs" ON background_jobs;

DROP POLICY IF EXISTS "Anon can read llm_scores" ON llm_scores;

DROP POLICY IF EXISTS "Anon can read neighborhoods" ON neighborhoods;

DROP POLICY IF EXISTS "Anon can read post_embeddings" ON post_embeddings;

DROP POLICY IF EXISTS "Anon can read post_scores" ON post_scores;

DROP POLICY IF EXISTS "Anon can read posts" ON posts;

DROP POLICY IF EXISTS "Anon can read settings" ON settings;

DROP POLICY IF EXISTS "Anon can read topic_frequencies" ON topic_frequencies;

DROP POLICY IF EXISTS "Anon can read weight_configs" ON weight_configs;
