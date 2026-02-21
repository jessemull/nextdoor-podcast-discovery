-- Reset database to a clean state. Run in Supabase SQL Editor.
--
-- 1. Wipes all data (posts, scores, sessions, etc.).
-- 2. Re-inserts Default neighborhood (scraper needs this for sessions).
-- 3. Re-inserts Default weight config + settings (feed needs this; scraper writes
--    post_scores for this config when it saves llm_scores).
--
-- Then run the scraper. Posts will show in the UI.

TRUNCATE
  post_scores,
  llm_scores,
  post_embeddings,
  posts,
  background_jobs,
  sessions,
  topic_frequencies,
  weight_configs,
  settings,
  neighborhoods
  RESTART IDENTITY
  CASCADE;

-- Re-insert the Default neighborhood so session storage works (matches 024).
INSERT INTO neighborhoods (id, name, slug, is_active, weight_modifier)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default',
  'default',
  true,
  1.0
)
ON CONFLICT (id) DO NOTHING;

-- Re-create default weight config and set as active (fixes "No weight configs found").
-- Feed and Settings need this; post_scores stay empty until the worker runs a recompute job.
WITH default_config AS (
  INSERT INTO weight_configs (weights, name, is_active, description)
  VALUES (
    '{"absurdity": 2.5, "discussion_spark": 1.0, "drama": 1.5, "emotional_intensity": 1.2, "news_value": 1.0, "podcast_worthy": 2.5, "readability": 1.2}'::jsonb,
    'Default',
    true,
    'Default weights after full wipe'
  )
  RETURNING id
)
INSERT INTO settings (key, value)
SELECT 'active_weight_config_id', to_jsonb(id::text)
FROM default_config
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (key, value)
VALUES (
  'ranking_weights',
  '{"absurdity": 2.5, "discussion_spark": 1.0, "drama": 1.5, "emotional_intensity": 1.2, "news_value": 1.0, "podcast_worthy": 2.5, "readability": 1.2}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
