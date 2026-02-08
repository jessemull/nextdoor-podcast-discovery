-- Migration: Add full-text search support for keyword search
-- Run this in Supabase SQL Editor after 014_episode_date_filter.sql
--
-- Adds ts_vector column and GIN index for full-text search on post text.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS text_search tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_posts_text_search ON posts USING GIN(text_search);
