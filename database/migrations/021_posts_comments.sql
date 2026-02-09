-- Add comments JSONB to posts for scraper-extracted comment data
-- Run this in Supabase SQL Editor

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]';

COMMENT ON COLUMN posts.comments IS 'List of {author_name, text, timestamp_relative} from feed comment drawer';
