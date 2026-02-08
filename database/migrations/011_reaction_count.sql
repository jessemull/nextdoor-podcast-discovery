-- Migration: Add reaction_count to posts table
-- Run this in Supabase SQL Editor after 010_neighborhood_filter.sql
--
-- Stores engagement metric from Nextdoor (reactions/likes) for potential ranking use.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS reaction_count INT DEFAULT 0;
