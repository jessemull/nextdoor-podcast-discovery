-- Migration: Add saved/starred flag to posts
-- Run this in Supabase SQL Editor after 011_reaction_count.sql
--
-- Allows users to save posts for later review (separate from used_on_episode).

ALTER TABLE posts ADD COLUMN IF NOT EXISTS saved BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_saved ON posts(saved) WHERE saved = true;
