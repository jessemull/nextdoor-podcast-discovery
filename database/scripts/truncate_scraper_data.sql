-- Wipe all post-related data for a clean scrape (no duplicates).
-- Run in Supabase SQL Editor when you want to re-scrape from scratch.
--
-- This truncates: post_scores, llm_scores, post_embeddings, posts (and any
-- other tables that reference posts). Sessions and neighborhoods are kept
-- so you stay logged in and neighborhood lookups still work.

TRUNCATE posts CASCADE;
