-- Migration: Allow feed_type 'nearby' in scraper_runs
-- Run this in Supabase SQL Editor after 048_scraper_runs_feed_type_for_you.sql
--
-- The scraper now supports the "Nearby" feed; add it to the check constraint.

ALTER TABLE scraper_runs
    DROP CONSTRAINT IF EXISTS scraper_runs_feed_type_check;

ALTER TABLE scraper_runs
    ADD CONSTRAINT scraper_runs_feed_type_check
    CHECK (feed_type IN ('for_you', 'nearby', 'recent', 'trending'));
