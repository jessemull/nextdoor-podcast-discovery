-- Add poster display name to posts (from scraper author_name).
-- Existing rows will have NULL; new scrapes will populate it.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS author_name TEXT;

COMMENT ON COLUMN posts.author_name IS 'Display name of the post author from Nextdoor (scraper author_name).';
