-- Migration: Add scoring counts to scraper_runs for Jobs visibility
-- Run this in Supabase SQL Editor after 068_get_score_distribution_search_path.sql

ALTER TABLE scraper_runs
    ADD COLUMN IF NOT EXISTS scoring_attempted_count INT,
    ADD COLUMN IF NOT EXISTS scoring_error_count INT,
    ADD COLUMN IF NOT EXISTS scoring_saved_count INT,
    ADD COLUMN IF NOT EXISTS scoring_skipped_count INT;
