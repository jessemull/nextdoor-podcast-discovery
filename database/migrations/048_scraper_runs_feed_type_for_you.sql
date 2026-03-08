-- Migration: Allow feed_type 'for_you' in scraper_runs
-- Run this in Supabase SQL Editor after 047_search_function_extensions_vector.sql
--
-- The scraper now supports the default "For you" feed; add it to the check constraint.

ALTER TABLE scraper_runs
    DROP CONSTRAINT IF EXISTS scraper_runs_feed_type_check;

ALTER TABLE scraper_runs
    ADD CONSTRAINT scraper_runs_feed_type_check
    CHECK (feed_type IN ('for_you', 'recent', 'trending'));
