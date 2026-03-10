-- Migration: Add post_type to posts for classifieds support
-- Run this in Supabase SQL Editor after 050_recount_topic_frequencies_where_clause.sql
--
-- Adds a simple discriminator so the application can distinguish between
-- standard neighborhood discussion posts and classifieds / For Sale posts.

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS post_type TEXT
    CHECK (post_type IN ('standard', 'classified'))
    DEFAULT 'standard';

