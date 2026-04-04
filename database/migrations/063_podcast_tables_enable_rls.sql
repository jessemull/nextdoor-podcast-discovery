-- Migration: Enable RLS on podcast tables (Supabase Security Advisor)
-- Run in Supabase SQL Editor after 062 (or latest prior migration).
--
-- Fixes "RLS Disabled in Public" for podcast_settings, podcast_categories,
-- podcast_episodes, episode_categories, episode_embeddings.
--
-- No GRANT changes: the app reads/writes these tables only with the service role
-- (getSupabaseAdmin), which bypasses RLS. Public podcast pages use RPCs via that
-- client. Anon/authenticated direct table access stays denied (defense in depth),
-- same pattern as sessions in 025_enable_rls.sql.

ALTER TABLE episode_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_settings ENABLE ROW LEVEL SECURITY;
