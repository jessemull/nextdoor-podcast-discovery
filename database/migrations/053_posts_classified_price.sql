-- Migration: Add classified_price to posts for classifieds
-- Run after 052_posts_rpc_post_type_filter.sql.
--
-- Stores price string (e.g. "Free", "$50") for classified/For Sale posts.
-- Null for standard posts.

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS classified_price TEXT;
