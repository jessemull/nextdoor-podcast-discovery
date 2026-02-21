-- Normalize settings.picks_defaults to only { "picks_min": number }.
-- Drops deprecated picks_limit and picks_min_podcast from existing rows.
-- Run after deploying the app change that removed those fields from the UI/API.

UPDATE settings
SET value = jsonb_build_object(
  'picks_min',
  COALESCE(
    (value->>'picks_min')::numeric,
    7
  )
)
WHERE key = 'picks_defaults'
  AND value IS NOT NULL
  AND jsonb_typeof(value) = 'object';
