-- Add comment_count to posts table (UI value from comment icon on card)
-- Run this in Supabase SQL Editor after 042_enable_rls_post_scores_staging.sql
--
-- Used to detect scraping gaps: compare to len(comments); log warning when mismatch.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT NULL;

COMMENT ON COLUMN posts.comment_count IS 'Comment count from feed card UI (comment icon); used to detect scraping gaps vs len(comments).';
