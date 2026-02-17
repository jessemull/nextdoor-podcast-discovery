-- One-off: insert a failed scraper run for testing the Jobs page Retry UI.
-- Run in Supabase SQL Editor (or psql) when scraper_runs table exists.

INSERT INTO scraper_runs (id, run_at, status, feed_type, error_message)
VALUES (
  gen_random_uuid(),
  NOW() - INTERVAL '1 hour',
  'error',
  'recent',
  'Simulated failure for testing Retry button.'
);
