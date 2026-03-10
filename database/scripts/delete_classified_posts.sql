-- One-off repair script: delete mis-scraped classifieds / For Sale posts.
-- These rows were created when the scraper captured the read-only banner text
-- instead of the actual post content, resulting in posts whose text is:
--
--   "Commenting is disabled because you are in read-only mode."
--
-- Run this script in the Supabase SQL Editor for the target project (e.g. prod)
-- AFTER confirming that all matching rows are indeed bad data.
--
-- Step 1: Preview rows that will be deleted

SELECT
    id,
    neighborhood_id,
    url,
    reaction_count,
    comment_count,
    created_at
FROM posts
WHERE text = 'Commenting is disabled because you are in read-only mode.';

-- Step 2: Delete the bad rows (uncomment when ready)
-- NOTE: llm_scores, post_scores, and other tables reference posts(id)
--       with ON DELETE CASCADE, so related rows will be removed
--       automatically when these posts are deleted.

-- DELETE FROM posts
-- WHERE text = 'Commenting is disabled because you are in read-only mode.';

